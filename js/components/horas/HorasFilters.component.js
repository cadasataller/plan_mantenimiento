/**
 * HorasFilters.component.js
 * Barra de controles: buscador por mecánico + selector de agrupación.
 * Emite callbacks onChange. No tiene lógica de datos.
 *
 * Uso:
 *   HorasFilters.mount('container-id', { groupBy, search, isAdmin, onChange });
 */
const HorasFilters = (() => {

  const GROUP_OPTIONS_NORMAL = [
    { value: 'semana',  label: 'Semana'  },
    { value: 'estatus', label: 'Estatus' },
    { value: 'dia',     label: 'Día'     },
  ];

  const GROUP_OPTIONS_ADMIN = [
    { value: 'semana',  label: 'Semana'  },
    { value: 'estatus', label: 'Estatus' },
    { value: 'area',    label: 'Área'    },
    { value: 'dia',     label: 'Día'     },
  ];

  // ─── Internal state por instancia (singleton por simplicidad) ───
  let _containerId = null;
  let _opts = {};
  let _debounceTimer = null;

  function mount(containerId, opts = {}) {
    _containerId = containerId;
    _opts = {
      groupBy:  opts.groupBy  || 'semana',
      search:   opts.search   || '',
      isAdmin:  opts.isAdmin  || false,
      onChange: opts.onChange || (() => {}),
    };
    _render();
  }

  function _render() {
    const el = document.getElementById(_containerId);
    if (!el) return;

    const groups = _opts.isAdmin ? GROUP_OPTIONS_ADMIN : GROUP_OPTIONS_NORMAL;

    el.innerHTML = `
      <div class="hf-root">
        <div class="hf-search-wrap">
          <svg class="hf-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="hf-search"
            class="hf-search"
            type="text"
            placeholder="Buscar mecánico…"
            value="${_escHtml(_opts.search)}"
            autocomplete="off"
          />
          ${_opts.search ? `<button class="hf-clear" id="hf-clear" title="Limpiar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
        </div>

        <div class="hf-group-row">
          <span class="hf-group-label">Agrupar por</span>
          <div class="hf-group-pills">
            ${groups.map(g => `
              <button
                class="hf-pill ${_opts.groupBy === g.value ? 'active' : ''}"
                data-group="${g.value}"
              >${g.label}</button>
            `).join('')}
          </div>
        </div>
        <button class="hp-refresh-btn" id="hp-refresh" title="Actualizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Actualizar
        </button>
      </div>
    `;

    // Eventos
    const searchEl = document.getElementById('hf-search');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          _opts.search = e.target.value;
          _opts.onChange({ groupBy: _opts.groupBy, search: _opts.search });
          _render();
        }, 280);
      });
    }

    const clearEl = document.getElementById('hf-clear');
    if (clearEl) {
      clearEl.addEventListener('click', () => {
        _opts.search = '';
        _opts.onChange({ groupBy: _opts.groupBy, search: '' });
        _render();
      });
    }

    el.querySelectorAll('.hf-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _opts.groupBy = btn.dataset.group;
        _opts.onChange({ groupBy: _opts.groupBy, search: _opts.search });
        _render();
      });
    });
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setGroupBy(v) { _opts.groupBy = v; _render(); }
  function setSearch(v)  { _opts.search  = v; _render(); }

  return { mount, setGroupBy, setSearch };
})();

window.HorasFilters = HorasFilters;