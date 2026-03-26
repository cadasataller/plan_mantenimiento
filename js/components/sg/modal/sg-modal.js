// ============================================================
// SG MODAL COMPONENT — Visor de Detalles de SG
// ============================================================

const SGModalComponent = (() => {
  let _currentSG = null;

  function open(sg) {
    _currentSG = sg;
    const root = document.getElementById('sg-modal-root'); 
    if (!root) return console.error('No se encontró #sg-modal-root en la pestaña SG');
    
    _renderModal(sg);
    document.body.style.overflow = 'hidden'; 
  }

  function close() {
    const root = document.getElementById('sg-modal-root');
    const bd = document.getElementById('sg-backdrop');
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

  // Helper para formatear fechas a texto legible
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      // Ajuste para evitar que el timezone reste un día a las fechas 'YYYY-MM-DD'
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const userTimezoneOffset = d.getTimezoneOffset() * 60000;
      const localDate = new Date(d.getTime() + userTimezoneOffset);
      
      return localDate.toLocaleDateString('es-PA');
    } catch {
      return dateStr;
    }
  }

  // Helper para calcular la diferencia de días y retornar el badge con colores
  function _calcularEstadoDias(fechaEntregaStr) {
    if (!fechaEntregaStr) return '<span style="color:#6b7280; font-size:0.8rem;">Sin fecha asignada</span>';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const entrega = new Date(fechaEntregaStr);
    // Ajustar el timezone para que compare exactamente los días locales
    entrega.setMinutes(entrega.getMinutes() + entrega.getTimezoneOffset());
    entrega.setHours(0, 0, 0, 0);

    const diffTime = entrega.getTime() - hoy.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Estilos base para el badge
    const baseStyle = "display:inline-block; padding:0.2rem 0.6rem; border-radius:4px; font-weight:600; font-size:0.75rem;";

    if (diffDays > 0) {
      // Falta para la entrega -> Verde
      return `<span style="${baseStyle} background:#DCFCE7; color:#166534;">Faltan ${diffDays} día(s)</span>`;
    } else if (diffDays < 0) {
      // Se pasó la fecha -> Rojo
      return `<span style="${baseStyle} background:#FEE2E2; color:#991B1B;">Retraso de ${Math.abs(diffDays)} día(s)</span>`;
    } else {
      // Es exactamente hoy -> Gris
      return `<span style="${baseStyle} background:#F3F4F6; color:#4B5563;">Se entrega hoy</span>`;
    }
  }

  function _renderModal(sg) {
    const root = document.getElementById('sg-modal-root');
    const om = sg.ORDEN_MANTENIMIENTO || {};
    
    // Obtener la fecha de entrega unificada
    const fechaEntrega = sg.fecha_entrega || om['Fecha Entrega'];

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
              ${SGUI.Badge(om.Estatus || sg.estado)}
            </div>
          </div>

          <div class="ot-modal-tabs">
            <div class="ot-modal-tab active">Información General</div>
          </div>

          <div class="ot-modal-body">
            <div class="ot-modal-tab-panel active">
              
              <div class="ot-modal-section">
                <div class="ot-modal-section-title">Identificación y Ubicación</div>
                <div class="ot-modal-grid">
                  <div class="ot-modal-field"><div class="ot-modal-label">Sistema</div><div class="ot-modal-val">${om.Sistema || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Tipo de Proceso</div><div class="ot-modal-val">${om['Tipo de Proceso'] || '—'}</div></div>
                </div>
              </div>

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">Detalles del Trabajo (Servicios Generales)</div>
                <div class="ot-modal-grid">
                  <div class="ot-modal-field"><div class="ot-modal-label">Tipo Trabajo</div><div class="ot-modal-val">${sg.tipo_trabajo || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Estimación</div><div class="ot-modal-val">${sg.estimacion_horas || 0} horas</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Personal Solicitado</div><div class="ot-modal-val">${sg.solicitar_personal || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Estado de Entrega</div><div class="ot-modal-val">${_calcularEstadoDias(fechaEntrega)}</div></div>
                </div>
              </div>

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">Fechas y Planificación</div>
                <div class="ot-modal-grid">
                  <div class="ot-modal-field"><div class="ot-modal-label">Semana</div><div class="ot-modal-val">${om.Semana || '—'}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Fecha Entrega Esperada</div><div class="ot-modal-val">${formatDate(fechaEntrega)}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Fecha Inicio (OM)</div><div class="ot-modal-val">${formatDate(om['Fecha inicio'])}</div></div>
                  <div class="ot-modal-field"><div class="ot-modal-label">Fecha Conclusión (OM)</div><div class="ot-modal-val">${formatDate(om['Fecha conclusion'])}</div></div>
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
                <div style="font-size:0.85rem; background:var(--color-gray-50); padding:1rem; border-radius:8px; border-left:3px solid var(--color-main-light); white-space: pre-wrap;">
                  ${om.Observaciones || 'Sin observaciones.'}
                </div>
              </div>

            </div>
          </div>

          <div class="ot-modal-footer">
            <div class="ot-modal-footer-left">
              <span style="font-size:0.72rem;color:var(--text-muted);">
                Registrado: ${sg.fecha_solicitud} | ID DB: ${sg.id_sg}
              </span>
            </div>
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