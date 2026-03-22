// ============================================================
// CADASA TALLER — OT STORE (Supabase)
// Estado centralizado del módulo de Órdenes de Trabajo.
// ============================================================

const OTStore = (() => {

  const ETAPAS = [
    'Desmontaje y diagnóstico',
    'Lavado e inspección',
    'Reparación o reemplazo',
    'Ensamblaje y ajuste; pruebas finales',
  ];

  const PAGE_LOAD = 1000; // filas por request al cargar todo

  let _allOrders  = [];
  let _filtered   = [];
  let _grouped    = {};
  let _loading    = false;
  let _source     = 'demo';
  let _listeners  = [];

  const _filters = {
    search:  '',
    area:    '',
    estatus: '',
    proceso: '',
    semana:  '',
  };

  // ── Notificaciones ───────────────────────────────────────
  function subscribe(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }
  function notify(event) {
    _listeners.forEach(fn => fn(event));
  }

  // ── Mapear fila de Supabase al formato interno ───────────
  function _mapRow(row) {
    return {
      ID_Orden:        row['ID_Orden mantenimiento'],
      Area:            row['Área'],
      ID_EQUIPO:       row['ID_#EQUIPO'],
      ITEM:            row['ITEM'],
      Sistema:         row['Sistema'],
      Descripcion:     row['Descripcion'],
      TipoProceso:     row['Tipo de Proceso'],
      Estatus:         row['Estatus'],
      Semana:          row['Semana'],
      FechaInicio:     row['Fecha inicio']
                         ? new Date(row['Fecha inicio']).toLocaleDateString('es-PA')
                         : null,
      FechaConclusion: row['Fecha conclusion']
                         ? new Date(row['Fecha conclusion']).toLocaleDateString('es-PA')
                         : null,
      TieneSolicitud:  row['Tiene solicitud de compra?'] ? 'Si' : 'No',
      NSolicitud:      row['N° solicitud'],
      NOrdenCompra:    row['N° Orden de compra'],
      FechaEntrega:    row['Fecha Entrega'],
      Observaciones:   row['Observaciones'],
      Cantidad:        row['Cantidad'],
      Etapa:           row['Etapa'],
    };
  }

  // ── Carga COMPLETA con paginación automática ─────────────
  // Supabase devuelve máx 1000 filas por request.
  // Este loop sigue pidiendo páginas hasta que no haya más.
  async function _fetchAll(db, userArea) {
    let allRows = [];
    let from    = 0;
    const size  = PAGE_LOAD;

    while (true) {
      let query = db
        .from('ORDEN_MANTENIMIENTO')
        .select('*')
        .range(from, from + size - 1);

      // Si el usuario no es admin, filtrar por área directo en la query
      if (userArea) {
        query = query.eq('Área', userArea);
      }

      const { data, error } = await query;

      if (error) throw error;

      allRows = allRows.concat(data || []);

      // Si devolvió menos de PAGE_LOAD, ya no hay más páginas
      if (!data || data.length < size) break;

      from += size;
    }

    return allRows;
  }

  // ── load ─────────────────────────────────────────────────
  async function load(authenticated) {
    _loading = true;
    notify('loading');

    try {
      const db   = window.SupabaseClient;
      const user = AuthService.getUser();

      // Solo filtrar por área en la query si no es admin
      const userArea = (authenticated && user?.role !== 'ADMIN' && user?.area)
        ? user.area
        : null;

      const raw  = await _fetchAll(db, userArea);
      _allOrders = raw.map(_mapRow);
      _source    = _allOrders.length > 0 ? 'live' : 'demo';

      console.log(`[OTStore] ${_allOrders.length} órdenes cargadas desde Supabase.`);

      applyFilters();

    } catch (err) {
      console.error('[OTStore] Error cargando desde Supabase:', err.message);
      notify('error');
    } finally {
      _loading = false;
      notify('ready');
    }
  }

  // ── Filtros (client-side sobre los datos ya cargados) ────
  // La búsqueda por texto opera sobre _allOrders en memoria.
  // Si el dataset es muy grande (>50k filas) considera mover
  // el filtro de texto a server-side con ilike de Supabase.
  function setFilter(key, value) {
    _filters[key] = value;
    applyFilters();
    notify('filtered');
  }

  function applyFilters() {
    let data = [..._allOrders];
    const { search, area, estatus, proceso, semana } = _filters;

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(o =>
        (o.ID_Orden    || '').toLowerCase().includes(q) ||
        (o.Descripcion || '').toLowerCase().includes(q) ||
        (o.ITEM        || '').toLowerCase().includes(q) ||
        (o.Sistema     || '').toLowerCase().includes(q) ||
        (o.ID_EQUIPO   || '').toLowerCase().includes(q)
      );
    }

    if (area)    data = data.filter(o => o.Area        === area);
    if (estatus) data = data.filter(o => o.Estatus     === estatus);
    if (proceso) data = data.filter(o => o.TipoProceso === proceso);
    if (semana === '__noasig') {
      data = data.filter(o => !o.Semana);
    } else if (semana) {
      data = data.filter(o => String(o.Semana) === semana);
    }

    _filtered = data;
    _grouped  = buildHierarchy(data);
  }

  function buildHierarchy(rows) {
    const tree = {};
    rows.forEach(row => {
      const eqKey  = row.ID_EQUIPO;
      const semKey = row.Semana ? `Semana ${String(row.Semana).padStart(2,'0')}` : '__noasig';
      const proc   = normalizeProcess(row.TipoProceso);
      if (!tree[eqKey]) {
        tree[eqKey] = { equipoId: row.ID_EQUIPO, item: row.ITEM, area: row.Area, semanas: {} };
      }
      if (!tree[eqKey].semanas[semKey]) tree[eqKey].semanas[semKey] = { procesos: {} };
      if (!tree[eqKey].semanas[semKey].procesos[proc]) tree[eqKey].semanas[semKey].procesos[proc] = [];
      tree[eqKey].semanas[semKey].procesos[proc].push(row);
    });
    return tree;
  }

  function normalizeProcess(tipo) {
    if (!tipo) return 'Sin tipo';
    const t = tipo.trim().toLowerCase();
    for (const et of ETAPAS) {
      if (et.toLowerCase().includes(t) || t.includes(et.toLowerCase().split(' ')[0])) return et;
    }
    if (t.includes('desmont') || t.includes('diagnos')) return ETAPAS[0];
    if (t.includes('lavado')  || t.includes('insp'))    return ETAPAS[1];
    if (t.includes('repar')   || t.includes('reempl'))  return ETAPAS[2];
    if (t.includes('ensam')   || t.includes('ajuste') || t.includes('prueba')) return ETAPAS[3];
    return tipo;
  }

  // ── Getters ──────────────────────────────────────────────
  function getAll()      { return _allOrders; }
  function empties() {
  _allOrders = [];        // array
  _filtered  = [];        // array
  _grouped   = {};        // objeto
  _loading   = false;     // boolean
  _source    = 'demo';    // string (valor por defecto)

  // resetear filtros respetando estructura
  _filters.search  = '';
  _filters.area    = '';
  _filters.estatus = '';
  _filters.proceso = '';
  _filters.semana  = '';

  // NO tocar ETAPAS (constante)
}
  function getFiltered() { return _filtered;  }
  function getGrouped()  { return _grouped;   }
  function isLoading()   { return _loading;   }
  function getSource()   { return _source;    }
  function getFilters()  { return { ..._filters }; }
  function getEtapas()   { return ETAPAS;     }

  function getKPIs() {
    const all = _filtered;
    return {
      total:      all.length,
      programado: all.filter(o => o.Estatus === 'Programado').length,
      enProceso:  all.filter(o => o.Estatus === 'En Proceso').length,
      completado: all.filter(o => o.Estatus === 'Concluida').length,
      pendiente:  all.filter(o => o.Estatus === 'Pendiente').length,
      sinSemana:  all.filter(o => !o.Semana).length,
    };
  }

  function getAreas() {
    return [...new Set(_allOrders.map(o => o.Area).filter(Boolean))].sort();
  }

  function getSemanas() {
    return [...new Set(_allOrders.map(o => o.Semana).filter(Boolean))].sort((a, b) => a - b);
  }

  function updateLocal() {
    applyFilters();
    notify('filtered');
  }

  return {
    load, subscribe,
    setFilter, getFilters,
    getAll, getFiltered, getGrouped,
    isLoading, getSource,
    getKPIs, getAreas, getSemanas, getEtapas,empties,
    updateLocal  
  };
})();

window.OTStore = OTStore;