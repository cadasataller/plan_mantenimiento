const SGListComponent = (() => {
  let _container = null;
  let _onNewManual = null;

  async function mount(containerId, callbacks) {
    _container = document.getElementById(containerId);
    _onNewManual = callbacks.onNewManual;
    
    _container.innerHTML = `<div style="padding: 2rem; text-align: center;">Cargando Órdenes SG...</div>`;
    
    const sgs = await SGService.fetchSGs();
    _render(sgs);
    _bindEvents();
  }

  function _render(sgs) {
    
    const getBadgeClass = (estado) => {
      const e = (estado || 'Programado').toLowerCase(); // <--- CAMBIO AQUÍ
      if (e.includes('proceso')) return 'st-en-proceso';
      if (e.includes('concluida')) return 'st-concluida';
      if (e.includes('programado')) return 'st-programado'; // <--- CAMBIO AQUÍ
      return 'st-pendiente';
    };

    const listHtml = sgs.length === 0 
      ? `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay órdenes de Servicios Generales registradas.</div>`
      : `<div class="sg-list-container">` + 
        sgs.map(sg => {
          // Extraemos el Estatus de la tabla ORDEN_MANTENIMIENTO
          const estatusOM = sg.ORDEN_MANTENIMIENTO?.Estatus || 'Programado'; 

          return `
          <div class="sg-card">
            <div class="sg-card-header">
              <div class="sg-card-title">${sg.ORDEN_MANTENIMIENTO?.Descripcion || 'Sin descripción'}</div>
              <div class="sg-card-id">${sg.ORDEN_MANTENIMIENTO?.['ID_#EQUIPO'] || 'N/A'}</div>
            </div>

            ${sg.ORDEN_MANTENIMIENTO?.Observaciones ? `<div class="sg-card-body"><strong>Obs:</strong> ${sg.ORDEN_MANTENIMIENTO.Observaciones}</div>` : ''}
            
            <div class="sg-card-footer">
              <span class="sg-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Registrado: ${sg.fecha_solicitud || '—'}
              </span>
              <span class="sg-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Est: ${sg.estimacion_horas || 0}h
              </span>
              <span class="sg-meta-item">
                <strong>Tipo:</strong> ${sg.tipo_trabajo || '—'}
              </span>
              <span class="sg-meta-item" style="margin-left: auto;">
                <span class="sg-badge ${getBadgeClass(estatusOM)}">${estatusOM}</span>
              </span>
            </div>
          </div>
        `}).join('') + `</div>`;

    _container.innerHTML = `
      <div class="ot-tab-header ot-modal-section" style="margin-bottom: 0;">
        <div class="ot-tab-title ot-modal-section-title">Servicios Generales</div>
        <button class="btn-modal-primary" id="btn-new-sg-manual">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16" style="margin-right: 4px;">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva SG Manual
        </button>
      </div>
      ${listHtml}
    `;
  }
  
  function _bindEvents() {
    const btnNew = document.getElementById('btn-new-sg-manual');
    if (btnNew) btnNew.addEventListener('click', _onNewManual);
  }

  return { mount };
})();

window.SGListComponent = SGListComponent;