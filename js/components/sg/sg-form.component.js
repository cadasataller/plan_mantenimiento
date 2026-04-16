// ============================================================
// SG FORM COMPONENT — Formulario de Creación
// ============================================================

const SGFormComponent = (() => {
  let _container = null;
  let _onCancel = null;
  let _onSuccess = null;

  // 👇 AGREGAMOS initialData COMO TERCER PARÁMETRO
  function mount(containerId, callbacks, initialData = {}) {
    _container = document.getElementById(containerId);
    _onCancel = callbacks?.onCancel;
    _onSuccess = callbacks?.onSuccess;

    
    _render(initialData);
    _bindEvents(initialData);

    if (window.MecanicoSelectComponent) {
      // 👇 PASAMOS EL CONTEXTO PARA FILTRAR MECÁNICOS Y SERVICIOS GENERALES
      const context = 'mecanicos';
      window.MecanicoSelectComponent.mount(null, context);
    }
  }

  function _render(data) {
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim();
    const isAll = uArea === 'ALL';

    // Usamos data.Area si viene desde otra pantalla, o el área del usuario como fallback
    const areaAsignada = isAll ? (data.Area || '') : uArea;

    _container.innerHTML = `
      <div class="sg-form-wrapper">
        <div class="ot-tab-header ot-modal-section">
          <button class="btn-modal-secondary" id="btn-sg-cancel">← Volver a la Lista</button>
          <div class="ot-tab-title ot-modal-section-title">Nueva Orden de Servicios Generales</div>
        </div>
        
        <form id="form-sg-manual" style="padding: 1.5rem;">
          
          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">1. Identificación y Ubicación</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            
            <div class="ot-modal-field" ${data.ID_Orden ? '' : 'hidden'}>
              <label class="ot-modal-label">ID Orden Base</label>
              <input type="text" id="sg-id-base" class="sg-field-input" value="${data.ID_Orden || ''}" ${data.ID_Orden ? 'readonly style="background:#f3f4f6;"' : ''} />
            </div>
            
            ${isAll ? 
              SGUI.ButtonGroup({
                id: 'sg-area',
                label: 'Área',
                options: SGUI.AREAS_OPTIONS,
                value: areaAsignada,
                required: true,
                fullWidth: true
              })
            : `
              <div class="ot-modal-field" style="grid-column: 1 / -1;">
                <label class="ot-modal-label">Área Solicitante</label>
                <input type="text" id="sg-area" class="sg-field-input" value="${areaAsignada}" readonly style="background:#f3f4f6; color:#4B5563; font-weight:600; cursor:not-allowed;" />
              </div>
            `}

            <div class="ot-modal-field">
              <label class="ot-modal-label">Equipo <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-equipo" class="sg-field-input" value="${data.ID_EQUIPO || ''}" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Item <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-item" class="sg-field-input" value="${data.ITEM || ''}" required />
            </div>
            <div class="ot-modal-field">
              <label class="ot-modal-label">Sistema <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-sistema" class="sg-field-input" value="${data.Sistema || ''}" required />
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">2. Detalles del Trabajo</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <label class="ot-modal-label">Trabajo a realizar <span style="color:#ef4444">*</span></label>
              <input type="text" id="sg-desc" class="sg-field-input" value="${data.Descripcion || ''}" required />
            </div>
            
            ${SGUI.ButtonGroup({
              id: 'sg-tipo-trabajo',
              label: 'Tipo de Trabajo',
              options: [
                { value: 'Soldadura', label: 'Soldadura' },
                { value: 'Torneria', label: 'Tornería' },
                { value: 'Electromecanica', label: 'Electromecánica' },
                { value: 'Bateria', label: 'Batería' },
                { value: 'tornsold', label: 'Torneria y Soldadura' }
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
              <label class="ot-modal-label">Mecánico a Solicitar <span style="color:#ef4444">*</span></label>
              ${window.MecanicoSelectComponent ? window.MecanicoSelectComponent.renderHtml() : '<input type="text" id="sg-personal" class="sg-field-input" />'}
            </div>
          </div>

          <h4 style="margin-bottom: 1rem; color: var(--color-main); font-size: 0.9rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 0.3rem;">3. Gestión de Compras</h4>
          <div class="ot-form-grid" style="margin-bottom: 1.5rem;">
            ${SGUI.ButtonGroup({
              id: 'sg-tiene-compra',
              label: '¿Tiene solicitud de compra?',
              value: 'false',
              options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí' }]
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
            <button type="submit" class="btn-modal-primary" id="btn-sg-save">Guardar OM SG</button>
          </div>
        </form>
      </div>
    `;
  }

  function _bindEvents(data) {
    document.getElementById('btn-sg-cancel').addEventListener('click', () => {
      if (_onCancel) _onCancel();
    });
    
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

    // 👇 NUEVO: Listener para filtrar mecánicos por tipo de trabajo
    const tipoTrabajoSelect = document.getElementById('sg-tipo-trabajo');
    tipoTrabajoSelect.addEventListener('change', (e) => {
      const tipo = e.target.value;
      if (window.MecanicoSelectComponent) {
        window.MecanicoSelectComponent.mount(null, 'mecanicos', tipo);
      }
    });

    document.getElementById('form-sg-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const areaVal = document.getElementById('sg-area').value;
      if (!areaVal) {
        window.ToastService?.show('Por favor asigne un Área válida', 'warning');
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
      
      // LÓGICA DE DECISIÓN: ¿Viene de initialData o es nuevo?
      const idBaseExistente = document.getElementById('sg-id-base').value.trim();
      const esAutomatico = idBaseExistente !== '';

      let personalIdStr = null;
      if (window.MecanicoSelectComponent) {
        const mecId = window.MecanicoSelectComponent.getValue();
        if (mecId) personalIdStr = String(mecId);
      }

      // Datos exclusivos de la tabla OM_SG (comunes para ambos métodos)
      const sgData = {
        tipo_trabajo: tipoTrabajoVal,
        "Estatus": "Programado",
        "Observaciones":document.getElementById('sg-obs').value.trim() || null,
        estimacion_horas: parseInt(document.getElementById('sg-horas').value, 10),
        solicitar_personal: personalIdStr,
        fecha_entrega: fechaEntrega 
      };

      let res;

      if (esAutomatico) {
        // --- CAMINO 1: AUTOMÁTICO (Solo OM_SG) ---
        console.log('Ejecutando creación Automática para la orden:', idBaseExistente);
        res = await SGService.createAutoSG(idBaseExistente, sgData);
      } else {
        // --- CAMINO 2: MANUAL (Ambas tablas) ---
        console.log('Ejecutando creación Manual desde cero');
        const nuevoId = SGService.generarIdMantenimiento({
          area: areaVal,
          equipo: document.getElementById('sg-equipo').value,
          item: document.getElementById('sg-item').value,
          sistema: document.getElementById('sg-sistema').value
        });

        const baseData = {
          'ID_Orden mantenimiento': nuevoId,
          'Área': areaVal,
          'ID_#EQUIPO': document.getElementById('sg-equipo').value.trim(),
          'ITEM': document.getElementById('sg-item').value.trim(),
          'Sistema': document.getElementById('sg-sistema').value.trim(),
          'Descripcion': document.getElementById('sg-desc').value.trim(),
          'Estatus': '', 
          'Tiene solicitud de compra?': document.getElementById('sg-tiene-compra').value === 'true',
          'N° solicitud': document.getElementById('sg-n-solicitud').value.trim() || null,
          'N° Orden de compra': document.getElementById('sg-n-oc').value.trim() || null,
          'Fecha Entrega': fechaEntrega, 
          'Observaciones': document.getElementById('sg-obs').value.trim() || null,
        };

        res = await SGService.createManualSG(baseData, sgData);
      }

      // Manejo de la respuesta
      if (res.ok) {
        window.ToastService?.show(esAutomatico ? 'SG vinculada exitosamente' : 'SG creada exitosamente', 'success');
        if (_onSuccess) _onSuccess();
      } else {
        window.ToastService?.show('Error al procesar la SG', 'danger');
        console.error(res.error);
        btn.disabled = false;
        btn.textContent = 'Guardar OM SG';
      }
    });
  }

  return { mount };
})();

window.SGFormComponent = SGFormComponent;