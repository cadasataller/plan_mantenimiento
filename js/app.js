// ============================================================
// CADASA TALLER — APP ENTRY POINT
// Inicializa toda la aplicación y conecta servicios
// ============================================================

(function initApp() {
  // ── 1. Montar componentes en sus contenedores ──
  LoginComponent.mount('page-login');
  DashboardComponent.mount('page-dashboard');

  // ── 2. Registrar rutas ──
  Router.register('login', {
    el:           document.getElementById('page-login'),
    onEnter:      () => LoginComponent.onEnter(),
    requiresAuth: false
  });

  Router.register('dashboard', {
    el:           document.getElementById('page-dashboard'),
    onEnter:      () => DashboardComponent.onEnter(),
    requiresAuth: true
  });

  // ── 3. Inicializar Auth cuando Google cargue ──
  // OAuth2 (initTokenClient) no necesita onGoogleLibraryLoad,
  // solo que el script de GSI haya cargado antes del clic del usuario.
  function tryInitAuth() {
    if (typeof google !== 'undefined') {
      AuthService.init();
    } else {
      // El script GSI aún no cargó — reintentar en 300ms
      setTimeout(tryInitAuth, 300);
    }
  }

  // ── 4. Quitar loader inicial ──
  window.addEventListener('load', () => {
    const loader = document.getElementById('app-loader');
    if (loader) {
      setTimeout(() => loader.classList.add('fade-out'), 600);
    }

    // ── 5. Inicializar router (detecta sesión activa) ──
    Router.init();
  });
})();
