/**
 * HorasStore — Capa de datos para el módulo de Horas Asignadas.
 * Lee ORDEN_TRABAJO + MECANICOS + ORDEN_MANTENIMIENTO + OM_SG.
 * No tiene estado UI; sólo fetching y transformaciones puras.
 */
const HorasStore = (() => {

  // ─── Cache ───────────────────────────────────────────────
  let _cache    = null;
  let _loading  = false;
  let _listeners = [];

  // ─── Constantes de áreas ─────────────────────────────────
  const AREAS = [
    'Cosecha Agricola',
    'Cosecha Mecanizada',
    'Engrase',
    'Equipo Pesado',
    'Mecanica de Transporte',
    'Servicios Generales',
    'TEST',
  ];

  // ─── Helpers ─────────────────────────────────────────────
  function _notify(data) {
    _listeners.forEach(fn => fn(data));
  }

  function _parseHoras(val) {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  function _fechaInicioSemanas(semanasAtras) {
    const hoy   = new Date();
    const dia   = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // lunes = 0
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - dia - semanasAtras * 7);
    lunes.setHours(0, 0, 0, 0);
    return lunes.toISOString();
    }

  /**
   * Fetch principal: trae OTs con joins de mecánico + origen (OM o SG).
   * Filtra por área del usuario si no es ALL.
   */
  async function fetchAll(userArea) {
    if (_loading) return _cache;
    _loading = true;

    try {
      const sb = window.SupabaseClient;
      const fechaDesde = _fechaInicioSemanas(1);

      // Base query: OT + mecánico + orden mantenimiento + sg
      let query = sb
        .from('ORDEN_TRABAJO')
        .select(`
          ID_OT,
          id_om,
          id_sg,
          Fecha,
          "Duración (horas)",
          Estatus,
          "Retraso (horas)",
          Semana,
          Causa,
          Comentario,
          Observaciones,
          MECANICOS!ORDEN_TRABAJO_ID_Mecanico_fkey (
            id,
            NOMBRE,
            AREA
          ),
          ORDEN_MANTENIMIENTO!ot_id_om_fkey (
            "ID_Orden mantenimiento",
            "Descripcion",
            "Área"
          ),
          OM_SG!OT_id_sg_fkey (
            id_sg,
            tipo_trabajo,
            "Observaciones",

            ORDEN_MANTENIMIENTO!om_servicios_generales_id_orden_base_fkey (
              "ID_Orden mantenimiento",
              "Descripcion",
              "Área"
            )
          )
        `)
        .gte('Fecha', fechaDesde)
        .order('Fecha', { ascending: false });

      // Filtro por área si no es administrador ALL
      if (userArea && userArea !== 'ALL') {
        if (userArea === 'SERVICIOS GENERALES') {
          // SG: sólo OTs con id_sg
          query = query.not('id_sg', 'is', null);
        } else {
          // Área normal: filtra por área del mecánico
          // Supabase no permite filtros en foreign tables directamente en .filter,
          // así que traemos todo y filtramos en JS para simplicidad.
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Normalizar rows
      const rows = (data || []).map(row => {
      const mec = row.MECANICOS || {};
      const omDirect = row.ORDEN_MANTENIMIENTO || null;
      const sg = row.OM_SG || null;

      // 🔥 OM final (puede venir directa o desde SG)
      const om = omDirect || sg?.ORDEN_MANTENIMIENTO || null;

      const isOM = !!omDirect;
      const isSG = !!sg;

      return {
        id: row.ID_OT,
        id_om: row.id_om,
        id_sg: row.id_sg,

        fecha: row.Fecha,
        semana: row.Semana || _semanaDeDate(row.Fecha),

        horas: _parseHoras(row['Duración (horas)']),
        retraso: _parseHoras(row['Retraso (horas)']),

        estatus: row.Estatus || '—',
        causa: row.Causa || '',
        comentario: row.Comentario || '',
        observaciones: row.Observaciones || '',

        // 🔧 MECÁNICO
        mecId: mec.id,
        mecNombre: (mec.NOMBRE || '').trim(),
        mecArea: mec.AREA || '',

        // 🔥 ORIGEN REAL
        origen: isOM ? 'OM' : 'SG',

        origenRef: isOM
          ? omDirect?.['ID_Orden mantenimiento']
          : sg?.id_sg,

        // 🔥 DESCRIPCIÓN UNIFICADA
        descripcion:
          om?.Descripcion ||              // fallback SG
          sg?.Observaciones ||              // fallback SG
          '',

        // 🔥 ÁREA UNIFICADA (MEJORADO)
        area:
          om?.['Área'] ||                   // prioridad OM
          mec.AREA ||                      // fallback mecánico
          '',

        // 🔥 EXTRA (muy útil)
        tipoTrabajo: sg?.tipo_trabajo || null
      };
    });

      // Filtro JS por área si no ALL
      let filtered = rows;
      if (userArea && userArea.toUpperCase()!== 'ALL' && userArea.toUpperCase() !== 'SERVICIOS GENERALES') {
        const uArea = userArea.trim().toLowerCase();
        filtered = rows.filter(r => r.mecArea.trim().toLowerCase() === uArea);
      }

      _cache = filtered;
      _notify(filtered);
      return filtered;

    } catch (err) {
      console.error('[HorasStore] Error fetching:', err);
      _notify([]);
      return [];
    } finally {
      _loading = false;
    }
  }

  /** Genera "YYYY-WNN" a partir de una fecha ISO si Semana viene vacío */
  function _semanaDeDate(fechaStr) {
    if (!fechaStr) return '—';
    const d    = new Date(fechaStr);
    const year = d.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${year}-S${String(week).padStart(2, '0')}`;
  }

  /**
   * Agrupa un array de OTs normalizado.
   * groupBy: 'semana' | 'estatus' | 'area' | 'dia'
   */
  function group(rows, groupBy, isAdmin = false) {
    const map = new Map();

    rows.forEach(r => {
        let key;
        switch (groupBy) {
        case 'semana':  key = r.semana;  break;
        case 'estatus': key = r.estatus; break;
        case 'area':    key = r.area || r.mecArea || 'Sin área'; break;
        case 'dia':     key = r.fecha ? r.fecha.slice(0, 10) : '—'; break;
        default:        key = 'Todo';
        }

        if (!map.has(key)) map.set(key, { key, rows: [], totalHoras: 0, totalRetraso: 0, subGroups: null });
        const g = map.get(key);
        g.rows.push(r);
        g.totalHoras   += r.horas;
        g.totalRetraso += r.retraso;
    });

    const grupos = [...map.values()].sort((a, b) => {
        if (groupBy === 'semana' || groupBy === 'dia') return b.key.localeCompare(a.key);
        return a.key.localeCompare(b.key);
    });

    // Sub-agrupación por área dentro de cada día — solo para admin
    if (groupBy === 'dia' && isAdmin) {
        grupos.forEach(g => {
        const subMap = new Map();
        g.rows.forEach(r => {
            const areaKey = r.id_sg != null
            ? 'Servicios Generales'
            : (r.area || r.mecArea || 'Sin área');
            if (!subMap.has(areaKey)) subMap.set(areaKey, { key: areaKey, rows: [], totalHoras: 0, totalRetraso: 0 });
            const sg = subMap.get(areaKey);
            sg.rows.push(r);
            sg.totalHoras   += r.horas;
            sg.totalRetraso += r.retraso;
        });
        g.subGroups = [...subMap.values()].sort((a, b) => a.key.localeCompare(b.key));
        });
    }

    return grupos;
    }

  /** Filtro por texto de mecánico */
  function filterByMecanico(rows, query) {
    if (!query || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter(r => r.mecNombre.toLowerCase().includes(q));
  }

  function getCache()  { return _cache; }
  function subscribe(fn) { _listeners.push(fn); return () => { _listeners = _listeners.filter(f => f !== fn); }; }
  function invalidate() { _cache = null; }

  return { fetchAll, group, filterByMecanico, getCache, subscribe, invalidate, AREAS };
})();

window.HorasStore = HorasStore;