// ============================================================
// CADASA TALLER — OT TAB COMPONENT  (v4)
// Cambios:
//  + Botón cambiador de estado rápido en cada card
//  + Datos de OM heredados: Area, Sistema, ID_Equipo, Item
//  + Semana calculada automáticamente desde la fecha
//  + Fix date format: yyyy-MM-dd (era dd-MM-yyyy en algunos casos)
// ============================================================

const OTTabComponent = (() => {

  let _state        = 'list'; // 'list' | 'create' | 'edit'
  let _om           = null;
  let _ots          = [];
  let _editingOT    = null;
  let _el           = null;
  let _bound        = false;
  let _onOTsChange  = null;

  // Popup de cambio de estado
  let _statusPopup  = null;

  const OT_ESTADOS = [
    { value: 'Programado', label: 'Programado' },
    { value: 'En Proceso', label: 'En Proceso' },
    { value: 'Concluida',  label: 'Concluida'  },
    { value: 'Ausencia',   label: 'Ausencia'   },
  ];

  const OT_STATUS_COLORS = {
    'Concluida':  { hex: '#2D8A4E', badge: 'status-completado' },
    'En Proceso': { hex: '#1A6B9A', badge: 'status-en-proceso' },
    'Programado': { hex: '#B8B3A7', badge: 'status-programado' },
    'Ausencia':   { hex: '#E67E22', badge: 'status-pendiente'  },
  };

  // ── Utilidades de fecha ──────────────────────────────────

  /**
   * Convierte CUALQUIER formato recibido → 'yyyy-MM-dd' para input[type=date]
   * Casos manejados:
   *   'dd/MM/yyyy'  'dd-MM-yyyy'  → invertir partes
   *   'yyyy-MM-dd'                → usar tal cual
   *   'yyyy-MM-ddTHH:MM:SS...'   → recortar
   *   timestamp ISO completo      → recortar
   */
  function _toInputDate(val) {
    if (!val || val === '—') return '';

    // ISO con tiempo: '2025-03-15T00:00:00...'
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(val)) return val.slice(0, 10);

    // ISO puro: '2025-03-15'
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    // Locale con separador '/' o '-': puede ser dd/MM/yyyy o d/M/yyyy
    const sep = val.includes('/') ? '/' : val.includes('-') ? '-' : null;
    if (sep) {
      const p = val.split(sep);
      if (p.length === 3) {
        // Determinar si el primer segmento es año (>= 1000) o día
        if (p[0].length === 4 && Number(p[0]) >= 1000) {
          // ya es yyyy-MM-dd con otro separador
          return `${p[0].padStart(4,'0')}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
        } else {
          // dd/MM/yyyy  →  yyyy-MM-dd
          const [d, m, y] = p;
          return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
      }
    }

    // Fallback: intentar parsear con Date
    try {
      const dt = new Date(val);
      if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
    } catch(_) {}

    return '';
  }

  /**
   * Calcula el número de semana ISO (lunes=inicio) para una fecha 'yyyy-MM-dd'
   */
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
      _el.removeEventListener('click', _handleClick);
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

  // ── Render ────────────────────────────────────────────────
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

    const totalH  = _ots.reduce((s,o) => s + (o.Duracion||0), 0);
    const totalR  = _ots.reduce((s,o) => s + (o.Retraso||0),  0);
    const concl   = _ots.filter(o => o.Estatus === 'Concluida').length;

    const summary = `
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;padding:0.75rem 1rem;
                  background:var(--color-gray-50);border-radius:var(--radius-md);
                  border:1px solid var(--color-gray-100);font-size:0.75rem;color:var(--text-muted);">
        <strong style="color:var(--text-primary);font-family:var(--font-mono);">${_ots.length}</strong> OTs ·
        <strong style="color:var(--text-primary);font-family:var(--font-mono);">${totalH.toFixed(1)}h</strong> totales ·
        <strong style="color:var(--color-success);font-family:var(--font-mono);">${concl}</strong> concluidas
        ${totalR > 0 ? ` · <strong style="color:var(--color-danger);font-family:var(--font-mono);">${totalR.toFixed(1)}h</strong> retraso` : ''}
      </div>`;

    const cards = _ots.map(ot => {
      const colors = OT_STATUS_COLORS[ot.Estatus] ?? OT_STATUS_COLORS['Programado'];
      const stKey  = (ot.Estatus ?? '').replace(/\s/g,'-');
      const id     = h(ot.ID_RowNumber);

      // Datos heredados de la OM
      const area    = h(ot.Area    || _om?.Area    || '');
      const sistema = h(ot.Sistema || _om?.Sistema || '');
      const equipo  = h(ot.ID_Equipo || _om?.ID_Equipo || '');
      const item    = h(ot.Item    || _om?.Item    || '');

      return `
        <div class="ot-work-card st-${stKey}" data-ot-id="${id}">
          <div class="ot-work-card-main">
            <div class="ot-work-desc">${h(ot.Descripcion)}</div>
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
              ${equipo  ? `<span class="ot-work-meta-item ot-om-chip ot-om-chip--equipo" title="Equipo"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>${equipo}</span>` : ''}
              ${area    ? `<span class="ot-work-meta-item ot-om-chip" title="Área">${area}</span>` : ''}
              ${sistema ? `<span class="ot-work-meta-item ot-om-chip" title="Sistema">${sistema}</span>` : ''}
              ${item    ? `<span class="ot-work-meta-item ot-om-chip" title="Item">Ítem: ${item}</span>` : ''}
            </div>
            ${ot.Causa      ? `<div class="ot-work-causa">⚠ ${h(ot.Causa)}</div>` : ''}
            ${ot.Comentario ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:0.3rem;font-style:italic;">${h(ot.Comentario)}</div>` : ''}
          </div>
          <div class="ot-work-card-right">
            <div class="ot-work-horas">${(ot.Duracion||0).toFixed(1)} <span>hrs</span></div>
            ${ot.Retraso > 0 ? `<div class="ot-work-retraso">+${ot.Retraso.toFixed(1)}h retraso</div>` : ''}
            <div class="ot-card-actions">
              <!-- Cambiador de estado rápido -->
              <button class="btn-ot-status-change" data-ot-id="${id}" data-current-status="${h(ot.Estatus)}"
                title="Cambiar estado">
                <span class="ot-status ${colors.badge}" style="font-size:0.63rem;pointer-events:none;">
                  <span class="ot-status-dot"></span>${h(ot.Estatus)}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10" style="margin-left:3px;flex-shrink:0;opacity:0.6;pointer-events:none;">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <!-- Editar -->
              <button class="btn-ot-edit" data-ot-id="${id}" title="Editar OT">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

    return summary + `<div class="ot-work-list">${cards}</div>`;
  }

  // ── Status Popup ─────────────────────────────────────────
  function _openStatusPopup(btn, otId, currentStatus) {
    _closeStatusPopup();

    const popup = document.createElement('div');
    popup.className = 'ot-status-popup';
    popup.dataset.popupFor = otId;

    popup.innerHTML = OT_ESTADOS.map(e => {
      const colors  = OT_STATUS_COLORS[e.value] ?? OT_STATUS_COLORS['Programado'];
      const active  = e.value === currentStatus ? ' ot-status-popup-item--active' : '';
      return `
        <button class="ot-status-popup-item${active}" data-status-val="${e.value}" data-ot-id="${otId}">
          <span class="ot-status-dot-sm" style="background:${colors.hex};"></span>
          ${e.label}
          ${active ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>`;
    }).join('');

    // Posicionar debajo del botón
    const rect = btn.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    popup.style.top  = (rect.bottom + scrollY + 4) + 'px';
    popup.style.left = (rect.left   + scrollX)     + 'px';

    document.body.appendChild(popup);
    _statusPopup = popup;

    // Cerrar al hacer click fuera
    setTimeout(() => {
      document.addEventListener('click', _onDocClickClosePopup, { once: true });
    }, 0);
  }

  function _closeStatusPopup() {
    if (_statusPopup) {
      _statusPopup.remove();
      _statusPopup = null;
    }
  }

  function _onDocClickClosePopup(e) {
    if (_statusPopup && !_statusPopup.contains(e.target)) {
      _closeStatusPopup();
    }
  }

  // ── Formulario crear/editar ───────────────────────────────
  function _renderForm(ot) {
    const isEdit = ot !== null;
    const h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const fechaVal = _toInputDate(ot?.Fecha);

    // Datos heredados de la OM (solo lectura en el form)
    const area    = _om?.Area      ?? ot?.Area      ?? '';
    const sistema = _om?.Sistema   ?? ot?.Sistema   ?? '';
    const equipo  = _om?.ID_Equipo ?? ot?.ID_Equipo ?? '';
    const item    = _om?.Item      ?? ot?.Item      ?? '';

    const opts = OT_ESTADOS.map(e =>
      `<option value="${e.value}" ${(ot?.Estatus ?? 'Programado') === e.value ? 'selected' : ''}>${e.label}</option>`
    ).join('');

    return `
      <div class="ot-tab-header ot-modal-section">
        <button class="btn-modal-secondary" id="btn-back-list">← Volver</button>
        <div class="ot-tab-title ot-modal-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isEdit
              ? `<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                 <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>`
              : `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`}
          </svg>
          ${isEdit ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
        </div>
      </div>

      <div class="ot-form ot-chart-card">

        ${(area || sistema || equipo || item) ? `
        <div class="ot-om-inherited-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          Datos heredados de la OM:
          ${equipo  ? `<span class="ot-om-inherited-chip"><strong>Equipo:</strong> ${h(equipo)}</span>` : ''}
          ${area    ? `<span class="ot-om-inherited-chip"><strong>Área:</strong> ${h(area)}</span>` : ''}
          ${sistema ? `<span class="ot-om-inherited-chip"><strong>Sistema:</strong> ${h(sistema)}</span>` : ''}
          ${item    ? `<span class="ot-om-inherited-chip"><strong>Ítem:</strong> ${h(item)}</span>` : ''}
        </div>` : ''}

        <div class="ot-form-grid">

          <div class="ot-modal-field" style="grid-column:1/-1;">
            <div class="ot-modal-label">Descripción</div>
            <input type="text" id="ot-desc" placeholder="Descripción de la orden…" value="${h(ot?.Descripcion ?? '')}" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Mecánico</div>
            <input type="text" id="ot-mec" placeholder="ID o nombre" value="${h(ot?.ID_Mecanico ?? '')}" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Fecha</div>
            <input type="date" id="ot-fecha" value="${fechaVal}" />
            <div class="ot-modal-label" style="margin-top:0.3rem;font-size:0.6rem;color:var(--text-muted);" id="ot-semana-preview">
              ${fechaVal ? `Semana ${_isoWeek(fechaVal) ?? '—'}` : 'Semana se calculará al guardar'}
            </div>
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Horas</div>
            <input type="number" id="ot-duracion" placeholder="0.0" min="0" step="0.5" value="${ot?.Duracion ?? ''}" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Retraso (hrs)</div>
            <input type="number" id="ot-retraso" placeholder="0.0" min="0" step="0.5" value="${(ot?.Retraso ?? 0)}" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Estado</div>
            <select id="ot-status">${opts}</select>
          </div>

          <div class="ot-modal-field" style="grid-column:1/-1;">
            <div class="ot-modal-label">Causa (opcional)</div>
            <input type="text" id="ot-causa" placeholder="Causa de retraso o parada…" value="${h(ot?.Causa ?? '')}" />
          </div>

          <div class="ot-modal-field" style="grid-column:1/-1;">
            <div class="ot-modal-label">Comentario (opcional)</div>
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

  // ── Eventos ───────────────────────────────────────────────
  function bindEvents() {
    if (!_el || _bound) return;
    _el.addEventListener('click', _handleClick);
    // Live preview de semana en el formulario
    _el.addEventListener('change', _handleChange);
    _bound = true;
  }

  function _handleChange(e) {
    if (e.target?.id === 'ot-fecha') {
      const preview = document.getElementById('ot-semana-preview');
      if (preview) {
        const dateStr = e.target.value; // ya en yyyy-MM-dd porque es input[type=date]
        const w = _isoWeek(dateStr);
        preview.textContent = w ? `Semana ${w}` : 'Fecha inválida';
      }
    }
  }

  async function _handleClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    // ── Cambiador de estado rápido ──
    if (btn.classList.contains('btn-ot-status-change')) {
      e.stopPropagation();
      const otId         = btn.dataset.otId;
      const currentStatus = btn.dataset.currentStatus;
      _openStatusPopup(btn, otId, currentStatus);
      return;
    }

    // ── Item del popup de estado ──
    if (btn.classList.contains('ot-status-popup-item')) {
      e.stopPropagation();
      const newStatus = btn.dataset.statusVal;
      const otId      = btn.dataset.otId;
      _closeStatusPopup();
      await _handleStatusChange(otId, newStatus);
      return;
    }

    // ── Editar OT ──
    if (btn.classList.contains('btn-ot-edit')) {
      const otId = btn.dataset.otId;
      _editingOT = _ots.find(o => String(o.ID_RowNumber) === String(otId)) ?? null;
      if (_editingOT) { _state = 'edit'; _render(); }
      return;
    }

    switch (btn.id) {
      case 'btn-add-ot':
        _editingOT = null; _state = 'create'; _render(); break;

      case 'btn-back-list':
      case 'btn-cancel':
        _editingOT = null; _state = 'list'; _render(); break;

      case 'btn-save':
        await _handleSave(
          btn.dataset.edit === 'true',
          btn.dataset.otId,
          btn
        );
        break;
    }
  }

  // ── Cambio rápido de estado ───────────────────────────────
  async function _handleStatusChange(otId, newStatus) {
    const ot = _ots.find(o => String(o.ID_RowNumber) === String(otId));
    if (!ot || ot.Estatus === newStatus) return;

    // Optimistic UI: actualizar localmente primero
    const oldStatus = ot.Estatus;
    ot.Estatus = newStatus;
    _render();

    const res = await OTService.actualizarOT(otId, { Estatus: newStatus });

    if (res.ok) {
      const idx = _ots.findIndex(o => String(o.ID_RowNumber) === String(otId));
      if (idx !== -1) _ots[idx] = res.data;
      _render();
      _onOTsChange?.([..._ots]);
      ToastService?.show(`Estado actualizado: ${newStatus}`, 'success');
    } else {
      // Revertir si falla
      ot.Estatus = oldStatus;
      _render();
      ToastService?.show('Error al cambiar estado. Intenta de nuevo.', 'danger');
    }
  }

  // ── Guardar OT ────────────────────────────────────────────
  async function _handleSave(isEdit, otId, saveBtn) {
    const desc       = document.getElementById('ot-desc')?.value?.trim()        ?? '';
    const mec        = document.getElementById('ot-mec')?.value?.trim()         ?? '';
    const fechaRaw   = document.getElementById('ot-fecha')?.value               ?? '';
    const duracion   = parseFloat(document.getElementById('ot-duracion')?.value) || 0;
    const retraso    = parseFloat(document.getElementById('ot-retraso')?.value)  || 0;
    const status     = document.getElementById('ot-status')?.value              ?? 'Programado';
    const causa      = document.getElementById('ot-causa')?.value?.trim()       ?? '';
    const comentario = document.getElementById('ot-comentario')?.value?.trim()  ?? '';

    if (!desc) {
      const inp = document.getElementById('ot-desc');
      if (inp) { inp.style.borderColor = 'var(--color-danger)'; inp.focus(); setTimeout(() => inp.style.borderColor = '', 2000); }
      return;
    }

    // Normalizar fecha a yyyy-MM-dd (input[type=date] ya lo entrega así, pero por si acaso)
    const fecha = _toInputDate(fechaRaw);

    // Calcular semana automáticamente
    const semana = _isoWeek(fecha) ?? null;

    // Datos heredados de la OM
    const area    = _om?.Area      ?? '';
    const sistema = _om?.Sistema   ?? '';
    const equipo  = _om?.ID_Equipo ?? '';
    const item    = _om?.Item      ?? '';

    saveBtn.disabled  = true;
    saveBtn.innerHTML = `<div class="spinner-sm"></div> Guardando…`;

    const datos = {
      Descripcion: desc,
      ID_Mecanico: mec,
      Fecha:       fecha,
      Duracion:    duracion,
      Retraso:     retraso,
      Estatus:     status,
      Causa:       causa,
      Comentario:  comentario,
      Semana:      semana,
      // Datos de OM
      Area:        area,
      Sistema:     sistema,
      ID_Equipo:   equipo,
      Item:        item,
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

      _editingOT = null;
      _state     = 'list';
      _render();

      // Badge
      const badge = document.getElementById('modal-ot-badge');
      if (badge) { badge.textContent = _ots.length; badge.style.display = 'inline'; }

      // Gráficas
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
      _el.removeEventListener('click', _handleClick);
      _el.removeEventListener('change', _handleChange);
    }
    _bound = false; _state = 'list'; _om = null;
    _ots = []; _editingOT = null; _el = null; _onOTsChange = null;
  }

  return { init, bindEvents, destroy };

})();

window.OTTabComponent = OTTabComponent;