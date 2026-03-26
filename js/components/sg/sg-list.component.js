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
  async function refresh() {
    if (!_container) return;
    const sgs = await SGService.fetchSGs(); 
    
    const listBody = document.getElementById('sg-list-dynamic-body');
    
    if (listBody) {
      // Inyectamos solo el HTML de las tarjetas
      listBody.innerHTML = sgs.length === 0 
        ? `<div style="padding: 2rem; text-align: center; color: #6b7280;">No hay órdenes de Servicios Generales registradas.</div>`
        : `<div id="sg-cards-container">` + sgs.map(sg => SGCardComponent.render(sg)).join('') + `</div>`;
      
      // Volvemos a atar los eventos de click SOLO para las tarjetas nuevas
      SGCardComponent.bindEvents('sg-cards-container', (sg) => {
        if (window.SGModalComponent) SGModalComponent.open(sg);
      });
    } else {
      // Fallback por si la estructura original no está
      _render(sgs);
      _bindEvents();
    }
  }

  function _render(sgs) {
    const listHtml = sgs.length === 0 
      ? `<div style="padding: 2rem; text-align: center; color: #6b7280;">No hay órdenes de Servicios Generales registradas.</div>`
      : `<div id="sg-cards-container">` + sgs.map(sg => SGCardComponent.render(sg)).join('') + `</div>`;

    _container.innerHTML = `
      <div class="sg-main-content" style="position: relative;">
        <div class="ot-tab-header ot-modal-section" style="margin-bottom: 1rem;">
          <div class="ot-tab-title ot-modal-section-title">Servicios Generales</div>
          <button class="btn-modal-primary" id="btn-new-sg-manual">
            ${SGUI.Icon('plus')} Nueva SG Manual
          </button>
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

    SGCardComponent.bindEvents('sg-cards-container', (sg) => {
      if (window.SGModalComponent) SGModalComponent.open(sg);
    });
  }

  return { mount, refresh };
})();

window.SGListComponent = SGListComponent;