// ============================================================
// CADASA TALLER — ETAPAS v2
// Búsqueda + agrupación por equipo/sistema + árbol colapsable
// ============================================================

// ============================================================
// CADASA TALLER — ETAPAS v3
// Búsqueda + recarga + filtro por etapa + agrupación árbol
// ============================================================

const EtapasComponent = (() => {

  const ALL_DIMS = [
    { id: 'equipo',  label: 'Equipo'  },
    { id: 'sistema', label: 'Sistema' },
  ];

  const ETAPA_FILTERS = [
    { value: '',        label: 'Todas'     },
    { value: '__empty', label: 'Sin etapa' },
    { value: 'Zafra',   label: 'Zafra'    },
    { value: 'Cultivo', label: 'Cultivo'  },
  ];

  // ── Estado ───────────────────────────────────────────────
  let _container    = null;
  let _selectedIds  = new Set();
  let _localOrders  = [];
  let _activeDim    = 'equipo';
  let _search       = '';
  let _etapaFilter  = '__empty';
  const _expandedSet = new Set();

  // ══════════════════════════════════════════════════════════
  // MOUNT / ENTER / LEAVE
  // ══════════════════════════════════════════════════════════
  function mount(containerId) {
    _container = document.getElementById(containerId);
  }

  async function onEnter() {
    if (!_container) return;
    _renderShell();

    if (OTStore.getAll().length === 0) {
      await OTStore.load(AuthService.isAuthenticated());
    }

    _refreshAndRender();
    OTStore.subscribe(_handleStoreUpdate);
  }

  function onLeave() {
    _selectedIds.clear();
    _expandedSet.clear();
  }

  function _handleStoreUpdate(event) {
    if (event === 'updated' || event === 'ready') _refreshAndRender();
  }

  // ══════════════════════════════════════════════════════════
  // SHELL
  // ══════════════════════════════════════════════════════════
  function _renderShell() {
    _container.innerHTML = `
      <div class="etapas-topcard" id="etapas-topcard"></div>
      <div class="etapas-filter-bar" id="etapas-filter-bar"></div>
      <div class="etapas-list-wrap" id="etapas-list-wrap">
        <div class="etapas-loading">Cargando órdenes…</div>
      </div>
      <div id="etapas-bulk-bar">
        <span class="etapas-bulk-count">
          <span id="etapas-bulk-num">0</span>
          <span> seleccionada(s)</span>
        </span>
        <div class="etapas-bulk-sep"></div>
        <button class="etapas-bulk-btn etapas-btn-zafra" id="btn-zafra">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Asignar ZAFRA
        </button>
        <button class="etapas-bulk-btn etapas-btn-cultivo" id="btn-cultivo">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Asignar CULTIVO
        </button>
        <button class="etapas-bulk-clear" id="btn-clear-selection">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Limpiar
        </button>
      </div>`;

    document.getElementById('btn-zafra').addEventListener('click', () => _procesarMasivo('Zafra'));
    document.getElementById('btn-cultivo').addEventListener('click', () => _procesarMasivo('Cultivo'));
    document.getElementById('btn-clear-selection').addEventListener('click', _clearSelection);

    const listWrap = document.getElementById('etapas-list-wrap');

    listWrap.addEventListener('change', e => {
      const rowChk = e.target.closest('.etapas-row-check');
      if (rowChk) {
        const id = rowChk.dataset.id;
        rowChk.checked ? _selectedIds.add(id) : _selectedIds.delete(id);
        rowChk.closest('tr')?.classList.toggle('row-selected', rowChk.checked);
        _syncBulkBar();
        return;
      }
      const chkAll = e.target.closest('.etapas-check-all');
      if (chkAll) {
        const tbody = document.getElementById(`etapas-tbody-${chkAll.dataset.tableId}`);
        if (!tbody) return;
        tbody.querySelectorAll('.etapas-row-check').forEach(chk => {
          const id = chk.dataset.id;
          chkAll.checked ? _selectedIds.add(id) : _selectedIds.delete(id);
          chk.checked = chkAll.checked;
          chk.closest('tr')?.classList.toggle('row-selected', chkAll.checked);
        });
        _syncBulkBar();
      }
    });

    listWrap.addEventListener('click', e => {
      const hdr = e.target.closest('[data-toggle-uid]');
      if (hdr) {
        e.stopPropagation();
        const uid = hdr.dataset.toggleUid;
        const el  = document.getElementById(uid);
        if (!el) return;
        const isCollapsed = el.classList.toggle('collapsed');
        if (isCollapsed) _expandedSet.delete(uid);
        else             _expandedSet.add(uid);
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _selectedIds.size > 0) _clearSelection();
    });

    _renderTopCard();
    _renderFilterBar();
  }

  // ══════════════════════════════════════════════════════════
  // TOP CARD
  // ══════════════════════════════════════════════════════════
  function _renderTopCard() {
    const card = document.getElementById('etapas-topcard');
    if (!card) return;

    const available = ALL_DIMS.filter(d => d.id !== _activeDim);

    card.innerHTML = `
      <div class="etapas-topcard-search">
        <div class="etapas-search-wrap">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="etapas-search-input" id="etapas-search" type="text"
            placeholder="Buscar por ID, equipo, sistema, descripción…"
            autocomplete="off" value="${_escH(_search)}">
          <button type="button" class="etapas-search-clear" id="etapas-search-clear"
            style="display:${_search ? 'flex' : 'none'}">×</button>
        </div>
        <button class="btn-reload" id="etapas-btn-reload" title="Recargar datos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      <div class="etapas-topcard-div"></div>

      <div class="etapas-topcard-grp">
        <span class="etapas-grp-label">Agrupar por</span>
        ${_activeDim ? `
          <div class="etapas-grp-active">
            <span class="etapas-grp-chip active dim-${_activeDim}">
              ${ALL_DIMS.find(d => d.id === _activeDim)?.label}
              <button class="rm" onclick="EtapasComponent._changeDim(null)">✕</button>
            </span>
          </div>` : ''}
        ${available.length > 0 ? `
          <span class="etapas-grp-sep">|</span>
          <div class="etapas-grp-available">
            ${available.map(dim => `
              <span class="etapas-grp-chip avail dim-${dim.id}"
                    onclick="EtapasComponent._changeDim('${dim.id}')">
                ${dim.label}
              </span>`).join('')}
          </div>` : ''}
      </div>`;

    const input    = document.getElementById('etapas-search');
    const clearBtn = document.getElementById('etapas-search-clear');

    input?.addEventListener('input', e => {
      _search = e.target.value;
      if (clearBtn) clearBtn.style.display = _search ? 'flex' : 'none';
      _clearSelection();
      _refreshAndRender();
    });

    clearBtn?.addEventListener('click', () => {
      _search = '';
      if (input)    input.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      _clearSelection();
      _refreshAndRender();
    });

    document.getElementById('etapas-btn-reload')?.addEventListener('click', async () => {
      const btn = document.getElementById('etapas-btn-reload');
      btn?.classList.add('spinning');
      await OTStore.load(AuthService?.isAuthenticated() ?? false);
      btn?.classList.remove('spinning');
      _clearSelection();
      _refreshAndRender();
    });
  }

  // ══════════════════════════════════════════════════════════
  // FILTER BAR — pills de etapa
  // ══════════════════════════════════════════════════════════
  function _renderFilterBar() {
    const bar = document.getElementById('etapas-filter-bar');
    if (!bar) return;

    bar.innerHTML = `
      <span class="etapas-filter-label">Etapa</span>
      ${ETAPA_FILTERS.map(f => `
        <button class="etapas-filter-pill${_etapaFilter === f.value ? ' active' : ''}"
                data-etapa-filter="${f.value}">
          ${f.label}
        </button>`).join('')}`;

    bar.querySelectorAll('.etapas-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _etapaFilter = btn.dataset.etapaFilter;
        _clearSelection();
        _renderFilterBar();
        _refreshAndRender();
      });
    });
  }

  // ── Agrupación ───────────────────────────────────────────
  function _changeDim(dimId) {
    _activeDim = dimId;
    _refreshPanel();
  }
  function _refreshPanel() {
    _clearSelection(); _renderTopCard(); _renderList();
  }

  // ══════════════════════════════════════════════════════════
  // DATOS
  // ══════════════════════════════════════════════════════════
  function _refreshAndRender() {
    let rows = OTStore.getAll();

    if (_etapaFilter === '__empty') {
      rows = rows.filter(o => !o.Etapa || o.Etapa.trim() === '');
    } else if (_etapaFilter !== '') {
      rows = rows.filter(o =>
        (o.Etapa || '').trim().toLowerCase() === _etapaFilter.toLowerCase()
      );
    }

    const q = _search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(o =>
        (o.ID_Orden    || '').toLowerCase().includes(q) ||
        (o.Descripcion || '').toLowerCase().includes(q) ||
        (o.ID_EQUIPO   || '').toLowerCase().includes(q) ||
        (o.ITEM        || '').toLowerCase().includes(q) ||
        (o.Sistema     || '').toLowerCase().includes(q)
      );
    }

    _localOrders = rows;
    _renderList();
  }

  // ══════════════════════════════════════════════════════════
  // ÁRBOL
  // ══════════════════════════════════════════════════════════
  function _buildTree(rows, dim) {
    if (!dim) return rows;
    const groups = {}, order = [];
    rows.forEach(r => {
      const k = _getDimKey(r, dim);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });
    order.sort((a, b) => {
      const aE = a.startsWith('Sin ') || a.startsWith('No ');
      const bE = b.startsWith('Sin ') || b.startsWith('No ');
      if (aE && !bE) return 1; if (!aE && bE) return -1; if (aE && bE) return 0;
      return a.localeCompare(b, 'es', { numeric: true });
    });
    return order.map(k => ({
      dim, key: k,
      noAsig: k.startsWith('Sin ') || k.startsWith('No '),
      count: groups[k].length,
      children: groups[k],
    }));
  }

  function _getDimKey(row, dim) {
    switch (dim) {
      case 'equipo':  return row.ID_EQUIPO ? `${row.ID_EQUIPO}${row.ITEM ? ' — ' + row.ITEM : ''}` : 'Sin equipo';
      case 'sistema': return row.Sistema || 'Sin sistema';
      default:        return '-';
    }
  }

  // ══════════════════════════════════════════════════════════
  // RENDER LISTA
  // ══════════════════════════════════════════════════════════
  function _renderList() {
    const wrap = document.getElementById('etapas-list-wrap');
    if (!wrap) return;
    if (_localOrders.length === 0) {
      wrap.innerHTML = `
        <div class="etapas-empty">
          <div class="etapas-empty-icon">🔍</div>
          <div class="etapas-empty-text">No hay órdenes con los filtros actuales.</div>
        </div>`;
      return;
    }
    if (!_activeDim) {
      wrap.innerHTML = `<div class="etapas-flat-table-wrap">${_buildTable(_localOrders, 'flat')}</div>`;
    } else {
      wrap.innerHTML = _renderNodes(_buildTree(_localOrders, _activeDim), 0);
    }
  }

  function _renderNodes(nodes, level) {
    if (!nodes || !nodes.length) return '';
    if (!nodes[0].dim) {
      const uid = _safeUID('leaf', nodes.map(r => r.ID_Orden).join('').slice(0, 20));
      return `<div class="etapas-table-wrap">${_buildTable(nodes, uid)}</div>`;
    }
    return nodes.map(node => {
      const uid       = _safeUID(node.dim, node.key);
      const label     = ALL_DIMS.find(d => d.id === node.dim)?.label ?? node.dim;
      const collapsed = !_expandedSet.has(uid);
      const children  = Array.isArray(node.children) && node.children[0] && node.children[0].dim
                        ? _renderNodes(node.children, level + 1)
                        : `<div class="etapas-table-wrap">${_buildTable(node.children, uid)}</div>`;

      return `
        <div class="etapas-group${collapsed ? ' collapsed' : ''}" id="${uid}">
          <div class="etapas-group-header dim-${node.dim}" data-toggle-uid="${uid}">
            <svg class="etapas-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span class="etapas-group-dim-badge badge-${node.dim}">${label}</span>
            <span class="etapas-group-key${node.noAsig ? ' no-asig' : ''}">${_escH(node.key)}</span>
            <span class="etapas-group-count">${node.count} OM${node.count !== 1 ? 's' : ''}</span>
          </div>
          <div class="etapas-group-body">${children}</div>
        </div>`;
    }).join('');
  }

  function _buildTable(rows, tableId) {
    if (!rows?.length) return `<div style="padding:1rem 1.5rem;font-size:.8rem;color:var(--text-muted)">Sin órdenes.</div>`;
    const chkAllId   = `chk-all-${tableId}`;
    const allChecked = rows.every(r => _selectedIds.has(String(r.ID_Orden)));
    const someChecked= rows.some(r  => _selectedIds.has(String(r.ID_Orden)));

    return `
      <table class="etapas-table">
        <thead><tr>
          <th class="col-check">
            <input type="checkbox" class="etapas-check-all" id="${chkAllId}"
                   ${allChecked ? 'checked' : ''} data-table-id="${tableId}">
            <label for="${chkAllId}" class="etapas-check-all-label"
                   style="${someChecked && !allChecked ? 'background:rgba(0,70,67,0.15);border-color:var(--color-main);' : ''}">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </label>
          </th>
          <th>OM ID</th><th>Equipo</th><th>Sistema</th>
          <th>Descripción</th><th>Fecha Inicio</th><th>Etapa Actual</th>
        </tr></thead>
        <tbody id="etapas-tbody-${tableId}">
          ${rows.map(r => _buildRow(r)).join('')}
        </tbody>
      </table>`;
  }

  function _buildRow(row) {
    const id        = String(row.ID_Orden);
    const isChecked = _selectedIds.has(id);
    const etapa     = (row.Etapa || '').trim();
    let etapaBadge;
    if (!etapa)                               etapaBadge = `<span class="etapas-badge sin-etapa">Sin definir</span>`;
    else if (etapa.toLowerCase() === 'zafra') etapaBadge = `<span class="etapas-badge zafra">Zafra</span>`;
    else if (etapa.toLowerCase() === 'cultivo') etapaBadge = `<span class="etapas-badge cultivo">Cultivo</span>`;
    else                                      etapaBadge = `<span class="etapas-badge sin-etapa">${_escH(etapa)}</span>`;

    const fecha = row.FechaInicio
      ? `<span class="etapas-fecha">${_escH(row.FechaInicio)}</span>`
      : `<span class="etapas-fecha no-asig">Sin asignar</span>`;

    return `
      <tr class="etapas-data-row${isChecked ? ' row-selected' : ''}">
        <td class="col-check" onclick="event.stopPropagation()">
          <input type="checkbox" class="etapas-row-check" id="echk-${_escH(id)}"
                 data-id="${_escH(id)}" ${isChecked ? 'checked' : ''}>
          <label for="echk-${_escH(id)}" class="etapas-check-label">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" stroke-width="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </label>
        </td>
        <td><span class="etapas-id">${_escH(row.ID_Orden)}</span></td>
        <td class="etapas-sistema">${_escH(row.ID_EQUIPO || '—')}</td>
        <td class="etapas-sistema">${_escH(row.Sistema || '—')}</td>
        <td><div class="etapas-desc" title="${_escH(row.Descripcion || '')}">${_escH(row.Descripcion || '—')}</div></td>
        <td>${fecha}</td>
        <td>${etapaBadge}</td>
      </tr>`;
  }

  // ══════════════════════════════════════════════════════════
  // BULK BAR
  // ══════════════════════════════════════════════════════════
  function _syncBulkBar() {
    const bar   = document.getElementById('etapas-bulk-bar');
    const numEl = document.getElementById('etapas-bulk-num');
    const n     = _selectedIds.size;
    if (numEl) numEl.textContent = n;
    if (bar)   bar.classList.toggle('visible', n > 0);
  }

  function _clearSelection() {
    _selectedIds.clear();
    document.querySelectorAll('tr.row-selected').forEach(tr => {
      tr.classList.remove('row-selected');
      const chk = tr.querySelector('.etapas-row-check');
      if (chk) chk.checked = false;
    });
    document.querySelectorAll('.etapas-check-all').forEach(chk => { chk.checked = false; });
    _syncBulkBar();
  }

  // ══════════════════════════════════════════════════════════
  // ASIGNACIÓN MASIVA
  // ══════════════════════════════════════════════════════════
  async function _procesarMasivo(nuevaEtapa) {
    if (_selectedIds.size === 0) return;
    const count = _selectedIds.size;

    const ejecutar = async () => {
      const bar = document.getElementById('etapas-bulk-bar');
      if (bar) { bar.style.opacity = '0.5'; bar.style.pointerEvents = 'none'; }

      const result = await OMService.actualizarEtapaMasiva(Array.from(_selectedIds), nuevaEtapa);

      if (result.ok) {
        window.ToastService?.show(`${count} orden(es) asignada(s) a ${nuevaEtapa}.`, 'success');
        _clearSelection();
        _refreshAndRender();
      } else {
        window.ToastService?.show('Error al actualizar: ' + result.error, 'danger');
      }

      if (bar) { bar.style.opacity = '1'; bar.style.pointerEvents = 'all'; }
    };

    if (window.ConfirmModal) {
      ConfirmModal.show({
        title:        `Asignar a ${nuevaEtapa}`,
        message:      `Se asignarán <strong>${count}</strong> orden(es) a la etapa <strong>${nuevaEtapa}</strong>. Esto puede sobreescribir etapas existentes.`,
        confirmLabel: `Sí, asignar a ${nuevaEtapa}`,
        cancelLabel:  'Cancelar',
        variant:      nuevaEtapa === 'Zafra' ? 'success' : 'info',
        onConfirm:    ejecutar,
      });
    } else {
      if (confirm(`¿Asignar ${count} orden(es) a ${nuevaEtapa}?`)) ejecutar();
    }
  }

  // ══════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════
  function _safeUID(...parts) {
    return ('etapas-' + parts.join('-'))
      .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  }

  function _escH(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  return { mount, onEnter, onLeave, _changeDim };
})();

window.EtapasComponent = EtapasComponent;