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

  function _formatDate(val) {
    if (!val || val === '—') return null;

    // Si viene como ISO: 2026-04-06T00:00:00 -> 2026-04-06
    if (typeof val === 'string' && val.includes('T')) {
      return val.split('T')[0];
    }

    // Si ya viene como fecha simple
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    // Si viene con guiones y quieres conservar solo la fecha
    const parts = val.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].slice(0, 2).padStart(2, '0')}`;
    }

    return null;
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
                         ? _formatDate(row['Fecha inicio'])
                         : null,
      FechaConclusion: row['Fecha conclusion']
                         ? _formatDate(row['Fecha conclusion'])
                         : null,
      TieneSolicitud:  row['Tiene solicitud de compra?'] ? 'Si' : 'No',
      NSolicitud:      row['N° solicitud'],
      NOrdenCompra:    row['N° Orden de compra'],
      FechaEntrega:    row['Fecha Entrega'],
      Observaciones:   row['Observaciones'],
      Cantidad:        row['Cantidad'],
      Etapa:           row['Etapa'],
      // 👇 NUEVO: Exportamos la bandera IS_SG para que el Modal sepa cómo comportarse
      IS_SG:           row['IS_SG'] === true 
    };
  }

  // ── Carga COMPLETA con paginación automática ─────────────
  async function _fetchAll(db, uArea) {
    let allRows = [];
    let from    = 0;
    const size  = PAGE_LOAD;

    while (true) {
      let query = db
        .from('ORDEN_MANTENIMIENTO')
        .select('*')
        .range(from, from + size - 1);

      // 👇 LA MAGIA DE LOS PERMISOS:
      if (uArea === 'SERVICIOS GENERALES') {
        // SG ve todas las áreas, pero SOLO las órdenes derivadas a ellos
        query = query.eq('IS_SG', true);
      } else if (uArea && uArea !== 'ALL') {
        const user = AuthService.getUser();
        // Un área normal solo ve sus órdenes (hayan sido o no derivadas a SG)
        query = query.eq('Área', user.area);
      } 
      // (Si es ALL, no aplica ningún filtro y trae la base de datos completa)

      const { data, error } = await query;

      if (error) throw error;

      allRows = allRows.concat(data || []);

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

      let uArea = null;
      if (authenticated && user) {
        // Obtenemos el área formateada
        uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
        // Si es Admin, forzamos ALL
        if (user.role === 'ADMIN') uArea = 'ALL';
      }

      // Mandamos el área al fetcher para que aplique la regla correspondiente
      const raw  = await _fetchAll(db, uArea);
      
      _allOrders = raw.map(_mapRow);
      _source    = _allOrders.length > 0 ? 'live' : 'demo';

      console.log(`[OTStore] ${_allOrders.length} órdenes cargadas desde Supabase. (Filtro Área: ${uArea || 'Ninguno'})`);

      applyFilters();

    } catch (err) {
      console.error('[OTStore] Error cargando desde Supabase:', err.message);
      notify('error');
    } finally {
      _loading = false;
      notify('ready');
    }
  }

  // ── Filtros (client-side) ────────────────────────────────
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
        (o.ID_Orden   || '').toLowerCase().includes(q) ||
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
    _allOrders = [];        
    _filtered  = [];        
    _grouped   = {};        
    _loading   = false;     
    _source    = 'demo';    

    _filters.search  = '';
    _filters.area    = '';
    _filters.estatus = '';
    _filters.proceso = '';
    _filters.semana  = '';
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
    getKPIs, getAreas, getSemanas, getEtapas, empties,
    updateLocal  
  };
})();

window.OTStore = OTStore;