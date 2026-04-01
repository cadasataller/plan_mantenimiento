// ============================================================
// SG CARD COMPONENT — Representa un ítem en la lista
// ============================================================

const SGCardComponent = (() => {
  SGUI.injectCSS('sg-card-css', `
    .sg-card-comp { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .sg-card-comp:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-color: #d1d5db; }
    .sg-card-header-comp { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .sg-card-title-comp { font-weight: 600; color: #111827; }
    .sg-card-id-comp { font-size: 0.75rem; color: #6b7280; font-family: monospace; background: #f3f4f6; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .sg-card-footer-comp { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; font-size: 0.8rem; color: #6b7280; border-top: 1px solid #f3f4f6; padding-top: 0.75rem; }
  `);

  // 👇 NUEVA FUNCIÓN: Genera la pastilla de días con los mismos colores del modal
  function _renderDiasBadge(sg) {
    const bs = "display:inline-block; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; font-size:0.68rem; margin-bottom:0.5rem;";
    
    const estatus = sg.Estatus || '';
    const diasGuardados = sg.dias;
    const fechaEntregaStr = sg.fecha_entrega || (sg.ORDEN_MANTENIMIENTO && sg.ORDEN_MANTENIMIENTO['Fecha Entrega']);

    // 1. SI TIENE VALOR EN LA COLUMNA DIAS (Ya fue concluida y calculada)
    if (diasGuardados !== null && diasGuardados !== undefined && diasGuardados !== '') {
      const d = parseInt(diasGuardados, 10);
      if (d > 0) return `<span style="${bs} background:#DCFCE7; color:#166534;">Días: ${d} (Anticipado)</span>`;
      if (d < 0) return `<span style="${bs} background:#FEE2E2; color:#991B1B;">Días: ${d} (Retraso)</span>`;
      return `<span style="${bs} background:#F3F4F6; color:#4B5563;">Días: 0 (A tiempo)</span>`;
    }

    // 2. LOGICA POR SI SE CONCLUYÓ ANTES DE ESTA ACTUALIZACIÓN (Legacy)
    if (estatus === 'Concluida') {
      return `<span style="${bs} background:#E5E7EB; color:#374151;">Trabajo Concluido</span>`;
    }

    // 3. LOGICA DINÁMICA (Mientras está programada o en proceso)
    if (!fechaEntregaStr) return `<span style="${bs} background:#F3F4F6; color:#6B7280; font-style:italic;">Sin fecha de entrega</span>`;
    
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const entrega = new Date(fechaEntregaStr);
    entrega.setMinutes(entrega.getMinutes() + entrega.getTimezoneOffset());
    entrega.setHours(0, 0, 0, 0);
    const diffDays = Math.round((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return `<span style="${bs} background:#DCFCE7; color:#166534;">Faltan ${diffDays} día(s)</span>`;
    if (diffDays < 0) return `<span style="${bs} background:#FEE2E2; color:#991B1B;">Retraso de ${Math.abs(diffDays)} día(s)</span>`;
    return `<span style="${bs} background:#F3F4F6; color:#4B5563;">Se entrega hoy</span>`;
  }

  function render(sg) {
    const om = sg.ORDEN_MANTENIMIENTO || {};
    const estatus = sg.Estatus || 'No Programado';
    const observaciones = sg.Observaciones || '';
    
    // Convertimos el objeto a un string base64 o inyectamos el ID para recuperarlo
    const dataString = encodeURIComponent(JSON.stringify(sg));

    return `
      <div class="sg-card-comp" data-sg-payload="${dataString}">
        <div class="sg-card-header-comp">
          <div class="sg-card-title-comp">${om.Descripcion || 'Sin descripción'}</div>
          <div class="sg-card-id-comp">${om['ID_#EQUIPO'] || 'N/A'}</div>
        </div>
        
        ${_renderDiasBadge(sg)}
        
        ${observaciones ? `<div style="font-size:0.85rem; color:#4B5563; margin-top:0.3rem;"><strong>Obs:</strong> ${observaciones}</div>` : ''}
        
        <div class="sg-card-footer-comp">
          <span style="display:flex; align-items:center; gap:0.3rem;">
            ${SGUI.Icon('calendar')} ${sg.fecha_solicitud || '—'}
          </span>
          <span style="display:flex; align-items:center; gap:0.3rem;">
            ${SGUI.Icon('clock')} ${sg.estimacion_horas || 0}h
          </span>
          <span style="margin-left: auto; color: #6b7280; font-weight: 500;">
            ${estatus === 'No Programado' ? 'No Programado' : SGUI.Badge(estatus)}
          </span>
        </div>
      </div>
    `;
  }

  // Delegación de eventos para las tarjetas
  function bindEvents(containerId, onCardClick) {
    const container = document.getElementById(containerId);
    if(!container) return;

    container.addEventListener('click', (e) => {
      const card = e.target.closest('.sg-card-comp');
      if (!card) return;
      
      const payload = card.getAttribute('data-sg-payload');
      if (payload) {
        const sgObj = JSON.parse(decodeURIComponent(payload));
        onCardClick(sgObj);
      }
    });
  }

  return { render, bindEvents };
})();

window.SGCardComponent = SGCardComponent;