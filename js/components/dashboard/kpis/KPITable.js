/**
 * renderKPITable — Tabla de estatus de taller estilo dashboard
 * Muestra conteo por estatus + % del total
 */

const STATUS_COLORS = {
  'Concluida':       'var(--color-success)',
  'En Proceso':      'var(--color-accent)',
  'Pendiente':       'var(--color-info)',
  'Sin iniciar':     'var(--color-gray-400)',
  'Detenida':        'var(--color-danger)',
  'Cancelada':       'var(--color-gray-300)',
  'En espera':       'var(--color-warning)',
  'Sin estatus':     'var(--color-gray-300)',
};

function _statusColor(status) {
  return STATUS_COLORS[status] || 'var(--color-gray-400)';
}

/**
 * renderKPIBadge — Pill coloreada de estatus
 */
function renderKPIBadge(status) {
  const el = document.createElement('span');
  el.className = 'kpi-badge';
  el.style.setProperty('--badge-color', _statusColor(status));
  el.textContent = status;
  return el;
}

/**
 * renderKPITable
 * @param {{ total: number, byStatus: Record<string,number> }} kpis
 */
function renderKPITable(kpis) {
  const el = document.createElement('div');
  el.className = 'kpi-table-wrap';

  const rows = Object.entries(kpis.byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => {
      const pct = kpis.total > 0 ? ((count / kpis.total) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td>
            <span class="kpi-dot" style="background:${_statusColor(status)}"></span>
            ${_esc(status)}
          </td>
          <td class="kpi-num">${count}</td>
          <td class="kpi-pct-cell">
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill" style="width:${pct}%;background:${_statusColor(status)}"></div>
            </div>
            <span class="kpi-pct">${pct}%</span>
          </td>
        </tr>
      `;
    }).join('');

  el.innerHTML = `
    <div class="kpi-table-header">
      <span class="kpi-table-title">Estatus de Órdenes</span>
      <span class="kpi-total-badge">${kpis.total} total</span>
    </div>
    <table class="kpi-table">
      <thead>
        <tr>
          <th>Estatus</th>
          <th>Cant.</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="kpi-total-row">
          <td><strong>Total</strong></td>
          <td class="kpi-num"><strong>${kpis.total}</strong></td>
          <td class="kpi-pct-cell"><span class="kpi-pct">100%</span></td>
        </tr>
      </tbody>
    </table>
  `;
  return el;
}

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.renderKPITable  = renderKPITable;
window.renderKPIBadge  = renderKPIBadge;
window._statusColor    = _statusColor;
window.STATUS_COLORS   = STATUS_COLORS;