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
    
    // fetchSGs ahora usa la caché que hicimos en el servicio
    const sgs = await SGService.fetchSGs();
    _render(sgs);
    _bindEvents();
  }

  // 👇 NUEVA FUNCIÓN: Vuelve a pedir los datos (de la caché) y repinta la lista
  async function refresh() {
    if (!_container) return;
    const sgs = await SGService.fetchSGs(); 
    _render(sgs);
    _bindEvents();
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
        ${listHtml}
      </div>
      <div id="sg-modal-root"></div>
    `;
  }
  
  function _bindEvents() {
    const btnNew = document.getElementById('btn-new-sg-manual');
    if (btnNew && _onNewManual) btnNew.addEventListener('click', _onNewManual);

    SGCardComponent.bindEvents('sg-cards-container', (sg) => {
      SGModalComponent.open(sg);
    });
  }

  // Exponemos el método refresh para que el modal pueda llamarlo
  return { mount, refresh };
})();

window.SGListComponent = SGListComponent;