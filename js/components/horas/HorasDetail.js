const HorasDetail = (() => {

  const ESTADOS_LIST = [
    { value: 'Concluida',  dot: '#2D8A4E' },
    { value: 'En Proceso', dot: '#1A6B9A' },
    { value: 'Ausencia',  dot: '#C97B2F' },
    { value: 'Retrasada',  dot: '#C0392B' },
  ];

  const ESTATUS_META = {
    'Concluido':  { cls: 'est-success', dot: '#2D8A4E' },
    'En Proceso': { cls: 'est-info',    dot: '#1A6B9A' },
    'Pendiente':  { cls: 'est-warning', dot: '#C97B2F' },
    'Retrasado':  { cls: 'est-danger',  dot: '#C0392B' },
    'Cancelado':  { cls: 'est-muted',   dot: '#8F8A7F' },
  };

  let _overlay = null;
  let _popup   = null;
  let _currentRow = null;
  let _onSave  = null;   // callback(updatedRow)
  let _onStatusChange = null; // callback(id, newStatus)

  // ── Inicializar (llamar una vez al montar el módulo de Horas) ──────────
  function init({ onSave, onStatusChange } = {}) {
    _onSave = onSave ?? null;
    _onStatusChange = onStatusChange ?? null;

    // Overlay de detalle
    if (!document.getElementById('hd-overlay')) {
      const ov = document.createElement('div');
      ov.id = 'hd-overlay';
      ov.className = 'hg-detail-overlay';
      ov.style.display = 'none';
      ov.innerHTML = `
        <div class="hg-detail-panel" id="hd-panel">
          <div class="hg-detail-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 width="16" height="16" style="color:var(--color-main);flex-shrink:0">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span class="hg-detail-header-title" id="hd-title">Detalle de Orden de Trabajo</span>
            <button class="hg-detail-close" id="hd-close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="hg-detail-body" id="hd-body"></div>
        </div>`;
      document.body.appendChild(ov);
      _overlay = ov;

      // Cerrar al click en fondo
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
      document.getElementById('hd-close').addEventListener('click', close);
    } else {
      _overlay = document.getElementById('hd-overlay');
    }

    // Popup de estados (flotante en body)
    if (!document.getElementById('hd-status-popup')) {
      const pp = document.createElement('div');
      pp.id = 'hd-status-popup';
      pp.className = 'hg-status-popup';
      pp.style.display = 'none';
      document.body.appendChild(pp);
      _popup = pp;
    } else {
      _popup = document.getElementById('hd-status-popup');
    }

    // Cerrar popup al click fuera
    document.addEventListener('click', e => {
      if (_popup && _popup.style.display !== 'none' &&
          !_popup.contains(e.target) &&
          !e.target.closest('.hg-btn-status-change')) {
        _closePopup();
      }
    });
  }

  // ── Abrir panel de detalle ────────────────────────────────
  function open(row) {
    _currentRow = { ...row };
    document.getElementById('hd-title').textContent = `Editar Orden de Trabajo`;
    _renderBody(row);
    _overlay.style.display = 'flex';
  }

  function close() {
    if (_overlay) _overlay.style.display = 'none';
    _currentRow = null;
  }

  // ── Render del cuerpo del panel ───────────────────────────
  // ── Fix 3: campo mecánico con MecanicoSelectComponent ─────────────────
function _renderBody(row) {
  const h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const isRetrasado = row.estatus === 'Retrasado';
  const semana = row.semana || '';

  document.getElementById('hd-body').innerHTML = `
    <div class="hg-detail-banner">
      ${row.descripcion ? `<div class="hg-detail-banner-item"><span class="hg-detail-banner-label">TRABAJO A REALIZAR</span><span class="hg-detail-banner-val">${h(row.descripcion)}</span></div>` : ''}
      ${row.area ? `<div class="hg-detail-banner-item"><span class="hg-detail-banner-label">Área</span><span class="hg-detail-banner-val">${h(row.area || row.mecArea || '—')}</span></div>` : ''}
    </div>

    <div class="hg-detail-grid">

      <!-- ✅ FIX 3: select en lugar de input texto -->
      <div class="hg-detail-field ot-modal-field" id="hdf-mec-wrapper">
        <label>Mecánico</label>
        ${MecanicoSelectComponent.renderHtml()}
      </div>

      <div class="hg-detail-field">
        <label>Fecha <span style="color:#ef4444">*</span></label>
        <input id="hdf-fecha" type="date" value="${_formatForDateInput(row.fecha)}"/>
        <div class="hg-semana-hint" id="hdf-semana-hint">${semana}</div>
      </div>

      <div class="hg-detail-field">
        <label>Horas <span style="color:#ef4444">*</span></label>
        <input id="hdf-horas" type="number" min="0" step="0.5" value="${row.horas ?? ''}"/>
      </div>

      <div class="hg-detail-field full">
        <label>Estado <span style="color:#ef4444">*</span></label>
        <div class="hg-status-buttons" id="hdf-status-btns">
          ${ESTADOS_LIST.map(e => `
            <button type="button" class="hg-status-btn ${row.estatus === e.value ? 'active' : ''}"
              data-value="${e.value}" style="--st-color:${e.dot};">
              <span class="dot"></span>${e.value}
            </button>`).join('')}
        </div>
        <input type="hidden" id="hdf-status" value="${h(row.estatus)}"/>
      </div>

      <div class="hg-retraso-section full" id="hdf-retraso-section"
           style="${isRetrasado ? '' : 'display:none'}">
        <div class="hg-detail-field">
          <label>Retraso (hrs)</label>
          <input id="hdf-retraso" type="number" min="0" step="0.5" value="${row.retraso || 0}"/>
        </div>
        <div class="hg-detail-field">
          <label>Causa del retraso</label>
          <input id="hdf-causa" type="text" value="${h(row.causa || '')}" placeholder="Causa del retraso…"/>
        </div>
      </div>

      <div class="hg-detail-field full">
        <label>Comentario</label>
        <textarea id="hdf-comentario" rows="2" placeholder="Observaciones adicionales…">${h(row.comentario || '')}</textarea>
      </div>

    </div>

    <div class="hg-detail-actions">
      <button class="btn-modal-secondary" id="hdf-cancel">Cancelar</button>
      <button class="btn-modal-primary" id="hdf-save">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
        Guardar cambios
      </button>
    </div>`;

  // ✅ FIX 3: montar el select de mecánicos con el ID actual
  MecanicoSelectComponent.mount(row.mecId);

  document.getElementById('hdf-fecha').addEventListener('input', _updateSemanaHint);
  document.getElementById('hdf-cancel').addEventListener('click', close);
  document.getElementById('hdf-save').addEventListener('click', _save);

  document.getElementById('hdf-status-btns').addEventListener('click', e => {
    const btn = e.target.closest('.hg-status-btn');
    if (!btn) return;
    document.querySelectorAll('#hdf-status-btns .hg-status-btn')
            .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const val = btn.dataset.value;
    document.getElementById('hdf-status').value = val;
    document.getElementById('hdf-retraso-section').style.display =
      val === 'Retrasado' ? '' : 'none';
    // ✅ FIX 2: NO limpiar causa/retraso al cambiar estado,
    // solo ocultar la sección visualmente
  });
}

  function _updateSemanaHint() {
    const fecha = document.getElementById('hdf-fecha')?.value;
    const hint  = document.getElementById('hdf-semana-hint');
    if (!hint) return;
    const w = _isoWeek(fecha);
    hint.textContent = (fecha && w)
      ? `Semana ${w} · ${fecha.slice(0, 4)}`
      : '';
  }

  // ── Fix 1 + 2: _save corregido ────────────────────────────────────────
function _save() {
  if (!_currentRow) return;
  const fecha      = document.getElementById('hdf-fecha')?.value || '';
  const horas      = parseFloat(document.getElementById('hdf-horas')?.value || 0);
  const status     = document.getElementById('hdf-status')?.value || '';
  const comentario = document.getElementById('hdf-comentario')?.value?.trim() || '';

  // ✅ leer ID del select de mecánico
  const mecId = MecanicoSelectComponent.getValue();

  const isRetrasado = status === 'Retrasado';
  const retraso = isRetrasado
    ? parseFloat(document.getElementById('hdf-retraso')?.value || 0)
    : (_currentRow.retraso || 0);
  const causa = isRetrasado
    ? (document.getElementById('hdf-causa')?.value?.trim() || '')
    : (_currentRow.causa || '');

  if (!fecha)                   { _showError('La fecha es obligatoria.');     return; }
  if (isNaN(horas) || horas < 0){ _showError('Las horas son obligatorias.');  return; }
  if (isRetrasado && !retraso)  { _showError('Indica las horas de retraso.'); return; }
  if (isRetrasado && !causa)    { _showError('Indica la causa del retraso.'); return; }

  // ✅ fecha siempre limpia YYYY-MM-DD desde el input[type=date]
  const semana = _isoWeek(fecha);

  const updated = {
    ..._currentRow,
    // ✅ actualizar mecId (el nombre lo resuelve HorasTable al actualizar cache)
    mecId: mecId ?? _currentRow.mecId,
    fecha,          // ya es YYYY-MM-DD, sin hora
    semana,
    horas,
    retraso,
    causa,
    estatus: status,
    comentario,
  };

  close();
  _onSave?.(updated);
}

  function _showError(msg) {
    let err = document.getElementById('hdf-error');
    if (!err) {
      err = document.createElement('div');
      err.id = 'hdf-error';
      err.className = 'ot-form-error-msg';
      err.style.cssText = `display:flex;align-items:center;gap:.5rem;padding:.55rem .85rem;
        background:var(--color-danger-bg);color:var(--color-danger);border-radius:var(--radius-md);
        font-size:.8rem;font-weight:600;margin-top:-.25rem;`;
      document.getElementById('hdf-save').parentNode.prepend(err);
    }
    err.textContent = msg;
    err.style.display = 'flex';
  }

  // Normaliza distintos formatos de fecha para `input[type=date]` (devuelve YYYY-MM-DD)
  // ── Fix 1: extraer solo YYYY-MM-DD de cualquier ISO con hora ──────────
function _formatForDateInput(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val)) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val).trim();

  // ✅ FIX: truncar siempre en posición 10 para "2026-04-09T00:00:00"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const parts = s.split(/[\/\.\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4)
      return `${parts[0].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    const dd = parts[0].padStart(2,'0');
    const mm = parts[1].padStart(2,'0');
    const yyyy = parts[2].padStart(4,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt)) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

  // ── Popup de estados (desde row) ─────────────────────────
  function openStatusPopup(refEl, otId, currentStatus, onApply) {
    _closePopup();

    _popup.innerHTML = ESTADOS_LIST.map(e => {
      const active = e.value === currentStatus;
      return `
        <button class="hg-status-popup-item ${active ? 'hg-status-popup-item--active' : ''}"
          data-val="${e.value}">
          <span class="hg-status-dot-sm" style="background:${e.dot}"></span>
          ${e.value}
          ${active ? `<svg class="hg-check" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" width="11" height="11" style="margin-left:auto;flex-shrink:0;">
            <polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </button>`;
    }).join('');

    _popup._onApply = onApply;
    _popup._otId    = otId;

    const rect       = refEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupH     = ESTADOS_LIST.length * 42;
    let topVal, transformVal;
    if (spaceBelow < popupH + 8) {
      topVal = rect.top + window.scrollY - 4;
      transformVal = 'translateY(-100%)';
    } else {
      topVal = rect.bottom + window.scrollY + 4;
      transformVal = 'none';
    }

    Object.assign(_popup.style, {
      display:   'block',
      position:  'absolute',
      top:       topVal + 'px',
      left:      rect.left + window.scrollX + 'px',
      transform: transformVal,
      zIndex:    '99999',
      minWidth:  Math.max(160, rect.width) + 'px',
    });

    _popup.addEventListener('click', _popupClick);
  }

  function _popupClick(e) {
    const item = e.target.closest('.hg-status-popup-item');
    if (!item) return;
    const newStatus = item.dataset.val;
    const otId      = _popup._otId;
    const cb        = _popup._onApply;
    _closePopup();
    cb?.(otId, newStatus);
    _onStatusChange?.(otId, newStatus);
  }

  function _closePopup() {
    if (_popup) {
      _popup.style.display = 'none';
      _popup.removeEventListener('click', _popupClick);
    }
  }

  // ── Actualizar badge de estado en row del DOM ─────────────
  function updateRowBadge(row) {
    const meta = ESTATUS_META[row.estatus] || ESTATUS_META['Cancelado'];
    const h    = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const tr   = document.querySelector(`.hg-row[data-ot-id="${row.id || row.origenRef}"]`);
    if (!tr) return false;
    const btn = tr.querySelector('.hg-btn-status-change');
    if (btn) {
      btn.dataset.currentStatus = row.estatus;
      btn.innerHTML = `
        <span class="hg-estatus ${meta.cls}">
          <span class="hg-dot" style="background:${meta.dot}"></span>
          ${h(row.estatus)}
        </span>`;
    }
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────
  function _isoWeek(dateStr) {
    if (!dateStr) return null;
    let d;
    // If the string already contains a time portion (T) parse it directly,
    // otherwise append a midday time to avoid timezone shifts
    if (String(dateStr).includes('T')) {
      d = new Date(dateStr);
    } else {
      d = new Date(String(dateStr) + 'T12:00:00');
    }
    if (isNaN(d)) {
      d = new Date(dateStr);
      if (isNaN(d)) return null;
    }
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const s    = new Date(jan4);
    s.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    return Math.floor((d - s) / (7 * 86400000)) + 1;
  }

  function _formatSemana(key) {
    const m = key.match(/^(\d{4})-S(\d+)$/);
    return m ? `Semana ${m[2]} · ${m[1]}` : key;
  }

  return { init, open, close, openStatusPopup, updateRowBadge };
})();

window.HorasDetail = HorasDetail;