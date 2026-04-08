/**
 * DashboardPageComponent — Orquestador principal del dashboard tipo Power BI
 * Coordina: filtros, KPIs, gráficos, tabla de equipo
 */
const DashboardPageComponent = (() => {
  let _containerId = null;
  let _charts = {};
  let _unsubscribe = null;
  let _selectedEquipo = null;

  // ── Chart instance IDs ────────────────────────────────────
  const IDS = {
    statusBar:      'chart-status-bar',
    weekly:         'chart-weekly',
    stackedArea:    'chart-stacked-area',
    stackedSistema: 'chart-stacked-sistema',
    stackedItem:    'chart-stacked-item',
    stackedEquipo:  'chart-stacked-equipo',
  };

  function mount(containerId) {
    _containerId = containerId;
  }

  function onEnter() {
    const user = AuthService?.getUser?.() || {};
    const area = user.area || user.Area || user.Área || null;
    DashboardStore.setUserArea(area);

    _renderShell();
    _subscribeStore();
    DashboardStore.load();
  }

  // ── Render shell (estructura fija, los gráficos van dentro) ───────────────
  function _renderShell() {
    const el = document.getElementById(_containerId);
    if (!el) return;

    el.innerHTML = `
      <div class="dbp-root">
        <!-- Toolbar: filtros + recarga -->
        <div class="dbp-toolbar">
          <div id="dbp-filters-slot"></div>
          <button class="dbp-reload-btn" id="dbp-reload-btn" title="Recargar datos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Recargar
          </button>
        </div>

        <!-- Estado de carga -->
        <div class="dbp-state" id="dbp-state">
          <div class="dbp-spinner"></div>
          <span>Cargando datos…</span>
        </div>

        <!-- Contenido principal (oculto hasta que cargue) -->
        <div class="dbp-content hidden" id="dbp-content">

          <!-- Fila 1: KPI table + Bar estatus -->
          <div class="dbp-row dbp-row--halves">
            <div class="dbp-card">
              <div class="dbp-card-title">Estatus de Taller</div>
              <div id="dbp-kpi-table"></div>
            </div>
            <div class="dbp-card">
              <div class="dbp-card-title">Distribución por Estatus</div>
              <div id="${IDS.statusBar}" class="dbp-chart-md"></div>
            </div>
          </div>

          <!-- Fila 2: Avance semanal -->
          <div class="dbp-row dbp-row--full">
            <div class="dbp-card">
              <div class="dbp-card-title">Avance Semanal (últimas 5 semanas)
                <span class="dbp-card-sub">— — Objetivo</span>
              </div>
              <div id="${IDS.weekly}" class="dbp-chart-md"></div>
            </div>
          </div>

          <!-- Fila 3: Por área + Por sistema -->
          <div class="dbp-row dbp-row--halves">
            <div class="dbp-card">
              <div class="dbp-card-title">Estatus por Área</div>
              <div id="${IDS.stackedArea}" class="dbp-chart-lg"></div>
            </div>
            <div class="dbp-card">
              <div class="dbp-card-title">Estatus por Sistema</div>
              <div id="${IDS.stackedSistema}" class="dbp-chart-xl"></div>
            </div>
          </div>

          <!-- Fila 4: Por tipo de equipo (ITEM) + Por equipo -->
          <div class="dbp-row dbp-row--halves">
            <div class="dbp-card">
              <div class="dbp-card-title">Estatus por Tipo de Equipo</div>
              <div id="${IDS.stackedItem}" class="dbp-chart-xl"></div>
            </div>
            <div class="dbp-card">
              <div class="dbp-card-title">Estatus por Equipo</div>
              <div id="${IDS.stackedEquipo}" class="dbp-chart-xl"></div>
            </div>
          </div>

          <!-- Tabla de equipo (condicional) -->
          <div class="dbp-row dbp-row--full eq-table-section hidden" id="dbp-eq-section">
            <div class="dbp-card" id="dbp-eq-card"></div>
          </div>

        </div>
      </div>
    `;

    // Botón recarga
    document.getElementById('dbp-reload-btn').addEventListener('click', () => {
      _destroyCharts();
      DashboardStore.load(true);
    });
  }

  // ── Suscripción al store ─────────────────────────────────
  function _subscribeStore() {
    if (_unsubscribe) _unsubscribe();
    _unsubscribe = DashboardStore.subscribe((event, payload) => {
      if (event === 'loading') _showState('loading');
      if (event === 'error')   _showState('error');
      if (event === 'ready' || event === 'filtered') _render(payload);
    });
  }

  // ── Render completo con datos ────────────────────────────
  function _render({ oms, filters }) {
    _showState('content');

    // Filtros
    const options = DashboardStore.getOptions();
    _renderFilters(options, filters);

    // KPIs
    const kpis = DashboardStore.getKPIs(oms);
    const kpiEl = document.getElementById('dbp-kpi-table');
    if (kpiEl) { kpiEl.innerHTML = ''; kpiEl.appendChild(renderKPITable(kpis)); }

    // Destruir gráficos antes de re-renderizar
    _destroyCharts();

    // Bar estatus
    renderStatusBarChart(IDS.statusBar, kpis);

    // Avance semanal
    const weekly = DashboardStore.getWeeklyProgress(oms);
    renderWeeklyChart(IDS.weekly, weekly);

    // Apilados
    const byArea    = DashboardStore.getByDimension('Área', oms);
    const bySistema = DashboardStore.getByDimension('Sistema', oms);
    const byItem    = DashboardStore.getByDimension('ITEM', oms);
    const byEquipo  = DashboardStore.getByDimension('ID_#EQUIPO', oms);

    renderStackedBarChart(IDS.stackedArea,    byArea);
    renderStackedBarChart(IDS.stackedSistema, bySistema);
    renderStackedBarChart(IDS.stackedItem,    byItem);
    renderStackedBarChart(IDS.stackedEquipo,  byEquipo, _onEquipoBarClick);

    // Si hay filtro por equipo activo, mostrar tabla
    if (filters.equipo && filters.equipo.length === 1) {
      _showEquipoTable(filters.equipo[0], oms);
    } else if (_selectedEquipo && filters.equipo?.includes(_selectedEquipo)) {
      _showEquipoTable(_selectedEquipo, oms);
    } else {
      document.getElementById('dbp-eq-section')?.classList.add('hidden');
    }
  }

  // ── Filtros ──────────────────────────────────────────────
  function _renderFilters(options, active) {
    const slot = document.getElementById('dbp-filters-slot');
    if (!slot) return;
    slot.innerHTML = '';
    slot.appendChild(
      renderFiltersBar(options, active, (key, vals) => {
        DashboardStore.setFilter(key, vals);
      })
    );
  }

  // ── Tabla de equipo ──────────────────────────────────────
  function _onEquipoBarClick(equipoId) {
    _selectedEquipo = equipoId;
    const { oms } = DashboardStore.getFiltered();
    _showEquipoTable(equipoId, oms);
  }

  function _showEquipoTable(equipoId, oms) {
    const section = document.getElementById('dbp-eq-section');
    const card    = document.getElementById('dbp-eq-card');
    if (!section || !card) return;
    const rows = DashboardStore.getEquipoDetail(equipoId, oms);
    card.innerHTML = '';
    card.appendChild(renderEquipoTable(equipoId, rows));
    section.classList.remove('hidden');
    //section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── UI helpers ───────────────────────────────────────────
  function _showState(state) {
    const stateEl   = document.getElementById('dbp-state');
    const contentEl = document.getElementById('dbp-content');
    if (!stateEl || !contentEl) return;

    if (state === 'loading') {
      stateEl.innerHTML = `<div class="dbp-spinner"></div><span>Cargando datos…</span>`;
      stateEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
    } else if (state === 'error') {
      stateEl.innerHTML = `<span class="dbp-error-icon">⚠</span><span>Error al cargar datos. <button onclick="DashboardStore.load(true)" class="btn-link">Reintentar</button></span>`;
      stateEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
    } else {
      stateEl.classList.add('hidden');
      contentEl.classList.remove('hidden');
    }
  }

  function _destroyCharts() {
    Object.values(IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el && window.echarts) {
        const inst = echarts.getInstanceByDom(el);
        inst?.dispose();
      }
    });
    _charts = {};
  }

  function onLeave() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _destroyCharts();
  }

  return { mount, onEnter, onLeave };
})();

window.DashboardPageComponent = DashboardPageComponent;