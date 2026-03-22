// ============================================================
// CADASA TALLER — OT TAB COMPONENT
// FIX: sistema de visibilidad por clase .active en lugar de
//      translateX sobre width:200% (incompatible con modal)
// ============================================================

const OTTabComponent = (() => {

  let _state   = 'list'; // 'list' | 'create'
  let _om      = null;
  let _ots     = [];
  let _el      = null;   // referencia al nodo contenedor — se guarda en init
  let _bound        = false;  // ¿ya registramos el listener en _el?
  let _onOTsChange  = null;  // callback → notifica al modal cuando cambian las OTs

  // ─────────────────────────────────────────────
  function init(containerId, om, ots, onOTsChange) {
    // Si ya hay un componente activo, limpiar antes de reiniciar
    if (_bound && _el) {
      _el.removeEventListener('click', _handleClick);
      _bound = false;
    }

    _om          = om;
    _ots         = [...ots];   // copia defensiva — evita mutar el cache del store
    _state       = 'list';
    _onOTsChange = onOTsChange ?? null;
    _el          = document.getElementById(containerId);
    if (!_el) return;

    _el.innerHTML = `
      <div class="ot-tab-wrapper">
        <div class="ot-tab-inner" id="ot-tab-inner"></div>
      </div>`;

    _render();
  }

  // ─────────────────────────────────────────────
  // FIX PRINCIPAL: ya no usamos translateX.
  // Ambas vistas están en el DOM; solo una tiene .active.
  // La clase slide-left/right en el inner es opcional y se
  // conserva por si algún estilo externo la referencia,
  // pero no afecta la visibilidad.
  // ─────────────────────────────────────────────
  function _render() {
    const inner = _el
      ? _el.querySelector('#ot-tab-inner')
      : document.getElementById('ot-tab-inner');
    if (!inner) return;

    // Clase informativa (no mueve el layout)
    inner.classList.remove('slide-left', 'slide-right');
    inner.classList.add(_state === 'create' ? 'slide-left' : 'slide-right');

    // Solo renderizamos la vista activa para evitar
    // que los inputs del form oculto interfieran
    inner.innerHTML = _state === 'list'
      ? `<div class="ot-view active">${_renderList()}</div>`
      : `<div class="ot-view active">${_renderForm()}</div>`;
  }

  // ─────────────────────────────────────────────
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
        ${ModalComponent.renderOTList(_ots)}
      </div>`;
  }

  // ─────────────────────────────────────────────
  function _renderForm() {
    return `
      <div class="ot-tab-header ot-modal-section">
        <button class="btn-modal-secondary" id="btn-back-list">← Volver</button>
        <div class="ot-tab-title ot-modal-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva Orden de Trabajo
        </div>
      </div>

      <div class="ot-form ot-chart-card">
        <div class="ot-form-grid">

          <div class="ot-modal-field" style="grid-column: 1 / -1;">
            <div class="ot-modal-label">Descripción</div>
            <input type="text" id="ot-desc" placeholder="Descripción de la orden…" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Mecánico</div>
            <input type="text" id="ot-mec" placeholder="ID o nombre del mecánico" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Fecha</div>
            <input type="date" id="ot-fecha" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Horas estimadas</div>
            <input type="number" id="ot-duracion" placeholder="0.0" min="0" step="0.5" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Estado</div>
            <select id="ot-status">
              <option value="Programado">Programado</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Concluida">Concluida</option>
              <option value="Detenido">Detenido</option>
            </select>
          </div>

        </div>

        <div class="ot-form-actions">
          <button class="btn-modal-secondary" id="btn-cancel">Cancelar</button>
          <button class="btn-modal-primary" id="btn-save">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Guardar OT
          </button>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────────────
  // bindEvents: registra UNA sola vez sobre _el (guardado en init).
  // Nunca sobre document — evita listeners huérfanos al cerrar el modal.
  function bindEvents() {
    if (!_el || _bound) return;   // ya registrado → no duplicar
    _el.addEventListener('click', _handleClick);
    _bound = true;
  }

  async function _handleClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    switch (btn.id) {

      case 'btn-add-ot':
        _state = 'create';
        _render();
        break;

      case 'btn-back-list':
      case 'btn-cancel':
        _state = 'list';
        _render();
        break;

      case 'btn-save': {
        const desc     = document.getElementById('ot-desc')?.value?.trim()    ?? '';
        const mec      = document.getElementById('ot-mec')?.value?.trim()     ?? '';
        const fecha    = document.getElementById('ot-fecha')?.value           ?? '';
        const duracion = parseFloat(document.getElementById('ot-duracion')?.value) || 0;
        const status   = document.getElementById('ot-status')?.value          ?? 'Programado';

        if (!desc) {
          // Feedback visual mínimo sin alert()
          const input = document.getElementById('ot-desc');
          if (input) {
            input.style.borderColor = 'var(--color-danger)';
            input.focus();
            setTimeout(() => { input.style.borderColor = ''; }, 2000);
          }
          return;
        }

        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
          saveBtn.disabled  = true;
          saveBtn.innerHTML = `<div class="spinner-sm"></div> Guardando…`;
        }

        const nueva = {
          Descripcion: desc,
          ID_Mecanico: mec,
          Fecha:       fecha,
          Duracion:    duracion,
          Estatus:     status,
        };

        const res = await OTService.crearOT(_om.ID_Orden, nueva);

        if (res.ok) {
          // _ots es copia local (ver init). Cache del store ahora inmutable.
          // Seguro agregar aquí sin riesgo de duplicados.
          _ots.unshift(res.data);
          _state = 'list';
          _render();
          // Notificar al modal para que actualice las gráficas
          _onOTsChange?.([..._ots]);
        } else {
          if (saveBtn) {
            saveBtn.disabled  = false;
            saveBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg> Guardar OT`;
          }
          ToastService?.show('Error al crear la OT. Intenta de nuevo.', 'danger');
        }
        break;
      }
    }
  }

  // destroy: usar la referencia guardada _el, NO getElementById.
  // El nodo ya puede haber sido eliminado del DOM cuando se llama esto.
  function destroy() {
    if (_el && _bound) {
      _el.removeEventListener('click', _handleClick);
    }
    _bound       = false;
    _state       = 'list';
    _om          = null;
    _ots         = [];
    _el          = null;
    _onOTsChange = null;
  }

  return { init, bindEvents, destroy };

})();

window.OTTabComponent = OTTabComponent;