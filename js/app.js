/// ============================================================
// CADASA TALLER — APP ENTRY POINT
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

  // ── 4. Arrancar cuando Google SDK esté listo ──
  function startApp() {
    AuthService.init();  // ← ahora Google sí existe, requestAccessToken funciona
    Router.init();       // ← detecta sesión y navega
  }

  if (typeof google !== 'undefined') {
    // SDK ya cargó (raro pero posible si el script estaba cacheado)
    startApp();
  } else {
    // Esperar el evento que dispara onload del script GSI en el index.html
    window.addEventListener('google-ready', startApp, { once: true });
  }

})();