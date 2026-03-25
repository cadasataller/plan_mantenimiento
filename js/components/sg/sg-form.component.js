const SGFormComponent = (() => {
  let _container = null;
  let _onCancel = null;
  let _onSuccess = null;

  function mount(containerId, callbacks) {
    _container = document.getElementById(containerId);
    _onCancel = callbacks.onCancel;
    _onSuccess = callbacks.onSuccess;
    _render();
    _bindEvents();
  }

  function _render() {
    // Nota: El enum 'tipo_trabajo' debe coincidir con los valores de tu BD.
    _container.innerHTML = `
      <div class="sg-form-wrapper">
        <div class="ot-tab-header ot-modal-section">
          <button class="btn-modal-secondary" id="btn-sg-cancel">← Volver</button>
          <div class="ot-tab-title ot-modal-section-title">Crear SG Manual</div>
        </div>
        
        <form id="form-sg-manual" class="ot-form-grid" style="padding: 1rem;">
          <div class="ot-modal-field">
            <label class="ot-modal-label">ID Orden (Manual)</label>
            <input type="text" id="sg-id-base" placeholder="Ej: SG-2026-001" required />
          </div>
          <div class="ot-modal-field">
            <label class="ot-modal-label">Área</label>
            <input type="text" id="sg-area" required />
          </div>
          <div class="ot-modal-field" style="grid-column: 1 / -1;">
            <label class="ot-modal-label">Descripción General</label>
            <input type="text" id="sg-desc" required />
          </div>

          <div class="ot-modal-field">
            <label class="ot-modal-label">Tipo de Trabajo</label>
            <select id="sg-tipo-trabajo" required>
              <option value="">Seleccione...</option>
              <option value="Soldadura">Soldadura</option>
              <option value="Torneria">Tornería</option>
              <option value="Electromecanica">Electromecánica</option>
              <option value="Bateria">Batería</option>
            </select>
          </div>
          <div class="ot-modal-field">
            <label class="ot-modal-label">Estimación (Horas)</label>
            <input type="number" id="sg-horas" min="1" required />
          </div>
          <div class="ot-modal-field">
            <label class="ot-modal-label">Fecha Entrega</label>
            <input type="date" id="sg-fecha-entrega" required />
          </div>
          <div class="ot-modal-field">
            <label class="ot-modal-label">Días Estimados</label>
            <input type="number" id="sg-dias" min="1" required />
          </div>
          
          <div class="ot-modal-field">
            <label class="ot-modal-label">Personal a Solicitar (Opcional)</label>
            <input type="text" id="sg-personal" placeholder="Ej: 2 Soldadores" />
          </div>
          <div class="ot-modal-field" style="grid-column: 1 / -1;">
            <label class="ot-modal-label">Observaciones (Opcional)</label>
            <input type="text" id="sg-obs" placeholder="Comentarios adicionales..." />
          </div>

          <div class="ot-form-actions" style="grid-column: 1 / -1;">
            <button type="submit" class="btn-modal-primary" id="btn-sg-save">Guardar SG</button>
          </div>
        </form>
      </div>
    `;
  }

  function _bindEvents() {
    document.getElementById('btn-sg-cancel').addEventListener('click', _onCancel);
    
    document.getElementById('form-sg-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-sg-save');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      const baseData = {
        'ID_Orden mantenimiento': document.getElementById('sg-id-base').value.trim(),
        'Área': document.getElementById('sg-area').value.trim(),
        'Descripcion': document.getElementById('sg-desc').value.trim(),
        'Observaciones': document.getElementById('sg-obs').value.trim(),
        'Estatus': 'Pendiente' // Estado por defecto
      };

      const sgData = {
        tipo_trabajo: document.getElementById('sg-tipo-trabajo').value,
        estimacion_horas: parseInt(document.getElementById('sg-horas').value, 10),
        fecha_entrega: document.getElementById('sg-fecha-entrega').value,
        dias: parseInt(document.getElementById('sg-dias').value, 10),
        solicitar_personal: document.getElementById('sg-personal').value.trim(),
        estado: 'Pendiente'
      };

      const res = await SGService.createManualSG(baseData, sgData);

      if (res.ok) {
        window.ToastService?.show('SG Creada exitosamente', 'success');
        _onSuccess();
      } else {
        window.ToastService?.show('Error al crear SG', 'danger');
        btn.disabled = false;
        btn.textContent = 'Guardar SG';
      }
    });
  }

  return { mount };
})();

window.SGFormComponent = SGFormComponent;