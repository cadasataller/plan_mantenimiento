/**
 * DashboardStore — versión con supabase.from().select()
 */
const DashboardStore = (() => {
  let _data = null;
  let _loading = false;
  let _listeners = [];
  let _filters = { etapa: [], area: [], item: [], equipo: [] };
  let _userArea = null;

  const supabase = window.SupabaseClient; // ← asegúrate de tenerlo inicializado

  // ── pub/sub ──────────────────────────────────────────────
  function subscribe(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }

  function _emit(event, payload) {
    _listeners.forEach(l => {
      try { l(event, payload); } catch (e) {}
    });
  }

  // ── Carga de datos (CON SELECT) ──────────────────────────
  async function load(forceReload = false) {
  if (_data && !forceReload) {
    _emit('ready', getFiltered());
    return;
  }

  if (_loading) return;

  _loading = true;
  _emit('loading');

  try {
    const pageSize = 1000;
    let from = 0;
    let allOMs = [];

    while (true) {
      const { data, error } = await supabase
        .from('ORDEN_MANTENIMIENTO')
        .select('*')
        .eq('IS_SG', false)
        .not('ID_Orden mantenimiento', 'like', 'SG%')
        .not('ID_Orden mantenimiento', 'like', 'OM-TEST%')
        .order('ID_Orden mantenimiento', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      allOMs = allOMs.concat(data || []);

      if (!data || data.length < pageSize) break;

      from += pageSize;
    }

    // ⛔ IMPORTANTE: esto ocurre DESPUÉS de terminar OM
    const [otRes, mecRes] = await Promise.all([
      supabase.from('ORDEN_TRABAJO').select('*'),
      supabase.from('MECANICOS').select('*'),
    ]);

    if (otRes.error) throw otRes.error;
    if (mecRes.error) throw mecRes.error;

    _data = {
      oms: allOMs,
      ots: otRes.data || [],
      mecanicos: mecRes.data || []
    };

    _emit('ready', getFiltered());

  } catch (err) {
    console.error('DashboardStore load error:', err);
    _emit('error', err);
  } finally {
    _loading = false;
  }
}

  // ── Área del usuario ─────────────────────────────────────
  function setUserArea(area) {
    _userArea = (area === 'ALL' || !area) ? null : area;
  }

  // ── Filtros ──────────────────────────────────────────────
  function setFilter(key, values) {
    _filters[key] = values;
    _emit('filtered', getFiltered());
  }

  function clearFilters() {
    _filters = { etapa: [], area: [], item: [], equipo: [] };
    _emit('filtered', getFiltered());
  }

  function getFilters() {
    return { ..._filters };
  }

  // ── Base OM (filtrado por área usuario) ──────────────────
  function _getBaseOMs() {
    if (!_data) return [];
    if (_userArea) {
      return _data.oms.filter(o => o['Área'] === _userArea);
    }
    return _data.oms;
  }

  // ── Opciones únicas ──────────────────────────────────────
  function getOptions() {
    if (!_data) return { etapa: [], area: [], item: [], equipo: [] };

    let base = _getBaseOMs();

    return {
      etapa:  [...new Set(base.map(o => o['Etapa']).filter(Boolean))].sort(),
      area:   [...new Set(base.map(o => o['Área']).filter(Boolean))].sort(),
      item:   [...new Set(base.map(o => o['ITEM']).filter(Boolean))].sort(),
      equipo: [...new Set(base.map(o => o['ID_#EQUIPO']).filter(Boolean))].sort(),
    };
  }

  // ── Filtrado completo ────────────────────────────────────
  function getFiltered() {
    let oms = _getBaseOMs();

    if (_filters.etapa.length)
      oms = oms.filter(o => _filters.etapa.includes(o['Etapa']));

    if (_filters.area.length)
      oms = oms.filter(o => _filters.area.includes(o['Área']));

    if (_filters.item.length)
      oms = oms.filter(o => _filters.item.includes(o['ITEM']));

    if (_filters.equipo.length)
      oms = oms.filter(o => _filters.equipo.includes(o['ID_#EQUIPO']));

    const omIds = new Set(oms.map(o => o['ID_Orden mantenimiento']));

    const ots = (_data?.ots || []).filter(t => omIds.has(t.id_om));

    return {
      oms,
      ots,
      mecanicos: _data?.mecanicos || [],
      filters: _filters
    };
  }

  // ── KPIs ────────────────────────────────────────────────
  function getKPIs(oms) {
    const list = oms || getFiltered().oms;

    const counts = {};

    list.forEach(o => {
      const s = o['Estatus'] || 'Sin estatus';
      counts[s] = (counts[s] || 0) + 1;
    });

    return {
      total: list.length,
      byStatus: counts
    };
  }

  // ── Avance semanal ──────────────────────────────────────
  function getWeeklyProgress(oms) {
    const list = oms || getFiltered().oms;
    const totalGlobal = list.length;

    const now = new Date();

    const getWeekNumber = (date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    let semanas = [];
    for (let i = 0; i < 5; i++) {
      const temp = new Date(now);
      temp.setDate(now.getDate() - (i * 7));
      semanas.push(getWeekNumber(temp));
    }

    semanas = semanas.map(s => String(s));

    semanas.reverse();

    return semanas.map(sem => {
      const semanales = list.filter(o => o['Semana'] === sem);
      const total = semanales.length;
      const concluidas = semanales.filter(o => o['Estatus'] === 'Concluida').length;

      return {
        semana: sem,
        total,
        concluidas,
        avance: total > 0 ? Number(((concluidas / totalGlobal) * 100).toFixed(2)) : 0
      };
    });
  }

  // ── Agrupación por dimensión ─────────────────────────────
  function getByDimension(dimension, oms) {
    const list = oms || getFiltered().oms;
    const map = {};

    list.forEach(o => {
      const key = o[dimension] || 'Sin definir';
      const status = o['Estatus'] || 'Sin estatus';

      if (!map[key]) map[key] = {};
      map[key][status] = (map[key][status] || 0) + 1;
    });

    return map;
  }

  // ── Detalle equipo ──────────────────────────────────────
  function getEquipoDetail(equipoId, oms) {
    const list = oms || getFiltered().oms;

    return list
      .filter(o => o['ID_#EQUIPO'] === equipoId)
      .map(o => ({
        id: o['ID_Orden mantenimiento'],
        descripcion: o['Descripcion'] || '',
        tieneSolicitud: o['Tiene solicitud de compra?'],
        nSolicitud: o['N° solicitud'] || '—',
        nOrdenCompra: o['N° Orden de compra'] || '—',
        fechaEntrega: o['Fecha Entrega'] || '—',
        estatus: o['Estatus'] || '—',
      }));
  }

  function getRaw() { return _data; }
  function isLoaded() { return !!_data; }

  return {
    load,
    subscribe,
    setUserArea,
    setFilter,
    clearFilters,
    getFilters,
    getOptions,
    getFiltered,
    getKPIs,
    getWeeklyProgress,
    getByDimension,
    getEquipoDetail,
    getRaw,
    isLoaded
  };
})();

window.DashboardStore = DashboardStore;