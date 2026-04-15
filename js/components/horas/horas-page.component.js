/**
 * HorasPage.component.js
 * Orquestador del módulo "Horas Asignadas".
 * Conecta: HorasStore → HorasFilters → HorasTable → HorasGroup.
 *
 * Registro en dashboard:
 *   HorasPageComponent.mount('tab-panel-container-id');
 *   HorasPageComponent.onEnter();
 */
const HorasPageComponent = (() => {

  // ─── Estado interno ──────────────────────────────────────
  let _containerId  = null;
  let _rendered     = false;
  let _loading      = false;

  let _state = {
    groupBy: 'dia',
    search:  '',
    rawData: [],  // filas normalizadas de HorasStore
  };

  // ─── IDs de sub-contenedores ─────────────────────────────
  const IDS = {
    filters: 'hp-filters',
    table:   'hp-table',
  };

  // ─── Helpers de usuario ──────────────────────────────────
  function _getUser()    { return (window.AuthService && AuthService.getUser()) || null; }
  function _isAdmin(u)   { return u && (u.role === 'ADMIN' || u.area === 'ALL'); }
  function _userArea(u)  { return u ? (u.area || u.Area || u.Área || '') : ''; }
  function _isSG(u)      { return String(_userArea(u)).trim().toUpperCase() === 'SERVICIOS GENERALES'; }

  // ─── Lifecycle ───────────────────────────────────────────
  function mount(containerId) {
    _containerId = containerId;
    _rendered    = false;
  }

  function onEnter() {
    if (!_containerId) return;
    const user = _getUser();
    if (!user) return;

    if (!_rendered) _buildShell(user);

    // Montar sub-componentes si aún no están vivos
    HorasFilters.mount(IDS.filters, {
      groupBy:  _state.groupBy,
      search:   _state.search,
      isAdmin:  _isAdmin(user),
      onChange: _onFiltersChange,
    });

    HorasTable.mount(IDS.table);

    // Fetch de datos
    _fetchAndRender(user);
  }

  // ─── Shell del módulo (se crea una sola vez) ─────────────
  function _buildShell(user) {
    const el = document.getElementById(_containerId);
    if (!el) return;

    const area  = _userArea(user);
    const admin = _isAdmin(user);

    el.innerHTML = `
      <div class="hp-root">

        <div id="${IDS.filters}" class="hp-filters-wrap"></div>
        <div id="${IDS.table}"   class="hp-table-wrap"></div>
      </div>
    `;

    document.getElementById('hp-refresh')?.addEventListener('click', () => {
      HorasStore.invalidate();
      _fetchAndRender(_getUser());
    });

    _rendered = true;
  }

  // ─── Fetch + render ──────────────────────────────────────
  async function _fetchAndRender(user) {
    if (_loading) return;
    _loading = true;

    const area = _isSG(user) ? 'SERVICIOS GENERALES' : _isAdmin(user) ? 'ALL' : _userArea(user);

    HorasTable.showLoading();

    try {
      const raw = await HorasStore.fetchAll(area);
      _state.rawData = raw;
    } catch (e) {
      console.error('[HorasPage] fetch error', e);
    } finally {
      _loading = false;
    }

    _renderTable();
  }

  function _renderTable() {
    const user   = _getUser();
    const admin  = _isAdmin(user);

    // Aplicar búsqueda
    const filtered = HorasStore.filterByMecanico(_state.rawData, _state.search);

    // Agrupar
    const groups = HorasStore.group(filtered, _state.groupBy, admin);

    // Totales globales sobre filtrado
    const totalHoras   = filtered.reduce((s, r) => s + r.horas,   0);
    const totalRetraso = filtered.reduce((s, r) => s + r.retraso, 0);
    const totalAusencia = filtered.reduce((s, r) => s + (r.estatus === 'Ausencia' ? r.horas : 0), 0);
    const totalCompletadas = filtered.reduce((s, r) => s + ((r.estatus === 'Concluida' || r.estatus === 'Concluido') ? r.horas : 0), 0);

    HorasTable.render(groups, {
      isAdmin:      admin,
      groupBy:      _state.groupBy,
      loading:      false,
      totalHoras,
      totalRetraso,
      totalAusencia,
      totalCompletadas,
      totalRows:    filtered.length,
    });
  }

  // ─── Callbacks ───────────────────────────────────────────
  function _onFiltersChange({ groupBy, search }) {
    _state.groupBy = groupBy;
    _state.search  = search;
    _renderTable();
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { mount, onEnter };
})();

window.HorasPageComponent = HorasPageComponent;