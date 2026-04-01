
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
    { id: 'proceso', label: 'Tipo de Proceso' },
    { id: 'area',    label: 'Área'            },
    { id: 'estatus', label: 'Estado'          },
  ];

  // ── Estado ───────────────────────────────────────────────
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
  function renderTopBar() {
    const card = document.getElementById('ot-topcard');
    if (!card) return;

    const available = ALL_DIMS.filter(d => !_activeDims.includes(d.id));

    card.innerHTML = `
      <!-- Mitad izquierda: búsqueda -->
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

      <!-- Divisor vertical -->
      <div class="ot-topcard-div" id="ot-topcard-div"></div>

      <!-- Mitad derecha: agrupación — solo admins -->
      <div class="ot-topcard-grp" id="ot-topcard-grp">
        <span class="ot-grp-label">Agrupar</span>

        <!-- Chips activos -->
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
                    ${canUp ? `<button onclick="OTComponent._moveDim('${dimId}',-1)">‹</button>` : ''}
                    ${canDn ? `<button onclick="OTComponent._moveDim('${dimId}',1)">›</button>`  : ''}
                    <button class="rm" onclick="OTComponent._removeDim('${dimId}')">✕</button>
                  </span>`;
              }).join('')
          }
        </div>

        <!-- Chips disponibles para añadir -->
        ${available.length > 0 ? `
          <span class="ot-grp-sep">+</span>
          <div class="ot-grp-available">
            ${available.map(dim => `
              <span class="ot-grp-chip avail dim-${dim.id}"
                    onclick="OTComponent._addDim('${dim.id}')">
                ${dim.label}
              </span>`).join('')}
          </div>` : ''}

        <!-- Botón limpiar -->
        ${_activeDims.length > 0
          ? `<button class="ot-grp-clear" onclick="OTComponent._clearGroups()">✕ Quitar todo</button>`
          : ''}
      </div>`;

    // Re-bind eventos del input (se re-renderizó)
    document.getElementById('ot-search')?.addEventListener('input', e => {
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
    if (!_activeDims.includes(dimId)) { _activeDims.push(dimId); _refreshPanel(); }
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
    _currentPage = 0;
    renderTopBar();
    renderList();
  }

  // ══════════════════════════════════════════════════════════
  // bindStaticEvents — solo los que no están en renderTopBar
  // ══════════════════════════════════════════════════════════
  function bindStaticEvents() {
    // Los del input y reload se bindean dentro de renderTopBar
    // porque el DOM se re-crea al renderizar
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
    if (grp) grp.style.display = isAdmin ? '' : 'none';
    if (div) div.style.display = isAdmin ? '' : 'none';
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
    order.sort((a, b) => {
      if (a.startsWith('Sin ')) return 1;
      if (b.startsWith('Sin ')) return -1;
      return a.localeCompare(b, 'es', { numeric: true });
    });
    return order.map(k => ({
      dim, key: k,
      noAsig: k.startsWith('Sin '),
      count: groups[k].length,
      children: buildTree(groups[k], dims, depth + 1),
    }));
  }

  function getDimKey(row, dim) {
    switch (dim) {
      case 'equipo':  return row.ID_EQUIPO ? `${row.ID_EQUIPO} — ${row.ITEM}` : 'Sin equipo';
      case 'semana':  return row.Semana ? `Semana ${String(row.Semana).padStart(2,'0')}` : 'No programada';
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
            <span class="ot-group-count">${node.count} OT${node.count!==1?'s':''}</span>
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
    const thead = `<tr>${checkAllCell}<th>ID Orden</th><th>Sistema</th><th>Descripción</th>
      <th>Tipo Proceso</th><th>Fecha Inicio</th><th>Semana</th><th>Estado</th><th>Compra</th>${xH}</tr>`;

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
        <td class="ot-sistema">${escH(row.Sistema)}</td>
        <td><div class="ot-desc" title="${escH(row.Descripcion)}">${escH(row.Descripcion)}</div></td>
        <td><span class="ot-etapa-chip etapa-${eIdx}">${ETAPA_SHORT[row.TipoProceso] ?? escH(row.TipoProceso||'—')}</span></td>
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
      <span class="bulk-bar-count"><span id="bulk-bar-num">0</span> órdenes seleccionadas</span>
      <div class="bulk-bar-sep"></div>
      <button class="bulk-bar-btn" id="bulk-bar-conclude">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Concluir seleccionadas
      </button>
      <button class="bulk-bar-clear" id="bulk-bar-clear">Limpiar</button>`;
    document.body.appendChild(bar);
    document.getElementById('bulk-bar-conclude').addEventListener('click', _bulkConcluir);
    document.getElementById('bulk-bar-clear').addEventListener('click', () => {
      _selectedOMs.clear();
      // Re-render para quitar los checks visuales
      renderList();
      _syncBulkBar();
    });
  }

  const n = _selectedOMs.size;
  document.getElementById('bulk-bar-num').textContent = n;
  bar.classList.toggle('visible', n > 0);
}

async function _bulkConcluir() {
  if (_selectedOMs.size === 0) return;

  const ids   = [..._selectedOMs];
  const todas = OTStore.getAll();
  const oms   = ids.map(id => todas.find(o => String(o.ID_Orden) === id)).filter(Boolean);

  // 1. Validar OTs pendientes en cada OM
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

  // 2. Confirmación
  const usar = window.ConfirmConcluirModal ?? null;
  const ejecutar = async () => {
    const btn = document.getElementById('bulk-bar-conclude');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner-sm" style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-bottom-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Guardando…`;

    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd   = String(hoy.getDate()).padStart(2, '0');
    const hoyFmt = `${mm}/${dd}/${yyyy}`;

    let errores = 0;
    for (const om of oms) {
      // 3. Si no tiene fecha de inicio, la ponemos igual a hoy
      const cambios = { estatus: 'Concluida', fechaConclusion: hoyFmt };
      if (!om.FechaInicio || om.FechaInicio === '—' || om.FechaInicio.trim() === '') {
        cambios.fechaInicio = hoyFmt;
      }
      const res = await OMService.actualizar(om, cambios);
      if (!res.ok) errores++;
    }

    btn.disabled = false;
    btn.innerHTML = orig;

    if (errores === 0) {
      window.ToastService?.show(`${oms.length} orden(es) concluida(s) correctamente.`, 'success');
      _selectedOMs.clear();
      _syncBulkBar();
      renderList();
      _updateGauge();
      renderKPIs();
    } else {
      window.ToastService?.show(`${errores} error(es) al guardar. Revisa e intenta de nuevo.`, 'danger');
    }
  };

  if (usar) {
    usar.show(ejecutar);
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
  _syncBulkBar,   // 👈 nuevo
  _bulkConcluir,  // 👈 nuevo
};
})();