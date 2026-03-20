// ============================================================
// CADASA TALLER — OT STORE (Supabase)
// Estado centralizado del módulo de Órdenes de Trabajo.
// Solo cambió: función load() — todo lo demás intacto.
// ============================================================

const OTStore = (() => {

  // ── Tipos de proceso en orden de etapa ──────────────────
  const ETAPAS = [
    'Desmontaje y diagnóstico',
    'Lavado e inspección',
    'Reparación o reemplazo',
    'Ensamblaje y ajuste; pruebas finales',
  ];

  // ── Estado interno ───────────────────────────────────────
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

  // ── Mapear fila de Supabase al formato interno del store ─
  // Convierte los nombres de columna de Supabase a los que
  // usan los componentes (OTComponent, modal, filtros, etc.)
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

  // ── Carga de datos desde Supabase ────────────────────────
  async function load(authenticated) {
    _loading = true;
    notify('loading');

    try {
      const db = window.SupabaseClient;

      const { data, error } = await db
        .from('ORDEN_MANTENIMIENTO')
        .select('*');

      if (error) throw error;

      _allOrders = (data || []).map(_mapRow);

      // Filtrar por área si el usuario no es admin
      if (authenticated) {
        const user   = AuthService.getUser();
        const config = RolesConfig.getForEmail(user?.email);
        if (config.role !== 'admin' && config.area) {
          _allOrders = _allOrders.filter(row => row.Area === config.area);
        }
      }

      _source = _allOrders.length > 0 ? 'live' : 'demo';
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

  // ── Filtros ──────────────────────────────────────────────
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
        tree[eqKey] = {
          equipoId: row.ID_EQUIPO,
          item:     row.ITEM,
          area:     row.Area,
          semanas:  {},
        };
      }

      if (!tree[eqKey].semanas[semKey]) {
        tree[eqKey].semanas[semKey] = { procesos: {} };
      }

      if (!tree[eqKey].semanas[semKey].procesos[proc]) {
        tree[eqKey].semanas[semKey].procesos[proc] = [];
      }

      tree[eqKey].semanas[semKey].procesos[proc].push(row);
    });

    return tree;
  }

  function normalizeProcess(tipo) {
    if (!tipo) return 'Sin tipo';
    const t = tipo.trim().toLowerCase();
    for (const et of ETAPAS) {
      if (et.toLowerCase().includes(t) || t.includes(et.toLowerCase().split(' ')[0])) {
        return et;
      }
    }
    if (t.includes('desmont') || t.includes('diagnos')) return ETAPAS[0];
    if (t.includes('lavado')  || t.includes('insp'))    return ETAPAS[1];
    if (t.includes('repar')   || t.includes('reempl'))  return ETAPAS[2];
    if (t.includes('ensam')   || t.includes('ajuste') || t.includes('prueba')) return ETAPAS[3];
    return tipo;
  }

  // ── Getters ──────────────────────────────────────────────
  function getAll()      { return _allOrders; }
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
      enProceso:  all.filter(o => o.Estatus === 'En proceso').length,
      completado: all.filter(o => o.Estatus === 'Completado').length,
      pendiente:  all.filter(o => o.Estatus === 'Pendiente').length,
      sinSemana:  all.filter(o => !o.Semana).length,
    };
  }

  function getAreas() {
    return [...new Set(_allOrders.map(o => o.Area).filter(Boolean))].sort();
  }

  function getSemanas() {
    return [...new Set(_allOrders.map(o => o.Semana).filter(Boolean))]
      .sort((a, b) => a - b);
  }

  return {
    load, subscribe,
    setFilter, getFilters,
    getAll, getFiltered, getGrouped,
    isLoading, getSource,
    getKPIs, getAreas, getSemanas, getEtapas,
  };
})();

window.OTStore = OTStore;