// ============================================================
// SG FORM COMPONENT — Formulario de Creación
// ============================================================

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
    
    // 👇 MONTAMOS EL COMPONENTE DE MECÁNICO DESPUÉS DE RENDERIZAR EL HTML
    if (window.MecanicoSelectComponent) {
      window.MecanicoSelectComponent.mount();
    }
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
            
            ${SGUI.ButtonGroup({
              id: 'sg-area',
              label: 'Área',
              options: SGUI.AREAS_OPTIONS,
              required: true,
              fullWidth: true
            })}

            <div class="ot-modal-field">
              <label class="ot-modal-label">Equipo <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-equipo" class="sg-field-input" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Item <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-item" class="sg-field-input" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Sistema <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-sistema" class="sg-field-input" required />
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">2. Detalles del Trabajo</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <label class="ot-modal-label">Descripción General <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-desc" class="sg-field-input" required />
            </div>
            
            ${SGUI.ButtonGroup({
              id: 'sg-tipo-trabajo',
              label: 'Tipo de Trabajo',
              options: [
                { value: 'Soldadura', label: 'Soldadura' },
                { value: 'Torneria', label: 'Tornería' },
                { value: 'Electromecanica', label: 'Electromecánica' },
                { value: 'Bateria', label: 'Batería' }
              ],
              required: true,
              fullWidth: true
            })}

            <div class="ot-modal-field">
              <label class="ot-modal-label">Estimación (Horas) <span style="color:#ef4444">*</span></label>
              <input type="number" id="sg-horas" class="sg-field-input" min="1" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Fecha Entrega <span style="color:#ef4444">*</span></label>
              <input type="date" id="sg-fecha-entrega" class="sg-field-input" required />
            </div>
            
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <label class="ot-modal-label">Personal a Solicitar</label>
              ${window.MecanicoSelectComponent ? window.MecanicoSelectComponent.renderHtml() : '<input type="text" id="sg-personal" class="sg-field-input" />'}
            </div>

          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">3. Gestión de Compras</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            
            ${SGUI.ButtonGroup({
              id: 'sg-tiene-compra',
              label: '¿Tiene solicitud de compra?',
              value: 'false',
              options: [
                { value: 'false', label: 'No' },
                { value: 'true', label: 'Sí' }
              ]
            })}

            <div class="ot-modal-field">
              <label class="ot-modal-label">N° Solicitud</label>
              <input type="text" id="sg-n-solicitud" class="sg-field-input" disabled style="background:#f3f4f6;" />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">N° Orden de Compra</label>
              <input type="text" id="sg-n-oc" class="sg-field-input" disabled style="background:#f3f4f6;" />
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">4. Notas Finales</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <label class="ot-modal-label">Observaciones</label>
              <input type="text" id="sg-obs" class="sg-field-input" placeholder="Comentarios adicionales..." />
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
    
    const inputTieneCompra = document.getElementById('sg-tiene-compra');
    const inputNSolicitud = document.getElementById('sg-n-solicitud');
    const inputNOc = document.getElementById('sg-n-oc');
    
    inputTieneCompra.addEventListener('change', (e) => {
      const tieneCompra = e.target.value === 'true';
      inputNSolicitud.disabled = !tieneCompra;
      inputNOc.disabled = !tieneCompra;
      
      if (tieneCompra) {
        inputNSolicitud.required = true;
        inputNSolicitud.style.background = '#fff';
        inputNOc.style.background = '#fff';
      } else {
        inputNSolicitud.required = false;
        inputNSolicitud.value = ''; 
        inputNOc.value = ''; 
        inputNSolicitud.style.background = '#f3f4f6';
        inputNOc.style.background = '#f3f4f6';
      }
    });

    document.getElementById('form-sg-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const areaVal = document.getElementById('sg-area').value;
      if (!areaVal) {
        window.ToastService?.show('Por favor seleccione un Área', 'warning');
        return;
      }
      
      const tipoTrabajoVal = document.getElementById('sg-tipo-trabajo').value;
      if (!tipoTrabajoVal) {
        window.ToastService?.show('Por favor seleccione un Tipo de Trabajo', 'warning');
        return;
      }

      const btn = document.getElementById('btn-sg-save');
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner-sm" style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-bottom-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Guardando...`;

      const fechaEntrega = document.getElementById('sg-fecha-entrega').value;
      let idMantenimiento = document.getElementById('sg-id-base').value.trim();

      if(idMantenimiento === ''){
        idMantenimiento = SGService.generarIdMantenimiento({
          area: areaVal,
          equipo: document.getElementById('sg-equipo').value,
          item: document.getElementById('sg-item').value,
          sistema: document.getElementById('sg-sistema').value
        });
      }

      const baseData = {
        'ID_Orden mantenimiento': idMantenimiento,
        'Área': areaVal,
        'ID_#EQUIPO': document.getElementById('sg-equipo').value.trim(),
        'ITEM': document.getElementById('sg-item').value.trim(),
        'Sistema': document.getElementById('sg-sistema').value.trim(),
        'Descripcion': document.getElementById('sg-desc').value.trim(),
        'Estatus': 'Programado', 
        'Tiene solicitud de compra?': document.getElementById('sg-tiene-compra').value === 'true',
        'N° solicitud': document.getElementById('sg-n-solicitud').value.trim() || null,
        'N° Orden de compra': document.getElementById('sg-n-oc').value.trim() || null,
        'Fecha Entrega': fechaEntrega, 
        'Observaciones': document.getElementById('sg-obs').value.trim() || null,
      };

      // 👇 OBTENEMOS EL ID DEL MECÁNICO Y LO CONVERTIMOS A STRING (Ya que tu BD lo espera como text null)
      let personalIdStr = null;
      if (window.MecanicoSelectComponent) {
        const mecId = window.MecanicoSelectComponent.getValue();
        if (mecId) personalIdStr = String(mecId);
      } else {
        const inputFallback = document.getElementById('sg-personal');
        if (inputFallback && inputFallback.value.trim()) personalIdStr = inputFallback.value.trim();
      }

      const sgData = {
        tipo_trabajo: tipoTrabajoVal,
        estimacion_horas: parseInt(document.getElementById('sg-horas').value, 10),
        solicitar_personal: personalIdStr,
        fecha_entrega: fechaEntrega 
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