/**
 * HorasTable.component.js
 * Renderiza la lista de grupos de OTs (usa HorasGroup internamente).
 * Gestiona estados: loading, vacío, con datos.
 *
 * Uso:
 *   HorasTable.mount('container-id');
 *   HorasTable.render(groups, { isAdmin, groupBy, loading });
 */
const HorasTable = (() => {

  let _containerId = null;

  function mount(containerId) {
    _containerId = containerId;
  }

  /**
   * @param {Array}   groups  — resultado de HorasStore.group(...)
   * @param {Object}  opts    — { isAdmin, groupBy, loading, totalHoras, totalRetraso }
   */
  function render(groups, opts = {}) {
    const el = document.getElementById(_containerId);
    if (!el) return;

    const { isAdmin = false, groupBy = 'semana', loading = false, totalHoras = 0, totalRetraso = 0, totalRows = 0 } = opts;

    if (loading) {
      el.innerHTML = _skeleton();
      return;
    }

    if (!groups || groups.length === 0) {
      el.innerHTML = _empty();
      return;
    }

    // Resumen global
    const summaryEl = document.createElement('div');
    summaryEl.className = 'ht-summary';
    summaryEl.innerHTML = `
      <div class="ht-summary-inner">
        <div class="ht-summary-stat">
          <span class="ht-summary-val">${totalRows}</span>
          <span class="ht-summary-lbl">órdenes</span>
        </div>
        <div class="ht-summary-div"></div>
        <div class="ht-summary-stat">
          <span class="ht-summary-val">${Number(totalHoras).toFixed(1)}<span class="ht-unit">h</span></span>
          <span class="ht-summary-lbl">horas asignadas</span>
        </div>
        ${totalRetraso > 0 ? `
        <div class="ht-summary-div"></div>
        <div class="ht-summary-stat ht-summary-danger">
          <span class="ht-summary-val">${Number(totalRetraso).toFixed(1)}<span class="ht-unit">h</span></span>
          <span class="ht-summary-lbl">horas retraso</span>
        </div>` : ''}
        <div class="ht-summary-div"></div>
        <div class="ht-summary-stat">
          <span class="ht-summary-val">${groups.length}</span>
          <span class="ht-summary-lbl">grupos</span>
        </div>
      </div>
    `;

    // Grupos
    const listEl = document.createElement('div');
    listEl.className = 'ht-list';

    groups.forEach(group => {
      const groupEl = HorasGroup.render(group, { isAdmin, groupBy });
      listEl.appendChild(groupEl);
    });

    el.innerHTML = '';
    el.appendChild(summaryEl);
    el.appendChild(listEl);
  }

  // ─── Estados especiales ──────────────────────────────────
  function _skeleton() {
    const lines = Array(4).fill(0).map(() => `
      <div class="ht-skel-group">
        <div class="ht-skel-header ht-skel-pulse"></div>
        <div class="ht-skel-rows">
          ${Array(3).fill('<div class="ht-skel-row ht-skel-pulse"></div>').join('')}
        </div>
      </div>
    `).join('');
    return `<div class="ht-skeleton">${lines}</div>`;
  }

  function _empty() {
    return `
      <div class="ht-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" opacity=".3">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>No se encontraron órdenes de trabajo</p>
        <small>Ajusta los filtros o el buscador</small>
      </div>
    `;
  }

  function showLoading() {
    const el = document.getElementById(_containerId);
    if (el) el.innerHTML = _skeleton();
  }

  return { mount, render, showLoading };
})();

window.HorasTable = HorasTable;