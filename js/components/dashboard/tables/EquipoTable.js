/**
 * renderEquipoTable — Tabla de detalle de equipo
 * Muestra: Solicitud de compra, Orden de compra, Fecha de entrega
 * Solo visible cuando se filtra por equipo o se hace clic en la barra del gráfico
 */

function renderEquipoTable(equipoId, rows) {
  const el = document.createElement('div');
  el.className = 'eq-table-wrap';

  if (!rows || rows.length === 0) {
    el.innerHTML = `
      <div class="eq-table-header">
        <span class="eq-table-title">Detalle: <strong>${_esc(equipoId)}</strong></span>
        <button class="eq-close" title="Cerrar">✕</button>
      </div>
      <p class="eq-empty">No hay órdenes para este equipo.</p>
    `;
  } else {
    const tableRows = rows.map(r => `
      <tr>
        <td class="eq-id">${_esc(r.id)}</td>
        <td>${_esc(r.descripcion)}</td>
        <td class="eq-center">
          <span class="eq-bool ${r.tieneSolicitud ? 'eq-bool--yes' : 'eq-bool--no'}">
            ${r.tieneSolicitud ? 'Sí' : 'No'}
          </span>
        </td>
        <td class="eq-center">${_esc(r.nSolicitud)}</td>
        <td class="eq-center">${_esc(r.nOrdenCompra)}</td>
        <td class="eq-center">${_esc(r.fechaEntrega)}</td>
        <td class="eq-center">
          <span class="kpi-dot" style="background:${window._statusColor ? _statusColor(r.estatus) : '#8F8A7F'}"></span>
          ${_esc(r.estatus)}
        </td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div class="eq-table-header">
        <span class="eq-table-title">Detalle: <strong>${_esc(equipoId)}</strong></span>
        <span class="eq-count">${rows.length} órdenes</span>
        <button class="eq-close" title="Cerrar">✕</button>
      </div>
      <div class="eq-table-scroll">
        <table class="eq-table">
          <thead>
            <tr>
              <th>ID Orden</th>
              <th>Descripción</th>
              <th>¿Sol. Compra?</th>
              <th>N° Solicitud</th>
              <th>N° Orden Compra</th>
              <th>Fecha Entrega</th>
              <th>Estatus</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;
  }

  el.querySelector('.eq-close').addEventListener('click', () => {
    el.closest('.eq-table-section')?.classList.add('hidden');
  });

  return el;
}

function _esc(str) {
  return String(str ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.renderEquipoTable = renderEquipoTable;