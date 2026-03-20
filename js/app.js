// ============================================================
// CADASA TALLER — APP ENTRY POINT (Supabase)
// ============================================================

(function initApp() {

  // ── 1. Montar componentes ──
  LoginComponent.mount('page-login');
  DashboardComponent.mount('page-dashboard');

  // ── 2. Registrar rutas ──
  Router.register('login', {
    el:           document.getElementById('page-login'),
    onEnter:      () => LoginComponent.onEnter(),
    requiresAuth: false,
  });

  Router.register('dashboard', {
    el:           document.getElementById('page-dashboard'),
    onEnter:      () => DashboardComponent.onEnter(),
    requiresAuth: true,
  });

  // ── 3. Quitar loader inicial ──
  window.addEventListener('load', () => {
    const loader = document.getElementById('app-loader');
    if (loader) {
      setTimeout(() => loader.classList.add('fade-out'), 600);
    }
  });

  // ── 4. Arrancar: AuthService.init() llama a _onAuthReady
  //    cuando getSession() ya resolvió, y solo ahí iniciamos
  //    el router — así isAuthenticated() ya tiene el valor correcto.
  window._onAuthReady = function () {
    const hash  = location.hash.replace('#', '');
    // Si el usuario abrió directo #dashboard pero no hay sesión,
    // el guard del router lo manda al login correctamente.
    Router.init();
  };

  // Iniciar auth (getSession es async; llama _onAuthReady al terminar)
  AuthService.init();

})();