/**
 * renderFilterDropdown — Dropdown con checkboxes estilo Power BI
 * @param {string} key - clave del filtro (etapa|area|item|equipo)
 * @param {string} label - etiqueta visible
 * @param {string[]} options - lista de opciones
 * @param {string[]} selected - valores seleccionados actualmente
 * @param {function} onChange - callback(key, selectedValues)
 */
function renderFilterDropdown(key, label, options, selected, onChange) {
  const el = document.createElement('div');
  el.className = 'flt-dropdown';
  el.dataset.key = key;

  const activeCount = selected.length;
  const summary = activeCount === 0
    ? 'Todos'
    : activeCount === 1
      ? selected[0]
      : `${activeCount} seleccionados`;

  el.innerHTML = `
    <button class="flt-trigger ${activeCount > 0 ? 'flt-trigger--active' : ''}" type="button">
      <span class="flt-label">${label}</span>
      <span class="flt-summary">${summary}</span>
      <svg class="flt-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
        <polyline points="4 6 8 10 12 6"/>
      </svg>
    </button>
    <div class="flt-panel" hidden>
      <div class="flt-search-wrap">
        <input class="flt-search" type="text" placeholder="Buscar…" autocomplete="off">
      </div>
      <div class="flt-actions">
        <button class="flt-select-all" type="button">Seleccionar todo</button>
        <button class="flt-clear" type="button">Limpiar</button>
      </div>
      <div class="flt-list">
        ${options.map(opt => `
          <label class="flt-item">
            <input type="checkbox" value="${_esc(opt)}" ${selected.includes(opt) ? 'checked' : ''}>
            <span class="flt-item-check"></span>
            <span class="flt-item-label">${_esc(opt)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;

  const trigger = el.querySelector('.flt-trigger');
  const panel   = el.querySelector('.flt-panel');
  const search  = el.querySelector('.flt-search');
  const list    = el.querySelector('.flt-list');

  // Abrir / cerrar
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.hidden;
    // Cerrar todos los demás dropdowns
    document.querySelectorAll('.flt-panel').forEach(p => { p.hidden = true; });
    panel.hidden = isOpen;
    if (!panel.hidden) search.focus();
  });

  // Búsqueda en tiempo real
  search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    list.querySelectorAll('.flt-item').forEach(item => {
      const text = item.querySelector('.flt-item-label').textContent.toLowerCase();
      item.style.display = text.includes(q) ? '' : 'none';
    });
  });

  // Cambio de checkbox → emitir
  list.addEventListener('change', () => _emitChange());

  // Seleccionar todo
  el.querySelector('.flt-select-all').addEventListener('click', () => {
    list.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = true; });
    _emitChange();
  });

  // Limpiar
  el.querySelector('.flt-clear').addEventListener('click', () => {
    list.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
    _emitChange();
  });

  function _emitChange() {
    const vals = [...list.querySelectorAll('input:checked')].map(cb => cb.value);
    onChange(key, vals);
  }

  return el;
}

/** Barra de filtros completa */
function renderFiltersBar(options, filters, onChange) {
  const el = document.createElement('div');
  el.className = 'flt-bar';

  const keys = [
    { key: 'etapa',  label: 'Etapa' },
    { key: 'area',   label: 'Área' },
    { key: 'item',   label: 'Tipo de equipo' },
    { key: 'equipo', label: 'ID Equipo' },
  ];

  keys.forEach(({ key, label }) => {
    el.appendChild(
      renderFilterDropdown(key, label, options[key] || [], filters[key] || [], onChange)
    );
  });

  // Botón limpiar todo
  const clearAll = document.createElement('button');
  clearAll.className = 'flt-clear-all';
  clearAll.textContent = '✕ Limpiar filtros';
  clearAll.addEventListener('click', () => {
    DashboardStore.clearFilters();
  });
  el.appendChild(clearAll);

  return el;
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', () => {
  document.querySelectorAll('.flt-panel').forEach(p => { p.hidden = true; });
});

function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

window.renderFilterDropdown = renderFilterDropdown;
window.renderFiltersBar     = renderFiltersBar;