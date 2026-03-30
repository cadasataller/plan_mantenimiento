// ============================================================
// CADASA TALLER — MODAL COMPONENT
// Solo UI y orquestación. Lógica de negocio → OMService.
// ============================================================

const ModalComponent = (() => {

  const STATUS_COLORS = {
    'Concluida':  { hex: '#2D8A4E', badge: 'status-completado' },
    'En Proceso': { hex: '#1A6B9A', badge: 'status-en-proceso' },
    'Programado': { hex: '#B8B3A7', badge: 'status-programado' },
    'Retrasada':  { hex: '#B8B3A7', badge: 'status-programado' }, 
    'Detenido':   { hex: '#C0392B', badge: 'status-pendiente'  },
  };

  const OT_COLORS = {
    'Concluida':  '#2D8A4E',
    'En Proceso': '#1A6B9A',
    'Retrasada':  '#B8B3A7', 
    'Ausencia':   '#E67E22',
  };
  
  const ESTADOS_EDIT = [
    { value: 'Programado', label: 'PROGRAMADO', icon: '◷', desc: 'En espera de inicio' },
    { value: 'En Proceso', label: 'EN PROCESO', icon: '⚡', desc: 'Trabajo activo'      },
    { value: 'Concluida',  label: 'CONCLUIDO',  icon: '✓', desc: 'Trabajo finalizado'  },
    { value: 'Detenido',   label: 'DETENIDO',   icon: '⏸', desc: 'Trabajo pausado'     },
  ];

  const DONUT_ORDER = ['Concluida', 'En Proceso', 'Retrasada', 'Ausencia'];

  let _currentOM = null;
  let _currentSGDetail = null; // 👈 NUEVO: Guardará los datos de la tabla OM_SG
  let _activeTab = 'info';
  let _editMode  = false;
  let _editState = {};   
  let _saving    = false;

  // ══════════════════════════════════════════════════════════
  // ABRIR
  // ══════════════════════════════════════════════════════════
  async function open(om) {
    _currentOM = om;
    _activeTab = 'info';
    _editMode  = false;
    _editState = {};
    _saving    = false;
    _currentSGDetail = null;

    const root = document.getElementById('ot-modal-root');
    if (!root) return;

    _renderModal(om);
    loadOTs(om, true);

    // 👇 NUEVO: Si es una orden de Servicios Generales, buscamos sus detalles extra
    /*if (om.IS_SG) {
      try {
        const db = window.SupabaseClient;
        const { data } = await db.from('OM_SG').select('*').eq('id_orden_base', om.ID_Orden).single();
        _currentSGDetail = data || {};
        _refreshInfoPanel(); // Repintamos la pestaña de info con los datos nuevos
      } catch(e) { console.error('Error cargando detalle SG:', e); }
    }*/
  }

  // ══════════════════════════════════════════════════════════
  // RENDER COMPLETO DEL MODAL
  // ══════════════════════════════════════════════════════════
  function _renderModal(om) {
    const root = document.getElementById('ot-modal-root');
    if (!root) return;

    root.innerHTML = `
      <div class="ot-modal-backdrop" id="ot-backdrop">
        <div class="ot-modal" role="dialog" aria-modal="true">

          <div class="ot-modal-header">
            <div class="ot-modal-header-left">
              <div class="ot-modal-id-badge">${h(om.ID_Orden)}</div>
              <div class="ot-modal-title">${h(om.Descripcion)}</div>
              <div class="ot-modal-area">
                <span>${h(om.Area)}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${h(om.ID_EQUIPO)} — ${h(om.ITEM)}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${h(om.Sistema)}</span>
              </div>
            </div>
            <div class="ot-modal-status-wrap">
              <button class="btn-modal-close" id="btn-modal-close" aria-label="Cerrar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <span class="ot-status ${omStatusClass(om.Estatus)}" id="header-status-badge">
                <span class="ot-status-dot"></span>${h(om.Estatus)}
              </span>
            </div>
          </div>

          <div class="ot-modal-tabs" id="ot-modal-tabs">
            <div class="ot-modal-tab active" data-tab="info">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Información
            </div>
            <div class="ot-modal-tab" data-tab="ots">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Órdenes de Trabajo
              <span class="dash-tab-badge" id="modal-ot-badge" style="display:none"></span>
            </div>
            <div class="ot-modal-tab" data-tab="graficas">
              <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
              Gráficas
            </div>
          </div>

          <div class="ot-modal-body">
            <div class="ot-modal-tab-panel active" id="tab-info"></div>
            <div class="ot-modal-tab-panel" id="tab-ots">
              <div id="ots-content">
                <div class="ot-work-loading"><div class="spinner"></div> Cargando órdenes de trabajo…</div>
              </div>
            </div>
            <div class="ot-modal-tab-panel" id="tab-graficas">
              <div id="graficas-content">
                <div class="ot-work-loading"><div class="spinner"></div> Calculando métricas…</div>
              </div>
            </div>
          </div>

          <div class="ot-modal-footer">
            <div class="ot-modal-footer-left">
              <span style="font-size:0.72rem;color:var(--text-muted);">OM ${h(om.ID_Orden)}</span>
            </div>
            <div class="ot-modal-footer-right" id="modal-footer-actions"></div>
          </div>

        </div>
      </div>`;

    _refreshInfoPanel();
    _refreshFooter();

    document.getElementById('btn-modal-close')?.addEventListener('click', close);
    document.getElementById('ot-backdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
    document.getElementById('ot-modal-tabs')?.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) switchTab(tab.dataset.tab);
    });
    document.getElementById('modal-footer-actions')?.addEventListener('click', _onFooterClick);
    document.addEventListener('keydown', _escHandler);
  }

  // ══════════════════════════════════════════════════════════
  // PANEL INFO — lectura y edición
  // ══════════════════════════════════════════════════════════
  function _refreshInfoPanel() {
    const panel = document.getElementById('tab-info');
    if (!panel) return;

    const om     = _currentOM;
    const omSC   = omStatusClass(om.Estatus);
    const eIdx   = ETAPA_IDX[om.TipoProceso] ?? 'x';
    const isSG   = false;

    // Verificar Rol
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    const isSGRole = uArea === 'SERVICIOS GENERALES';

    const v = (key, fallback = '') => _editMode ? (_editState[key] ?? om[key] ?? fallback) : (om[key] ?? fallback);
    const semDisplay = om.Semana ? `Semana ${String(om.Semana).padStart(2,'0')}` : '—';

    let html = '';

    if (_editMode) {
      html += `
        <div class="edit-mode-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Modo edición activo — ${isSGRole ? 'Actualiza tu estatus y observaciones' : 'modifica los campos y guarda los cambios'}
        </div>`;
    }

    // 👇 SI ES UNA ORDEN DE SERVICIOS GENERALES, MOSTRAMOS EL DISEÑO SG
    if (isSG) {
      if (!_currentSGDetail) {
        panel.innerHTML = html + `<div style="padding:3rem;text-align:center;"><div class="spinner"></div> Cargando detalles SG...</div>`;
        return;
      }
      
      const sgDet = _currentSGDetail;

      html += `
        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Identificación y Ubicación</div>
          <div class="ot-modal-grid">
            ${mf('Área', om.Area)}
            ${mf('Equipo (ID)', om.ID_EQUIPO)}
            ${mf('Item / Equipo', om.ITEM)}
            ${mf('Sistema', om.Sistema)}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Detalles del Trabajo (SG)</div>
          <div class="ot-modal-grid">
            ${mf('Tipo Trabajo', sgDet.tipo_trabajo || '—')}
            ${mf('Estimación (h)', sgDet.estimacion_horas || '—')}
            ${mf('Personal Solicitado', sgDet.solicitar_personal || '—')}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Planificación y Estado ${_editMode ? '<span class="edit-section-tag">editable</span>' : ''}</div>
          <div class="ot-modal-grid">
            <div class="ot-modal-field" style="grid-column:1/-1;">
              <div class="ot-modal-label">Estado</div>
              ${_editMode ? _renderStatusPicker(v('estatus', om.Estatus)) : `<span class="ot-status ${omSC}"><span class="ot-status-dot"></span>${h(om.Estatus)}</span>`}
            </div>
            ${mf('Semana', '', `<div class="ot-modal-val">${semDisplay}</div>`)}
            ${mf('Fecha Entrega Esperada', om.FechaEntrega)}
            ${mf('Fecha Inicio (Real)', om.FechaInicio)}
            ${mf('Fecha Conclusión (Real)', om.FechaConclusion)}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Gestión de Compras</div>
          <div class="ot-modal-grid">
            ${mf('Tiene solicitud?', om.TieneSolicitud)}
            ${mf('N° Solicitud', om.NSolicitud)}
            ${mf('N° Orden Compra', om.NOrdenCompra)}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Observaciones ${_editMode ? '<span class="edit-section-tag">editable</span>' : ''}</div>
          ${_editMode
            ? `<textarea id="edit-observaciones" class="edit-textarea" placeholder="Notas..." rows="3">${h(v('observaciones', om.Observaciones ?? ''))}</textarea>`
            : (om.Observaciones ? `<div style="font-size:0.85rem;background:var(--color-gray-50);padding:0.85rem 1rem;border-radius:4px;">${h(om.Observaciones)}</div>` : `<div style="font-size:0.82rem;color:var(--color-gray-300);font-style:italic;">Sin observaciones.</div>`)
          }
        </div>
      `;
    } 
    // 👇 SI ES UNA ORDEN DE MANTENIMIENTO NORMAL
    else {
      html += `
        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Identificación</div>
          <div class="ot-modal-grid">
            ${mf('ID de Orden',    om.ID_Orden)}
            ${mf('Área',           om.Area)}
            ${mf('Equipo (ID)',    om.ID_EQUIPO)}
            ${mf('Item / Equipo', om.ITEM)}
            ${mf('Sistema',        om.Sistema)}
            ${mf('Tipo de Proceso', '', `<span class="ot-etapa-chip etapa-${eIdx}">${ETAPA_SHORT[om.TipoProceso] ?? h(om.TipoProceso || '—')}</span>`)}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Planificación ${_editMode ? '<span class="edit-section-tag">editable</span>' : ''}</div>
          <div class="ot-modal-grid">
            <div class="ot-modal-field" style="grid-column:1/-1;">
              <div class="ot-modal-label">Estado</div>
              ${_editMode ? _renderStatusPicker(v('estatus', om.Estatus)) : `<span class="ot-status ${omSC}"><span class="ot-status-dot"></span>${h(om.Estatus)}</span>`}
            </div>
            ${mf('Semana asignada', '', `<div class="ot-modal-val">${semDisplay}</div> `)}
            ${mf('Fecha de inicio', om.FechaInicio)}
            ${mf('Fecha conclusión', om.FechaConclusion)}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Compras y Materiales ${_editMode && !isSGRole ? '<span class="edit-section-tag">editable</span>' : ''}</div>
          <div class="ot-modal-grid">
            ${mf('Tiene solicitud', om.TieneSolicitud)}
            <div class="ot-modal-field">
              <div class="ot-modal-label">N° Solicitud ${(_editMode && !isSGRole) ? '<span class="edit-field-optional">editable</span>' : ''}</div>
              ${(_editMode && !isSGRole) ? `<input type="text" id="edit-n-solicitud" class="edit-input" value="${h(v('nSolicitud', om.NSolicitud ?? ''))}" />` : `<div class="ot-modal-val${!om.NSolicitud ? ' empty' : ''}">${om.NSolicitud || '—'}</div>`}
            </div>
            <div class="ot-modal-field">
              <div class="ot-modal-label">N° Orden Compra ${(_editMode && !isSGRole) ? '<span class="edit-field-optional">editable</span>' : ''}</div>
              ${(_editMode && !isSGRole) ? `<input type="text" id="edit-n-orden-compra" class="edit-input" value="${h(v('nOrdenCompra', om.NOrdenCompra ?? ''))}" />` : `<div class="ot-modal-val${!om.NOrdenCompra ? ' empty' : ''}">${om.NOrdenCompra || '—'}</div>`}
            </div>
            <div class="ot-modal-field">
              <div class="ot-modal-label">Fecha entrega ${(_editMode && !isSGRole) ? '<span class="edit-field-optional">editable</span>' : ''}</div>
              ${(_editMode && !isSGRole) ? `<input type="date" id="edit-fecha-entrega" class="edit-input" value="${_isoDateValue(v('fechaEntrega', om.FechaEntrega))}" />` : `<div class="ot-modal-val${!om.FechaEntrega ? ' empty' : ''}">${om.FechaEntrega || '—'}</div>`}
            </div>
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Observaciones ${_editMode ? '<span class="edit-section-tag">editable</span>' : ''}</div>
          ${_editMode
            ? `<textarea id="edit-observaciones" class="edit-textarea" placeholder="Escribe las observaciones aquí…" rows="4">${h(v('observaciones', om.Observaciones ?? ''))}</textarea>`
            : (om.Observaciones ? `<div style="font-size:0.85rem;background:var(--color-gray-50);padding:0.85rem 1rem;border-radius:4px;">${h(om.Observaciones)}</div>` : `<div style="font-size:0.82rem;color:var(--color-gray-300);font-style:italic;">Sin observaciones.</div>`)
          }
        </div>
      `;
    }

    panel.innerHTML = html;

    if (_editMode) {
      panel.addEventListener('click', _onStatusPick);
      const binds = [
        ['edit-n-solicitud',     'nSolicitud'],
        ['edit-n-orden-compra',  'nOrdenCompra'],
        ['edit-fecha-entrega',   'fechaEntrega'],
        ['edit-observaciones',   'observaciones'],
      ];
      binds.forEach(([id, key]) => {
        document.getElementById(id)?.addEventListener('input', e => {
          _editState[key] = e.target.value;
        });
      });
    }
  }

  function _isoDateValue(val) {
    if (!val || val === '—') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const parts = val.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return '';
  }

  function _renderStatusPicker(current) {
    return `<div class="status-picker" id="status-picker">
      ${ESTADOS_EDIT.map(est => `
        <button class="status-pick-btn ${est.value.toLowerCase().replace(' ','-')} ${est.value === current ? 'active' : ''}" data-status-pick="${est.value}" type="button" title="${est.desc}">
          <span class="spb-icon">${est.icon}</span><span class="spb-label">${est.label}</span>
        </button>`).join('')}
    </div>`;
  }

  function _onStatusPick(e) {
    const btn = e.target.closest('[data-status-pick]');
    if (!btn) return;
    _editState.estatus = btn.dataset.statusPick;
    document.querySelectorAll('.status-pick-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.statusPick === _editState.estatus));
  }

  // ══════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════
  function _refreshFooter() {
    const footerRight = document.getElementById('modal-footer-actions');
    if (!footerRight) return;
  
    const enTabInfo = _activeTab === 'info';
    const enTabOTs  = _activeTab === 'ots';

    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    const isSGRole = uArea === 'SERVICIOS GENERALES';
  
    if (_editMode) {
      footerRight.innerHTML = `
        <button class="btn-modal-secondary" id="btn-cancel-edit">Cancelar</button>
        <button class="btn-modal-save" id="btn-save-edit" ${_saving ? 'disabled' : ''}>
          ${_saving ? `<div class="spinner-sm"></div> Guardando…` : `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Guardar cambios`}
        </button>`;
    } else {
      let html = '';
      
      if (enTabInfo && !isSGRole) {
        html += `
          <button class="btn-modal-secondary" id="btn-derivar-sg" style="color: #166534; border-color: #166534; display: flex; align-items: center; gap: 0.4rem;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Nueva OM SG
          </button>`;
      }

      if (enTabInfo) {
        html += `
          <button class="btn-modal-edit" id="btn-modal-edit">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>`;
      }
  
      if (!enTabOTs) {
        html += `
          <button class="btn-modal-primary" id="btn-ver-ots">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Ver OTs
          </button>`;
      }

      footerRight.innerHTML = html;
    }
  
    footerRight.removeEventListener('click', _onFooterClick);
    footerRight.addEventListener('click', _onFooterClick);
  }

  function _onFooterClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.id;
    if (id === 'btn-modal-footer-close') close();
    if (id === 'btn-ver-ots')            switchTab('ots');
    if (id === 'btn-modal-edit')         _enterEditMode();
    if (id === 'btn-cancel-edit')        _cancelEdit();
    if (id === 'btn-save-edit')          _saveEdit();
    
    if (id === 'btn-derivar-sg') {
      const omData = { ..._currentOM };
      close();
      if (window.DashboardComponent) DashboardComponent._switchTab('sg');
      if (window.SGPageComponent) {
        setTimeout(() => {
          SGPageComponent.openForm({
            ID_Orden: omData.ID_Orden, Area: omData.Area, ID_EQUIPO: omData.ID_EQUIPO,
            ITEM: omData.ITEM, Sistema: omData.Sistema, Descripcion: omData.Descripcion
          });
        }, 100);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // MODO EDICIÓN
  // ══════════════════════════════════════════════════════════
  function _enterEditMode() {
    _editMode  = true;
    _editState = {
      estatus:       _currentOM.Estatus,
      observaciones: _currentOM.Observaciones    ?? '',
      nSolicitud:    _currentOM.NSolicitud       ?? '',
      nOrdenCompra:  _currentOM.NOrdenCompra      ?? '',
      fechaEntrega:  _currentOM.FechaEntrega      ?? '',
    };
    _refreshInfoPanel();
    _refreshFooter();
  }

  function _cancelEdit() {
    _editMode  = false;
    _editState = {};
    _refreshInfoPanel();
    _refreshFooter();
  }

  async function _saveEdit() {
    if (_saving) return;
    _saving = true;
    _refreshFooter();

    const omSnapshot      = _currentOM;
    // Si el usuario es de SG, en este modal SOLO le mandamos Estatus y Observaciones.
    // OMService los actualizará perfectamente.
    const cambiosSnapshot = { ..._editState };
    
    const resultado = await OMService.actualizar(omSnapshot, cambiosSnapshot);

    _saving = false;

    if (resultado.ok) {
      ToastService?.show('Orden actualizada correctamente.', 'success');
      _editMode  = false;
      _editState = {};
      _refreshInfoPanel();
      _refreshFooter();
      _refreshHeaderBadge();
    } else {
      if(resultado.error){ ToastService?.show(resultado.error, 'danger'); }
      else{ ToastService?.show('Error al guardar. Intenta de nuevo.', 'danger'); }
      _refreshFooter();
    }
  }

  // ══════════════════════════════════════════════════════════
  // TABS Y GRAFICAS MANTIENEN SU CÓDIGO ORIGINAL INTACTO
  // ══════════════════════════════════════════════════════════
  function switchTab(tabId) {
    _activeTab = tabId;
    document.querySelectorAll('.ot-modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.ot-modal-tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
    _refreshFooter();
  }

  async function loadOTs(om, authenticated) {
    om.IS_SG=false;
    const ots = await OTWorkStore.getForOM(om.ID_Orden, om, authenticated);
    const badge = document.getElementById('modal-ot-badge');
    if (badge) { badge.textContent = ots.length; badge.style.display = 'inline'; }
    const otsEl = document.getElementById('ots-content');
    if (otsEl) {
      OTTabComponent.init('ots-content', om, ots, _refreshGraficas);
      OTTabComponent.bindEvents();
    }
    _refreshGraficas(ots);
  }
  
  function _refreshGraficas(ots) {
    const grafEl = document.getElementById('graficas-content');
    if (!grafEl) return;
    grafEl.innerHTML = renderCharts(ots);
  }

  function renderCharts(ots) {
    const kpis         = OTWorkStore.calcKPIs(ots);
    const omsDelEquipo = OTStore.getAll().filter(o => o.ID_EQUIPO === _currentOM.ID_EQUIPO);
    const equipos      = OTWorkStore.calcEquipoAvance(omsDelEquipo);
    const equipo       = equipos[0];

    const pctColor = kpis.pctConcluida >= 75 ? '#2D8A4E' : kpis.pctConcluida >= 40 ? '#4caf50' : kpis.pctConcluida >  0  ? '#81c784' : '#B8B3A7';

    return `
      <div class="ot-chart-hero">
        <div class="ot-chart-hero-left">
          <div class="ot-chart-hero-label">Avance general</div>
          <div class="ot-chart-hero-pct">${kpis.pctConcluida}<span>%</span></div>
          <div class="ot-chart-hero-sub">${kpis.counts['Concluida'] ?? 0} completadas de ${kpis.total} órdenes</div>
        </div>
        <div class="ot-chart-hero-bar-wrap">
          <div class="ot-chart-hero-track">
            <div class="ot-chart-hero-fill" style="width:${Math.max(kpis.pctConcluida,2)}%;background:${pctColor};"></div>
          </div>
          <div class="ot-chart-hero-scale"><span>0%</span><span>50%</span><span>100%</span></div>
        </div>
      </div>
      <div class="ot-charts-panel">
        <div class="ot-chart-card">
          <div class="ot-chart-card-title"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Estado de OTs</div>
          ${renderDonut(kpis)}
        </div>
        <div class="ot-chart-card">
          <div class="ot-chart-card-title"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> Avance del Equipo</div>
          ${equipo ? `
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.6rem;">${equipo.equipoId} — ${equipo.item}</div>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="flex:1;height:10px;background:var(--color-gray-100);border-radius:99px;overflow:hidden;">
                  <div style="height:100%;width:${Math.max(equipo.pct,2)}%;background:${pctColor};border-radius:99px;transition:width 0.4s ease;"></div>
                </div>
                <span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:${pctColor};min-width:36px;">${equipo.pct}%</span>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.4rem;">${equipo.concluidas} de ${equipo.total} órdenes completadas</div>
            </div>` : `<div style="flex:1;display:flex;align-items:center;font-size:0.8rem;color:var(--text-muted);">Sin datos de equipo.</div>`}
          <hr class="ot-chart-card-divider"/>
          <div class="ot-modal-kpis">
            ${mkpi(kpis.total,                   'Total OTs')}
            ${mkpi(kpis.horasTotal.toFixed(1),   'Horas totales')}
            ${mkpi(kpis.horasRetraso.toFixed(1), 'Horas retraso')}
          </div>
        </div>
      </div>`;
  }

  function mkpi(val, label) { return `<div class="ot-modal-kpi"><div class="ot-modal-kpi-val">${val}</div><div class="ot-modal-kpi-label">${label}</div></div>`; }

  function renderDonut(kpis) {
    const total  = kpis.total || 1;
    const r = 62, cx = 80, cy = 80;
    const circum = 2 * Math.PI * r;
    let paths = '', offset = 0, legend = '';
  
    DONUT_ORDER.forEach(st => {
      const cnt   = kpis.counts[st] ?? 0;
      const pct   = cnt / total;
      const dash  = pct * circum;
      const color = OT_COLORS[st] ?? '#ccc'; 
  
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="22" stroke-dasharray="${dash} ${circum - dash}" stroke-dashoffset="${-offset}" stroke-linecap="butt"/>`;
      offset += dash;
  
      legend += `<div class="ot-legend-item"><span class="ot-legend-dot" style="background:${color}"></span><span class="ot-legend-label">${st}</span><span class="ot-legend-val">${cnt}</span><span class="ot-legend-pct">${Math.round(pct * 100)}%</span></div>`;
    });
  
    if (kpis.total === 0) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-gray-200)" stroke-width="22"/>`;
  
    return `<div class="ot-donut-wrap"><div style="position:relative;display:inline-flex;align-items:center;justify-content:center;"><svg class="ot-donut-svg" viewBox="0 0 160 160"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-gray-100)" stroke-width="22"/>${paths}</svg><div class="ot-donut-center"><div class="ot-donut-pct">${kpis.pctConcluida}<span style="font-size:1rem;">%</span></div><div class="ot-donut-pct-label">Concluido</div></div></div><div class="ot-donut-legend">${legend}</div></div>`;
  }

  function renderOTList(ots) {
    if (!ots || ots.length === 0) return `<div class="ot-bar-chart-empty">No hay órdenes de trabajo registradas para esta OM.</div>`;
    const totalHoras   = ots.reduce((s, ot) => s + (ot.Duracion || 0), 0);
    const totalRetraso = ots.reduce((s, ot) => s + (ot.Retraso  || 0), 0);
    const concluidas   = ots.filter(ot => ot.Estatus === 'Concluida').length;

    const summary = `<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;padding:0.75rem 1rem;background:var(--color-gray-50);border-radius:var(--radius-md);border:1px solid var(--color-gray-100);"><div style="font-size:0.75rem;color:var(--text-muted);"><strong style="color:var(--text-primary);font-family:var(--font-mono);">${ots.length}</strong> OTs · <strong style="color:var(--text-primary);font-family:var(--font-mono);">${totalHoras.toFixed(1)}h</strong> totales · <strong style="color:var(--color-success);font-family:var(--font-mono);">${concluidas}</strong> concluidas ${totalRetraso > 0 ? ` · <strong style="color:var(--color-danger);font-family:var(--font-mono);">${totalRetraso.toFixed(1)}h</strong> retraso` : ''}</div></div>`;

    const cards = ots.map(ot => {
      const stKey    = ot.Estatus?.replace(/\s/g,'-') ?? '';
      const badgeCls = STATUS_COLORS[ot.Estatus]?.badge ?? 'status-programado';
      return `<div class="ot-work-card st-${stKey}"><div class="ot-work-card-main"><div class="ot-work-desc">${h(ot.Descripcion)}</div><div class="ot-work-meta"><span class="ot-work-meta-item"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${h(ot.ID_Mecanico)}</span><span class="ot-work-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${h(ot.Fecha || '—')}</span>${ot.Semana ? `<span class="ot-work-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg> S${String(ot.Semana).padStart(2,'0')}</span>` : ''}<span class="ot-status ${badgeCls}" style="font-size:0.63rem;"><span class="ot-status-dot"></span>${h(ot.Estatus)}</span></div>${ot.Causa    ? `<div class="ot-work-causa">⚠ ${h(ot.Causa)}</div>` : ''}${ot.Comentario ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:0.3rem;font-style:italic;">${h(ot.Comentario)}</div>` : ''}</div><div class="ot-work-card-right"><div class="ot-work-horas">${ot.Duracion.toFixed(1)} <span>hrs</span></div>${ot.Retraso > 0 ? `<div class="ot-work-retraso"><svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>+${ot.Retraso.toFixed(1)}h retraso</div>` : ''}</div></div>`;
    }).join('');

    return summary + `<div class="ot-work-list">${cards}</div>`;
  }

  function close() {
    if (_editMode) { if (!window.confirm('Tienes cambios sin guardar. ¿Cerrar de todas formas?')) return; }
    const root = document.getElementById('ot-modal-root');
    const bd   = document.getElementById('ot-backdrop');
    document.removeEventListener('keydown', _escHandler);
     OTTabComponent.destroy();
    _currentOM = null; _editMode = false; _editState = {}; _currentSGDetail = null;
    if (bd) {
      bd.style.transition = 'opacity 0.18s ease'; bd.style.opacity = '0';
      const m = bd.querySelector('.ot-modal');
      if (m) { m.style.transition = 'all 0.18s ease'; m.style.transform = 'scale(0.95) translateY(8px)'; m.style.opacity = '0'; }
      setTimeout(() => { if (root) root.innerHTML = ''; }, 200);
    } else if (root) { root.innerHTML = ''; }
  }

  function _escHandler(e) { if (e.key === 'Escape') { if (_editMode) _cancelEdit(); else close(); } }

  function _refreshHeaderBadge() {
    const badge = document.getElementById('header-status-badge');
    if (!badge) return;
    badge.className = `ot-status ${omStatusClass(_currentOM.Estatus)}`;
    badge.innerHTML = `<span class="ot-status-dot"></span>${h(_currentOM.Estatus)}`;
  }

  function h(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function mf(label, val, customHtml) { const empty = !val || String(val).trim() === ''; const body = customHtml ?? `<div class="ot-modal-val${empty?' empty':''}">${empty?'—':h(String(val))}</div>`; return `<div class="ot-modal-field"><div class="ot-modal-label">${label}</div>${body}</div>`; }
  
  function omStatusClass(s) {
    return { 'Programado': 'status-programado', 'En Proceso': 'status-en-proceso', 'En proceso': 'status-en-proceso', 'Concluida':  'status-completado', 'Completado': 'status-completado', 'Detenido':   'status-pendiente', 'Pendiente':  'status-pendiente' }[s] ?? 'status-programado';
  }

  const ETAPA_IDX = { 'Desmontaje y diagnóstico': 0, 'Lavado e inspección': 1, 'Reparación o reemplazo': 2, 'Ensamblaje y ajuste; pruebas finales': 3 };
  const ETAPA_SHORT = { 'Desmontaje y diagnóstico': 'Desmontaje', 'Lavado e inspección': 'Lavado/Insp.', 'Reparación o reemplazo': 'Reparación', 'Ensamblaje y ajuste; pruebas finales': 'Ensamblaje' };

  return { open, close, renderOTList};
})();

window.ModalComponent = ModalComponent;