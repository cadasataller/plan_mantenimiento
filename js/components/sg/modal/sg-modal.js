// ============================================================
// SG MODAL COMPONENT — Visor de Detalles de SG
// ============================================================

const SGModalComponent = (() => {
  let _currentSG = null;

  function open(sg) {
    _currentSG = sg;
    // 👇 Cambiamos a sg-modal-root
    const root = document.getElementById('sg-modal-root'); 
    if (!root) return console.error('No se encontró #sg-modal-root en la pestaña SG');
    
    _renderModal(sg);
    document.body.style.overflow = 'hidden'; 
  }

  function close() {
    // 👇 Cambiamos a sg-modal-root
    const root = document.getElementById('sg-modal-root');
    const bd = document.getElementById('sg-backdrop'); // Cambié el ID del backdrop también para que no choque
    _currentSG = null;
    
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

  function _renderModal(sg) {
    const root = document.getElementById('sg-modal-root');
    const om = sg.ORDEN_MANTENIMIENTO || {};

    root.innerHTML = `
      <div class="ot-modal-backdrop" id="ot-backdrop" style="opacity: 1; transition: opacity 0.2s ease;">
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
              ${SGUI.Badge(om.Estatus)}
            </div>
          </div>

          <div class="ot-modal-tabs">
            <div class="ot-modal-tab active">Información General</div>
          </div>

          <div class="ot-modal-body">
            <div class="ot-modal-tab-panel active">
              
              <div class="ot-modal-section">
                <div class="ot-modal-section-title">Detalles del Trabajo</div>
                <div class="ot-modal-grid">
                  <div class="ot-modal-field"><div class="ot-modal-label">Tipo Trabajo</div><div class="ot-modal-val">${sg.tipo_trabajo || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Estimación</div><div class="ot-modal-val">${sg.estimacion_horas || 0} horas</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Personal Solicitado</div><div class="ot-modal-val">${sg.solicitar_personal || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Fecha Entrega</div><div class="ot-modal-val">${sg.fecha_entrega || om['Fecha Entrega'] || '—'}</div></div>
                </div>
              </div>

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">Gestión de Compras</div>
                <div class="ot-modal-grid">
                  <div class="ot-modal-field"><div class="ot-modal-label">¿Requiere Compra?</div><div class="ot-modal-val">${om['Tiene solicitud de compra?'] ? 'Sí' : 'No'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">N° Solicitud</div><div class="ot-modal-val">${om['N° solicitud'] || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">N° OC</div><div class="ot-modal-val">${om['N° Orden de compra'] || '—'}</div></div>
                </div>
              </div>

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">Observaciones</div>
                <div style="font-size:0.85rem; background:var(--color-gray-50); padding:1rem; border-radius:8px; border-left:3px solid var(--color-main-light);">
                  ${om.Observaciones || 'Sin observaciones.'}
                </div>
              </div>

            </div>
          </div>

          <div class="ot-modal-footer">
            <div class="ot-modal-footer-left"><span style="font-size:0.72rem;color:var(--text-muted);">Registrado: ${sg.fecha_solicitud}</span></div>
            <div class="ot-modal-footer-right">
              <button class="btn-modal-secondary" id="btn-sg-modal-cerrar">Cerrar</button>
            </div>
          </div>

        </div>
      </div>
    `;

    // Eventos
    document.getElementById('btn-sg-modal-close')?.addEventListener('click', close);
    document.getElementById('btn-sg-modal-cerrar')?.addEventListener('click', close);
    document.getElementById('sg-backdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  }

  return { open, close };
})();
window.SGModalComponent = SGModalComponent;