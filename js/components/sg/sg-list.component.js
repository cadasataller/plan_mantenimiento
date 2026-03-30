// ============================================================
// SG LIST COMPONENT
// ============================================================

const SGListComponent = (() => {
  let _container = null;
  let _onNewManual = null;

  async function mount(containerId, callbacks) {
    _container = document.getElementById(containerId);
    _onNewManual = callbacks?.onNewManual;
    
    _container.innerHTML = `<div style="padding: 2rem; text-align: center;">Cargando Órdenes SG...</div>`;
    
    const sgs = await SGService.fetchSGs();
    _render(sgs);
    _bindEvents();
  }

  // 👇 FUNCIÓN MEJORADA: Solo recarga las tarjetas, sin destruir el modal
  // 👇 Agregamos el parámetro "force = false"
  async function refresh(force = false) {
    if (!_container) return;

    // Si el usuario forzó la actualización, mostramos el estado de "Cargando..."
    const listBody = document.getElementById('sg-list-dynamic-body');
    const refreshBtn = document.getElementById('btn-refresh-sg');
    
    if (force) {
      if (refreshBtn) {
        refreshBtn.innerHTML = `<div class="spinner-sm" style="border-color:#6b7280;border-bottom-color:transparent;"></div>`;
        refreshBtn.disabled = true;
      }
      if (listBody) {
        listBody.innerHTML = `<div style="padding: 3rem; text-align: center; color: #6b7280;"><div class="spinner" style="margin: 0 auto 1rem auto;"></div> Actualizando datos desde el servidor...</div>`;
      }
    }

    // Le pasamos el parámetro 'force' al servicio. Si es true, ignora el caché.
    const sgs = await SGService.fetchSGs(force); 
    
    if (listBody) {
      listBody.innerHTML = sgs.length === 0 
        ? `<div style="padding: 2rem; text-align: center; color: #6b7280;">No hay órdenes de Servicios Generales registradas.</div>`
        : `<div id="sg-cards-container">` + sgs.map(sg => SGCardComponent.render(sg)).join('') + `</div>`;
      
      SGCardComponent.bindEvents('sg-cards-container', (sg) => {
        if (window.SGModalComponent) SGModalComponent.open(sg);
      });
    } else {
      _render(sgs);
      _bindEvents();
    }

    // Restauramos el icono del botón de recarga
    if (force && refreshBtn) {
      refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
      refreshBtn.disabled = false;
    }
  }

  function _render(sgs) {
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    
    const listHtml = sgs.length === 0 
      ? `<div style="padding: 2rem; text-align: center; color: #6b7280;">No hay órdenes de Servicios Generales registradas.</div>`
      : `<div id="sg-cards-container">` + sgs.map(sg => SGCardComponent.render(sg)).join('') + `</div>`;

    const btnHtml = uArea !== 'SERVICIOS GENERALES' 
      ? `<button class="btn-modal-primary" id="btn-new-sg-manual">${SGUI.Icon('plus')} Nueva SG Manual</button>` 
      : '';

    // 👇 NUEVO BOTÓN: Botón de refresco con icono de flechas girando
    const refreshBtnHtml = `
      <button class="btn-modal-secondary" id="btn-refresh-sg" style="display: flex; align-items: center; justify-content: center; padding: 0.5rem; border-radius: 6px;" title="Actualizar lista">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
      </button>
    `;

    _container.innerHTML = `
      <div class="sg-main-content" style="position: relative;">
        <div class="ot-tab-header ot-modal-section" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div class="ot-tab-title ot-modal-section-title" style="margin-bottom: 0;">Servicios Generales</div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${refreshBtnHtml}
            ${btnHtml}
          </div>
        </div>
        
        <div id="sg-list-dynamic-body">
          ${listHtml}
        </div>
      </div>

      <div id="sg-modal-root"></div>
    `;
  }
  
  function _bindEvents() {
    const btnNew = document.getElementById('btn-new-sg-manual');
    if (btnNew && _onNewManual) btnNew.addEventListener('click', _onNewManual);

    const btnRefresh = document.getElementById('btn-refresh-sg');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        refresh(true); // El "true" obliga a consultar la base de datos
      });
    }
    
    SGCardComponent.bindEvents('sg-cards-container', (sg) => {
      if (window.SGModalComponent) SGModalComponent.open(sg);
    });
  }

  return { mount, refresh };
})();

window.SGListComponent = SGListComponent;