// ============================================================
// CADASA TALLER — OT WORK ORDERS STORE (Supabase)  (v4.2)
// Gestiona las Órdenes de Trabajo (hijas de las OMs)
// ============================================================

const OTWorkStore = (() => {

  // Caché: Map<ID_OrdenMant → OT[]>
  let _cache     = new Map();
  let _listeners = [];

  // ── Suscripción ─────────────────────────────────────────
  function subscribe(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }
  function notify(omId) {
    _listeners.forEach(fn => fn(omId));
  }

  // ── Mapear fila de Supabase al formato interno ───────────
  function _mapRow(row) {
    // Fecha: convertir timestamp a yyyy-MM-dd sin depender de locale
    let fechaDisplay = row['Fecha'] ?? '';
    if (fechaDisplay && fechaDisplay.length > 10) {
      fechaDisplay = fechaDisplay.slice(0, 10);   // 'yyyy-MM-dd'
    }

    return {
      ID_RowNumber:  row['ID_OT']                        ?? '',
      ID_OrdenMant:  row['ID_Orden mantenimiento']       ?? '',
      ID_Mecanico:   row['ID_Mecanico']                  ?? '',
      EquipoTrabajo: row['Equipo de trabajo']            ?? '',
      Fecha:         fechaDisplay,
      Duracion:      parseFloat(row['Duración (horas)']) || 0,
      Estatus:       row['Estatus']                      ?? 'Retrasado',
      Retraso:       parseFloat(row['Retraso (horas)'])  || 0,
      Causa:         row['Causa']                        ?? '',
      Comentario:    row['Comentario']                   ?? '',
      Semana:        row['Semana'] ? (parseInt(row['Semana']) || null) : null,
    };
  }

  // ── Fetch desde Supabase ─────────────────────────────────
  async function _fetchFromSupabase(omId) {
    const db = window.SupabaseClient;

    const { data, error } = await db
      .from('ORDEN_TRABAJO')
      .select('*')
      .eq('ID_Orden mantenimiento', String(omId));

    if (error) throw new Error(error.message);

    return (data || []).map(_mapRow);
  }

  // ── Obtener OTs de una OM ────────────────────────────────
  async function getForOM(omId, omRow, authenticated) {
    const key = String(omId);

    if (_cache.has(key)) return _cache.get(key);

    let ots;
    try {
      ots = await _fetchFromSupabase(omId);
    } catch (err) {
      console.warn('[OTWorkStore] Supabase falló, usando mock:', err.message);
      ots = typeof MockOTService !== 'undefined'
        ? MockOTService.generateForOM(omRow)
        : [];
    }

    _cache.set(key, ots);
    return ots;
  }

  function getOTsByOM(omId) {
    return _cache.get(String(omId)) || [];
  }

  // ── KPIs de una lista de OTs ─────────────────────────────
  function calcKPIs(ots) {
    const total  = ots.length;
    const counts = { 'Concluida': 0, 'En Proceso': 0, 'Retrasado': 0, 'Ausencia': 0 };
    let   horasTotal   = 0;
    let   horasRetraso = 0;
    const mecanicos    = new Set();

    ots.forEach(ot => {
      counts[ot.Estatus] = (counts[ot.Estatus] ?? 0) + 1;
      horasTotal    += ot.Duracion || 0;
      horasRetraso  += ot.Retraso  || 0;
      if (ot.ID_Mecanico) mecanicos.add(ot.ID_Mecanico);
    });

    const pctConcluida = total > 0
      ? Math.round((counts['Concluida'] / total) * 100)
      : 0;

    return { total, counts, horasTotal, horasRetraso, mecanicos: mecanicos.size, pctConcluida };
  }

  // ── Avance general por equipo ────────────────────────────
  function calcEquipoAvance(allOMs) {
    const map = {};
    allOMs.forEach(om => {
      const key = om.ID_EQUIPO;
      if (!map[key]) {
        map[key] = { equipoId: om.ID_EQUIPO, item: om.ITEM, area: om.Area, total: 0, concluidas: 0 };
      }
      map[key].total++;
      const st = (om.Estatus || '').toLowerCase();
      if (st === 'completado' || st === 'concluida' || st === 'concluido') {
        map[key].concluidas++;
      }
    });

    return Object.values(map).map(e => ({
      ...e,
      pct: e.total > 0 ? Math.round((e.concluidas / e.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }

  // ── Limpiar caché ────────────────────────────────────────
  function clearCache() {
    _cache.clear();
  }

  return {
    getForOM, getOTsByOM,
    calcKPIs, calcEquipoAvance,
    subscribe, clearCache,
    _getCache: () => _cache,
    _notify:   notify,
    _mapRow:   _mapRow,
  };
})();

window.OTWorkStore = OTWorkStore;