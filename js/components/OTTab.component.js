// ============================================================
// CADASA TALLER — OT TAB COMPONENT  (v3)
// Estados OT: Programado | En Proceso | Concluida | Ausencia
// Incluye: crear OT, editar OT, sync gráficas, badge, cache
// ============================================================

const OTTabComponent = (() => {

  let _state        = 'list'; // 'list' | 'create' | 'edit'
  let _om           = null;
  let _ots          = [];
  let _editingOT    = null;
  let _el           = null;
  let _bound        = false;
  let _onOTsChange  = null;

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

  // ── Init ──────────────────────────────────────────────────
  function init(containerId, om, ots, onOTsChange) {
    if (_bound && _el) {
      _el.removeEventListener('click', _handleClick);
      _bound = false;
    }
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
      const colors   = OT_STATUS_COLORS[ot.Estatus] ?? OT_STATUS_COLORS['Programado'];
      const stKey    = (ot.Estatus ?? '').replace(/\s/g,'-');
      return `
        <div class="ot-work-card st-${stKey}">
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
              ${ot.Semana ? `<span class="ot-work-meta-item">S${String(ot.Semana).padStart(2,'0')}</span>` : ''}
              <span class="ot-status ${colors.badge}" style="font-size:0.63rem;">
                <span class="ot-status-dot"></span>${h(ot.Estatus)}
              </span>
            </div>
            ${ot.Causa      ? `<div class="ot-work-causa">⚠ ${h(ot.Causa)}</div>` : ''}
            ${ot.Comentario ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:0.3rem;font-style:italic;">${h(ot.Comentario)}</div>` : ''}
          </div>
          <div class="ot-work-card-right">
            <div class="ot-work-horas">${(ot.Duracion||0).toFixed(1)} <span>hrs</span></div>
            ${ot.Retraso > 0 ? `<div class="ot-work-retraso">+${ot.Retraso.toFixed(1)}h retraso</div>` : ''}
            <button class="btn-ot-edit" data-ot-id="${h(ot.ID_RowNumber)}" title="Editar OT"
              style="margin-top:0.35rem;width:28px;height:28px;display:flex;align-items:center;
                     justify-content:center;border-radius:var(--radius-sm);border:1.5px solid var(--color-gray-200);
                     background:var(--color-white);cursor:pointer;color:var(--text-muted);
                     transition:all var(--transition-fast);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>`;
    }).join('');

    return summary + `<div class="ot-work-list">${cards}</div>`;
  }

  // ── Formulario crear/editar ───────────────────────────────
  function _renderForm(ot) {
    const isEdit = ot !== null;
    const h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    let fechaVal = '';
    if (ot?.Fecha && ot.Fecha !== '—') {
      const p = ot.Fecha.split('/');
      if (p.length === 3) fechaVal = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(ot.Fecha)) fechaVal = ot.Fecha;
    }

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
    _bound = true;
  }

  async function _handleClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

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

  async function _handleSave(isEdit, otId, saveBtn) {
    const desc       = document.getElementById('ot-desc')?.value?.trim()        ?? '';
    const mec        = document.getElementById('ot-mec')?.value?.trim()         ?? '';
    const fecha      = document.getElementById('ot-fecha')?.value               ?? '';
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

    saveBtn.disabled  = true;
    saveBtn.innerHTML = `<div class="spinner-sm"></div> Guardando…`;

    const datos = { Descripcion: desc, ID_Mecanico: mec, Fecha: fecha,
                    Duracion: duracion, Retraso: retraso, Estatus: status,
                    Causa: causa, Comentario: comentario };

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
    if (_el && _bound) _el.removeEventListener('click', _handleClick);
    _bound = false; _state = 'list'; _om = null;
    _ots = []; _editingOT = null; _el = null; _onOTsChange = null;
  }

  return { init, bindEvents, destroy };

})();

window.OTTabComponent = OTTabComponent;