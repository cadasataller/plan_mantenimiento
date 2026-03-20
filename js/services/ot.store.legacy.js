// ============================================================
// CADASA TALLER — OT STORE
// Estado centralizado del módulo de Órdenes de Trabajo
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

  // ── Carga de datos ───────────────────────────────────────
  async function load(authenticated) {
    _loading = true;
    notify('loading');

    try {
      if (authenticated) {
        try {
          // Esperar token — con renovación silenciosa incluida
          await new Promise(resolve => AuthService.onTokenReady(resolve));

          // Verificar que efectivamente llegó un token
          const token = AuthService.getAccessToken();
          if (!token) throw new Error('Sin token tras espera');

          const rows = await SheetsService.fetchAll();
          if (rows.length > 0) {
            _allOrders = rows;
            const user   = AuthService.getUser();
            const config = RolesConfig.getForEmail(user?.email);

            if (config.role !== 'admin' && config.area) {
              _allOrders = _allOrders.filter(row => row.Area === config.area);
            }
            _source = 'live';
          } else {
            throw new Error('Sin filas en Sheets');
          }
        } catch (sheetsErr) {
          console.warn('[OTStore] Sheets falló, usando mock:', sheetsErr.message);
          _allOrders = MockDataService.generateOrders(100);
          _source    = 'demo';
        }
      } else {
        _allOrders = MockDataService.generateOrders(100);
        _source    = 'demo';
      }

      applyFilters();

    } catch (err) {
      console.error('[OTStore] Error cargando datos:', err);
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
        o.ID_Orden.toLowerCase().includes(q)    ||
        o.Descripcion.toLowerCase().includes(q) ||
        o.ITEM.toLowerCase().includes(q)        ||
        o.Sistema.toLowerCase().includes(q)     ||
        o.ID_EQUIPO.toLowerCase().includes(q)
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
    return [...new Set(_allOrders.map(o => o.Area))].sort();
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