// ============================================================
// CADASA TALLER — OT WORK ORDERS STORE
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

  // ── Obtener OTs de una OM ────────────────────────────────
  /**
   * Devuelve las OTs de una OM. Si no están en caché las genera (mock)
   * o las busca en Sheets si el usuario está autenticado.
   * @param {string}  omId
   * @param {object}  omRow   — fila completa de la OM (para el mock)
   * @param {boolean} authenticated
   */
  async function getForOM(omId, omRow, authenticated) {
    const key = String(omId);

    if (_cache.has(key)) return _cache.get(key);

    let ots;
    if (authenticated) {
      try {
        ots = await fetchFromSheets(omId);
      } catch (err) {
        console.warn('[OTWorkStore] Sheets falló, usando mock:', err.message);
        ots = MockOTService.generateForOM(omRow);
      }
    } else {
      ots = MockOTService.generateForOM(omRow);
    }

    _cache.set(key, ots);
    return ots;
  }

  // ── Fetch de Google Sheets ───────────────────────────────
  // CONFIGURAR: ID del spreadsheet y nombre de la hoja de OTs
  const SHEET_ID   = 'TU_SHEET_ID_AQUI';
  const SHEET_NAME = 'Ordenes_Trabajo';

  async function fetchFromSheets(omId) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const all  = parseCSV(text);
    return all.filter(r => String(r.ID_OrdenMant) === String(omId));
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
      const c = splitLine(line);
      return {
        ID_RowNumber:  clean(c[0]),
        ID_OrdenMant:  clean(c[1]),
        Area:          clean(c[2]),
        ID_EQUIPO:     clean(c[3]),
        ITEM:          clean(c[4]),
        Sistema:       clean(c[5]),
        Descripcion:   clean(c[6]),
        Fecha:         clean(c[7]),
        ID_Mecanico:   clean(c[8]),
        EquipoTrabajo: clean(c[9]),
        Duracion:      parseFloat(clean(c[10])) || 0,
        Estatus:       clean(c[11]),
        Retraso:       parseFloat(clean(c[12])) || 0,
        Causa:         clean(c[13]),
        Comentario:    clean(c[14]),
        Semana:        parseInt(clean(c[15])) || null,
        Cantidad:      parseInt(clean(c[16])) || 1,
      };
    }).filter(r => r.ID_OrdenMant);
  }

  function splitLine(line) {
    const res = []; let cur = ''; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { res.push(cur); cur = ''; continue; }
      cur += ch;
    }
    res.push(cur);
    return res;
  }

  function clean(v) { return (v ?? '').trim(); }

  // ── KPIs de una lista de OTs ─────────────────────────────
  function calcKPIs(ots) {
    const total     = ots.length;
    const counts    = { 'Concluida':0, 'En Proceso':0, 'Programado':0, 'Detenido':0 };
    let   horasTotal = 0;
    let   horasRetraso = 0;
    const mecanicos  = new Set();

    ots.forEach(ot => {
      counts[ot.Estatus] = (counts[ot.Estatus] ?? 0) + 1;
      horasTotal   += ot.Duracion   || 0;
      horasRetraso += ot.Retraso    || 0;
      if (ot.ID_Mecanico) mecanicos.add(ot.ID_Mecanico);
    });

    const pctConcluida = total > 0 ? Math.round((counts['Concluida'] / total) * 100) : 0;

    return { total, counts, horasTotal, horasRetraso, mecanicos: mecanicos.size, pctConcluida };
  }

  /**
   * Calcula avance general por equipo usando todas las OMs
   * @param {object[]} allOMs  — todas las órdenes de mantenimiento
   * @returns {object[]}  — [{ equipoId, item, total, concluidas, pct }]
   */
  function calcEquipoAvance(allOMs) {
    const map = {};
    allOMs.forEach(om => {
      const key = om.ID_EQUIPO;
      if (!map[key]) map[key] = { equipoId: om.ID_EQUIPO, item: om.ITEM, area: om.Area, total: 0, concluidas: 0 };
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

  return { getForOM, calcKPIs, calcEquipoAvance, subscribe };
})();

window.OTWorkStore = OTWorkStore;
