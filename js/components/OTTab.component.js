// ============================================================
// CADASA TALLER — OT TAB COMPONENT
// Maneja lista + creación de OTs con animación
// ============================================================

const OTTabComponent = (() => {

  let _state = 'list'; // 'list' | 'create'
  let _om = null;
  let _ots = [];
  let _el = null;

  // ─────────────────────────────────────────────
  function init(containerId, om, ots) {
    _om = om;
    _ots = ots;

    _el = document.getElementById(containerId); // 👈 guardar referencia
    if (!_el) return;

    _el.innerHTML = `
                <div class="ot-tab-wrapper">
                <div class="ot-tab-inner" id="ot-tab-inner"></div>
                </div>
            `;

    _render();
  }

  // ─────────────────────────────────────────────
  function _render() {
    const inner = _el ? _el.querySelector('#ot-tab-inner') : document.getElementById('ot-tab-inner');
    if (!inner) return;

    inner.classList.remove('slide-left', 'slide-right');

    if (_state === 'create') {
      inner.classList.add('slide-left');
    } else {
      inner.classList.add('slide-right');
    }

    inner.innerHTML = `
      <div class="ot-view ot-tab-panel ${_state === 'list' ? 'active' : ''}">
        ${_renderList()}
      </div>
      <div class="ot-view ot-tab-panel ${_state === 'create' ? 'active' : ''}">
        ${_renderForm()}
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  function _renderList() {
    return `
      <div class="ot-tab-header ot-modal-section">
        
        <div class="ot-tab-title ot-modal-section-title">
          Órdenes de Trabajo
        </div>

        <button class="btn-modal-primary" id="btn-add-ot">
          + Nueva OT
        </button>
      </div>

      <div class="ot-tab-content ot-work-list">
        ${ModalComponent.renderOTList(_ots)}
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  function _renderForm() {
    return `
      <div class="ot-tab-header ot-modal-section">

        <button class="btn-modal-secondary" id="btn-back-list">
          ← Volver
        </button>

        <div class="ot-tab-title ot-modal-section-title">
          Nueva Orden de Trabajo
        </div>
      </div>

      <div class="ot-form ot-chart-card">
        <div class="ot-form-grid ot-modal-grid">

          <div class="ot-modal-field">
            <div class="ot-modal-label">Descripción</div>
            <input type="text" id="ot-desc" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Mecánico</div>
            <input type="text" id="ot-mec" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Fecha</div>
            <input type="date" id="ot-fecha" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Horas</div>
            <input type="number" id="ot-duracion" />
          </div>

          <div class="ot-modal-field">
            <div class="ot-modal-label">Estado</div>
            <select id="ot-status">
              <option>Programado</option>
              <option>En Proceso</option>
              <option>Concluida</option>
              <option>Detenido</option>
            </select>
          </div>

        </div>

        <div class="ot-form-actions ot-modal-footer">
          <div></div>

          <div class="ot-modal-footer-right">
            <button class="btn-modal-secondary" id="btn-cancel">
              Cancelar
            </button>

            <button class="btn-modal-primary" id="btn-save">
              Guardar OT
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  function bindEvents() {
    document.addEventListener('click', async (e) => {

      if (e.target.id === 'btn-add-ot') {
        _state = 'create';
        _render();
      }

      if (e.target.id === 'btn-back-list' || e.target.id === 'btn-cancel') {
        _state = 'list';
        _render();
      }

      if (e.target.id === 'btn-save') {
        const nueva = {
          Descripcion: document.getElementById('ot-desc').value,
          ID_Mecanico: document.getElementById('ot-mec').value,
          Fecha: document.getElementById('ot-fecha').value,
          Duracion: parseFloat(document.getElementById('ot-duracion').value) || 0,
          Estatus: document.getElementById('ot-status').value,
        };

        const res = await OTService.crearOT(_om.ID_Orden, nueva);

        if (res.ok) {
            _ots.unshift(res.data);
            _state = 'list';
            _render();
        } else {
            alert('Error al crear OT');
        }
      }

    });
  }

  return { init, bindEvents };

})();

window.OTTabComponent = OTTabComponent;