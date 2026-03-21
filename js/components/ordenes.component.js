// ============================================================
// CADASA TALLER — ÓRDENES DE TRABAJO COMPONENT v4.1
// + Velocímetro SVG (gauge.component.js requerido)
// ============================================================

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

  const PRESETS = [
    { label: 'Equipo › Semana › Proceso', dims: ['equipo','semana','proceso'] },
    { label: 'Área › Equipo',             dims: ['area','equipo']             },
    { label: 'Semana › Proceso',          dims: ['semana','proceso']          },
    { label: 'Proceso › Equipo',          dims: ['proceso','equipo']          },
    { label: 'Solo Estado',               dims: ['estatus']                   },
  ];

  // ── Estado ───────────────────────────────────────────────
  let _activeDims = ['semana'];
  let _unsub      = null;
  let _activeKPI  = null;
  const _rowCache   = new Map();
  const _tableCache = new Map();
  let _tablePages   = new Map();
  const PAGE_SIZE   = 100;
  let _currentPage  = 0;

  // ══════════════════════════════════════════════════════════
  // MOUNT
  // ══════════════════════════════════════════════════════════
  function mount(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = buildShell();
    bindStaticEvents();
    renderGroupingPanel();
  }

  function buildShell() {
    return `
      <div class="ot-page">

        <!-- 1. TOP BAR (búsqueda + reload) — solo admins -->
        <div class="ot-top-bar" id="ot-top-bar">
          <div class="ot-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input class="ot-search" id="ot-search"
              type="text" placeholder="Buscar por ID, equipo, descripción…" autocomplete="off"/>
          </div>
          <button class="btn-reload" id="btn-reload" title="Recargar datos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        <!-- 2. Panel de agrupación — solo admins -->
        <div class="ot-grouping-panel" id="ot-grouping-panel"></div>

        <!-- 3. KPIs como filtros -->
        <div class="ot-kpi-bar" id="ot-kpi-bar">${buildKPISkeleton()}</div>

        <!-- 4. Velocímetro — debajo de KPIs -->
        <div id="ot-gauge-wrap"></div>

        <!-- 5. Lista / tabla -->
        <div class="ot-list-wrap" id="ot-list-wrap">${buildLoadingState()}</div>
      </div>
      <div id="ot-modal-root"></div>`;
  }

  // ══════════════════════════════════════════════════════════
  // PANEL DE AGRUPACIÓN — simplificado
  // ══════════════════════════════════════════════════════════
  function renderGroupingPanel() {
    const panel = document.getElementById('ot-grouping-panel');
    if (!panel) return;
    const available = ALL_DIMS.filter(d => !_activeDims.includes(d.id));

    panel.innerHTML = `
      <div class="ot-grp-simple">
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
                    ${canUp ? `<button onclick="OTComponent._moveDim('${dimId}',-1)" title="Mover izquierda">‹</button>` : ''}
                    ${canDn ? `<button onclick="OTComponent._moveDim('${dimId}',1)"  title="Mover derecha">›</button>` : ''}
                    <button class="rm" onclick="OTComponent._removeDim('${dimId}')" title="Quitar">✕</button>
                  </span>`;
              }).join('')
          }
        </div>

        ${available.length > 0 ? `<span class="ot-grp-sep">+</span>` : ''}

        <div class="ot-grp-available">
          ${available.map(dim => `
            <span class="ot-grp-chip avail dim-${dim.id}"
                  onclick="OTComponent._addDim('${dim.id}')">
              ${dim.label}
            </span>`).join('')}
        </div>

        <div class="ot-grp-presets">
          ${PRESETS.map(p => {
            const isActive = JSON.stringify(_activeDims) === JSON.stringify(p.dims);
            return `<button class="ot-grp-preset${isActive?' on':''}"
                            onclick="OTComponent._applyPreset('${p.dims.join(',')}')">
                      ${p.label}
                    </button>`;
          }).join('')}
          ${_activeDims.length > 0
            ? `<button class="ot-grp-preset clear" onclick="OTComponent._clearGroups()">Sin agrupar</button>`
            : ''}
        </div>
      </div>`;
  }

  function _addDim(dimId) {
    if (!_activeDims.includes(dimId)) { _activeDims.push(dimId); _refreshPanel(); }
  }
  function _removeDim(dimId) {
    _activeDims = _activeDims.filter(d => d !== dimId); _refreshPanel();
  }
  function _moveDim(dimId, dir) {
    const idx = _activeDims.indexOf(dimId);
    if (idx === -1) return;
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
    renderGroupingPanel();
    renderList();
  }

  // ══════════════════════════════════════════════════════════
  // EVENTOS ESTÁTICOS
  // ══════════════════════════════════════════════════════════
  function bindStaticEvents() {
    document.getElementById('ot-search')?.addEventListener('input', e => {
      OTStore.setFilter('search', e.target.value);
      _currentPage = 0;
      _updateGaugeFromSearch();
      renderList();
    });
    document.getElementById('btn-reload')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-reload');
      btn?.classList.add('spinning');
      OTStore.load(AuthService?.isAuthenticated() ?? false).then(() => {
        btn?.classList.remove('spinning');
        _updateGaugeFromSearch();
        renderList();
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // onEnter
  // ══════════════════════════════════════════════════════════
  function onEnter() {
    if (_unsub) _unsub();
    _unsub = OTStore.subscribe(event => {
      if (event === 'ready' || event === 'filtered') {
        renderKPIs();
        _updateGaugeFromSearch();
        renderList();
      }
      if (event === 'loading') {
        const w = document.getElementById('ot-list-wrap');
        if (w) w.innerHTML = buildLoadingState();
      }
    });
    if (OTStore.getAll().length === 0) {
      OTStore.load(AuthService?.isAuthenticated() ?? false);
    } else {
      renderKPIs();
      _updateGaugeFromSearch();
      renderList();
    }

    const user     = AuthService.getUser();
    const isAdmin  = user?.role === 'ADMIN';
    const topBar   = document.getElementById('ot-top-bar');
    const grpPanel = document.getElementById('ot-grouping-panel');
    if (topBar)   topBar.style.display   = isAdmin ? '' : 'none';
    if (grpPanel) grpPanel.style.display = isAdmin ? '' : 'none';
  }

  // ══════════════════════════════════════════════════════════
  // GAUGE — solo filtro de búsqueda, ignora filtros de KPI
  // ══════════════════════════════════════════════════════════
  function _updateGaugeFromSearch() {
    if (!window.GaugeComponent) return;
    const search = (OTStore.getFilters().search || '').toLowerCase().trim();
    let rows = OTStore.getAll();
    if (search) {
      rows = rows.filter(o =>
        (o.ID_Orden    || '').toLowerCase().includes(search) ||
        (o.Descripcion || '').toLowerCase().includes(search) ||
        (o.ITEM        || '').toLowerCase().includes(search) ||
        (o.Sistema     || '').toLowerCase().includes(search) ||
        (o.ID_EQUIPO   || '').toLowerCase().includes(search)
      );
    }
    GaugeComponent.update(rows);
  }

  // ══════════════════════════════════════════════════════════
  // KPIs — clickeables como filtros
  // Los números se calculan sobre datos filtrados solo por búsqueda
  // ══════════════════════════════════════════════════════════
  function renderKPIs() {
    const search = (OTStore.getFilters().search || '').toLowerCase().trim();
    let base = OTStore.getAll();
    if (search) {
      base = base.filter(o =>
        (o.ID_Orden    || '').toLowerCase().includes(search) ||
        (o.Descripcion || '').toLowerCase().includes(search) ||
        (o.ITEM        || '').toLowerCase().includes(search) ||
        (o.Sistema     || '').toLowerCase().includes(search) ||
        (o.ID_EQUIPO   || '').toLowerCase().includes(search)
      );
    }

    const k = {
      total:      base.length,
      programado: base.filter(o => o.Estatus === 'Programado').length,
      enProceso:  base.filter(o => o.Estatus === 'En proceso').length,
      completado: base.filter(o => o.Estatus === 'Completado').length,
      sinSemana:  base.filter(o => !o.Semana).length,
    };

    const bar = document.getElementById('ot-kpi-bar');
    if (!bar) return;

    const cards = [
      { key: 'total',      val: k.total,      label: 'Total OTs',   cls: 'total',  filterKey: null,      filterVal: null         },
      { key: 'programado', val: k.programado, label: 'Programadas', cls: 'prog',   filterKey: 'estatus', filterVal: 'Programado' },
      { key: 'enProceso',  val: k.enProceso,  label: 'En Proceso',  cls: 'pend',   filterKey: 'estatus', filterVal: 'En proceso' },
      { key: 'completado', val: k.completado, label: 'Completadas', cls: 'done',   filterKey: 'estatus', filterVal: 'Completado' },
      { key: 'sinSemana',  val: k.sinSemana,  label: 'Sin Semana',  cls: 'noasig', filterKey: 'semana',  filterVal: '__noasig'   },
    ];

    bar.innerHTML = cards.map(c => {
      const isActive = _activeKPI === c.key;
      return `
        <div class="ot-kpi${isActive ? ' kpi-active' : ''}"
             onclick="OTComponent._filterByKPI('${c.key}','${c.filterKey||''}','${c.filterVal||''}')"
             title="${isActive ? 'Clic para quitar filtro' : 'Clic para filtrar'}">
          <span class="ot-kpi-dot ${c.cls}"></span>
          <div class="ot-kpi-body">
            <div class="ot-kpi-val">${c.val}</div>
            <div class="ot-kpi-label">${c.label}</div>
          </div>
          ${isActive ? `<span class="ot-kpi-active-badge">✓</span>` : ''}
        </div>`;
    }).join('');
  }

  function _filterByKPI(kpiKey, filterKey, filterVal) {
    if (_activeKPI === kpiKey) {
      _activeKPI = null;
      if (filterKey) OTStore.setFilter(filterKey, '');
    } else {
      if (_activeKPI) {
        const prev = _getKPIFilterKey(_activeKPI);
        if (prev) OTStore.setFilter(prev, '');
      }
      _activeKPI = kpiKey;
      if (filterKey) OTStore.setFilter(filterKey, filterVal);
    }
    _currentPage = 0;
    renderKPIs();
    // El gauge NO se actualiza al cambiar KPI — solo búsqueda lo mueve
    renderList();
  }

  function _getKPIFilterKey(kpiKey) {
    return { programado:'estatus', enProceso:'estatus', completado:'estatus', sinSemana:'semana' }[kpiKey] || null;
  }

  function buildKPISkeleton() {
    return ['Total OTs','Programadas','En Proceso','Completadas','Sin Semana']
      .map(l => `<div class="ot-kpi"><span class="ot-kpi-dot total"></span>
        <div class="ot-kpi-body"><div class="ot-kpi-val">—</div>
        <div class="ot-kpi-label">${l}</div></div></div>`).join('');
  }

  // ══════════════════════════════════════════════════════════
  // RENDER LISTA
  // ══════════════════════════════════════════════════════════
  function renderList() {
    _tableCache.clear();
    _tablePages.clear();
    const wrap = document.getElementById('ot-list-wrap');
    if (!wrap) return;

    const data = OTStore.getFiltered();
    _rowCache.clear();
    data.forEach(row => _rowCache.set(String(row.ID_Orden), row));

    if (data.length === 0) {
      wrap.innerHTML = `<div class="ot-empty">
        <div class="ot-empty-icon">🔍</div>
        <div class="ot-empty-text">No se encontraron órdenes con los filtros aplicados.</div>
      </div>`;
    } else if (_activeDims.length === 0) {
      wrap.innerHTML = `<div class="ot-flat-table-wrap">${buildTable(data, true, 'flat_main')}</div>`;
    } else {
      const tree = buildTree(data, _activeDims, 0);
      wrap.innerHTML = renderNodes(tree, 0);
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
  }

  // ══════════════════════════════════════════════════════════
  // ÁRBOL
  // ══════════════════════════════════════════════════════════
  function buildTree(rows, dims, depth) {
    if (depth >= dims.length) return rows;
    const dim = dims[depth], groups = {}, order = [];
    rows.forEach(row => {
      const key = getDimKey(row, dim);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(row);
    });
    order.sort((a, b) => {
      if (a.startsWith('Sin ')) return 1;
      if (b.startsWith('Sin ')) return -1;
      return a.localeCompare(b, 'es', { numeric: true });
    });
    return order.map(key => ({
      dim, key,
      noAsig:   key.startsWith('Sin '),
      count:    groups[key].length,
      children: buildTree(groups[key], dims, depth + 1),
    }));
  }

  function getDimKey(row, dim) {
    switch (dim) {
      case 'equipo':  return row.ID_EQUIPO ? `${row.ID_EQUIPO} — ${row.ITEM}` : 'Sin equipo';
      case 'semana':  return row.Semana    ? `Semana ${String(row.Semana).padStart(2,'0')}` : 'Sin semana asignada';
      case 'proceso': return row.TipoProceso || 'Sin tipo de proceso';
      case 'area':    return row.Area        || 'Sin área';
      case 'estatus': return row.Estatus     || 'Sin estado';
      default:        return '—';
    }
  }

  function renderNodes(nodes, level) {
    if (!nodes || nodes.length === 0) return '';
    const isDataLeaf = nodes[0] && nodes[0].dim === undefined;
    if (isDataLeaf) {
      const tblId = safeUID(level, 'leaf', nodes.map(r => r.ID_Orden).join('').slice(0, 20));
      return `<div class="ot-table-wrap">${buildTable(nodes, false, tblId)}</div>`;
    }
    return nodes.map(node => {
      const uid      = safeUID(level, node.dim, node.key);
      const dimLabel = ALL_DIMS.find(d => d.id === node.dim)?.label ?? node.dim;
      const inner    = renderNodes(node.children, level + 1);

      if (level === 0) return `
        <div class="ot-group ${level === _activeDims.length - 1 ? 'collapsed' : ''}" id="${uid}">
          <div class="ot-group-header dim-${node.dim}" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ot-group-dim-badge badge-${node.dim}">${dimLabel}</span>
            <span class="ot-group-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-group-count">${node.count} OT${node.count!==1?'s':''}</span>
          </div>
          <div class="ot-group-body">${inner}</div>
        </div>`;

      if (level === 1) return `
        <div class="ot-subgroup ${level === _activeDims.length - 1 ? 'collapsed' : ''}" id="${uid}">
          <div class="ot-subgroup-header dim-${node.dim}" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-subgroup-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ot-group-dim-badge badge-${node.dim}" style="font-size:0.57rem;padding:0.12rem 0.4rem;">${dimLabel}</span>
            <span class="ot-subgroup-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-subgroup-cnt">${node.count} OTs</span>
          </div>
          <div class="ot-subgroup-body">${inner}</div>
        </div>`;

      return `
        <div class="ot-sub2group ${level === _activeDims.length - 1 ? 'collapsed' : ''}" id="${uid}">
          <div class="ot-sub2group-header" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-sub2group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ot-sub2group-dim">${dimLabel}</span>
            <span class="ot-sub2group-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-sub2group-cnt">${node.count} OTs</span>
          </div>
          <div class="ot-sub2group-body">${inner}</div>
        </div>`;
    }).join('');
  }

  function safeUID(level, dim, key) {
    const clean = ('g' + level + '_' + dim + '_' + key)
      .replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,50);
    return `${clean}_${Math.random().toString(36).slice(2,7)}`;
  }

  function _toggle(uid) {
    document.getElementById(uid)?.classList.toggle('collapsed');
  }

  // ══════════════════════════════════════════════════════════
  // TABLA
  // ══════════════════════════════════════════════════════════
  function buildTable(rows, showArea = false, tableId = 'tbl_' + Math.random().toString(36).slice(2,7)) {
    if (!rows || rows.length === 0)
      return `<div style="padding:1rem 1.5rem;font-size:0.8rem;color:var(--text-muted);">Sin órdenes.</div>`;
    _tableCache.set(tableId, { rows, showArea });
    _tablePages.set(tableId, _tablePages.get(tableId) ?? 0);
    return _renderTablePage(tableId, _tablePages.get(tableId));
  }

  function _renderTablePage(tableId, page) {
    const cached = _tableCache.get(tableId);
    if (!cached) return '';
    const { rows, showArea } = cached;
    const total = rows.length, pages = Math.ceil(total / PAGE_SIZE);
    const start = page * PAGE_SIZE, pageRows = rows.slice(start, start + PAGE_SIZE);

    const extraH = showArea ? '<th>Área</th><th>Equipo</th>' : '';
    const thead = `<tr>
      <th>ID Orden</th><th>Sistema</th><th>Descripción</th><th>Tipo Proceso</th>
      <th>Fecha Inicio</th><th>Semana</th><th>Estado</th><th>Compra</th>${extraH}
    </tr>`;

    const WINDOW = 10, half = Math.floor(WINDOW / 2);
    let winStart = Math.max(0, page - half);
    let winEnd   = Math.min(pages - 1, winStart + WINDOW - 1);
    if (winEnd - winStart < WINDOW - 1) winStart = Math.max(0, winEnd - WINDOW + 1);
    const btnPages = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);

    const pagination = pages > 1 ? `
      <div class="ot-pagination">
        <span class="ot-pagination-info">
          <strong>${start+1}–${Math.min(start+PAGE_SIZE,total)}</strong>
          <span>de ${total} órdenes</span>
        </span>
        <div class="ot-pagination-btns">
          <button class="ot-page-btn nav-btn" ${page===0?'disabled':''}
            onclick="OTComponent._goTablePage('${tableId}',${page-1})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          ${winStart>0?`<button class="ot-page-btn" onclick="OTComponent._goTablePage('${tableId}',0)">1</button><span class="ot-page-ellipsis">…</span>`:''}
          ${btnPages.map(i=>`<button class="ot-page-btn${i===page?' active':''}" onclick="OTComponent._goTablePage('${tableId}',${i})">${i+1}</button>`).join('')}
          ${winEnd<pages-1?`<span class="ot-page-ellipsis">…</span><button class="ot-page-btn" onclick="OTComponent._goTablePage('${tableId}',${pages-1})">${pages}</button>`:''}
          <button class="ot-page-btn nav-btn" ${page>=pages-1?'disabled':''}
            onclick="OTComponent._goTablePage('${tableId}',${page+1})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>` : '';

    return `<div id="tbl-wrap-${tableId}">
      <table class="ot-table">
        <thead>${thead}</thead>
        <tbody>${pageRows.map(r => buildRow(r, showArea)).join('')}</tbody>
      </table>
      ${pagination}
    </div>`;
  }

  function _goTablePage(tableId, page) {
    _tablePages.set(tableId, page);
    const wrap = document.getElementById(`tbl-wrap-${tableId}`);
    if (!wrap) return;
    wrap.outerHTML = _renderTablePage(tableId, page);
    document.getElementById(`tbl-wrap-${tableId}`)
      ?.closest('.ot-group-body,.ot-subgroup-body,.ot-sub2group-body,.ot-flat-table-wrap')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function buildRow(row, showArea = false) {
    const sc   = statusToClass(row.Estatus);
    const eIdx = ETAPA_IDX[row.TipoProceso] ?? 'x';
    const sem  = row.Semana
      ? `<span class="ot-semana asig">S${String(row.Semana).padStart(2,'0')}</span>`
      : `<span class="ot-semana no-asig">—</span>`;
    const comp = row.TieneSolicitud === 'Si'
      ? `<span class="ot-compra si">✓ Sí</span>`
      : `<span class="ot-compra no">No</span>`;
    const xtra = showArea
      ? `<td class="ot-sistema">${escH(row.Area)}</td><td><span class="ot-id">${escH(row.ID_EQUIPO)}</span></td>`
      : '';
    return `
      <tr class="ot-data-row" data-ot-id="${escH(row.ID_Orden)}" title="Clic para ver detalle completo">
        <td><span class="ot-id">${escH(row.ID_Orden)}</span></td>
        <td class="ot-sistema">${escH(row.Sistema)}</td>
        <td><div class="ot-desc" title="${escH(row.Descripcion)}">${escH(row.Descripcion)}</div></td>
        <td><span class="ot-etapa-chip etapa-${eIdx}">${ETAPA_SHORT[row.TipoProceso] ?? escH(row.TipoProceso||'—')}</span></td>
        <td class="ot-fecha${row.FechaInicio?'':' no-asig'}">${escH(row.FechaInicio||'Sin asignar')}</td>
        <td>${sem}</td>
        <td><span class="ot-status ${sc}"><span class="ot-status-dot"></span>${escH(row.Estatus)}</span></td>
        <td>${comp}</td>
        ${xtra}
      </tr>`;
  }

  function openModal(row) {
    if (window.ModalComponent) ModalComponent.open(row);
    else console.error('ModalComponent no está cargado.');
  }

  function statusToClass(s) {
    return { 'Programado':'status-programado','En proceso':'status-en-proceso',
             'Completado':'status-completado','Pendiente':'status-pendiente' }[s] ?? 'status-programado';
  }

  function escH(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function buildLoadingState() {
    return `<div class="ot-loading"><div class="spinner"></div> Cargando órdenes de trabajo…</div>`;
  }

  function _goPage(page) {
    _currentPage = page;
    renderList();
    document.getElementById('ot-list-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return {
    mount, onEnter,
    _toggle, _addDim, _removeDim, _moveDim,
    _applyPreset, _clearGroups,
    _goPage, _goTablePage,
    _filterByKPI,
  };
})(); 