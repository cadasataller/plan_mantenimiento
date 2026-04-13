

const OTTabComponent = (() => {

  let _state        = 'list';
  let _om           = null;
  let _ots          = [];
  let _editingOT    = null;
  let _el           = null;
  let _bound        = false;
  let _onOTsChange  = null;
  let _statusPopup  = null;

  const OT_ESTADOS = [
    { value: 'Retrasada',  label: 'Retrasada'  },
    { value: 'En Proceso', label: 'En Proceso' },
    { value: 'Concluida',  label: 'Concluida'  },
    { value: 'Ausencia',   label: 'Ausencia'   },
  ];

  const OT_STATUS_COLORS = {
    'Concluida':  { hex: '#2D8A4E', badge: 'status-completado' },
    'En Proceso': { hex: '#1A6B9A', badge: 'status-en-proceso' },
    'Retrasada':  { hex: '#B8B3A7', badge: 'status-programado' },
'Retrasado':  { hex: '#B8B3A7', badge: 'status-programado' }, // ✅ Cambiar a 'Retrasada'
    'Ausencia':   { hex: '#E67E22', badge: 'status-pendiente'  },
  };

  // ── Utilidades de fecha ───────────────────────────────────

  function _toInputDate(val) {
    if (!val || val === '—') return '';
    const raw = String(val).trim();

    // ① ISO con tiempo: '2026-03-31T00:00:00'
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
      const result = raw.slice(0, 10);
      console.log('[OTTab] _toInputDate ①ISO+time :', raw, '→', result);
      return result;
    }
    // ② ISO puro: '2026-03-31'
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    // ③ dd/MM/yyyy
    if (raw.includes('/')) {
      const p = raw.split('/');
      if (p.length === 3) {
        const [d, m, y] = p;
        const result = `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        console.log('[OTTab] _toInputDate ③dd/MM/yyyy:', raw, '→', result);
        return result;
      }
    }
    console.warn('[OTTab] _toInputDate formato desconocido:', raw);
    return '';
  }

  function _isoWeek(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d)) return null;
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diff = d - startOfWeek1;
    return Math.floor(diff / (7 * 86400000)) + 1;
  }

  // ── Init ──────────────────────────────────────────────────
  function init(containerId, om, ots, onOTsChange) {
    if (_bound && _el) {
      _el.removeEventListener('click',  _handleClick);
      _el.removeEventListener('change', _handleChange);
      document.removeEventListener('click', _handleDocClick);
      _bound = false;
    }
    _closeStatusPopup();
    _om          = om;
    _ots         = [...ots];
    _state       = 'list';
    _editingOT   = null;
    _onOTsChange = onOTsChange ?? null;
    _el          = document.getElementById(containerId);
    if (!_el) return;

    _el.innerHTML = `
      <div class="ot-tab-wrapper">
        <div class="ot-tab-inner" id="ot-tab-inner"></div>
      </div>`;
    _render();
  }

  // ── Render completo ───────────────────────────────────────
  // ── Render completo ───────────────────────────────────────
  async function _render() {
    const inner = _el?.querySelector('#ot-tab-inner')
                ?? document.getElementById('ot-tab-inner');
    if (!inner) return;

    // Definir contexto y equipo de trabajo para filtrar mecánicos
    const context = _om.IS_SG ? 'mecanicos' : 'default';
    const equipoTrabajo = _om.IS_SG && _om.tipo_trabajo ? _om.tipo_trabajo : null;

    // Precargar mecánicos antes de pintar cualquier cosa para tener los nombres listos
    if (window.MecanicoSelectComponent) {
      await MecanicoSelectComponent.fetchMecanicos(context, equipoTrabajo);
    }

    inner.classList.remove('slide-left', 'slide-right');
    inner.classList.add(_state === 'list' ? 'slide-right' : 'slide-left');
    
    // Ahora las funciones de renderizado abajo tendrán acceso inmediato al caché
    const html = _state === 'list'   ? await _renderList(context, equipoTrabajo)
               : _state === 'create' ? _renderForm(null)
               :                       _renderForm(_editingOT);
               
    inner.innerHTML = `<div class="ot-view active">${html}</div>`;

    if (_state === 'create' || _state === 'edit') {
      MecanicoSelectComponent.mount(_editingOT?.ID_Mecanico, context, equipoTrabajo);
    }
  }

  // ── Lista ─────────────────────────────────────────────────
  // ── Lista ─────────────────────────────────────────────────
  async function _renderList(context, equipoTrabajo) {
    // 1. Esperamos a que se generen todas las tarjetas (ahora es asíncrono)
    const cardsHtml = await _renderOTCards(context, equipoTrabajo);

    return `
      <div class="ot-tab-header ot-modal-section">
        <div class="ot-tab-title ot-modal-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Órdenes de Trabajo
        </div>
        <button class="btn-modal-primary" id="btn-add-ot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva OT
        </button>
      </div>
      <div class="ot-tab-content ot-work-list">
        ${cardsHtml}
      </div>`;
  }

  async function _renderOTCards(context, equipoTrabajo) {
    const h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (!_ots.length)
      return `<div class="ot-bar-chart-empty">No hay órdenes de trabajo registradas para esta OM.</div>`;

    const totalH = _ots.reduce((s,o) => s + (o.Duracion||0), 0);
    const totalR = _ots.reduce((s,o) => s + (o.Retraso||0),  0);
    const concl  = _ots.filter(o => o.Estatus === 'Concluida').length;

    const activas    = _ots.filter(o => o.Estatus !== 'Concluida');
    const concluidas = _ots.filter(o => o.Estatus === 'Concluida');

    const summary = `
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;padding:0.75rem 1rem;
                  background:var(--color-gray-50);border-radius:var(--radius-md);
                  border:1px solid var(--color-gray-100);font-size:0.75rem;color:var(--text-muted);">
        <strong style="color:var(--text-primary);font-family:var(--font-mono);">${_ots.length}</strong> OTs ·
        <strong style="color:var(--text-primary);font-family:var(--font-mono);">${totalH.toFixed(1)}h</strong> totales ·
        <strong style="color:var(--color-success);font-family:var(--font-mono);">${concl}</strong> concluidas
        ${totalR > 0 ? ` · <strong style="color:var(--color-danger);font-family:var(--font-mono);">${totalR.toFixed(1)}h</strong> retraso` : ''}
      </div>`;

    // 2. Usamos Promise.all para esperar que TODAS las tarjetas activas obtengan el nombre del mecánico
    const cardsActivasPromises = activas.map(ot => _renderCard(ot, h, context, equipoTrabajo));
    const cardsActivas = activas.length
      ? (await Promise.all(cardsActivasPromises)).join('')
      : `<div class="ot-bar-chart-empty" style="padding:1rem 0;">No hay órdenes activas.</div>`;

    let seccionConcluidas = '';
    
    // 3. Hacemos lo mismo con las tarjetas concluidas si es que hay alguna
    if (concluidas.length) {
      const cardsConcluidasPromises = concluidas.map(ot => _renderCard(ot, h, context, equipoTrabajo));
      const cardsConcluidasHtml = (await Promise.all(cardsConcluidasPromises)).join('');
      
      seccionConcluidas = `
        <div class="ot-concluidas-toggle" id="btn-toggle-concluidas" data-open="false">
          <div class="ot-concluidas-toggle-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span>Concluidas</span>
            <span class="ot-concluidas-badge">${concluidas.length}</span>
          </div>
          <span class="ot-concluidas-toggle-hint">Mostrar</span>
        </div>
        <div class="ot-concluidas-list" id="ot-concluidas-list" style="display:none;">
          ${cardsConcluidasHtml}
        </div>`;
    }

    return summary
      + `<div class="ot-work-list">${cardsActivas}</div>`
      + seccionConcluidas;
  }

  // ── Render Card ──────────────────────────────────────────
async function _renderCard(ot, h, context, equipoTrabajo) {

  const colors = OT_STATUS_COLORS[ot.Estatus] ?? OT_STATUS_COLORS['Retrasado'];
  const stKey  = (ot.Estatus ?? '').replace(/\s/g, '-');
  const id     = h(ot.ID_RowNumber);

  // 🔹 Obtener nombre del mecánico
  const nombreMecanico = window.MecanicoSelectComponent
    ? await window.MecanicoSelectComponent.getNameById(ot.ID_Mecanico, context, equipoTrabajo)
    : ot.ID_Mecanico;

  return `
    <div class="ot-work-card st-${stKey}" data-ot-id="${id}">
      
      <div class="ot-work-card-main">

        <!-- Descripción -->
        <div class="ot-work-desc">
          ${h(ot.Descripcion ?? '')}
        </div>

        <!-- Meta -->
        <div class="ot-work-meta">

          <!-- Mecánico -->
          <span class="ot-work-meta-item">
            <svg viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${h(nombreMecanico || '—')}
          </span>

          <!-- Fecha -->
          <span class="ot-work-meta-item">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${h(ot.Fecha || '—')}
          </span>

        </div>

        <!-- Causa / Comentario -->
        ${ot.Causa 
          ? `<div class="ot-work-causa">⚠ ${h(ot.Causa)}</div>` 
          : ''}

        ${ot.Comentario 
          ? `<div class="ot-work-comment">${h(ot.Comentario)}</div>` 
          : ''}

      </div>

      <!-- Lado derecho -->
      <div class="ot-work-card-right">

        <!-- Horas -->
        <div class="ot-work-horas">
          ${(ot.Duracion || 0).toFixed(1)} <span>hrs</span>
        </div>

        <!-- Retraso -->
        ${ot.Retraso > 0 
          ? `<div class="ot-work-retraso">+${ot.Retraso.toFixed(1)}h retraso</div>` 
          : ''}

        <!-- Acciones -->
        <div class="ot-card-actions">

          <!-- Estado -->
          <button 
            class="btn-ot-status-change"
            data-ot-id="${id}"
            data-current-status="${h(ot.Estatus)}"
            title="Cambiar estado"
          >
            <span class="ot-status ${colors.badge}" style="pointer-events:none;">
              <span class="ot-status-dot"></span>
              ${h(ot.Estatus)}
            </span>
          </button>

          <!-- Editar -->
          <button 
            class="btn-ot-edit"
            data-ot-id="${id}"
            title="Editar OT"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

        </div>
      </div>

    </div>
  `;
  }
  // ── Status Popup ──────────────────────────────────────────
  function _openStatusPopup(btn, otId, currentStatus) {
    _closeStatusPopup();

    const popup = document.createElement('div');
    popup.className    = 'ot-status-popup';
    popup.dataset.popupFor = otId;

    popup.innerHTML = OT_ESTADOS.map(e => {
      const colors = OT_STATUS_COLORS[e.value] ?? OT_STATUS_COLORS['Retrasado'];
      const active = e.value === currentStatus ? ' ot-status-popup-item--active' : '';
      return `
        <button class="ot-status-popup-item${active}" data-status-val="${e.value}" data-ot-id="${otId}">
          <span class="ot-status-dot-sm" style="background:${colors.hex};"></span>
          ${e.label}
          ${active ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="11" height="11" style="margin-left:auto;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>`;
    }).join('');

    const rect       = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupH     = OT_ESTADOS.length * 42;

    let topVal, transformVal;
    if (spaceBelow < popupH + 8) {
      topVal       = rect.top - 4;
      transformVal = 'translateY(-100%)';
    } else {
      topVal       = rect.bottom + 4;
      transformVal = 'none';
    }

    popup.style.cssText = `
      position: fixed;
      top: ${topVal}px;
      left: ${rect.left}px;
      transform: ${transformVal};
      z-index: 99999;
      min-width: max(160px, ${rect.width}px);
    `;

    document.body.appendChild(popup);
    _statusPopup = popup;
  }

  function _closeStatusPopup() {
    if (_statusPopup) {
      _statusPopup.remove();
      _statusPopup = null;
    }
  }

  // ── Formulario crear/editar ───────────────────────────────
  function _renderForm(ot) {
    const isEdit       = ot !== null;
    const h            = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const fechaVal     = _toInputDate(ot?.Fecha);
    const estadoActual = ot?.Estatus ?? 'En Proceso';
    const showRetrasoFields = estadoActual === 'Retrasada';

    // ── Banner con datos de la OM ──
    const omBanner = _om ? `
      <div class="ot-om-banner">
        ${_om.Area        ? `<span class="ot-om-banner-item"><span class="ot-om-banner-label">Área</span>${h(_om.Area)}</span>` : ''}
        ${_om.ID_EQUIPO   ? `<span class="ot-om-banner-item"><span class="ot-om-banner-label">Equipo</span>${h(_om.ID_EQUIPO)}</span>` : ''}
        ${_om.ITEM        ? `<span class="ot-om-banner-item"><span class="ot-om-banner-label">Item</span>${h(_om.ITEM)}</span>` : ''}
        ${_om.Sistema     ? `<span class="ot-om-banner-item"><span class="ot-om-banner-label">Sistema</span>${h(_om.Sistema)}</span>` : ''}
        ${_om.Descripcion ? `<span class="ot-om-banner-item ot-om-banner-desc"><span class="ot-om-banner-label">Descripción</span>${h(_om.Descripcion)}</span>` : ''}
      </div>` : '';

    return `
      <div class="ot-tab-header ot-modal-section">
        <button class="btn-modal-secondary" id="btn-back-list">← Volver</button>
        <div class="ot-tab-title ot-modal-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isEdit
              ? `<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
                 <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>`
              : `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`}
          </svg>
          ${isEdit ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
        </div>
      </div>

      ${omBanner}

      <div class="ot-form ot-chart-card">
        <div class="ot-form-grid">
          
          <div class="ot-modal-field">
              <div class="ot-moda-label">
                Mecánico <span style="color:#ef4444">*</span>
              </div>
              ${MecanicoSelectComponent.renderHtml()}
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Fecha <span style="color:#ef4444">*</span></div>
            <input type="date" id="ot-fecha" value="${fechaVal}" />
            <div class="ot-semana-hint" id="ot-semana-preview">
              ${fechaVal ? `Semana ${_isoWeek(fechaVal) ?? '—'}` : ''}
            </div>
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Horas <span style="color:#ef4444">*</span></div>
            <input type="number" id="ot-duracion" placeholder="0.0" min="0" step="0.5" value="${ot?.Duracion ?? ''}" />
          </div>

          <div class="ot-modal-field" style="grid-column:1/-1;">
            <div class="ot-modal-label">Estado <span style="color:#ef4444">*</span></div>
            <div class="ot-status-buttons" id="ot-status-buttons">
              ${OT_ESTADOS.map(e => {
                const active = estadoActual === e.value ? 'active' : '';
                const colors = OT_STATUS_COLORS[e.value] ?? OT_STATUS_COLORS['Retrasado'];
                return `
                  <button
                    type="button"
                    class="ot-status-btn ${active}"
                    data-value="${e.value}"
                    style="--st-color:${colors.hex};"
                  >
                    <span class="dot"></span>
                    ${e.label}
                  </button>`;
              }).join('')}
            </div>
            <input type="hidden" id="ot-status" value="${estadoActual}" />
          </div>

          <!-- Campos de retraso: visibles solo cuando Estatus = Retrasado -->
          <div class="ot-modal-field ot-retraso-field" id="ot-field-retraso"
               style="${showRetrasoFields ? '' : 'display:none;'}">
            <div class="ot-modal-label">Retraso (hrs)</div>
            <input type="number" id="ot-retraso" placeholder="0.0" min="0" step="0.5" value="${(ot?.Retraso ?? 0)}" />
          </div>

          <div class="ot-modal-field ot-retraso-field" style="grid-column:1/-1;${showRetrasoFields ? '' : 'display:none;'}"
               id="ot-field-causa">
            <div class="ot-modal-label">Causa del retraso</div>
            <input type="text" id="ot-causa" placeholder="Causa del retraso…" value="${h(ot?.Causa ?? '')}" />
          </div>

          <div class="ot-modal-field" style="grid-column:1/-1;">
            <div class="ot-modal-label">Comentario</div>
            <input type="text" id="ot-comentario" placeholder="Observaciones adicionales…" value="${h(ot?.Comentario ?? '')}" />
          </div>

        </div>

        <div class="ot-form-actions">
          <button class="btn-modal-secondary" id="btn-cancel">Cancelar</button>
          <button class="btn-modal-primary" id="btn-save"
            data-edit="${isEdit}"
            data-ot-id="${h(ot?.ID_RowNumber ?? '')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            ${isEdit ? 'Guardar cambios' : 'Crear OT'}
          </button>
        </div>
      </div>`;
  }

  // ── Mostrar/ocultar campos de retraso ─────────────────────
  function _toggleRetrasoFields(show) {
    ['ot-field-retraso', 'ot-field-causa'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    });
    // Limpiar valores si se ocultan
    if (!show) {
      const r = document.getElementById('ot-retraso');
      const c = document.getElementById('ot-causa');
      if (r) r.value = '0';
      if (c) c.value = '';
    }
  }

  // ── Eventos ───────────────────────────────────────────────
  function bindEvents() {
    if (!_el || _bound) return;
    _el.addEventListener('click',  _handleClick);
    _el.addEventListener('change', _handleChange);
    document.addEventListener('click', _handleDocClick);
    _bound = true;
  }

  function _handleChange(e) {
    if (e.target?.id === 'ot-fecha') {
      const preview = document.getElementById('ot-semana-preview');
      if (preview) {
        const w = _isoWeek(e.target.value);
        preview.textContent = w ? `Semana ${w}` : 'Fecha inválida';
      }
    }
  }

  function _handleDocClick(e) {
    const popupItem = e.target.closest('.ot-status-popup-item');
    if (popupItem) {
      e.stopPropagation();
      const newStatus = popupItem.dataset.statusVal;
      const otId      = popupItem.dataset.otId;
      _closeStatusPopup();
      _handleStatusChange(otId, newStatus);
      return;
    }
    if (_statusPopup && !_statusPopup.contains(e.target)) {
      _closeStatusPopup();
    }
  }

  async function _handleClick(e) {
    const btn = e.target.closest('button, #btn-toggle-concluidas');
    if (!btn) return;

    // ── Abrir popup de estado desde card ──
    if (btn.classList.contains('btn-ot-status-change')) {
      e.stopPropagation();
      _openStatusPopup(btn, btn.dataset.otId, btn.dataset.currentStatus);
      return;
    }

    // ── Editar OT ──
    if (btn.classList.contains('btn-ot-edit')) {
      const otId = btn.dataset.otId;
      _editingOT = _ots.find(o => String(o.ID_RowNumber) === String(otId)) ?? null;
      if (_editingOT) { _state = 'edit'; _render(); }
      return;
    }

    // ── Selector de estado en formulario ──
    const statusBtn = e.target.closest('.ot-status-btn');
    if (statusBtn) {
      const container = document.getElementById('ot-status-buttons');
      const hidden    = document.getElementById('ot-status');

      container.querySelectorAll('.ot-status-btn').forEach(b => b.classList.remove('active'));
      statusBtn.classList.add('active');

      const newVal = statusBtn.dataset.value;
      if (hidden) hidden.value = newVal;

      // Mostrar/ocultar campos de retraso según el estado elegido
      _toggleRetrasoFields(newVal === 'Retrasada');
      return;
    }

    // ── Toggle concluidas ──
    if (btn.id === 'btn-toggle-concluidas') {
      const list   = document.getElementById('ot-concluidas-list');
      const isOpen = btn.dataset.open === 'true';
      const hint   = btn.querySelector('.ot-concluidas-toggle-hint');
      const icon   = btn.querySelector('svg');
      btn.dataset.open    = !isOpen;
      list.style.display  = isOpen ? 'none' : 'flex';
      hint.textContent    = isOpen ? 'Mostrar' : 'Ocultar';
      icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
      return;
    }

    // ── Nueva OT ──
    // ── Nueva OT ──
    if (btn.id === 'btn-add-ot') {
      if (_om.Estatus === 'Concluida') {
        window.ToastService
          ? window.ToastService.show('No se pueden agregar tareas a un mantenimiento ya completado. Debe cambiar el estado primero.', 'error')
          : alert('Debe cambiar el estado de la OM para agregar nuevas tareas.');
        return;
      }

      // 👇 NUEVA VALIDACIÓN: Bloquear si no hay fecha programada
      const fechaPadre = _om.IS_SG ? _om.fecha_ejecucion : (_om['Fecha inicio'] || _om.FechaInicio);
      const tieneFechaPadre = fechaPadre && fechaPadre !== '—' && String(fechaPadre).trim() !== '';

      if (
        (!_om.IS_SG && (!tieneFechaPadre || _om.Estatus === 'Programado')) ||
        (!_om.Estatus)
      ) {
        const msg = 'Debe programar la Orden y asignarle una fecha de inicio (o ejecución) antes de agregar tareas.';
        if (window.ToastService) window.ToastService.show(msg, 'warning');
        else alert(msg);
        return;
      }
      // 👆 FIN DE NUEVA VALIDACIÓN

      _state = 'create'; 
      _editingOT = null; 
      _render();
      return;
    }

    switch (btn.id) {
      case 'btn-back-list':
      case 'btn-cancel':
        _editingOT = null; _state = 'list'; _render(); break;
      case 'btn-save':
        await _handleSave(btn.dataset.edit === 'true', btn.dataset.otId, btn); break;
    }
  }

  // ── Cambio rápido de estado desde card ───────────────────
  async function _handleStatusChange(otId, newStatus) {
    const ot = _ots.find(o => String(o.ID_RowNumber) === String(otId));
    if (!ot || ot.Estatus === newStatus) return;

    // Retrasado → abrir formulario para capturar causa y horas
    if (newStatus === 'Retrasada') {
      _editingOT = { ...ot, Estatus: 'Retrasada' };
      _state     = 'edit';
      _render();
      return;
    }

    const oldStatus = ot.Estatus;

    // Optimistic: actualizar badge de estado en la card
    ot.Estatus = newStatus;
    _updateCardBadge(ot);

    const res = await OTService.actualizarOT(otId, { Estatus: newStatus });

    if (res.ok) {
      const idx = _ots.findIndex(o => String(o.ID_RowNumber) === String(otId));
      if (idx !== -1) _ots[idx] = res.data;

      // Actualizar badge con datos confirmados del server
      _updateCardBadge(res.data);

      // Si pasó a Concluida → mover card al bloque de concluidas en el DOM
      if (newStatus === 'Concluida') {
        _moveCardToConcluidas(res.data);
      }
      // Si venía de Concluida y ahora es otro estado → mover a activas
      if (oldStatus === 'Concluida' && newStatus !== 'Concluida') {
        _moveCardToActivas(res.data);
      }

      _onOTsChange?.([..._ots]);
      ToastService?.show(`Estado: ${newStatus}`, 'success');
    } else {
      ot.Estatus = oldStatus;
      _updateCardBadge(ot);
      ToastService?.show('Error al cambiar estado.', 'danger');
    }
  }

  // ── Actualizar solo el badge de estado de una card ────────
  function _updateCardBadge(ot) {
    const card = _el?.querySelector(`.ot-work-card[data-ot-id="${ot.ID_RowNumber}"]`);
    if (!card) { _render(); return; }

    const h      = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const colors = OT_STATUS_COLORS[ot.Estatus] ?? OT_STATUS_COLORS['Retrasado'];
    const stKey  = (ot.Estatus ?? '').replace(/\s/g,'-');

    card.className = card.className.replace(/\bst-\S+/g, '').trim() + ` st-${stKey}`;

    const statusBtn = card.querySelector('.btn-ot-status-change');
    if (statusBtn) {
      statusBtn.dataset.currentStatus = ot.Estatus;
      statusBtn.innerHTML = `
        <span class="ot-status ${colors.badge}" style="font-size:0.63rem;pointer-events:none;">
          <span class="ot-status-dot"></span>${h(ot.Estatus)}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             width="10" height="10" style="margin-left:3px;flex-shrink:0;opacity:0.6;pointer-events:none;">
          <polyline points="6 9 12 15 18 9"/>
        </svg>`;
    }
  }

  // ── Mover card al bloque de concluidas ────────────────────
  function _moveCardToConcluidas(ot) {
    const h    = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const card = _el?.querySelector(`.ot-work-card[data-ot-id="${ot.ID_RowNumber}"]`);
    if (!card) { _render(); return; }

    // Contar concluidas actuales para decidir si crear la sección
    const concluidas = _ots.filter(o => o.Estatus === 'Concluida');

    // Animación de salida
    card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'translateY(-6px)';

    setTimeout(async() => {
      card.remove();

      // Actualizar contador del summary
      _refreshSummary();

      // ── Obtener o crear la sección de concluidas ──
      let toggleBtn  = _el?.querySelector('#btn-toggle-concluidas');
      let listEl     = _el?.querySelector('#ot-concluidas-list');

      if (!toggleBtn) {
        // La sección no existe aún → crearla e insertarla al final de ot-tab-content
        const tabContent = _el?.querySelector('.ot-tab-content');
        if (!tabContent) { _render(); return; }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
          <div class="ot-concluidas-toggle" id="btn-toggle-concluidas" data-open="true">
            <div class="ot-concluidas-toggle-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"
                   style="transform:rotate(90deg);">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span>Concluidas</span>
              <span class="ot-concluidas-badge">1</span>
            </div>
            <span class="ot-concluidas-toggle-hint">Ocultar</span>
          </div>
          <div class="ot-concluidas-list" id="ot-concluidas-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"></div>`;

        tabContent.appendChild(wrapper.children[0]); // toggle btn
        tabContent.appendChild(wrapper.children[0]); // list
        toggleBtn = _el.querySelector('#btn-toggle-concluidas');
        listEl    = _el.querySelector('#ot-concluidas-list');
      } else {
        // Actualizar badge del contador
        const badge = toggleBtn.querySelector('.ot-concluidas-badge');
        if (badge) badge.textContent = concluidas.length;

        // Si la sección está cerrada, abrirla automáticamente
        const isOpen = toggleBtn.dataset.open === 'true';
        if (!isOpen) {
          toggleBtn.dataset.open = 'true';
          listEl.style.display   = 'flex';
          const hint = toggleBtn.querySelector('.ot-concluidas-toggle-hint');
          const icon = toggleBtn.querySelector('svg');
          if (hint) hint.textContent     = 'Ocultar';
          if (icon) icon.style.transform = 'rotate(90deg)';
        }
      }

      // Insertar card al principio de la lista de concluidas
      const context = _om.IS_SG ? 'mecanicos' : 'default';
      const equipoTrabajo = _om.IS_SG && _om.tipo_trabajo ? _om.tipo_trabajo : null;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = await _renderCard(ot, h, context, equipoTrabajo);
      const newCard = tempDiv.firstElementChild;
      newCard.style.opacity   = '0';
      newCard.style.transform = 'translateY(8px)';
      listEl.prepend(newCard);

      // Animación de entrada
      requestAnimationFrame(() => {
        newCard.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        newCard.style.opacity    = '1';
        newCard.style.transform  = 'translateY(0)';
      });

      // Si la lista de activas quedó vacía, mostrar placeholder
      const listaActivas = _el?.querySelector('.ot-work-list');
      if (listaActivas && !listaActivas.querySelector('.ot-work-card')) {
        listaActivas.innerHTML =
          `<div class="ot-bar-chart-empty" style="padding:1rem 0;">No hay órdenes activas.</div>`;
      }
    }, 230);
  }

  // ── Mover card de concluidas a activas ────────────────────
  // (cuando se reactiva una OT que estaba concluida)
  function _moveCardToActivas(ot) {
    const h    = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const card = _el?.querySelector(`.ot-work-card[data-ot-id="${ot.ID_RowNumber}"]`);
    if (!card) { _render(); return; }

    card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'translateY(-6px)';

    setTimeout(async() => {
      card.remove();
      _refreshSummary();

      // Actualizar badge de concluidas
      const concluidas  = _ots.filter(o => o.Estatus === 'Concluida');
      const toggleBtn   = _el?.querySelector('#btn-toggle-concluidas');
      if (toggleBtn) {
        const badge = toggleBtn.querySelector('.ot-concluidas-badge');
        if (badge) badge.textContent = concluidas.length;
        // Si ya no hay concluidas, remover la sección entera
        if (!concluidas.length) {
          toggleBtn.remove();
          _el?.querySelector('#ot-concluidas-list')?.remove();
        }
      }

      // Insertar en lista de activas (debajo del summary, no encima)
      let listaActivas = _el?.querySelector('.ot-work-list');
      if (!listaActivas) { _render(); return; }

      // Quitar placeholder si existe
      const placeholder = listaActivas.querySelector('.ot-bar-chart-empty');
      if (placeholder) placeholder.remove();

      const tempDiv = document.createElement('div');
      const context = _om.IS_SG ? 'mecanicos' : 'default';
      const equipoTrabajo = _om.IS_SG && _om.tipo_trabajo ? _om.tipo_trabajo : null;
      tempDiv.innerHTML = await _renderCard(ot, h, context, equipoTrabajo);
      const newCard = tempDiv.firstElementChild;
      newCard.style.opacity   = '0';
      newCard.style.transform = 'translateY(8px)';
      // prepend dentro de .ot-work-list — el summary vive FUERA de este div
      // así que la card queda correctamente debajo del summary
      listaActivas.prepend(newCard);

      requestAnimationFrame(() => {
        newCard.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        newCard.style.opacity    = '1';
        newCard.style.transform  = 'translateY(0)';
      });
    }, 230);
  }

  // ── Refrescar el bloque de summary (totales) ──────────────
  function _refreshSummary() {
    const summaryEl = _el?.querySelector('.ot-tab-content > div[style*="background"]');
    if (!summaryEl) return;
    const totalH = _ots.reduce((s,o) => s + (o.Duracion||0), 0);
    const totalR = _ots.reduce((s,o) => s + (o.Retraso||0),  0);
    const concl  = _ots.filter(o => o.Estatus === 'Concluida').length;
    summaryEl.innerHTML = `
      <strong style="color:var(--text-primary);font-family:var(--font-mono);">${_ots.length}</strong> OTs ·
      <strong style="color:var(--text-primary);font-family:var(--font-mono);">${totalH.toFixed(1)}h</strong> totales ·
      <strong style="color:var(--color-success);font-family:var(--font-mono);">${concl}</strong> concluidas
      ${totalR > 0 ? ` · <strong style="color:var(--color-danger);font-family:var(--font-mono);">${totalR.toFixed(1)}h</strong> retraso` : ''}`;
  }

  // Alias para compatibilidad interna (usado en _handleSave tras guardar desde form)
  function _updateCardInPlace(ot) { _updateCardBadge(ot); }

  // ── Guardar OT ────────────────────────────────────────────
  async function _handleSave(isEdit, otId, saveBtn) {
    const mecId       = MecanicoSelectComponent.getValue();
    const fechaRaw    = document.getElementById('ot-fecha')?.value                ?? '';
    const duracionStr = document.getElementById('ot-duracion')?.value?.trim()     ?? '';
    const status      = document.getElementById('ot-status')?.value               ?? 'Retrasada';
    const comentario  = document.getElementById('ot-comentario')?.value?.trim()   ?? '';

    // Causa y Retraso solo si aplica
    const isRetrasado = status === 'Retrasada'; 
    const retrasoStr  = document.getElementById('ot-retraso')?.value?.trim()      ?? '';
    const causa       = document.getElementById('ot-causa')?.value?.trim()        ?? '';

    const fecha  = _toInputDate(fechaRaw);
    const semana = fecha ? String(_isoWeek(fecha) ?? '') : '';

    // ── 1. Lógica de Validación de la OT ──
    let errorMsg = '';
    if (mecId === null) errorMsg = 'El Mecánico es obligatorio.';
    else if (!fecha) errorMsg = 'La Fecha es obligatoria.';
    else if (!semana) errorMsg = 'La fecha ingresada no es válida.';
    else if (!duracionStr || parseFloat(duracionStr) < 0) errorMsg = 'La Duración (horas) es obligatoria.';
    else if (isRetrasado) {
      if (!retrasoStr || parseFloat(retrasoStr) <= 0) errorMsg = 'Si está Retrasada, debe indicar las horas de retraso.';
      else if (!causa) errorMsg = 'Debe indicar la causa del retraso.';
    }

    // ── 1.1 Validación de la Orden Padre (OM o SG) ──
    if (!errorMsg) {
      const estadoPadre = _om.Estatus; 
      const fechaPadre = _om.IS_SG ? _om.fecha_ejecucion : (_om['Fecha inicio'] || _om.FechaInicio);

      const tieneFechaPadre  = fechaPadre && fechaPadre !== '—' && String(fechaPadre).trim() !== '';
      const tieneEstadoPadre = estadoPadre && String(estadoPadre).trim() !== '';

      if (
        !_om.IS_SG &&
        (!tieneEstadoPadre || (estadoPadre === 'Programado' && !tieneFechaPadre))
      ) {
        errorMsg = 'Debe programar la Orden y asignarle una fecha de inicio (o ejecución) antes de guardar trabajos.';
      }
    }

    // ── 2. Mostrar Error en UI ──
    let errorContainer = document.getElementById('ot-form-error');
    if (errorMsg) {
      if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'ot-form-error';
        errorContainer.className = 'ot-form-error-msg';
        const actions = document.querySelector('.ot-form-actions');
        actions.parentNode.insertBefore(errorContainer, actions);
      }
      errorContainer.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg> 
        ${errorMsg}`;
      errorContainer.style.display = 'flex';
      return; 
    } else if (errorContainer) {
      errorContainer.style.display = 'none'; 
    }

    // ── 3. Preparar datos validados ──
    const duracion   = parseFloat(duracionStr) || 0;
    const retraso    = isRetrasado ? (parseFloat(retrasoStr) || 0) : 0;
    const causaFinal = isRetrasado ? causa : '';

    saveBtn.disabled  = true;
    saveBtn.innerHTML = `<div class="spinner-sm"></div> Guardando…`;

    // ── 4. Actualización Automática del Padre a "En Proceso" ──
    if (_om.Estatus === 'Programado') {
      let resEstado;

      if (_om.IS_SG) {
       
        
        const payloadSG = {
          Estatus: 'En Proceso',
          
        };

        if(!_om.fecha_ejecucion){
           const hoy = new Date().toISOString().split('T')[0];
          const [y, m, d] = hoy.split('-');
          const dateObj = new Date(y, m - 1, d); // Meses en JS son de 0 a 11
                
          _om.Semana = String(_getWeekNumber(dateObj));

          payloadSG.semana = _om.Semana;
          payloadSG.fecha_ejecucion= hoy;
        }

        resEstado = await window.SGService.actualizarEstado(_om.id_sg, payloadSG);

        if (resEstado.ok) {
          _om.Estatus = 'En Proceso';
          _om.fecha_ejecucion = payloadSG.fecha_ejecucion;
          
          // Actualizamos el badge de SG usando SGUI si existe
          const headerBadge = document.getElementById('sg-modal-header-badge');
          if (headerBadge && window.SGUI) {
            headerBadge.innerHTML = SGUI.Badge('En Proceso');
          }
        }
      } else {
        // 👇 LLAMADA CORRECTA A OMService.actualizar 👇
        resEstado = await window.OMService.actualizar(_om, { estatus: 'En Proceso' });
        
        if (resEstado.ok) {
          _om.Estatus = 'En Proceso';
          
          const headerBadge = document.getElementById('header-status-badge');
          if (headerBadge) {
            headerBadge.className = 'ot-status status-en-proceso';
            headerBadge.innerHTML = '<span class="ot-status-dot"></span>En Proceso';
          }
        }
      }
      
      // Manejo de error si falla cualquiera de las dos actualizaciones
      if (!resEstado.ok) {
        saveBtn.disabled  = false;
        saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${isEdit ? 'Guardar cambios' : 'Crear OT'}`;
        const mensajeError = resEstado.error || 'Error al actualizar la orden.';
        if (window.ToastService) ToastService.show(mensajeError, 'danger');
        else alert(mensajeError);
        return; 
      }
    }

    // ── 5. Guardado de la OT ──
    const datos = {
      ID_Mecanico:  mecId,
      Fecha:        fecha,
      Duracion:     duracion,
      Retraso:      retraso,
      Estatus:      status,
      Causa:        causaFinal,
      Comentario:   comentario,
      Semana:       semana,
    };

    if (_om.IS_SG) {
      datos.id_sg = _om.id_sg;
      datos.id_om = null;
    } else {
      datos.id_om = _om.ID_Orden; 
      datos.id_sg = null;
    }
    
    const llaveCache = _om.IS_SG ? _om.id_sg : _om.ID_Orden;

    const res = isEdit
      ? await OTService.actualizarOT(otId, datos)
      : await OTService.crearOT(llaveCache, datos); 

    if (res.ok) {
      if (isEdit) {
        const idx = _ots.findIndex(o => String(o.ID_RowNumber) === String(otId));
        if (idx !== -1) _ots[idx] = res.data; else _ots.unshift(res.data);
      } else {
        _ots.unshift(res.data);
      }

      _editingOT = null; _state = 'list'; _render();

      const badge = document.getElementById('modal-ot-badge') || document.getElementById('sg-modal-ot-badge');
      if (badge) { badge.textContent = _ots.length; badge.style.display = 'inline-block'; }

      _onOTsChange?.([..._ots]);
      ToastService?.show(isEdit ? 'OT actualizada correctamente.' : 'OT creada correctamente.', 'success');
      if (_om.IS_SG && window.SGListComponent && typeof window.SGListComponent.refresh === 'function') {
         window.SGListComponent.refresh();
      }

    } else {
      saveBtn.disabled  = false;
      saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg> ${isEdit ? 'Guardar cambios' : 'Crear OT'}`;
      ToastService?.show('Error al guardar. Intenta de nuevo.', 'danger');
    }
  }

  function _getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }
  // ── Destroy ───────────────────────────────────────────────
  function destroy() {
    _closeStatusPopup();
    if (_el && _bound) {
      _el.removeEventListener('click',  _handleClick);
      _el.removeEventListener('change', _handleChange);
      document.removeEventListener('click', _handleDocClick);
    }
    _bound = false; _state = 'list'; _om = null;
    _ots = []; _editingOT = null; _el = null; _onOTsChange = null;
  }

  return { init, bindEvents, destroy };

})();

window.OTTabComponent = OTTabComponent;