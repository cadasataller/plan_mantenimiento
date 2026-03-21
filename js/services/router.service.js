// ============================================================
// CADASA TALLER — ROUTER SERVICE
// Navegación SPA entre vistas (login, dashboard, etc.)
// ============================================================

const Router = (() => {
  const routes = {};
  let currentRoute = null;

  /** Registrar una ruta: nombre → { el, onEnter, onLeave, requiresAuth } */
  function register(name, config) {
    routes[name] = config;
  }

  /** Navegar a una ruta */
  function navigate(name, params = {}) {
    const route = routes[name];
    if (!route) {
      console.warn(`[Router] Ruta desconocida: "${name}"`);
      return;
    }

    // Guard: ruta protegida sin sesión → ir al login
    if (route.requiresAuth && !AuthService?.isAuthenticated()) {
      if (name !== 'login') navigate('login');  // ← corregido: era 'dashboard'
      return;
    }

    // Guard: ya autenticado e intenta ir al login → ir al dashboard
    if (name === 'login' && AuthService?.isAuthenticated()) {
      navigate('dashboard');
      return;
    }

    // Ocultar vista actual
    if (currentRoute && routes[currentRoute]) {
      const prev = routes[currentRoute];
      prev.el?.classList.remove('active');
      prev.onLeave?.();
    }

    // Mostrar nueva vista
    currentRoute = name;
    route.el?.classList.add('active');
    route.onEnter?.(params);

    // Actualizar hash sin recargar
    history.replaceState({ route: name }, '', `#${name}`);
  }

  /** Inicializar: leer hash o redirigir según estado */
  function init() {
    console.log("INIT ROUTER");
    
    const hash = location.hash.replace('#', '') || 'login';
    navigate(hash);
  }

  return { register, navigate, init, current: () => currentRoute };
})();

window.Router = Router;