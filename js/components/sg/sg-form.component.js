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
    _container.innerHTML = `
      <div class="sg-form-wrapper">
        <div class="ot-tab-header ot-modal-section">
          <button class="btn-modal-secondary" id="btn-sg-cancel">← Volver</button>
          <div class="ot-tab-title ot-modal-section-title">Crear SG Manual</div>
        </div>
        
        <form id="form-sg-manual" style="padding: 1.5rem;">
          
          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">1. Identificación y Ubicación</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field" hidden>
              <label class="ot-modal-label">ID Orden</label>
              <input type="text" id="sg-id-base" placeholder="Ej: SG-2026-001" />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Área*</label>
              <input type="text" id="sg-area" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Equipo*</label>
              <input type="text" id="sg-equipo" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Item*</label>
              <input type="text" id="sg-item" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Sistema*</label>
              <input type="text" id="sg-sistema" required />
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">2. Detalles del Trabajo</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <label class="ot-modal-label">Descripción General*</label>
              <input type="text" id="sg-desc" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Tipo de Trabajo*</label>
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
              <label class="ot-modal-label">Personal a Solicitar</label>
              <input type="text" id="sg-personal" placeholder="Ej: 2 Soldadores" />
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">3. Gestión de Compras</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field">
              <label class="ot-modal-label">¿Tiene solicitud de compra?</label>
              <select id="sg-tiene-compra" required>
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">N° Solicitud</label>
              <input type="text" id="sg-n-solicitud" />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">N° Orden de Compra</label>
              <input type="text" id="sg-n-oc" />
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">4. Notas Finales</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <label class="ot-modal-label">Observaciones</label>
              <input type="text" id="sg-obs" placeholder="Comentarios adicionales..." />
            </div>
          </div>

          <div class="ot-form-actions" style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
            <button type="submit" class="btn-modal-primary" id="btn-sg-save">Guardar SG</button>
          </div>
        </form>
      </div>
    `;
  }

  function _bindEvents() {
    document.getElementById('btn-sg-cancel').addEventListener('click', _onCancel);
    
    // Lógica UX: Habilitar/deshabilitar los campos de compra
    const selectCompra = document.getElementById('sg-tiene-compra');
    const inputNSolicitud = document.getElementById('sg-n-solicitud');
    
    selectCompra.addEventListener('change', (e) => {
      const tieneCompra = e.target.value === 'true';
      if (tieneCompra) {
        inputNSolicitud.required = true;
      } else {
        inputNSolicitud.required = false;
        inputNSolicitud.value = ''; // Limpiar
        document.getElementById('sg-n-oc').value = ''; // Limpiar OC
      }
    });

    // Guardar Formulario
    document.getElementById('form-sg-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-sg-save');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      const fechaEntrega = document.getElementById('sg-fecha-entrega').value;

      const idMantenimiento = document.getElementById('sg-id-base').value.trim();

      if(idMantenimiento===''){
        idMantenimiento = SGService.generarIdMantenimiento({
          area: document.getElementById('sg-area').value,
          equipo: document.getElementById('sg-equipo').value,
          item: document.getElementById('sg-item').value,
          sistema: document.getElementById('sg-sistema').value
        });
      }

       

        //'ID_Orden mantenimiento': document.getElementById('sg-id-base').value.trim()
      // 1. Armamos el objeto para la tabla base (ORDEN_MANTENIMIENTO)
      const baseData = {
        'ID_Orden mantenimiento': idMantenimiento,
        'Área': document.getElementById('sg-area').value.trim(),
        'ID_#EQUIPO': document.getElementById('sg-equipo').value.trim(),
        'ITEM': document.getElementById('sg-item').value.trim(),
        'Sistema': document.getElementById('sg-sistema').value.trim(),
        'Descripcion': document.getElementById('sg-desc').value.trim(),
        'Estatus': 'Programado', // Por defecto
        'Tiene solicitud de compra?': document.getElementById('sg-tiene-compra').value === 'true',
        'N° solicitud': document.getElementById('sg-n-solicitud').value.trim() || null,
        'N° Orden de compra': document.getElementById('sg-n-oc').value.trim() || null,
        'Fecha Entrega': fechaEntrega, // Está en ambas tablas
        'Observaciones': document.getElementById('sg-obs').value.trim() || null,
      };

      // 2. Armamos el objeto para la tabla de detalle (OM_SG)
      const sgData = {
        tipo_trabajo: document.getElementById('sg-tipo-trabajo').value,
        estimacion_horas: parseInt(document.getElementById('sg-horas').value, 10),
        solicitar_personal: document.getElementById('sg-personal').value.trim() || null,
        fecha_entrega: fechaEntrega // Está en ambas tablas
        // id_orden_base y fecha_solicitud se manejan automáticamente en sg.service.js/BD
      };

      const res = await SGService.createManualSG(baseData, sgData);

      if (res.ok) {
        window.ToastService?.show('SG Creada exitosamente', 'success');
        _onSuccess();
      } else {
        window.ToastService?.show('Error al crear SG', 'danger');
        console.error(res.error);
        btn.disabled = false;
        btn.textContent = 'Guardar SG';
      }
    });
  }

  return { mount };
})();

window.SGFormComponent = SGFormComponent;