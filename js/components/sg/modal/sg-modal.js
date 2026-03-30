// ============================================================
// SG MODAL COMPONENT — Visor y Editor de Detalles de SG
// ============================================================

const SGModalComponent = (() => {
  let _currentSG = null;
  let _editMode = false;
  let _editState = {};
  let _perms = { statusObs: false, all: false, godMode: false };
  let _activeTab = 'info'; // <-- NUEVO: Control de pestañas

  function open(sg) {
    _currentSG = sg;
    _editMode = false;
    _editState = {};
    _activeTab = 'info';
    _calcularPermisos(sg);

    const root = document.getElementById('sg-modal-root'); 
    if (!root) return console.error('No se encontró #sg-modal-root en la pestaña SG');
    
    _renderShell(sg);
    _renderContent();
    loadOTs(sg, true); // <-- NUEVO: Carga las OTs en segundo plano
    
    document.body.style.overflow = 'hidden'; 
  }

  function close() {
    if (_editMode && !confirm('Tienes cambios sin guardar. ¿Cerrar de todas formas?')) return;
    
    const root = document.getElementById('sg-modal-root');
    const bd = document.getElementById('sg-backdrop');
    
    // <-- NUEVO: Limpiamos el componente de OTs para que no se dupliquen eventos
    if (window.OTTabComponent) window.OTTabComponent.destroy();

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
    _perms = { statusObs: false, all: false, godMode: false };
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    const om = sg.ORDEN_MANTENIMIENTO || {};
    const omArea = String(om['Área'] || '').trim().toUpperCase();
    
    // 👇 Leemos el estatus desde OM_SG
    const estatus = String(sg.Estatus).trim().toUpperCase();

    if (uArea === 'ALL') {
      _perms.godMode = true;
      _perms.statusObs = true;
    } else if (uArea === 'SERVICIOS GENERALES') {
      _perms.statusObs = true;
    } else if (uArea === omArea) {
      if (estatus === 'PROGRAMADO') {
        _perms.all = true;
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
      estatus: _currentSG.Estatus || 'Programado', // Ojo: ahora leemos de SG
      observaciones: _currentSG.Observaciones || '', // Ojo: ahora leemos de SG
      tipo_trabajo: _currentSG.tipo_trabajo || '',
      estimacion_horas: _currentSG.estimacion_horas || '',
      solicitar_personal: _currentSG.solicitar_personal || '',
      fecha_entrega: _currentSG.fecha_entrega || om['Fecha Entrega'] || '',
      tiene_compra: om['Tiene solicitud de compra?'] ? 'true' : 'false',
      n_solicitud: om['N° solicitud'] || '',
      n_oc: om['N° Orden de compra'] || '',
      fecha_ejecucion: _currentSG.fecha_ejecucion || '', // <-- CAMBIO AQUÍ
      fecha_conclusion: _currentSG['Fecha conclusion'] || '', // <-- CAMBIO AQUÍ
      semana: _currentSG.semana || '', // <-- CAMBIO AQUÍ
      
      area_om: om['Área'] || '',
      equipo: om['ID_#EQUIPO'] || '',
      item: om.ITEM || '',
      sistema: om.Sistema || '',
      descripcion: om.Descripcion || ''
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

    if (_editState.estatus === 'Concluida') {
      try {
        const db = window.SupabaseClient;
        
        // <-- CAMBIO: Consultamos OM_SG en lugar de ORDEN_MANTENIMIENTO
        const { data, error } = await db
          .from('OM_SG')
          .select('fecha_ejecucion')
          .eq('id_sg', _currentSG.id_sg)
          .single();
          
        if (error) throw error;

        // <-- CAMBIO: Validamos fecha_ejecucion
        if (!data.fecha_ejecucion && !_editState.fecha_ejecucion) {
          window.ToastService?.show('No se puede concluir: La orden no tiene Fecha de Ejecución registrada.', 'warning');
          btn.disabled = false;
          btn.innerHTML = btnOriginalHTML;
          return; 
        }
      } catch (err) {
        console.error('Error al consultar Supabase:', err);
        window.ToastService?.show('Error al validar la orden en la base de datos.', 'danger');
        btn.disabled = false;
        btn.innerHTML = btnOriginalHTML;
        return;
      }
    }

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

    if (_perms.godMode) {
      const om = _currentSG.ORDEN_MANTENIMIENTO;
      const titleEl = document.querySelector('#sg-backdrop .ot-modal-title');
      const areaEl = document.querySelector('#sg-backdrop .ot-modal-area');
      
      if (titleEl) titleEl.innerText = om.Descripcion || 'Sin descripción';
      if (areaEl) {
        areaEl.innerHTML = `
          <span>${om['Área'] || 'N/A'}</span>
          <span class="ot-modal-area-sep">·</span>
          <span>${om['ID_#EQUIPO'] || 'N/A'} — ${om.ITEM || 'N/A'}</span>
        `;
      }
    }

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

    // 👇 OBTENEMOS EL ÁREA DEL USUARIO LOGUEADO
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    
    // 👇 DEFINIMOS SI TIENE PERMISO PARA VER OTs
    const puedeVerOTs = uArea === 'ALL' || uArea === 'SERVICIOS GENERALES';

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
              <span id="sg-modal-header-badge">${SGUI.Badge(sg.Estatus)}</span>
            </div>
          </div>

          <div class="ot-modal-tabs" id="sg-modal-tabs">
            <div class="ot-modal-tab active" data-tab="info">
               Información General
            </div>
            
            ${puedeVerOTs ? `
              <div class="ot-modal-tab" data-tab="ots">
                 Órdenes de Trabajo 
                 <span class="dash-tab-badge" id="sg-modal-ot-badge" style="display:none">0</span>
              </div>
            ` : ''}
          </div>

          <div class="ot-modal-body">
            <div class="ot-modal-tab-panel active" id="sg-tab-info"></div>
            
            ${puedeVerOTs ? `
              <div class="ot-modal-tab-panel" id="sg-tab-ots">
                 <div id="sg-ots-content" style="padding: 1rem;">
                   <div class="ot-work-loading"><div class="spinner"></div> Cargando órdenes de trabajo…</div>
                 </div>
              </div>
            ` : ''}
          </div>
          
          <div class="ot-modal-footer" id="sg-dynamic-footer"></div>

        </div>
      </div>
    `;

    document.getElementById('btn-sg-modal-close')?.addEventListener('click', close);
    document.getElementById('sg-backdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });

    // Evento para cambiar de pestaña
    document.getElementById('sg-modal-tabs')?.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) switchTab(tab.dataset.tab);
    });
  }

  function _renderContent() {
    const bodyContainer = document.getElementById('sg-tab-info');
    const footerContainer = document.getElementById('sg-dynamic-footer');
    if (!bodyContainer || !footerContainer) return;

    const sg = _currentSG;
    const om = sg.ORDEN_MANTENIMIENTO || {};
    
    const v = (key, fallback) => _editMode ? (_editState[key] ?? fallback) : fallback;
    const fechaEntregaReal = sg.fecha_entrega || om['Fecha Entrega'];

    const headerBadge = document.getElementById('sg-modal-header-badge');
    
    // 👇 CAMBIO 1: Leemos el estatus desde sg.Estatus
    if (headerBadge) headerBadge.innerHTML = SGUI.Badge(v('estatus', sg.Estatus || 'Programado'));

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

    const canEditFull = _perms.all || _perms.godMode;

    bodyContainer.innerHTML = `
        
        ${_editMode ? `<div style="background:#E0F2FE; color:#0284C7; padding:0.5rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.8rem; font-weight:600; display:flex; align-items:center; gap:0.5rem;">${SGUI.Icon('edit')} Modo edición activo ${(_perms.godMode) ? '(Acceso ALL)' : ''}</div>` : ''}

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Identificación y Ubicación</div>
          <div class="ot-modal-grid">
            ${(_editMode && _perms.godMode) ? `
              ${SGUI.EditableField({ id: 'edit-descripcion', label: 'Descripción', value: v('descripcion', om.Descripcion), type: 'textarea', isEditMode: true, canEdit: true, fullWidth: true })}
              ${SGUI.EditableField({ id: 'edit-area_om', label: 'Área', value: v('area_om', om['Área']), type: 'buttongroup', options: SGUI.AREAS_OPTIONS, isEditMode: true, canEdit: true, fullWidth: true })}
              ${SGUI.EditableField({ id: 'edit-equipo', label: 'Equipo', value: v('equipo', om['ID_#EQUIPO']), type: 'text', isEditMode: true, canEdit: true })}
              ${SGUI.EditableField({ id: 'edit-item', label: 'Item', value: v('item', om.ITEM), type: 'text', isEditMode: true, canEdit: true })}
              ${SGUI.EditableField({ id: 'edit-sistema', label: 'Sistema', value: v('sistema', om.Sistema), type: 'text', isEditMode: true, canEdit: true })}
            ` : `
              <div class="ot-modal-field"><div class="ot-modal-label">Sistema</div><div class="ot-modal-val">${om.Sistema || '—'}</div></div>
            `}
            <div class="ot-modal-field"><div class="ot-modal-label">Tipo de Proceso</div><div class="ot-modal-val">${om['Tipo de Proceso'] || '—'}</div></div>
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Estado y Observaciones</div>
          <div class="ot-modal-grid">
            ${SGUI.StatusPicker({ id: 'edit-estatus', label: 'Estatus', value: v('estatus', sg.Estatus), options: estatusOptions, isEditMode: _editMode, canEdit: _perms.statusObs })}
            
            ${SGUI.EditableField({ id: 'edit-observaciones', label: 'Observaciones', value: v('observaciones', sg.Observaciones || ''), type: 'textarea', placeholder: 'Notas de Servicios Generales...', isEditMode: _editMode, canEdit: _perms.statusObs, fullWidth: true })}
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Detalles del Trabajo (SG)</div>
          <div class="ot-modal-grid">
            ${SGUI.EditableField({ id: 'edit-tipo_trabajo', label: 'Tipo Trabajo', value: v('tipo_trabajo', sg.tipo_trabajo), type: 'buttongroup', options: tipoTrabajoOptions, isEditMode: _editMode, canEdit: canEditFull, fullWidth: true })}
            ${SGUI.EditableField({ id: 'edit-estimacion_horas', label: 'Estimación (h)', value: v('estimacion_horas', sg.estimacion_horas), type: 'number', isEditMode: _editMode, canEdit: canEditFull })}
            
            <div class="ot-modal-field" style="grid-column: 1 / -1;">
              <div class="ot-modal-label">Mecánico a Solicitar ${(_editMode && canEditFull) ? '<span class="sg-edit-tag">(editable)</span>' : ''}</div>
              ${(_editMode && canEditFull) 
                ? (window.MecanicoSelectComponent ? window.MecanicoSelectComponent.renderHtml() : `<input type="text" id="edit-solicitar_personal" data-sg-edit class="sg-field-input" value="${v('solicitar_personal', sg.solicitar_personal)}" />`)
                : `<div class="ot-modal-val" id="disp-mecanico-solicitado">Cargando...</div>`
              }
            </div>

          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Fechas y Planificación</div>
          <div class="ot-modal-grid">
            <div class="ot-modal-field"><div class="ot-modal-label">Semana</div><div class="ot-modal-val" id="disp-semana">${v('semana', sg.semana || '—')}</div></div>
            
            ${_editMode && canEditFull 
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
            
            <div class="ot-modal-field"><div class="ot-modal-label">Fecha Ejecución (SG)</div><div class="ot-modal-val" id="disp-fecha-ejecucion">${formatDate(v('fecha_ejecucion', sg.fecha_ejecucion))}</div></div>
            <div class="ot-modal-field"><div class="ot-modal-label">Fecha Conclusión (SG)</div><div class="ot-modal-val" id="disp-fecha-conclusion">${formatDate(v('fecha_conclusion', sg['Fecha conclusion']))}</div></div>
          </div>
        </div>

        <div class="ot-modal-section">
          <div class="ot-modal-section-title">Gestión de Compras</div>
          <div class="ot-modal-grid">
            ${SGUI.EditableField({ id: 'edit-tiene_compra', label: 'Tiene solicitud?', value: v('tiene_compra', om['Tiene solicitud de compra?'] ? 'true' : 'false'), type: 'buttongroup', options: booleanOptions, isEditMode: _editMode, canEdit: canEditFull })}
            ${SGUI.EditableField({ id: 'edit-n_solicitud', label: 'N° Solicitud', value: v('n_solicitud', om['N° solicitud']), type: 'text', isEditMode: _editMode, canEdit: canEditFull })}
            ${SGUI.EditableField({ id: 'edit-n_oc', label: 'N° OC', value: v('n_oc', om['N° Orden de compra']), type: 'text', isEditMode: _editMode, canEdit: canEditFull })}
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
          ${(_perms.statusObs || _perms.all || _perms.godMode) ? `
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

    const canEditFull = _perms.all || _perms.godMode;
    const currentMecId = _editMode ? _editState.solicitar_personal : (_currentSG?.solicitar_personal || null);

    // 👇 LOGICA DEL MECÁNICO (Edición vs Lectura)
    if (_editMode && canEditFull && window.MecanicoSelectComponent) {
      // Cargamos el select con el valor actual
      window.MecanicoSelectComponent.mount(currentMecId);
      
      // Vinculamos el cambio del select para guardarlo en _editState
      const mecSelect = document.getElementById('ot-mec-select');
      if (mecSelect) {
        mecSelect.addEventListener('change', (e) => {
          _editState.solicitar_personal = e.target.value;
        });
      }
    } else if (!_editMode || !canEditFull) {
      // En modo lectura pedimos el nombre asíncronamente
      if (window.MecanicoSelectComponent) {
        window.MecanicoSelectComponent.getNameById(currentMecId).then(name => {
          const disp = document.getElementById('disp-mecanico-solicitado');
          if (disp) disp.innerText = name || '—';
        });
      } else {
        const disp = document.getElementById('disp-mecanico-solicitado');
        if (disp) disp.innerText = currentMecId || '—';
      }
    }

    if (_editMode) {
      document.getElementById('edit-estatus')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sg-status-btn');
        if (!btn) return;
        
        const nuevoEstado = btn.getAttribute('data-sg-status');
        if (_editState.estatus !== nuevoEstado) {

          if (nuevoEstado === 'Concluida' && !_editState.fecha_ejecucion) {
            if (window.ToastService) {
              window.ToastService.show('Debe iniciar la orden (estado "En Proceso") antes de poder concluirla.', 'warning');
            } else {
              alert('Debe iniciar la orden (estado "En Proceso") antes de poder concluirla.');
            }
            return; 
          }

          _editState.estatus = nuevoEstado;

          document.querySelectorAll('#edit-estatus .sg-status-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.sgStatus === nuevoEstado);
          });
          
          const headerBadge = document.getElementById('sg-modal-header-badge');
          if (headerBadge) headerBadge.innerHTML = SGUI.Badge(nuevoEstado);

          const panamaTime = _getPanamaNow();

          if (nuevoEstado === 'En Proceso') {
            if (!_editState.fecha_ejecucion) _editState.fecha_ejecucion = panamaTime.timestamp;
            if (!_editState.semana) _editState.semana = String(_getWeekNumber(panamaTime.dateObj));
            _editState.fecha_conclusion = '';

          } else if (nuevoEstado === 'Concluida') {
            if (!_editState.fecha_conclusion) _editState.fecha_conclusion = panamaTime.timestamp;
            
          } else if (nuevoEstado === 'Detenido') { 
            _editState.fecha_conclusion = ''; 
            
          } else if (nuevoEstado === 'Programado') {
            _editState.fecha_ejecucion = '';
            _editState.semana = '';
            _editState.fecha_conclusion = '';
          }

          const dispSemana = document.getElementById('disp-semana');
          const dispEjecucion = document.getElementById('disp-fecha-ejecucion');
          const dispConclusion = document.getElementById('disp-fecha-conclusion');

          if (dispSemana) dispSemana.innerText = _editState.semana || '—';
          if (dispEjecucion) dispEjecucion.innerText = formatDate(_editState.fecha_ejecucion);
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

  // ══════════════════════════════════════════════════════════
  // PESTAÑAS Y CARGA DE OTs
  // ══════════════════════════════════════════════════════════
  function switchTab(tabId) {
    _activeTab = tabId;
    // Ocultar/Mostrar Pestañas (Botones)
    document.querySelectorAll('#sg-modal-tabs .ot-modal-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    // Ocultar/Mostrar Paneles de contenido
    document.querySelectorAll('.ot-modal-tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `sg-tab-${tabId}`);
    });
  }

  async function loadOTs(sg, authenticated) {
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    if (uArea !== 'ALL' && uArea !== 'SERVICIOS GENERALES') return; // No carga nada
    const om = sg.ORDEN_MANTENIMIENTO || {};
    
    const mappedOM = {
      ...om,
      ID_Orden: om['ID_Orden mantenimiento'], // Para visualización en el Tab
      Area: om['Área'],
      Descripcion: om.Descripcion,
      ID_EQUIPO: om['ID_#EQUIPO'],
      
      // 👇 NUEVO: Banderas clave para que el Store sepa cómo buscar
      IS_SG: true, 
      id_sg: sg.id_sg 
    };

    if (!window.OTWorkStore || !window.OTTabComponent) {
      console.warn("Componentes de OTs no encontrados.");
      return;
    }

    // 👇 CAMBIO VITAL: Ahora le pasamos sg.id_sg (el UUID) como primer parámetro
    const ots = await window.OTWorkStore.getForOM(sg.id_sg, mappedOM, authenticated);
    
    const badge = document.getElementById('sg-modal-ot-badge');
    if (badge) {
      badge.textContent = ots.length;
      badge.style.display = 'inline-block';
    }
    
    const otsEl = document.getElementById('sg-ots-content');
    if (otsEl) {
      window.OTTabComponent.init('sg-ots-content', mappedOM, ots, () => {}); 
      window.OTTabComponent.bindEvents();
    }
  }

  return { open, close };
})();

window.SGModalComponent = SGModalComponent;