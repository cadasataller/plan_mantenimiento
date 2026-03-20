// ============================================================
// CADASA TALLER — DASHBOARD COMPONENT (v2)
// Incluye tabs: Dashboard / Órdenes de Trabajo / Horas Asignadas
// ============================================================

const DashboardComponent = (() => {

  let _activeTab = 'ordenes'; // default

  const TABS = [
    {
      id:    'dashboard',
      label: 'Dashboard',
      icon:  () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    },
    {
      id:    'ordenes',
      label: 'Órdenes de Trabajo',
      icon:  () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      badge: () => { try { const k = OTStore.getKPIs(); return k.total > 0 ? k.total : null; } catch(_){return null;} },
    },
    {
      id:    'horas',
      label: 'Horas Asignadas',
      icon:  () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    },
  ];

  // ── MOUNT ────────────────────────────────────────────────
  function mount(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
      <nav class="topbar" id="topbar">
        <a class="topbar-logo" href="#dashboard">
          <div class="topbar-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </div>
          <div class="topbar-brand">
            <span class="topbar-name">CADASA</span>
            <span class="topbar-section">Taller</span>
          </div>
        </a>
        <div class="topbar-divider"></div>
        <div class="topbar-user" id="topbar-user"></div>
      </nav>

      <div class="dash-tabs" id="dash-tabs">
        ${TABS.map(tab => `
          <div class="dash-tab ${tab.id === _activeTab ? 'active' : ''}"
               data-tab="${tab.id}"
               onclick="DashboardComponent._switchTab('${tab.id}')">
            ${tab.icon()}
            ${tab.label}
            <span class="dash-tab-badge" id="tab-badge-${tab.id}" style="display:none"></span>
          </div>`).join('')}
      </div>

      <div style="flex:1;overflow-y:auto;" id="dash-tab-content">

        <div class="tab-panel ${_activeTab==='dashboard'?'active':''}" id="tab-panel-dashboard">
          <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;color:var(--text-muted);flex-direction:column;gap:1rem;padding:3rem;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:0.25">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <p style="font-size:0.95rem;font-weight:500;">Dashboard de Avances</p>
            <p style="font-size:0.8rem;opacity:0.6;">Módulo en desarrollo — Próximamente</p>
          </div>
        </div>

        <div class="tab-panel ${_activeTab==='ordenes'?'active':''}" id="tab-panel-ordenes">
          <div id="ot-module-container"></div>
        </div>

        <div class="tab-panel ${_activeTab==='horas'?'active':''}" id="tab-panel-horas">
          <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;color:var(--text-muted);flex-direction:column;gap:1rem;padding:3rem;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:0.25">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <p style="font-size:0.95rem;font-weight:500;">Horas Asignadas</p>
            <p style="font-size:0.8rem;opacity:0.6;">Módulo en desarrollo — Próximamente</p>
          </div>
        </div>

      </div>
    `;

    OTComponent.mount('ot-module-container');
  }

  function _switchTab(tabId) {
    if (_activeTab === tabId) return;
    _activeTab = tabId;
    document.querySelectorAll('.dash-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach(el =>
      el.classList.toggle('active', el.id === `tab-panel-${tabId}`));
    if (tabId === 'ordenes') {
      OTComponent.onEnter();
      setTimeout(updateTabBadges, 800);
    }
  }

  function updateTabBadges() {
    TABS.forEach(tab => {
      if (typeof tab.badge !== 'function') return;
      const badge = document.getElementById(`tab-badge-${tab.id}`);
      if (!badge) return;
      const val = tab.badge();
      if (val) { badge.textContent = val; badge.style.display = 'inline'; }
      else      { badge.style.display = 'none'; }
    });
  }

  function onEnter() {
    const user = AuthService.getUser();
    if (!user) { Router.navigate('login'); return; }
    renderTopbarUser(user);
    if (_activeTab === 'ordenes') OTComponent.onEnter();
    setTimeout(updateTabBadges, 1200);
  }

  function renderTopbarUser(user) {
    const container = document.getElementById('topbar-user');
    if (!container) return;
 
    // role y area vienen directamente desde la tabla PROFILE via _buildUser
    const isAdmin   = user.role === 'admin';
    const roleLabel = isAdmin ? 'Administrador' : `Taller · ${user.area ?? 'Sin área'}`;
    const initials  = (user.name || '').trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
    const avatar    = user.picture
      ? `<img class="topbar-avatar" src="${user.picture}" alt="${user.name}" referrerpolicy="no-referrer">`
      : `<div class="topbar-avatar-placeholder">${initials}</div>`;
 
    container.innerHTML = `
      <div class="topbar-user-info">
        <span class="topbar-user-name">${user.givenName ?? user.name}</span>
        <span class="topbar-user-role">${roleLabel}</span>
      </div>
      ${avatar}
      <div class="topbar-divider"></div>
      <button class="btn-logout" onclick="AuthService.signOut()">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Salir
      </button>`;
  }

  return { mount, onEnter, _switchTab };
})();

window.DashboardComponent = DashboardComponent;
