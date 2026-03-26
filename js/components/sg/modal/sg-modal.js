// ============================================================
// SG MODAL COMPONENT — Visor y Editor de Detalles de SG
// ============================================================

const SGModalComponent = (() => {
  let _currentSG = null;
  let _editMode = false;
  let _editState = {};
  let _perms = { statusObs: false, all: false };

  function open(sg) {
    _currentSG = sg;
    _editMode = false;
    _editState = {};
    _calcularPermisos(sg);

    const root = document.getElementById('sg-modal-root'); 
    if (!root) return console.error('No se encontró #sg-modal-root en la pestaña SG');
    
    _renderShell(sg);
    _renderContent();
    
    document.body.style.overflow = 'hidden'; 
  }

  function close() {
    if (_editMode && !confirm('Tienes cambios sin guardar. ¿Cerrar de todas formas?')) return;
    
    const root = document.getElementById('sg-modal-root');
    const bd = document.getElementById('sg-backdrop');
    _currentSG = null;
    _editMode = false;
    _editState = {};
    
    if (bd) {
      bd.style.opacity = '0';
      setTimeout(() => { 
        if (root) root.innerHTML = ''; 
        document.body.style.overflow = '';
      }, 200);
    } else if (root) { 
      root.innerHTML = ''; 
      document.body.style.overflow = '';
    }
  }

  function _calcularPermisos(sg) {
    _perms = { statusObs: false, all: false };
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    const om = sg.ORDEN_MANTENIMIENTO || {};
    const omArea = String(om['Área'] || '').trim().toUpperCase();
    const estatus = String(om.Estatus || 'Programado').trim().toUpperCase();

    if (uArea === 'SERVICIOS GENERALES') _perms.statusObs = true;
    if (uArea === omArea || uArea === 'ALL') {
      if (estatus === 'PROGRAMADO') {
        _perms.all = true;
        _perms.statusObs = true; 
      }
    }
  }

  function _getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  function _enterEditMode() {
    _editMode = true;
    const om = _currentSG.ORDEN_MANTENIMIENTO || {};
    
    _editState = {
      estatus: om.Estatus || 'Programado',
      observaciones: om.Observaciones || '',
      tipo_trabajo: _currentSG.tipo_trabajo || '',
      estimacion_horas: _currentSG.estimacion_horas || '',
      solicitar_personal: _currentSG.solicitar_personal || '',
      fecha_entrega: _currentSG.fecha_entrega || om['Fecha Entrega'] || '',
      tiene_compra: om['Tiene solicitud de compra?'] ? 'true' : 'false',
      n_solicitud: om['N° solicitud'] || '',
      n_oc: om['N° Orden de compra'] || '',
      fecha_inicio: om['Fecha inicio'] || '',
      fecha_conclusion: om['Fecha conclusion'] || '',
      semana: om.Semana || ''
    };
    _renderContent();
  }

  function _cancelEdit() {
    _editMode = false;
    _editState = {};
    _renderContent();
  }

  async function _saveEdit() {
    const btn = document.getElementById('btn-sg-modal-save');
    const btnOriginalHTML = btn.innerHTML; 
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner-sm" style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-bottom-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Guardando...`;

    // 👇 VALIDACIÓN MEDIANTE CONSULTA A SUPABASE ANTES DE GUARDAR
    if (_editState.estatus === 'Concluida') {
      try {
        const db = window.SupabaseClient;
        const idOrden = _currentSG.ORDEN_MANTENIMIENTO['ID_Orden mantenimiento'];
        
        const { data, error } = await db
          .from('ORDEN_MANTENIMIENTO')
          .select('"Fecha inicio"')
          .eq('ID_Orden mantenimiento', idOrden)
          .single();
          
        if (error) throw error;

        // Validamos si no hay fecha de inicio en la base de datos Y tampoco en el estado de edición actual
        if (!data['Fecha inicio'] && !_editState.fecha_inicio) {
          window.ToastService?.show('No se puede concluir: La orden no tiene Fecha de Inicio registrada.', 'warning');
          btn.disabled = false;
          btn.innerHTML = btnOriginalHTML;
          return; // Detiene el guardado
        }
      } catch (err) {
        console.error('Error al consultar Supabase:', err);
        window.ToastService?.show('Error al validar la orden en la base de datos.', 'danger');
        btn.disabled = false;
        btn.innerHTML = btnOriginalHTML;
        return;
      }
    }

    // LLAMADA A LA BD PARA ACTUALIZAR
    const resultado = await SGService.updateSG(
      _currentSG.id_sg, 
      _currentSG.ORDEN_MANTENIMIENTO['ID_Orden mantenimiento'], 
      _editState, 
      _perms
    );

    if (!resultado.ok) {
      window.ToastService?.show('Error al guardar en la base de datos', 'danger');
      btn.disabled = false;
      btn.innerHTML = btnOriginalHTML;
      return; 
    }

    _currentSG = resultado.data; 

    _editMode = false;
    _editState = {};
    window.ToastService?.show('Cambios guardados', 'success');
    _renderContent(); 

    if (window.SGListComponent && typeof window.SGListComponent.refresh === 'function') {
      window.SGListComponent.refresh();
    }
  }

  function _getPanamaNow() {
    const panamaDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
    const d = new Date(panamaDateStr);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    
    return {
      timestamp: `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`, 
      soloFecha: `${yyyy}-${mm}-${dd}`,                    
      dateObj: d                                           
    };
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const localDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000));
      return localDate.toLocaleDateString('es-PA');
    } catch { return dateStr; }
  }

  function _calcularEstadoDias(fechaEntregaStr) {
    if (!fechaEntregaStr) return '<span style="color:var(--text-muted); font-size:0.68rem; margin-top:0.3rem; font-style:italic;">Sin fecha asignada</span>';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const entrega = new Date(fechaEntregaStr);
    entrega.setMinutes(entrega.getMinutes() + entrega.getTimezoneOffset());
    entrega.setHours(0, 0, 0, 0);
    const diffDays = Math.round((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    const bs = "display:inline-block; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; font-size:0.68rem; margin-top:0.3rem;";
    if (diffDays > 0) return `<span style="${bs} background:#DCFCE7; color:#166534;">Faltan ${diffDays} día(s)</span>`;
    if (diffDays < 0) return `<span style="${bs} background:#FEE2E2; color:#991B1B;">Retraso de ${Math.abs(diffDays)} día(s)</span>`;
    return `<span style="${bs} background:#F3F4F6; color:#4B5563;">Se entrega hoy</span>`;
  }

  function _renderShell(sg) {
    const root = document.getElementById('sg-modal-root');
    const om = sg.ORDEN_MANTENIMIENTO || {};

    root.innerHTML = `
      <div class="ot-modal-backdrop" id="sg-backdrop" style="opacity: 1; transition: opacity 0.2s ease;">
        <div class="ot-modal" role="dialog" aria-modal="true">
          
          <div class="ot-modal-header">
            <div class="ot-modal-header-left">
              <div class="ot-modal-id-badge">${om['ID_Orden mantenimiento'] || 'N/A'}</div>
              <div class="ot-modal-title">${om.Descripcion || 'Sin descripción'}</div>
              <div class="ot-modal-area">
                <span>${om['Área'] || 'N/A'}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${om['ID_#EQUIPO'] || 'N/A'} — ${om.ITEM || 'N/A'}</span>
              </div>
            </div>
            <div class="ot-modal-status-wrap">
              <button class="btn-modal-close" id="btn-sg-modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <span id="sg-modal-header-badge">${SGUI.Badge(om.Estatus || sg.estado)}</span>
            </div>
          </div>

          <div class="ot-modal-tabs">
            <div class="ot-modal-tab active">Información General</div>
          </div>

          <div class="ot-modal-body" id="sg-dynamic-body"></div>
          <div class="ot-modal-footer" id="sg-dynamic-footer"></div>

        </div>
      </div>
    `;

    document.getElementById('btn-sg-modal-close')?.addEventListener('click', close);
    document.getElementById('sg-backdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  }

  function _renderContent() {
    const bodyContainer = document.getElementById('sg-dynamic-body');
    const footerContainer = document.getElementById('sg-dynamic-footer');
    if (!bodyContainer || !footerContainer) return;

    const sg = _currentSG;
    const om = sg.ORDEN_MANTENIMIENTO || {};
    
    const v = (key, fallback) => _editMode ? (_editState[key] ?? fallback) : fallback;
    const fechaEntregaReal = sg.fecha_entrega || om['Fecha Entrega'];

    const headerBadge = document.getElementById('sg-modal-header-badge');
    if (headerBadge) headerBadge.innerHTML = SGUI.Badge(v('estatus', om.Estatus || sg.estado));

    const estatusOptions = [
      { value: 'Programado', label: 'Programado' },
      { value: 'En Proceso', label: 'En Proceso' },
      { value: 'Detenido', label: 'Detenido' },
      { value: 'Concluida', label: 'Concluida' }
    ];
    const booleanOptions = [{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí' }];
    const tipoTrabajoOptions = [
      { value: 'Soldadura', label: 'Soldadura' },
      { value: 'Torneria', label: 'Tornería' },
      { value: 'Electromecanica', label: 'Electromecánica' },
      { value: 'Bateria', label: 'Batería' }
    ];

    bodyContainer.innerHTML = `
      <div class="ot-modal-tab-panel active">
        
        ${_editMode ? `<div style="background:#E0F2FE; color:#0284C7; padding:0.5rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.8rem; font-weight:600; display:flex; align-items:center; gap:0.5rem;">${SGUI.Icon('edit')} Modo edición activo</div>` : ''}

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Estado y Observaciones</div>
          <div class="ot-modal-grid">
            ${SGUI.StatusPicker({ id: 'edit-estatus', label: 'Estatus', value: v('estatus', om.Estatus), options: estatusOptions, isEditMode: _editMode, canEdit: _perms.statusObs })}
            ${SGUI.EditableField({ id: 'edit-observaciones', label: 'Observaciones', value: v('observaciones', om.Observaciones), type: 'textarea', placeholder: 'Notas de Servicios Generales...', isEditMode: _editMode, canEdit: _perms.statusObs, fullWidth: true })}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Detalles del Trabajo (SG)</div>
          <div class="ot-modal-grid">
            ${SGUI.EditableField({ id: 'edit-tipo_trabajo', label: 'Tipo Trabajo', value: v('tipo_trabajo', sg.tipo_trabajo), type: 'select', options: tipoTrabajoOptions, isEditMode: _editMode, canEdit: _perms.all })}
            ${SGUI.EditableField({ id: 'edit-estimacion_horas', label: 'Estimación (h)', value: v('estimacion_horas', sg.estimacion_horas), type: 'number', isEditMode: _editMode, canEdit: _perms.all })}
            ${SGUI.EditableField({ id: 'edit-solicitar_personal', label: 'Personal Solicitado', value: v('solicitar_personal', sg.solicitar_personal), type: 'text', isEditMode: _editMode, canEdit: _perms.all, fullWidth: true })}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Fechas y Planificación</div>
          <div class="ot-modal-grid">
            <div class="ot-modal-field"><div class="ot-modal-label">Semana</div><div class="ot-modal-val" id="disp-semana">${v('semana', om.Semana || '—')}</div></div>
            
            ${_editMode && _perms.all 
              ? SGUI.EditableField({ id: 'edit-fecha_entrega', label: 'Fecha Entrega Esperada', value: v('fecha_entrega', fechaEntregaReal), type: 'date', isEditMode: true, canEdit: true })
              : `
              <div class="ot-modal-field">
                <div class="ot-modal-label">Fecha Entrega Esperada</div>
                <div class="ot-modal-val" style="display: flex; flex-direction: column; align-items: flex-start;">
                  <span>${formatDate(fechaEntregaReal)}</span>
                  ${!_editMode ? _calcularEstadoDias(fechaEntregaReal) : ''}
                </div>
              </div>
              `
            }
            
            <div class="ot-modal-field"><div class="ot-modal-label">Fecha Inicio (OM)</div><div class="ot-modal-val" id="disp-fecha-inicio">${formatDate(v('fecha_inicio', om['Fecha inicio']))}</div></div>
            <div class="ot-modal-field"><div class="ot-modal-label">Fecha Conclusión (OM)</div><div class="ot-modal-val" id="disp-fecha-conclusion">${formatDate(v('fecha_conclusion', om['Fecha conclusion']))}</div></div>
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Gestión de Compras</div>
          <div class="ot-modal-grid">
            ${SGUI.EditableField({ id: 'edit-tiene_compra', label: 'Tiene solicitud?', value: v('tiene_compra', om['Tiene solicitud de compra?'] ? 'true' : 'false'), type: 'select', options: booleanOptions, isEditMode: _editMode, canEdit: _perms.all })}
            ${SGUI.EditableField({ id: 'edit-n_solicitud', label: 'N° Solicitud', value: v('n_solicitud', om['N° solicitud']), type: 'text', isEditMode: _editMode, canEdit: _perms.all })}
            ${SGUI.EditableField({ id: 'edit-n_oc', label: 'N° OC', value: v('n_oc', om['N° Orden de compra']), type: 'text', isEditMode: _editMode, canEdit: _perms.all })}
          </div>
        </div>

      </div>
    `;

    footerContainer.innerHTML = `
      <div class="ot-modal-footer-left">
        <span style="font-size:0.72rem;color:var(--text-muted);">Registrado: ${sg.fecha_solicitud || '—'}</span>
      </div>
      <div class="ot-modal-footer-right" style="display:flex; gap:0.5rem;">
        ${_editMode ? `
          <button class="btn-modal-secondary" id="btn-sg-modal-cancel">Cancelar</button>
          <button class="btn-modal-primary" id="btn-sg-modal-save" style="background:#166534; border-color:#166534;">
            ${SGUI.Icon('save')} Guardar Cambios
          </button>
        ` : `
          ${(_perms.statusObs || _perms.all) ? `
            <button class="btn-modal-primary" id="btn-sg-modal-edit" style="background:#0284C7; border-color:#0284C7;">
              ${SGUI.Icon('edit')} Editar
            </button>
          ` : ''}
          <button class="btn-modal-secondary" id="btn-sg-modal-cerrar">Cerrar</button>
        `}
      </div>
    `;

    _bindDynamicEvents();
  }

  function _bindDynamicEvents() {
    document.getElementById('btn-sg-modal-cerrar')?.addEventListener('click', close);
    document.getElementById('btn-sg-modal-edit')?.addEventListener('click', _enterEditMode);
    document.getElementById('btn-sg-modal-cancel')?.addEventListener('click', _cancelEdit);
    document.getElementById('btn-sg-modal-save')?.addEventListener('click', _saveEdit);

    if (_editMode) {
      document.getElementById('edit-estatus')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sg-status-btn');
        if (!btn) return;
        
        const nuevoEstado = btn.getAttribute('data-sg-status');
        if (_editState.estatus !== nuevoEstado) {

          _editState.estatus = nuevoEstado;

          // Se actualiza el color de los botones
          document.querySelectorAll('#edit-estatus .sg-status-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.sgStatus === nuevoEstado);
          });
          
          const headerBadge = document.getElementById('sg-modal-header-badge');
          if (headerBadge) headerBadge.innerHTML = SGUI.Badge(nuevoEstado);

          const panamaTime = _getPanamaNow();

          if (nuevoEstado === 'En Proceso') {
            if (!_editState.fecha_inicio) _editState.fecha_inicio = panamaTime.timestamp;
            if (!_editState.semana) _editState.semana = String(_getWeekNumber(panamaTime.dateObj));
            _editState.fecha_conclusion = ''; 

          } else if (nuevoEstado === 'Concluida') {
            if (!_editState.fecha_conclusion) _editState.fecha_conclusion = panamaTime.timestamp;
            
          } else if (nuevoEstado === 'Detenido') { // 👇 SE LIMPIA CONCLUSIÓN SI SE DETIENE
            _editState.fecha_conclusion = ''; 
            
          } else if (nuevoEstado === 'Programado') {
            _editState.fecha_inicio = '';
            _editState.semana = '';
            _editState.fecha_conclusion = '';
          }

          const dispSemana = document.getElementById('disp-semana');
          const dispInicio = document.getElementById('disp-fecha-inicio');
          const dispConclusion = document.getElementById('disp-fecha-conclusion');

          if (dispSemana) dispSemana.innerText = _editState.semana || '—';
          if (dispInicio) dispInicio.innerText = formatDate(_editState.fecha_inicio);
          if (dispConclusion) dispConclusion.innerText = formatDate(_editState.fecha_conclusion);
        }
      });

      document.querySelectorAll('[data-sg-edit]').forEach(input => {
        input.addEventListener('input', (e) => {
          const key = e.target.id.replace('edit-', '');
          _editState[key] = e.target.value;
        });
      });
    }
  }

  return { open, close };
})();

window.SGModalComponent = SGModalComponent;