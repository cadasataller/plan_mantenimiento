// ============================================================
// CADASA TALLER — ÓRDENES DE TRABAJO COMPONENT v3
// Agrupación flexible con clicks + modal de detalle correcto
// ============================================================

const OTComponent = (() => {

  // ── Catálogo de etapas ───────────────────────────────────
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
    { id: 'equipo',  label: 'Equipo'          },
    { id: 'semana',  label: 'Semana'           },
    { id: 'proceso', label: 'Tipo de Proceso'  },
    { id: 'area',    label: 'Área'             },
    { id: 'estatus', label: 'Estado'           },
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
  let _unsub = null;
  const _rowCache = new Map(); // ID → row object (para el modal)
  const PAGE_SIZE = 50;        // ← agregar
  let _currentPage = 0; 

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
        <div class="ot-page-header">
          <div class="ot-page-title-group">
            <div class="ot-page-eyebrow">Módulo de Gestión</div>
            <h2 class="ot-page-title">Órdenes de Trabajo</h2>
            <p class="ot-page-subtitle" id="ot-subtitle">Cargando datos…</p>
          </div>
          <span class="ot-source-badge demo" id="ot-source-badge">
            <span class="ot-source-dot"></span>
            <span id="ot-source-label">Demo</span>
          </span>
        </div>

        <div class="ot-kpi-bar" id="ot-kpi-bar">${buildKPISkeleton()}</div>

        <div class="ot-toolbar">
          <div class="ot-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input class="ot-search" id="ot-search"
              type="text" placeholder="Buscar por ID, equipo, descripción…" autocomplete="off"/>
          </div>
          <div class="ot-toolbar-sep"></div>
          <select class="ot-select" id="ot-filter-area">
            <option value="">Todas las áreas</option>
          </select>
          <select class="ot-select" id="ot-filter-estatus">
            <option value="">Todos los estados</option>
            <option value="Programado">Programado</option>
            <option value="En proceso">En proceso</option>
            <option value="Completado">Completado</option>
            <option value="Pendiente">Pendiente</option>
          </select>
          <select class="ot-select" id="ot-filter-semana">
            <option value="">Todas las semanas</option>
            <option value="__noasig">Sin asignar</option>
          </select>
          <div class="ot-toolbar-sep"></div>
          <button class="btn-reload" id="btn-reload" title="Recargar datos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        <div class="ot-grouping-panel" id="ot-grouping-panel"></div>
        <div class="ot-list-wrap" id="ot-list-wrap">${buildLoadingState()}</div>
      </div>
      <div id="ot-modal-root"></div>`;
  }

  // ══════════════════════════════════════════════════════════
  // PANEL DE AGRUPACIÓN — todo por click
  // ══════════════════════════════════════════════════════════
  function renderGroupingPanel() {
    const panel = document.getElementById('ot-grouping-panel');
    if (!panel) return;

    const available = ALL_DIMS.filter(d => !_activeDims.includes(d.id));
    const presetActive = PRESETS.find(p => JSON.stringify(p.dims) === JSON.stringify(_activeDims));

    panel.innerHTML = `
      <div class="ot-grouping-header">
        <div class="ot-grouping-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Agrupar por
        </div>
        <span class="ot-grouping-hint">Clic para añadir · ✕ para quitar · ↑↓ para reordenar</span>
      </div>

      <div class="ot-grouping-body">

        <!-- Zona activa -->
        <div class="ot-grouping-active-wrap">
          <div class="ot-dim-zone-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Jerarquía activa
            ${_activeDims.length > 0
              ? `<span class="ot-active-count">${_activeDims.length} nivel${_activeDims.length > 1 ? 'es' : ''}</span>`
              : ''}
          </div>
          <div class="ot-active-chips">
            ${_activeDims.length === 0
              ? `<span class="ot-empty-hint">Sin agrupación — haz clic en una dimensión disponible</span>`
              : _activeDims.map((dimId, idx) => {
                  const dim = ALL_DIMS.find(d => d.id === dimId);
                  const canUp   = idx > 0;
                  const canDown = idx < _activeDims.length - 1;
                  return `
                    ${idx > 0 ? `<span class="ot-level-sep">›</span>` : ''}
                    <span class="ot-dim-chip active-chip dim-${dimId}">
                      <span class="ot-level-num">${idx + 1}</span>
                      ${dim.label}
                      <span class="ot-chip-actions">
                        <button class="ot-chip-btn${canUp?'':' disabled'}" ${canUp?`onclick="OTComponent._moveDim('${dimId}',-1)"`:'disabled'} title="Subir">↑</button>
                        <button class="ot-chip-btn${canDown?'':' disabled'}" ${canDown?`onclick="OTComponent._moveDim('${dimId}',1)"`:'disabled'} title="Bajar">↓</button>
                        <button class="ot-chip-btn remove" onclick="OTComponent._removeDim('${dimId}')" title="Quitar">✕</button>
                      </span>
                    </span>`;
                }).join('')
            }
          </div>
        </div>

        <div class="ot-grouping-divider"></div>

        <!-- Disponibles -->
        <div class="ot-grouping-available-wrap">
          <div class="ot-dim-zone-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Añadir dimensión
          </div>
          <div class="ot-available-chips">
            ${available.length === 0
              ? `<span class="ot-empty-hint">Todas las dimensiones están activas</span>`
              : available.map(dim => `
                  <span class="ot-dim-chip available-chip dim-${dim.id}"
                        onclick="OTComponent._addDim('${dim.id}')"
                        title="Clic para añadir">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px;flex-shrink:0">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    ${dim.label}
                  </span>`).join('')
            }
          </div>
        </div>

      </div>

      <!-- Presets -->
      <div class="ot-grouping-presets">
        <span class="ot-preset-label">Presets:</span>
        ${PRESETS.map(p => {
          const isActive = JSON.stringify(_activeDims) === JSON.stringify(p.dims);
          const dimsStr  = p.dims.join(',');
          return `<button class="btn-preset${isActive?' active':''}"
                          onclick="OTComponent._applyPreset('${dimsStr}')">${p.label}</button>`;
        }).join('')}
        ${_activeDims.length > 0
          ? `<button class="btn-clear-groups" onclick="OTComponent._clearGroups()">✕ Sin agrupar</button>`
          : ''}
      </div>`;
  }

  // ── Acciones del panel ───────────────────────────────────
  function _addDim(dimId) {
    if (!_activeDims.includes(dimId)) {
      _activeDims.push(dimId);
      _refreshPanel();
    }
  }

  function _removeDim(dimId) {
    _activeDims = _activeDims.filter(d => d !== dimId);
    _refreshPanel();
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
    _activeDims = dimsStr.split(',').filter(Boolean);
    _refreshPanel();
  }

  function _clearGroups() {
    _activeDims = [];
    _refreshPanel();
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
      _currentPage = 0
      renderList();
    });
    ['area','estatus','semana'].forEach(k => {
      document.getElementById(`ot-filter-${k}`)?.addEventListener('change', e => {
        OTStore.setFilter(k, e.target.value);
        _currentPage = 0
        renderList();
      });
    });
    document.getElementById('btn-reload')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-reload');
      btn?.classList.add('spinning');
      OTStore.load(AuthService?.isAuthenticated() ?? false).then(() => {
        btn?.classList.remove('spinning');
        updateFilterOptions();
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
        updateFilterOptions(); renderKPIs(); renderList(); updateSourceBadge();
      }
      if (event === 'loading') {
        const w = document.getElementById('ot-list-wrap');
        if (w) w.innerHTML = buildLoadingState();
      }
    });
    if (OTStore.getAll().length === 0) {
      OTStore.load(AuthService?.isAuthenticated() ?? false);
    } else {
      updateFilterOptions(); renderKPIs(); renderList(); updateSourceBadge();
    }
  }

  // ══════════════════════════════════════════════════════════
  // KPIs
  // ══════════════════════════════════════════════════════════
  function renderKPIs() {
    const k = OTStore.getKPIs();
    const bar = document.getElementById('ot-kpi-bar');
    if (!bar) return;
    bar.innerHTML = [
      kpiCard('total',  k.total,      'Total OTs'),
      kpiCard('prog',   k.programado, 'Programadas'),
      kpiCard('pend',   k.enProceso,  'En Proceso'),
      kpiCard('done',   k.completado, 'Completadas'),
      kpiCard('noasig', k.sinSemana,  'Sin semana'),
    ].join('');
    const sub = document.getElementById('ot-subtitle');
    if (sub) sub.textContent = `${k.total} órdenes · ${OTStore.getAreas().length} áreas`;
  }

  function kpiCard(cls, val, label) {
    return `<div class="ot-kpi"><span class="ot-kpi-dot ${cls}"></span>
      <div class="ot-kpi-body"><div class="ot-kpi-val">${val}</div>
      <div class="ot-kpi-label">${label}</div></div></div>`;
  }

  function buildKPISkeleton() {
    return ['Total','Programadas','En Proceso','Completadas','Sin semana'].map(l=>kpiCard('total','—',l)).join('');
  }

  // ══════════════════════════════════════════════════════════
  // FILTROS
  // ══════════════════════════════════════════════════════════
  function updateFilterOptions() {
    const ae = document.getElementById('ot-filter-area');
    if (ae) {
      const cur = ae.value;
      ae.innerHTML = `<option value="">Todas las áreas</option>` +
        OTStore.getAreas().map(a=>`<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
    }
    const se = document.getElementById('ot-filter-semana');
    if (se) {
      const cur = se.value;
      se.innerHTML = `<option value="">Todas las semanas</option>
        <option value="__noasig" ${cur==='__noasig'?'selected':''}>Sin asignar</option>` +
        OTStore.getSemanas().map(s=>
          `<option value="${s}" ${String(s)===cur?'selected':''}>Semana ${String(s).padStart(2,'0')}</option>`
        ).join('');
    }
  }

  function updateSourceBadge() {
    const b = document.getElementById('ot-source-badge');
    const l = document.getElementById('ot-source-label');
    if (!b||!l) return;
    const src = OTStore.getSource();
    b.className = `ot-source-badge ${src==='live'?'live':'demo'}`;
    l.textContent = src==='live' ? 'Google Sheets' : 'Datos Demo';
  }

  // ══════════════════════════════════════════════════════════
  // RENDER LISTA
  // ══════════════════════════════════════════════════════════
  function renderList() {
    const wrap = document.getElementById('ot-list-wrap');
    if (!wrap) return;

    const data = OTStore.getFiltered();

    // Actualizar caché del modal
    _rowCache.clear();
    data.forEach(row => _rowCache.set(String(row.ID_Orden), row));

    if (data.length === 0) {
      wrap.innerHTML = `<div class="ot-empty">
        <div class="ot-empty-icon">🔍</div>
        <div class="ot-empty-text">No se encontraron órdenes con los filtros aplicados.</div>
      </div>`;
    } else if (_activeDims.length === 0) {
      wrap.innerHTML = `<div class="ot-flat-table-wrap">${buildTable(data, true)}</div>`;
    } else {
      const tree = buildTree(data, _activeDims, 0);
      wrap.innerHTML = renderNodes(tree, 0);
    }

    // Delegado de clicks en filas — se registra una sola vez
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
  // ÁRBOL — construcción
  // ══════════════════════════════════════════════════════════
  function buildTree(rows, dims, depth) {
    // Caso base: sin más niveles → devolver las filas tal cual
    if (depth >= dims.length) return rows;

    const dim    = dims[depth];
    const groups = {};
    const order  = [];

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
      dim,
      key,
      noAsig:   key.startsWith('Sin '),
      count:    groups[key].length,
      // Recursión: puede devolver más nodos O las filas directamente
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

  // ══════════════════════════════════════════════════════════
  // ÁRBOL — render recursivo
  // Detecta si children son nodos (tienen .dim) o filas de datos
  // ══════════════════════════════════════════════════════════
  function renderNodes(nodes, level) {
    if (!nodes || nodes.length === 0) return '';

    // ¿Los hijos son filas de datos (no nodos agrupadores)?
    const isDataLeaf = nodes[0] && nodes[0].dim === undefined;
    if (isDataLeaf) {
      return `<div class="ot-table-wrap">${buildTable(nodes)}</div>`;
    }

    return nodes.map(node => {
      const uid      = safeUID(level, node.dim, node.key);
      const dimLabel = ALL_DIMS.find(d => d.id === node.dim)?.label ?? node.dim;
      // Renderizar los hijos de este nodo recursivamente
      const inner    = renderNodes(node.children, level + 1);

      if (level === 0) {
        return `
          <div class="ot-group ${level === _activeDims.length - 1 ? 'collapsed' : ''}" id="${uid}">
            <div class="ot-group-header dim-${node.dim}" onclick="OTComponent._toggle('${uid}')">
              <svg class="ot-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span class="ot-group-dim-badge badge-${node.dim}">${dimLabel}</span>
              <span class="ot-group-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
              <span class="ot-group-count">${node.count} OT${node.count!==1?'s':''}</span>
            </div>
            <div class="ot-group-body">${inner}</div>
          </div>`;
      }

      if (level === 1) {
        return `
          <div class="ot-subgroup ${level === _activeDims.length - 1 ? 'collapsed' : ''}" id="${uid}">
            <div class="ot-subgroup-header dim-${node.dim}" onclick="OTComponent._toggle('${uid}')">
              <svg class="ot-subgroup-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span class="ot-group-dim-badge badge-${node.dim}" style="font-size:0.57rem;padding:0.12rem 0.4rem;">${dimLabel}</span>
              <span class="ot-subgroup-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
              <span class="ot-subgroup-cnt">${node.count} OTs</span>
            </div>
            <div class="ot-subgroup-body">${inner}</div>
          </div>`;
      }

      // Nivel 2+
      return `
        <div class="ot-sub2group ${level === _activeDims.length - 1 ? 'collapsed' : ''}" id="${uid}">
          <div class="ot-sub2group-header" onclick="OTComponent._toggle('${uid}')">
            <svg class="ot-sub2group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span class="ot-sub2group-dim">${dimLabel}</span>
            <span class="ot-sub2group-key${node.noAsig?' no-asig':''}">${escH(node.key)}</span>
            <span class="ot-sub2group-cnt">${node.count} OTs</span>
          </div>
          <div class="ot-sub2group-body">${inner}</div>
        </div>`;
    }).join('');
  }

  function safeUID(level, dim, key) {
    return ('g' + level + '_' + dim + '_' + key)
      .replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,90);
  }

  function _toggle(uid) {
    document.getElementById(uid)?.classList.toggle('collapsed');
  }

  // ══════════════════════════════════════════════════════════
  // TABLA
  // ══════════════════════════════════════════════════════════
  function buildTable(rows, showArea = false) {
    if (!rows || rows.length === 0) {
      return `<div style="padding:1rem 1.5rem;font-size:0.8rem;color:var(--text-muted);">Sin órdenes.</div>`;
    }

    const start    = _currentPage * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    const total    = rows.length;
    const pages    = Math.ceil(total / PAGE_SIZE);

    const extraH = showArea ? '<th>Área</th><th>Equipo</th>' : '';
    const thead  = `<tr>
      <th>ID Orden</th><th>Sistema</th><th>Descripción</th><th>Tipo Proceso</th>
      <th>Fecha Inicio</th><th>Semana</th><th>Estado</th><th>Compra</th>${extraH}
    </tr>`;

    const pagination = pages > 1 ? `
      <div class="ot-pagination">
        <span class="ot-pagination-info">
          ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total}
        </span>
        <div class="ot-pagination-btns">
          <button class="ot-page-btn" ${_currentPage === 0 ? 'disabled' : ''}
            onclick="OTComponent._goPage(${_currentPage - 1})">‹</button>
          ${Array.from({length: pages}, (_, i) => `
            <button class="ot-page-btn ${i === _currentPage ? 'active' : ''}"
              onclick="OTComponent._goPage(${i})">${i + 1}</button>
          `).join('')}
          <button class="ot-page-btn" ${_currentPage >= pages - 1 ? 'disabled' : ''}
            onclick="OTComponent._goPage(${_currentPage + 1})">›</button>
        </div>
      </div>` : '';

    return `<table class="ot-table">
      <thead>${thead}</thead>
      <tbody>${pageRows.map(r => buildRow(r, showArea)).join('')}</tbody>
    </table>${pagination}`;
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

  // ══════════════════════════════════════════════════════════
  // MODAL
  // ══════════════════════════════════════════════════════════
  function openModal(row) {
    const root = document.getElementById('ot-modal-root');
    if (!root) return;

    const sc   = statusToClass(row.Estatus);
    const eIdx = ETAPA_IDX[row.TipoProceso] ?? 'x';
    const sem  = row.Semana ? `Semana ${String(row.Semana).padStart(2,'0')}` : '—';

    root.innerHTML = `
      <div class="ot-modal-backdrop" id="ot-backdrop">
        <div class="ot-modal" role="dialog" aria-modal="true">

          <div class="ot-modal-header">
            <div class="ot-modal-header-left">
              <div class="ot-modal-id-badge">${escH(row.ID_Orden)}</div>
              <div class="ot-modal-title">${escH(row.Descripcion)}</div>
              <div class="ot-modal-area">
                <span>${escH(row.Area)}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${escH(row.ID_EQUIPO)} — ${escH(row.ITEM)}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${escH(row.Sistema)}</span>
              </div>
            </div>
            <div class="ot-modal-status-wrap">
              <button class="btn-modal-close" id="btn-modal-close" aria-label="Cerrar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <span class="ot-status ${sc}">
                <span class="ot-status-dot"></span>${escH(row.Estatus)}
              </span>
            </div>
          </div>

          <div class="ot-modal-body">

            <div class="ot-modal-section">
              <div class="ot-modal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                  <path d="M16 3H8v4h8V3z"/>
                </svg>
                Identificación
              </div>
              <div class="ot-modal-grid">
                ${mf('ID de Orden',     row.ID_Orden)}
                ${mf('Área',            row.Area)}
                ${mf('Equipo (ID)',     row.ID_EQUIPO)}
                ${mf('Item / Equipo',  row.ITEM)}
                ${mf('Sistema',         row.Sistema)}
                ${mf('Tipo de Proceso', '',
                  `<span class="ot-etapa-chip etapa-${eIdx}">${ETAPA_SHORT[row.TipoProceso] ?? escH(row.TipoProceso||'—')}</span>`)}
              </div>
            </div>

            <div class="ot-modal-section">
              <div class="ot-modal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Planificación
              </div>
              <div class="ot-modal-grid">
                ${mf('Estado', '',
                  `<span class="ot-status ${sc}" style="font-size:0.72rem;"><span class="ot-status-dot"></span>${escH(row.Estatus)}</span>`)}
                ${mf('Semana asignada',  sem)}
                ${mf('Fecha de inicio',  row.FechaInicio)}
                ${mf('Fecha conclusión', row.FechaConclusion)}
              </div>
            </div>

            <div class="ot-modal-section">
              <div class="ot-modal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                Compras y Materiales
              </div>
              <div class="ot-modal-grid">
                ${mf('Tiene solicitud', row.TieneSolicitud)}
                ${mf('N° Solicitud',    row.NSolicitud)}
                ${mf('N° Orden Compra', row.NOrdenCompra)}
                ${mf('Fecha entrega',   row.FechaEntrega)}
              </div>
            </div>

            ${row.Observaciones ? `
            <div class="ot-modal-section">
              <div class="ot-modal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                Observaciones
              </div>
              <div style="font-size:0.85rem;color:var(--text-primary);line-height:1.7;
                          background:var(--color-gray-50);padding:0.85rem 1rem;
                          border-radius:var(--radius-md);border-left:3px solid var(--color-main-light);">
                ${escH(row.Observaciones)}
              </div>
            </div>` : ''}

          </div>

          <div class="ot-modal-footer">
            <button class="btn-modal-secondary" id="btn-modal-footer-close">Cerrar</button>
          </div>
        </div>
      </div>`;

    // Bind cierre
    document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('btn-modal-footer-close')?.addEventListener('click', closeModal);
    document.getElementById('ot-backdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', escHandler);
  }

  function closeModal() {
    const root = document.getElementById('ot-modal-root');
    const bd   = document.getElementById('ot-backdrop');
    document.removeEventListener('keydown', escHandler);
    if (bd) {
      bd.style.transition = 'opacity 0.18s ease';
      bd.style.opacity    = '0';
      const m = bd.querySelector('.ot-modal');
      if (m) { m.style.transition = 'all 0.18s ease'; m.style.transform = 'scale(0.95) translateY(8px)'; m.style.opacity = '0'; }
      setTimeout(() => { if (root) root.innerHTML = ''; }, 200);
    } else if (root) {
      root.innerHTML = '';
    }
  }

  function escHandler(e) { if (e.key === 'Escape') closeModal(); }

  // ── Helpers ──────────────────────────────────────────────
  function statusToClass(s) {
    return { 'Programado':'status-programado','En proceso':'status-en-proceso',
             'Completado':'status-completado','Pendiente':'status-pendiente' }[s] ?? 'status-programado';
  }

  function mf(label, val, customHtml) {
    const empty = !val || String(val).trim() === '';
    const body  = customHtml
      ? customHtml
      : `<div class="ot-modal-val${empty?' empty':''}">${empty ? '—' : escH(String(val))}</div>`;
    return `<div class="ot-modal-field"><div class="ot-modal-label">${label}</div>${body}</div>`;
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
  // Scroll suave al inicio de la lista
  document.getElementById('ot-list-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

return { mount, onEnter, _toggle, _addDim, _removeDim, _moveDim, _applyPreset, _clearGroups, _goPage };
})();

