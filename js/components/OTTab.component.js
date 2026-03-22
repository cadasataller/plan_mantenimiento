// ============================================================
// CADASA TALLER — OT TAB COMPONENT
// Maneja lista + creación de OTs con animación
// ============================================================

const OTTabComponent = (() => {

  let _state = 'list'; // 'list' | 'create'
  let _om = null;
  let _ots = [];

  // ─────────────────────────────────────────────
  function init(containerId, om, ots) {
    _om = om;
    _ots = ots;

    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
      <div class="ot-tab-wrapper">
        <div class="ot-tab-inner" id="ot-tab-inner"></div>
      </div>
    `;

    _render();
  }

  // ─────────────────────────────────────────────
  function _render() {
    const inner = document.getElementById('ot-tab-inner');
    if (!inner) return;

    inner.classList.remove('slide-left', 'slide-right');

    // Trigger animation direction
    if (_state === 'create') {
      inner.classList.add('slide-left');
    } else {
      inner.classList.add('slide-right');
    }

    inner.innerHTML = `
      <div class="ot-view ${_state === 'list' ? 'active' : ''}">
        ${_renderList()}
      </div>
      <div class="ot-view ${_state === 'create' ? 'active' : ''}">
        ${_renderForm()}
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  function _renderList() {
    return `
      <div class="ot-tab-header">
        <div class="ot-tab-title">Órdenes de Trabajo</div>
        <button class="btn-primary" id="btn-add-ot">+ Nueva OT</button>
      </div>

      <div class="ot-tab-content">
        ${ModalComponent.renderOTList(_ots)}
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  function _renderForm() {
    return `
      <div class="ot-tab-header">
        <button class="btn-back" id="btn-back-list">← Volver</button>
        <div class="ot-tab-title">Nueva Orden de Trabajo</div>
      </div>

      <div class="ot-form">
        <div class="ot-form-grid">

          <input type="text" id="ot-desc" placeholder="Descripción" />
          <input type="text" id="ot-mec" placeholder="Mecánico" />
          <input type="date" id="ot-fecha" />
          <input type="number" id="ot-duracion" placeholder="Horas" />

          <select id="ot-status">
            <option>Programado</option>
            <option>En Proceso</option>
            <option>Concluida</option>
            <option>Detenido</option>
          </select>

        </div>

        <div class="ot-form-actions">
          <button class="btn-secondary" id="btn-cancel">Cancelar</button>
          <button class="btn-primary" id="btn-save">Guardar OT</button>
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

        // 👉 Aquí irá OTService después
        const res = await OTService.crearOT(_om.ID_Orden, nueva);

        if (res.ok) {
            // actualizar lista local
            _ots.unshift(res.data);

            // volver a lista
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