// ============================================================
// CADASA TALLER — OT TAB COMPONENT  (v4.3)
// Cambios:
//  - Estado "Programado" → "Retrasado"
//  - Causa y Retraso (horas) solo visibles cuando Estatus = Retrasado
//  - Al cambiar estado a "Retrasado" desde card → abre form edición
//  - Al cambiar a "Concluida" → update directo + mover card al DOM
//    de concluidas sin re-render completo (animación fade-out/in)
//  - Solo se envían columnas del schema al guardar/actualizar
// ============================================================

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
    { value: 'Retrasado',  label: 'Retrasado'  },
    { value: 'En Proceso', label: 'En Proceso' },
    { value: 'Concluida',  label: 'Concluida'  },
    { value: 'Ausencia',   label: 'Ausencia'   },
  ];

  const OT_STATUS_COLORS = {
    'Concluida':  { hex: '#2D8A4E', badge: 'status-completado' },
    'En Proceso': { hex: '#1A6B9A', badge: 'status-en-proceso' },
    'Retrasado':  { hex: '#B8B3A7', badge: 'status-programado' },
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
  function _render() {
    const inner = _el?.querySelector('#ot-tab-inner')
                ?? document.getElementById('ot-tab-inner');
    if (!inner) return;
    inner.classList.remove('slide-left', 'slide-right');
    inner.classList.add(_state === 'list' ? 'slide-right' : 'slide-left');
    const html = _state === 'list'   ? _renderList()
               : _state === 'create' ? _renderForm(null)
               :                       _renderForm(_editingOT);
    inner.innerHTML = `<div class="ot-view active">${html}</div>`;
  }

  // ── Lista ─────────────────────────────────────────────────
  function _renderList() {
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
        ${_renderOTCards()}
      </div>`;
  }

  function _renderOTCards() {
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

    const cardsActivas = activas.length
      ? activas.map(ot => _renderCard(ot, h)).join('')
      : `<div class="ot-bar-chart-empty" style="padding:1rem 0;">No hay órdenes activas.</div>`;

    const seccionConcluidas = concluidas.length ? `
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
        ${concluidas.map(ot => _renderCard(ot, h)).join('')}
      </div>` : '';

    return summary
      + `<div class="ot-work-list">${cardsActivas}</div>`
      + seccionConcluidas;
  }

  function _renderCard(ot, h) {
    const colors = OT_STATUS_COLORS[ot.Estatus] ?? OT_STATUS_COLORS['Retrasado'];
    const stKey  = (ot.Estatus ?? '').replace(/\s/g,'-');
    const id     = h(ot.ID_RowNumber);

    return `
      <div class="ot-work-card st-${stKey}" data-ot-id="${id}">
        <div class="ot-work-card-main">
          <div class="ot-work-desc">${h(ot.Descripcion ?? '')}</div>
          <div class="ot-work-meta">
            <span class="ot-work-meta-item">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${h(ot.ID_Mecanico || '—')}
            </span>
            <span class="ot-work-meta-item">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${h(ot.Fecha || '—')}
            </span>
            ${ot.Semana ? `<span class="ot-work-meta-item ot-semana-badge">S${String(ot.Semana).padStart(2,'0')}</span>` : ''}
          </div>
          ${ot.Causa      ? `<div class="ot-work-causa">⚠ ${h(ot.Causa)}</div>` : ''}
          ${ot.Comentario ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:0.3rem;font-style:italic;">${h(ot.Comentario)}</div>` : ''}
        </div>
        <div class="ot-work-card-right">
          <div class="ot-work-horas">${(ot.Duracion||0).toFixed(1)} <span>hrs</span></div>
          ${ot.Retraso > 0 ? `<div class="ot-work-retraso">+${ot.Retraso.toFixed(1)}h retraso</div>` : ''}
          <div class="ot-card-actions">
            <button class="btn-ot-status-change" data-ot-id="${id}" data-current-status="${h(ot.Estatus)}" title="Cambiar estado">
              <span class="ot-status ${colors.badge}" style="font-size:0.63rem;pointer-events:none;">
                <span class="ot-status-dot"></span>${h(ot.Estatus)}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  width="10" height="10" style="margin-left:3px;flex-shrink:0;opacity:0.6;pointer-events:none;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <button class="btn-ot-edit" data-ot-id="${id}" title="Editar OT">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`;
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
    const isEdit      = ot !== null;
    const h           = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const fechaVal    = _toInputDate(ot?.Fecha);
    const estadoActual = ot?.Estatus ?? 'Retrasado';

    // Mostrar campos de retraso solo si el estado es 'Retrasado'
    const showRetrasoFields = estadoActual === 'Retrasado';

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

      <div class="ot-form ot-chart-card">
        <div class="ot-form-grid">

          <div class="ot-modal-field">
            <div class="ot-modal-label">Mecánico</div>
            <input type="text" id="ot-mec" placeholder="ID o nombre" value="${h(ot?.ID_Mecanico ?? '')}" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Fecha</div>
            <input type="date" id="ot-fecha" value="${fechaVal}" />
            <div class="ot-semana-hint" id="ot-semana-preview">
              ${fechaVal ? `Semana ${_isoWeek(fechaVal) ?? '—'}` : ''}
            </div>
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Horas</div>
            <input type="number" id="ot-duracion" placeholder="0.0" min="0" step="0.5" value="${ot?.Duracion ?? ''}" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Estado</div>
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
      _toggleRetrasoFields(newVal === 'Retrasado');
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
    if (btn.id === 'btn-add-ot') {
      if (_om.Estatus === 'Concluida') {
        window.ToastService
          ? window.ToastService.show('No se pueden agregar tareas a un mantenimiento ya completado. Debe cambiar el estado primero.', 'error')
          : alert('Debe cambiar el estado de la OM para agregar nuevas tareas.');
        return;
      }
      _state = 'create'; _editingOT = null; _render();
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
    if (newStatus === 'Retrasado') {
      _editingOT = { ...ot, Estatus: 'Retrasado' };
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

    setTimeout(() => {
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
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = _renderCard(ot, h);
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

    setTimeout(() => {
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

      // Insertar en lista de activas
      let listaActivas = _el?.querySelector('.ot-work-list');
      if (!listaActivas) { _render(); return; }

      // Quitar placeholder si existe
      const placeholder = listaActivas.querySelector('.ot-bar-chart-empty');
      if (placeholder) placeholder.remove();

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = _renderCard(ot, h);
      const newCard = tempDiv.firstElementChild;
      newCard.style.opacity   = '0';
      newCard.style.transform = 'translateY(8px)';
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
    const mec        = document.getElementById('ot-mec')?.value?.trim()          ?? '';
    const fechaRaw   = document.getElementById('ot-fecha')?.value                ?? '';
    const duracion   = parseFloat(document.getElementById('ot-duracion')?.value) || 0;
    const status     = document.getElementById('ot-status')?.value               ?? 'Retrasado';
    const comentario = document.getElementById('ot-comentario')?.value?.trim()   ?? '';

    // Causa y Retraso solo si aplica
    const isRetrasado = status === 'Retrasado';
    const retraso  = isRetrasado ? (parseFloat(document.getElementById('ot-retraso')?.value)  || 0) : 0;
    const causa    = isRetrasado ? (document.getElementById('ot-causa')?.value?.trim()        ?? '') : '';

    const fecha  = _toInputDate(fechaRaw);
    const semana = fecha ? String(_isoWeek(fecha) ?? '') : '';

    console.log('[OTTab] fecha raw:', fechaRaw, '→ normalizada:', fecha, '| semana:', semana);

    saveBtn.disabled  = true;
    saveBtn.innerHTML = `<div class="spinner-sm"></div> Guardando…`;

    // Solo columnas del schema (sin Descripcion, Area, etc.)
    const datos = {
      ID_Mecanico:  mec,
      Fecha:        fecha,
      Duracion:     duracion,
      Retraso:      retraso,
      Estatus:      status,
      Causa:        causa,
      Comentario:   comentario,
      Semana:       semana,
    };

    const res = isEdit
      ? await OTService.actualizarOT(otId, datos)
      : await OTService.crearOT(_om.ID_Orden, datos);

    if (res.ok) {
      if (isEdit) {
        const idx = _ots.findIndex(o => String(o.ID_RowNumber) === String(otId));
        if (idx !== -1) _ots[idx] = res.data; else _ots.unshift(res.data);
      } else {
        _ots.unshift(res.data);
      }

      _editingOT = null; _state = 'list'; _render();

      const badge = document.getElementById('modal-ot-badge');
      if (badge) { badge.textContent = _ots.length; badge.style.display = 'inline'; }

      _onOTsChange?.([..._ots]);
      ToastService?.show(isEdit ? 'OT actualizada correctamente.' : 'OT creada correctamente.', 'success');

    } else {
      saveBtn.disabled  = false;
      saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg> ${isEdit ? 'Guardar cambios' : 'Crear OT'}`;
      ToastService?.show('Error al guardar. Intenta de nuevo.', 'danger');
    }
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