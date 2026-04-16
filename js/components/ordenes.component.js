
const OTComponent = (() => {

  const ETAPA_IDX = {
    'Desmontaje y diagnóstico':             0,
    'Lavado e inspección':                  1,
    'Reparacion o reemplazo':              2,
    'Reparación o reemplazo':              2,
    'Ensamblaje y ajuste; pruebas finales': 3,
  };
  const ETAPA_SHORT = {
    'Desmontaje y diagnóstico':             'Desmontaje',
    'Lavado e inspección':                  'Lavado/Insp.',
    'Reparacion o reemplazo':              'Reparación',
    'Reparación o reemplazo':              'Reparación',
    'Ensamblaje y ajuste; pruebas finales': 'Ensamblaje',
  };

  const ALL_DIMS = [
    { id: 'equipo',  label: 'Equipo'         },
    { id: 'semana',  label: 'Semana'          },
    { id: 'dia',     label: 'Día'             },
    { id: 'proceso', label: 'Tipo de Proceso' },
    { id: 'area',    label: 'Área'            },
    { id: 'estatus', label: 'Estado'          },
  ];

  // ── Estado ───────────────────────────────────────────────
  // Agrega estas dos líneas junto a:  let _selectedOMs = new Set();
  let _currentBulkAction = null;   // 'concluir' | 'programar' | null
  let _activeDims = ['semana'];
  let _unsub      = null;
  let _activeKPI  = null;
  let _gaugeChart = null;   // instancia ECharts
  const _rowCache   = new Map();
  const _tableCache = new Map();
  let _tablePages   = new Map();
  const PAGE_SIZE   = 100;
  let _currentPage  = 0;
  let _selectedOMs = new Set(); // IDs de OMs seleccionadas para concluir en bulk

  // ══════════════════════════════════════════════════════════
  // MOUNT
  // ══════════════════════════════════════════════════════════
  function mount(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = buildShell();
    bindStaticEvents();
    renderTopBar();   // renderiza búsqueda + agrupación juntos
  }

  function buildShell() {
    return `
      <div class="ot-page">

        <!-- 1. Card único: búsqueda izq + agrupación der — solo admins -->
        <div class="ot-topcard" id="ot-topcard"></div>

        <!-- 2. KPIs clickeables -->
        <div class="ot-kpi-bar" id="ot-kpi-bar">${buildKPISkeleton()}</div>

        <!-- 3. Velocímetro ECharts -->
        <div class="ot-gauge-card" id="ot-gauge-card">
          <div class="ot-gauge-label">AVANCE DE COMPLETADO</div>
          <div id="ot-gauge-chart" style="width:100%;height:220px;"></div>
          <div class="ot-gauge-ctx" id="ot-gauge-ctx"></div>
        </div>

        <!-- 4. Lista / tabla -->
        <div class="ot-list-wrap" id="ot-list-wrap">${buildLoadingState()}</div>
      </div>
      <div id="ot-modal-root"></div>`;
  }

  // ══════════════════════════════════════════════════════════
  // TOP CARD — búsqueda (50%) + agrupación (50%)
  // ══════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════
  // TOP CARD — búsqueda (50%) + agrupación (50%)
  // ══════════════════════════════════════════════════════════
  function renderTopBar() {
    const card = document.getElementById('ot-topcard');
    if (!card) return;

    const isAdmin = AuthService?.getUser()?.role === 'ADMIN';

    // 1. Usuarios normales solo ven Semana y Día. Admins ven todo.
    const allowedDims = isAdmin 
      ? ALL_DIMS 
      : ALL_DIMS.filter(d => d.id === 'semana' || d.id === 'dia');

    // 2. Sacamos las que ya están activas para no repetirlas
    const available = allowedDims.filter(d => !_activeDims.includes(d.id));

    card.innerHTML = `
      <div class="ot-topcard-search">
        <div class="ot-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="ot-search" id="ot-search"
            type="text" placeholder="Buscar por ID, equipo, descripción…" autocomplete="off"/>
        </div>
        <button class="btn-reload" id="btn-reload" title="Recargar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      <div class="ot-topcard-div" id="ot-topcard-div"></div>

      <div class="ot-topcard-grp" id="ot-topcard-grp">
        <span class="ot-grp-label">Agrupar</span>

        <div class="ot-grp-active">
          ${_activeDims.length === 0
            ? `<span class="ot-grp-none">Sin agrupación</span>`
            : _activeDims.map((dimId, idx) => {
                const dim   = ALL_DIMS.find(d => d.id === dimId);
                const canUp = idx > 0;
                const canDn = idx < _activeDims.length - 1;
                return `
                  ${idx > 0 ? `<span class="ot-grp-arrow">›</span>` : ''}
                  <span class="ot-grp-chip active dim-${dimId}">
                    ${dim.label}
                    ${canUp && isAdmin ? `<button onclick="OTComponent._moveDim('${dimId}',-1)">‹</button>` : ''}
                    ${canDn && isAdmin ? `<button onclick="OTComponent._moveDim('${dimId}',1)">›</button>`  : ''}
                    <button class="rm" onclick="OTComponent._removeDim('${dimId}')">✕</button>
                  </span>`;
              }).join('')
          }
        </div>

        ${available.length > 0 ? `
          <span class="ot-grp-sep">+</span>
          <div class="ot-grp-available">
            ${available.map(dim => `
              <span class="ot-grp-chip avail dim-${dim.id}"
                    onclick="OTComponent._addDim('${dim.id}')">
                ${dim.label}
              </span>`).join('')}
          </div>` : ''}

        ${_activeDims.length > 0
          ? `<button class="ot-grp-clear" onclick="OTComponent._clearGroups()">✕ Quitar todo</button>`
          : ''}
      </div>`;

    // Re-bind eventos
    document.getElementById('ot-search')?.addEventListener('input', e => {
      _clearSelection();            // ← limpia zombies
      OTStore.setFilter('search', e.target.value);
      _currentPage = 0;
      _updateGauge();
      renderList();
    });
    
    document.getElementById('btn-reload')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-reload');
      btn?.classList.add('spinning');
      OTStore.load(AuthService?.isAuthenticated() ?? false).then(() => {
        btn?.classList.remove('spinning');
        renderKPIs();
        _updateGauge();
        renderList();
      });
    });
  }

  // ── Acciones del panel ───────────────────────────────────
  function _addDim(dimId) {
    const isAdmin = AuthService?.getUser()?.role === 'ADMIN';

    if (!isAdmin) {
      // Si NO es admin, reemplazamos por completo el arreglo (solo 1 nivel a la vez)
      _activeDims = [dimId];
      _refreshPanel();
    } else {
      // Si ES admin, apilamos como de costumbre (multinivel)
      if (!_activeDims.includes(dimId)) { 
        _activeDims.push(dimId); 
        _refreshPanel(); 
      }
    }
  }
  function _removeDim(dimId) {
    _activeDims = _activeDims.filter(d => d !== dimId); _refreshPanel();
  }
  function _moveDim(dimId, dir) {
    const idx = _activeDims.indexOf(dimId);
    if (idx < 0) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= _activeDims.length) return;
    const arr = [..._activeDims];
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    _activeDims = arr;
    _refreshPanel();
  }
  function _applyPreset(dimsStr) {
    _activeDims = dimsStr.split(',').filter(Boolean); _refreshPanel();
  }
  function _clearGroups() {
    _activeDims = []; _refreshPanel();
  }

  function _refreshPanel() {
  _clearSelection();            // ← limpia zombies
  _currentPage = 0;
  renderTopBar();
  renderList();
}

  // ══════════════════════════════════════════════════════════
  // bindStaticEvents — solo los que no están en renderTopBar
  // ══════════════════════════════════════════════════════════
  function bindStaticEvents() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const bar = document.getElementById('ot-bulk-bar');
      // Si estamos en Estado B, solo cancelar el formulario (volver a A)
      if (bar && _currentBulkAction !== null) {
        _cancelBulkForm();
      } else if (_selectedOMs.size > 0) {
        // Si estamos en Estado A con selecciones, limpiamos todo
        _clearSelection();
      }
    }
  });
}

  // ══════════════════════════════════════════════════════════
  // onEnter
  // ══════════════════════════════════════════════════════════
  function onEnter() {
    if (_unsub) _unsub();
    _unsub = OTStore.subscribe(event => {
      if (event === 'ready' || event === 'filtered') {
        renderKPIs(); _updateGauge(); renderList();
      }
      if (event === 'loading') {
        const w = document.getElementById('ot-list-wrap');
        if (w) w.innerHTML = buildLoadingState();
      }
    });

    if (OTStore.getAll().length === 0) {
      OTStore.load(AuthService?.isAuthenticated() ?? false);
    } else {
      renderKPIs(); _updateGauge(); renderList();
    }

    // Mostrar/ocultar la mitad de agrupación según rol
    const isAdmin = AuthService.getUser()?.role === 'ADMIN';
    const grp     = document.getElementById('ot-topcard-grp');
    const div     = document.getElementById('ot-topcard-div');
    if (grp) grp.style.display = '';
    if (div) div.style.display = '';
  }

  // ══════════════════════════════════════════════════════════
  // GAUGE — ECharts, solo filtro de búsqueda
  // ══════════════════════════════════════════════════════════
  function _getSearchRows() {
    const q = (OTStore.getFilters().search || '').toLowerCase().trim();
    let rows = OTStore.getAll();
    if (q) {
      rows = rows.filter(o =>
        (o.ID_Orden    || '').toLowerCase().includes(q) ||
        (o.Descripcion || '').toLowerCase().includes(q) ||
        (o.ITEM        || '').toLowerCase().includes(q) ||
        (o.Sistema     || '').toLowerCase().includes(q) ||
        (o.ID_EQUIPO   || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function _updateGauge() {
    if (typeof echarts === 'undefined') return;

    const rows      = _getSearchRows();
    const total     = rows.length;
    const completed = rows.filter(r => r.Estatus === 'Concluida').length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log(pct)

    const dom = document.getElementById('ot-gauge-chart');
    if (!dom) return;

    // Crear instancia si no existe o fue destruida
    if (!_gaugeChart || _gaugeChart.isDisposed()) {
      _gaugeChart = echarts.init(dom, null, { renderer: 'svg' });
    }

    const option = {
      backgroundColor: 'transparent',
      animationDuration: 1500,      // Duración del movimiento en milisegundos
      animationEasing: 'quarticOut', // Tipo de suavizado (quarticOut es muy elegante)
      animationDurationUpdate: 1000,
      series: [
        // Arco de fondo (gris claro)
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          radius: '90%',
          center: ['50%', '75%'],
          splitNumber: 4,
          axisLine: {
            lineStyle: {
              width: 26,
              color: [
                [0.25, '#c8e6c9'],
                [0.50, '#81c784'],
                [0.75, '#388e3c'],
                [1.00, '#1b5e20'],
              ],
            },
          },
          pointer: {
            length: '65%',
            width: 3,
            offsetCenter: [0, '-10%'],
            itemStyle: { color: '#2d3748' },
          },
          axisTick: { show: false },
          splitLine: {
            distance: -28,
            length: 10,
            lineStyle: { color: 'rgba(255,255,255,0.6)', width: 2 },
          },
          axisLabel: {
            distance: -48,
            color: '#888',
            fontSize: 11,
            formatter: v => v + '%',
          },
          anchor: {
            show: true,
            size: 10,
            itemStyle: { color: '#2d3748', borderWidth: 2, borderColor: '#fff' },
          },
          title: {
            offsetCenter: [0, '-28%'],
            fontSize: 13,
            color: '#888',
            fontWeight: 400,
          },
          detail: {
            valueAnimation: true,
            formatter: v => `{val|${v}%}\n{sub|${completed} de ${total} completadas}`,
            rich: {
              val: {
                fontSize: 28,
                fontWeight: 700,
                color: pct >= 75 ? '#1b5e20' : pct >= 50 ? '#388e3c' : pct >= 25 ? '#81c784' : '#aaa',
                lineHeight: 36,
              },
              sub: {
                fontSize: 11,
                color: '#999',
                lineHeight: 18,
              },
            },
            offsetCenter: [0, '-5%'],
          },
          data: [{ value: pct, name: '' }],
        },
      ],
    };

    _gaugeChart.setOption(option, true);

    // Etiqueta de filtro activo
    const ctx = document.getElementById('ot-gauge-ctx');
    const label = document.querySelector('#ot-gauge-card .ot-gauge-label');
    if (ctx) {
      const q = OTStore.getFilters().search;
      ctx.textContent = q ? `Filtro de búsqueda: "${q}"` : '';
      if (label) {
        label.textContent = q
          ? `AVANCE DE COMPLETADO PARA ${q.toUpperCase()}`
          : 'AVANCE DE COMPLETADO';
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // KPIs — clickeables, se calculan sobre filtro de búsqueda
  // ══════════════════════════════════════════════════════════
  function renderKPIs() {
    const base = _getSearchRows();
    const k = {
      total:      base.length,
      programado: base.filter(o => o.Estatus === 'Programado').length,
      enProceso:  base.filter(o => o.Estatus === 'En Proceso').length,
      completado: base.filter(o => o.Estatus === 'Concluida').length,
      sinSemana:  base.filter(o => !o.Semana).length,
    };

    const bar = document.getElementById('ot-kpi-bar');
    if (!bar) return;

    const cards = [
      { key: 'total',      val: k.total,      label: 'Total OMs',   cls: 'total',  fk: null,       fv: null         },
      { key: 'programado', val: k.programado, label: 'Programadas', cls: 'prog',   fk: 'estatus',  fv: 'Programado' },
      { key: 'enProceso',  val: k.enProceso,  label: 'En Proceso',  cls: 'pend',   fk: 'estatus',  fv: 'En Proceso' },
      { key: 'completado', val: k.completado, label: 'Concluidas', cls: 'done',   fk: 'estatus',  fv: 'Concluida' },
      { key: 'sinSemana',  val: k.sinSemana,  label: 'Sin Semana',  cls: 'noasig', fk: 'semana',   fv: '__noasig'   },
    ];

    bar.innerHTML = cards.map(c => {
      const on = _activeKPI === c.key;
      return `
        <div class="ot-kpi${on ? ' kpi-active' : ''}"
             onclick="OTComponent._filterByKPI('${c.key}','${c.fk||''}','${c.fv||''}')"
             title="${on ? 'Clic para quitar filtro' : 'Clic para filtrar'}">
          <span class="ot-kpi-dot ${c.cls}"></span>
          <div class="ot-kpi-body">
            <div class="ot-kpi-val">${c.val}</div>
            <div class="ot-kpi-label">${c.label}</div>
          </div>
          ${on ? `<span class="ot-kpi-active-badge">✓</span>` : ''}
        </div>`;
    }).join('');
  }

  function _filterByKPI(kpiKey, fk, fv) {
    _clearSelection();
    if (_activeKPI === kpiKey) {
      _activeKPI = null;
      if (fk) OTStore.setFilter(fk, '');
    } else {
      if (_activeKPI) OTStore.setFilter(_kpiFilterKey(_activeKPI), '');
      _activeKPI = kpiKey;
      if (fk) OTStore.setFilter(fk, fv);
    }
    _currentPage = 0;
    renderKPIs();
    // Gauge NO se actualiza con KPI
    renderList();
  }

  function _kpiFilterKey(k) {
    return { programado:'estatus', enProceso:'estatus', completado:'estatus', sinSemana:'semana' }[k] || null;
  }

  function buildKPISkeleton() {
    return ['Total OMs','Programadas','En Proceso','Completadas','Sin Semana']
      .map(l => `<div class="ot-kpi"><span class="ot-kpi-dot total"></span>
        <div class="ot-kpi-body"><div class="ot-kpi-val">—</div>
        <div class="ot-kpi-label">${l}</div></div></div>`).join('');
  }

  // ══════════════════════════════════════════════════════════
  // RENDER LISTA
  // ══════════════════════════════════════════════════════════
  function renderList() {
    _tableCache.clear(); _tablePages.clear();
    const wrap = document.getElementById('ot-list-wrap');
    if (!wrap) return;
    const data = OTStore.getFiltered();
    _rowCache.clear();  
    data.forEach(r => _rowCache.set(String(r.ID_Orden), r));


    
    if (data.length === 0) {
      wrap.innerHTML = `<div class="ot-empty">
        <div class="ot-empty-icon">🔍</div>
        <div class="ot-empty-text">No se encontraron órdenes con los filtros aplicados.</div>
      </div>`;
    } else if (_activeDims.length === 0) {
      wrap.innerHTML = `<div class="ot-flat-table-wrap">${buildTable(data, true, 'flat_main')}</div>`;
    } else {
      wrap.innerHTML = renderNodes(buildTree(data, _activeDims, 0), 0);
    }

    if (!wrap._clickDelegate) {
      wrap._clickDelegate = true;
      wrap.addEventListener('click', e => {
        const tr = e.target.closest('tr.ot-data-row');
        if (!tr) return;
        _clearSelection();
        const row = _rowCache.get(String(tr.dataset.otId));
        if (row) openModal(row);
      });
    }

    // Delegate para checkboxes (se añade solo una vez)
    if (!wrap._checkDelegate) {
      wrap._checkDelegate = true;

      wrap.addEventListener('change', e => {
        const chk = e.target.closest('.ot-row-check');
        if (chk) {
          const omId = chk.dataset.omId;
          chk.checked ? _selectedOMs.add(omId) : _selectedOMs.delete(omId);
          chk.closest('tr')?.classList.toggle('row-selected', chk.checked);
          _syncBulkBar();
          return;
        }

        const chkAll = e.target.closest('.ot-check-all');
        if (chkAll) {
          const tableId = chkAll.dataset.tableId;
          const tblData = _tableCache.get(tableId);
          if (!tblData) return;
          tblData.rows
            .filter(r => r.Estatus !== 'Concluida' && r.Estatus !== 'Concluido')
            .forEach(r => {
              const id = String(r.ID_Orden);
              chkAll.checked ? _selectedOMs.add(id) : _selectedOMs.delete(id);
            });
          // Re-render solo la página actual para reflejar el estado
          const page = _tablePages.get(tableId) ?? 0;
          const w = document.getElementById(`tbl-wrap-${tableId}`);
          if (w) w.outerHTML = _renderTablePage(tableId, page);
          _syncBulkBar();
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // ÁRBOL
  // ══════════════════════════════════════════════════════════
  function buildTree(rows, dims, depth) {
    if (depth >= dims.length) return rows;
    const dim = dims[depth], groups = {}, order = [];
    
    rows.forEach(r => {
      const k = getDimKey(r, dim);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });

    // ── LÓGICA DE ORDENAMIENTO MEJORADA ──
    order.sort((a, b) => {
      // 1. Mandar "Sin ..." y "No programada" siempre al final
      const aEmpty = a.startsWith('Sin ') || a.startsWith('No ');
      const bEmpty = b.startsWith('Sin ') || b.startsWith('No ');
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      if (aEmpty && bEmpty) return 0;

      // 2. Ordenar Semanas numéricamente (14, 15, 16...)
      if (dim === 'semana') {
        // Extrae solo los números de "Semana 15"
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numB - numA; // Orden ascendente. (Usa numB - numA si prefieres 16, 15, 14)
      }

      // 3. Ordenar Días cronológicamente (Fechas reales)
      if (dim === 'dia') {
        const dateA = new Date(a);
        const dateB = new Date(b);
        // Si ambas son fechas válidas, las restamos para ordenar cronológicamente
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return dateB - dateA; // Orden ascendente (fechas más antiguas primero)
        }
      }

      // 4. Ordenamiento por defecto para Equipos, Procesos, Áreas, etc.
      return a.localeCompare(b, 'es', { numeric: true });
    });

    return order.map(k => ({
      dim, key: k,
      // Detectamos si es un grupo "vacío" para ponerle la clase CSS gris
      noAsig: k.startsWith('Sin ') || k.startsWith('No '),
      count: groups[k].length,
      children: buildTree(groups[k], dims, depth + 1),
    }));
  }

  function getDimKey(row, dim) {
    switch (dim) {
      case 'equipo':  return row.ID_EQUIPO ? `${row.ID_EQUIPO} — ${row.ITEM}` : 'Sin equipo';
      case 'semana':  return row.Semana ? `Semana ${String(row.Semana).padStart(2,'0')}` : 'No programada';
      case 'dia':     return row.FechaInicio ? row.FechaInicio : 'Sin fecha';
      case 'proceso': return row.TipoProceso || 'Sin tipo de proceso';
      case 'area':    return row.Area || 'Sin área';
      case 'estatus': return row.Estatus || '-';
      default:        return '-';
    }
  }

  function renderNodes(nodes, level) {
    if (!nodes || !nodes.length) return '';
    if (!nodes[0].dim) {
      const id = safeUID(level, 'leaf', nodes.map(r => r.ID_Orden).join('').slice(0,20));
      return `<div class="ot-table-wrap">${buildTable(nodes, false, id)}</div>`;
    }
    return nodes.map(node => {
      const uid   = safeUID(level, node.dim, node.key);
      const label = ALL_DIMS.find(d => d.id === node.dim)?.label ?? node.dim;
      const inner = renderNodes(node.children, level + 1);

      if (level === 0) return `
        <div class="ot-group ${level===_activeDims.length-1?'collapsed':''}" id="${uid}">
          <div class="ot-group-header dim-${node.dim}" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ot-group-dim-badge badge-${node.dim}">${label}</span>
            <span class="ot-group-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-group-count">${node.count} OM${node.count!==1?'s':''}</span>
          </div>
          <div class="ot-group-body">${inner}</div>
        </div>`;

      if (level === 1) return `
        <div class="ot-subgroup ${level===_activeDims.length-1?'collapsed':''}" id="${uid}">
          <div class="ot-subgroup-header dim-${node.dim}" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-subgroup-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ot-group-dim-badge badge-${node.dim}" style="font-size:.57rem;padding:.12rem .4rem">${label}</span>
            <span class="ot-subgroup-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-subgroup-cnt">${node.count} OMs</span>
          </div>
          <div class="ot-subgroup-body">${inner}</div>
        </div>`;

      return `
        <div class="ot-sub2group ${level===_activeDims.length-1?'collapsed':''}" id="${uid}">
          <div class="ot-sub2group-header" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-sub2group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ot-sub2group-dim">${label}</span>
            <span class="ot-sub2group-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-sub2group-cnt">${node.count} OMs</span>
          </div>
          <div class="ot-sub2group-body">${inner}</div>
        </div>`;
    }).join('');
  }

  function safeUID(l, d, k) {
    return ('g'+l+'_'+d+'_'+k).replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,50)
      + '_' + Math.random().toString(36).slice(2,7);
  }

  function _toggle(uid) { document.getElementById(uid)?.classList.toggle('collapsed'); }

  // ══════════════════════════════════════════════════════════
  // TABLA
  // ══════════════════════════════════════════════════════════
  function buildTable(rows, showArea = false, tableId = 'tbl_'+Math.random().toString(36).slice(2,7)) {
    if (!rows?.length)
      return `<div style="padding:1rem 1.5rem;font-size:.8rem;color:var(--text-muted)">Sin órdenes.</div>`;
    _tableCache.set(tableId, { rows, showArea });
    _tablePages.set(tableId, 0);
    return _renderTablePage(tableId, 0);
  }

  function _renderTablePage(tableId, page) {
    const c = _tableCache.get(tableId);
    if (!c) return '';
    const { rows, showArea } = c;
    const total = rows.length, pages = Math.ceil(total / PAGE_SIZE);
    const start = page * PAGE_SIZE, pageRows = rows.slice(start, start + PAGE_SIZE);

    const pendientes = pageRows.filter(r => r.Estatus !== 'Concluida' && r.Estatus !== 'Concluido');
    const allChecked = pendientes.length > 0 && pendientes.every(r => _selectedOMs.has(String(r.ID_Orden)));
    const someChecked = pendientes.some(r => _selectedOMs.has(String(r.ID_Orden)));

    const checkAllId = `chk-all-${tableId}`;
    const checkAllCell = `
      <th class="col-check">
        <input type="checkbox" class="ot-check-all" id="${checkAllId}"
              ${allChecked ? 'checked' : ''} data-table-id="${tableId}">
        <label for="${checkAllId}" class="ot-check-all-label" 
              style="${someChecked && !allChecked ? 'background:#bbf7d0;border-color:#166534;' : ''}">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="${someChecked ? '#166534' : '#fff'}" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </label>
      </th>`;

    const xH = showArea ? '<th>Área</th><th>Equipo</th>' : '';
    const thead = `<tr>${checkAllCell}<th>ID Orden</th><th>Equipo</th><th>Sistema</th><th>Descripción</th>
      <th>Tipo Proceso</th><th>Estado Ots</th><th>Fecha Inicio</th><th>Semana</th><th>Estado</th><th>Compra</th>${xH}</tr>`;

    // … paginación igual que antes …
    const W = 10, h = Math.floor(W/2);
    let ws = Math.max(0, page - h), we = Math.min(pages-1, ws + W - 1);
    if (we - ws < W-1) ws = Math.max(0, we - W + 1);
    const bp = Array.from({ length: we - ws + 1 }, (_, i) => ws + i);

    const pag = pages > 1 ? `
      <div class="ot-pagination">
        <span class="ot-pagination-info"><strong>${start+1}–${Math.min(start+PAGE_SIZE,total)}</strong> <span>de ${total}</span></span>
        <div class="ot-pagination-btns">
          <button class="ot-page-btn nav-btn" ${page===0?'disabled':''} onclick="OTComponent._goTablePage('${tableId}',${page-1})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          ${ws>0?`<button class="ot-page-btn" onclick="OTComponent._goTablePage('${tableId}',0)">1</button><span class="ot-page-ellipsis">…</span>`:''}
          ${bp.map(i=>`<button class="ot-page-btn${i===page?' active':''}" onclick="OTComponent._goTablePage('${tableId}',${i})">${i+1}</button>`).join('')}
          ${we<pages-1?`<span class="ot-page-ellipsis">…</span><button class="ot-page-btn" onclick="OTComponent._goTablePage('${tableId}',${pages-1})">${pages}</button>`:''}
          <button class="ot-page-btn nav-btn" ${page>=pages-1?'disabled':''} onclick="OTComponent._goTablePage('${tableId}',${page+1})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>` : '';

    return `<div id="tbl-wrap-${tableId}">
      <table class="ot-table"><thead>${thead}</thead>
      <tbody>${pageRows.map(r => buildRow(r, showArea)).join('')}</tbody></table>
      ${pag}</div>`;
  }

  function _goTablePage(tableId, page) {
    _tablePages.set(tableId, page);
    const w = document.getElementById(`tbl-wrap-${tableId}`);
    if (!w) return;
    w.outerHTML = _renderTablePage(tableId, page);
    document.getElementById(`tbl-wrap-${tableId}`)
      ?.closest('.ot-group-body,.ot-subgroup-body,.ot-sub2group-body,.ot-flat-table-wrap')
      ?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function buildRow(row, showArea = false) {
    const sc    = statusToClass(row.Estatus);
    const eIdx  = ETAPA_IDX[row.TipoProceso] ?? 'x';
    const statusLabel = row.Estatus ? escH(row.Estatus) : '-';
    const sem   = row.Semana
      ? `<span class="ot-semana asig">S${String(row.Semana).padStart(2,'0')}</span>`
      : `<span class="ot-semana no-asig">No programada</span>`;
    const comp  = row.TieneSolicitud === 'Si'
      ? `<span class="ot-compra si">✓ Sí</span>`
      : `<span class="ot-compra no">No</span>`;
    const xtra  = showArea
      ? `<td class="ot-sistema">${escH(row.Area)}</td><td><span class="ot-id">${escH(row.ID_EQUIPO)}</span></td>`
      : '';

    const isConcluida = row.Estatus === 'Concluida' || row.Estatus === 'Concluido';
    const isChecked   = _selectedOMs.has(String(row.ID_Orden));

    const checkCell = isConcluida
      ? `<td class="col-check"></td>`
      : `<td class="col-check" onclick="event.stopPropagation()">
          <input type="checkbox" class="ot-row-check" id="chk-om-${escH(row.ID_Orden)}"
                data-om-id="${escH(row.ID_Orden)}" ${isChecked ? 'checked' : ''}>
          <label for="chk-om-${escH(row.ID_Orden)}" class="ot-check-label">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" stroke-width="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </label>
        </td>`;

    return `
      <tr class="ot-data-row${isChecked ? ' row-selected' : ''}" data-ot-id="${escH(row.ID_Orden)}" title="Clic para ver detalle">
        ${checkCell}
        <td><span class="ot-id">${escH(row.ID_Orden)}</span></td>
        <td class="ot-sistema">${escH(row.ID_EQUIPO)}</td>
        <td class="ot-sistema">${escH(row.Sistema)}</td>
        <td><div class="ot-desc" title="${escH(row.Descripcion)}">${escH(row.Descripcion)}</div></td>
        <td><span class="ot-etapa-chip etapa-${eIdx}">${ETAPA_SHORT[row.TipoProceso] ?? escH(row.TipoProceso||'—')}</span></td>
        <td>
          <span class="ot-resumen">
            <span class="ot-badge concluidas">${row.otsConcluidas}✔</span>
            <span class="ot-badge pendientes">${row.otsPendientes}⏳</span>
          </span>
        </td>
        <td class="ot-fecha${row.FechaInicio?'':' no-asig'}">${escH(row.FechaInicio||'Sin asignar')}</td>
        <td>${sem}</td>
        <td><span class="ot-status ${sc}">${row.Estatus ? `<span class="ot-status-dot"></span>${statusLabel}` : '-'}</span></td>
        <td>${comp}</td>
        ${xtra}
      </tr>`;
  }

  function openModal(row) {
    window.ModalComponent ? ModalComponent.open(row) : console.error('ModalComponent no cargado');
  }
  function statusToClass(s) {
    if (!s || String(s).trim() === '') return '';
    const norm = String(s).trim().toLowerCase();
    if (norm === 'programado')  return 'status-programado';
    if (norm === 'en proceso')  return 'status-en-proceso';
    if (norm === 'concluida' || norm === 'completado') return 'status-completado';
    if (norm === 'pendiente')   return 'status-pendiente';
    return '';
  }
  function escH(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function buildLoadingState() {
    return `<div class="ot-loading"><div class="spinner"></div> Cargando órdenes de trabajo…</div>`;
  }
  function _goPage(p) {
    _currentPage = p; renderList();
    document.getElementById('ot-list-wrap')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  // ══════════════════════════════════════════════════════════
// BULK BAR — barra flotante de conclusión masiva
// ══════════════════════════════════════════════════════════
function _syncBulkBar() {
  let bar = document.getElementById('ot-bulk-bar');

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ot-bulk-bar';
    bar.innerHTML = `
      <!-- ═══ ESTADO A: Reposo ═══ -->
      <div class="bulk-state-a" id="bulk-state-a">
        <span class="bulk-bar-count">
          <span id="bulk-bar-num">0</span>
          <span class="bulk-bar-count-label"> órdenes seleccionadas</span>
        </span>
        <div class="bulk-bar-sep"></div>
        <button class="bulk-bar-btn bulk-btn-conclude" id="bulk-bar-conclude">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Concluir
        </button>
        <button class="bulk-bar-btn bulk-btn-schedule" id="bulk-bar-schedule">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Programar
        </button>
        <button class="bulk-bar-clear" id="bulk-bar-clear">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Limpiar
        </button>
      </div>

      <!-- ═══ ESTADO B: Formulario ═══ -->
      <div class="bulk-state-b" id="bulk-state-b" style="display:none">
        <span class="bulk-bar-action-label" id="bulk-action-label">Concluir</span>
        <div class="bulk-bar-sep"></div>
        <div class="bulk-field-wrap">
          <label class="bulk-field-label" for="bulk-obs">Observaciones</label>
          <input
            type="text"
            id="bulk-obs"
            class="bulk-input"
            placeholder="Observaciones opcionales…"
            autocomplete="off"
          />
        </div>
        <div class="bulk-field-wrap" id="bulk-fecha-wrap" style="display:none">
          <label class="bulk-field-label" for="bulk-fecha">Fecha</label>
          <input
            type="date"
            id="bulk-fecha"
            class="bulk-input bulk-input-date"
          />
        </div>
        <button class="bulk-bar-btn bulk-btn-save" id="bulk-bar-save" disabled>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Guardar
        </button>
        <button class="bulk-bar-btn bulk-btn-cancel" id="bulk-bar-cancel">
          Cancelar
        </button>
      </div>`;

    document.body.appendChild(bar);

    // ── Listeners Estado A ──
    document.getElementById('bulk-bar-conclude').addEventListener('click', () => {
      _enterBulkForm('concluir');
    });

    document.getElementById('bulk-bar-schedule').addEventListener('click', () => {
      _enterBulkForm('programar');
    });

    document.getElementById('bulk-bar-clear').addEventListener('click', () => {
      _clearSelection();
    });

    // ── Listeners Estado B ──
    document.getElementById('bulk-bar-cancel').addEventListener('click', _cancelBulkForm);

    document.getElementById('bulk-bar-save').addEventListener('click', () => {
      const obs   = document.getElementById('bulk-obs')?.value || '';
      const fecha = document.getElementById('bulk-fecha')?.value || '';
      _bulkUpdate(_currentBulkAction, { observaciones: obs, fecha });
    });

    // Validación dinámica del input de fecha (solo aplica a "programar")
    document.getElementById('bulk-fecha').addEventListener('input', _validateBulkSaveBtn);
  }

  // ── Sincronizar conteo ──
  const n = _selectedOMs.size;
  const numEl = document.getElementById('bulk-bar-num');
  if (numEl) numEl.textContent = n;

  bar.classList.toggle('visible', n > 0);

  // Si ya no hay selección, forzar regreso a Estado A
  if (n === 0) {
    _showBulkStateA();
  }
}

/** Entra al Estado B con la acción indicada */
function _enterBulkForm(accion) {
  _currentBulkAction = accion;

  // Actualizar etiqueta
  const label = document.getElementById('bulk-action-label');
  if (label) label.textContent = accion === 'programar' ? 'Programar' : 'Concluir';

  // Mostrar/ocultar campo de fecha
  const fechaWrap = document.getElementById('bulk-fecha-wrap');
  const fechaInput = document.getElementById('bulk-fecha');

  if (accion === 'programar') {
    if (fechaWrap) fechaWrap.style.display = '';

    // Resolución de fecha previa: si todas las OMs seleccionadas con fecha coinciden
    const todas = OTStore.getAll();
    const ids = [..._selectedOMs];
    const oms = ids.map(id => todas.find(o => String(o.ID_Orden) === id)).filter(Boolean);
    const fechas = oms
      .map(om => om.FechaInicio)
      .filter(f => f && f !== '—' && f.trim() !== '');

    let prefill = '';
    if (fechas.length > 0) {
      // Normalizar a formato yyyy-mm-dd para el input date
      const normalizadas = fechas.map(f => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f.slice(0, 10);
        if (f.includes('T')) return f.split('T')[0];
        return '';
      }).filter(Boolean);

      const unicas = [...new Set(normalizadas)];
      if (unicas.length === 1) prefill = unicas[0]; // todas coinciden
    }
    if (fechaInput) fechaInput.value = prefill;
  } else {
    // "concluir": ocultar fecha
    if (fechaWrap) fechaWrap.style.display = 'none';
    if (fechaInput) fechaInput.value = '';
  }

  // Limpiar observaciones
  const obsInput = document.getElementById('bulk-obs');
  if (obsInput) obsInput.value = '';

  // Estado del botón Guardar
  _validateBulkSaveBtn();

  // Cambiar vistas
  _showBulkStateB();
}

/** Vuelve al Estado A sin limpiar la selección */
function _cancelBulkForm() {
  _currentBulkAction = null;
  const obsInput = document.getElementById('bulk-obs');
  const fechaInput = document.getElementById('bulk-fecha');
  if (obsInput) obsInput.value = '';
  if (fechaInput) fechaInput.value = '';
  _showBulkStateA();
}

/** Muestra Estado A, oculta Estado B */
function _showBulkStateA() {
  const a = document.getElementById('bulk-state-a');
  const b = document.getElementById('bulk-state-b');
  if (a) a.style.display = '';
  if (b) b.style.display = 'none';
}

/** Muestra Estado B, oculta Estado A */
function _showBulkStateB() {
  const a = document.getElementById('bulk-state-a');
  const b = document.getElementById('bulk-state-b');
  if (a) a.style.display = 'none';
  if (b) b.style.display = '';
}

/** Habilita o deshabilita el botón Guardar según la acción actual */
function _validateBulkSaveBtn() {
  const btn = document.getElementById('bulk-bar-save');
  if (!btn) return;

  if (_currentBulkAction === 'programar') {
    const fecha = document.getElementById('bulk-fecha')?.value || '';
    btn.disabled = fecha.trim() === '';
  } else {
    // "concluir": siempre habilitado
    btn.disabled = false;
  }
}

function _clearSelection() {
  _selectedOMs.clear();
  _currentBulkAction = null;

  // Quitar estilos visuales de filas seleccionadas sin re-renderizar toda la lista
  document.querySelectorAll('tr.row-selected').forEach(tr => {
    tr.classList.remove('row-selected');
    const chk = tr.querySelector('.ot-row-check');
    if (chk) chk.checked = false;
  });
  document.querySelectorAll('.ot-check-all').forEach(chk => {
    chk.checked = false;
  });

  _syncBulkBar();
}

async function _bulkUpdate(accion, datosFormulario = {}) {
  if (_selectedOMs.size === 0) return;

  const ids   = [..._selectedOMs];
  const todas = OTStore.getAll();
  const oms   = ids.map(id => todas.find(o => String(o.ID_Orden) === id)).filter(Boolean);

  // ── Validación: OTs pendientes (solo aplica a "concluir") ──
  if (accion === 'concluir') {
    const conOTsPendientes = oms.filter(om => {
      const ots = window.OTWorkStore?.getOTsByOM(om.ID_Orden) || [];
      return ots.some(ot => ot.Estatus !== 'Concluida');
    });

    if (conOTsPendientes.length > 0) {
      const nombres = conOTsPendientes.map(o => o.ID_Orden).join(', ');
      window.ToastService?.show(
        `No se puede concluir: ${conOTsPendientes.length} OM(s) tienen OTs pendientes (${nombres}).`,
        'warning'
      );
      return;
    }
  }

  // ── Función de ejecución real ──
  const ejecutar = async () => {
    const saveBtn = document.getElementById('bulk-bar-save');
    const origHTML = saveBtn?.innerHTML;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<div class="spinner-sm" style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-bottom-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Guardando…`;
    }

    const hoy = new Date();
    const hoyISO = hoy.toISOString().slice(0, 10);

    let errores = 0;

    for (const om of oms) {
      let cambios = {};

      if (accion === 'concluir') {
        cambios.estatus = 'Concluida';
        cambios.fechaConclusion = hoyISO;
        const nuevaObs = datosFormulario.observaciones?.trim();
        const actualObs = String(om.Observaciones ?? '').trim();
        if (nuevaObs) {
          cambios.observaciones = actualObs
            ? `${actualObs} -- ${nuevaObs}`
            : nuevaObs;
        }
        if (!om.FechaInicio || om.FechaInicio === '—' || om.FechaInicio.trim() === '') {
          cambios.fechaInicio = hoyISO;
        }
      } else if (accion === 'programar') {
        cambios.estatus = 'Programado';
        if (datosFormulario.fecha) {
          cambios.fechaInicio = datosFormulario.fecha;
        }
        const nuevaObs = datosFormulario.observaciones?.trim();
        const actualObs = String(om.Observaciones ?? '').trim();
        if (nuevaObs) {
          cambios.observaciones = actualObs
            ? `${actualObs} -- ${nuevaObs}`
            : nuevaObs;
        }
      }

      const res = await OMService.actualizar(om, cambios);
      if (!res.ok) errores++;
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      if (origHTML) saveBtn.innerHTML = origHTML;
    }

    if (errores === 0) {
      const accionLabel = accion === 'concluir' ? 'concluida(s)' : 'programada(s)';
      window.ToastService?.show(`${oms.length} orden(es) ${accionLabel} correctamente.`, 'success');
      _clearSelection();           // limpia selección y cierra barra
      _updateGauge();
      renderKPIs();
      renderList();
    } else {
      window.ToastService?.show(`${errores} error(es) al guardar. Revisa e intenta de nuevo.`, 'danger');
    }
  };

  // Confirmación modal solo para "concluir"
  if (accion === 'concluir' && window.ConfirmConcluirModal) {
    window.ConfirmConcluirModal.show(ejecutar);
  } else {
    ejecutar();
  }
}

  return {
  mount, onEnter,
  _toggle, _addDim, _removeDim, _moveDim,
  _applyPreset, _clearGroups,
  _goPage, _goTablePage,
  _filterByKPI,
  _updateGauge,
  _syncBulkBar,
  _bulkUpdate,
  _clearSelection,
};
})();