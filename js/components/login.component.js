// ============================================================
// CADASA TALLER — LOGIN COMPONENT
// Renderiza y controla la pantalla de inicio de sesión
// ============================================================

const LoginComponent = (() => {
  const MODULES = [
    'Autenticación',
    'Órdenes de Trabajo',
    'Agrupación / Jerarquía',
    'Listado y Filtros',
    'Gestión de OT',
    'Lógica y Avances',
    'Dashboard',
  ];

  /** Inyectar HTML en el contenedor */
  function mount(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
      <!-- ── Panel izquierdo: Branding ── -->
      <div class="login-brand">
        <div class="brand-top">
          <div class="brand-logo-wrap">
            <div class="brand-icon">
              ${Icons.gear()}
            </div>
            <div>
              <div class="brand-name">CADASA</div>
              <div class="brand-division">Sistema de Taller</div>
            </div>
          </div>

          <h1 class="brand-headline">
            Control<br>Total del<br><span>Taller</span>
          </h1>

          <p class="brand-desc">
            Plataforma integral de gestión de mantenimiento para equipos
            industriales. Trazabilidad completa de órdenes de trabajo,
            avances y recursos.
          </p>
        </div>

        <div class="brand-modules">
          ${MODULES.map(m => `<span class="brand-module-tag">${m}</span>`).join('')}
        </div>

        <div class="brand-footer">
          &copy; ${new Date().getFullYear()} CADASA &mdash; Compañía Azucarera
        </div>
      </div>

      <!-- ── Panel derecho: Formulario ── -->
      <div class="login-form-panel">
        <div class="login-card" id="login-card">

          <div class="login-card-header">
            <div class="login-greeting">Bienvenido</div>
            <h2 class="login-title">Iniciar Sesión</h2>
            <p class="login-subtitle">Accede con tu cuenta corporativa de Google</p>
          </div>

          <div class="login-divider">
            <span>Acceso Seguro</span>
          </div>

          <!-- Botón propio que abre el popup de Google -->
          <button class="btn-google" id="btn-google-signin" onclick="LoginComponent.handleSignIn()">
            ${Icons.googleLogo()}
            <span>Continuar con Google</span>
          </button>

          <!-- Contenedor oculto para el botón nativo de Google (fallback) -->
          <div id="google-btn-container" style="display:none; margin-top:0.75rem; justify-content:center;"></div>

          <div class="login-access-info">
            <strong>Acceso restringido</strong>
            Solo personal autorizado de CADASA. Utiliza tu cuenta
            <em>@cadasa.com</em> o la cuenta corporativa asignada.
          </div>

          <!-- Overlay de carga -->
          <div class="login-loading" id="login-loading">
            <div class="spinner"></div>
            <span class="login-loading-text">Verificando credenciales…</span>
          </div>

        </div>
      </div>
    `;
  }

  /** Maneja clic en el botón de Google */
  function handleSignIn() {
    setLoading(true);

    // Pequeño delay para mostrar el spinner antes del popup
    setTimeout(() => {
      AuthService.signIn();
      // Quitar spinner si el popup tarda (se quitará en el callback si falla)
      setTimeout(() => setLoading(false), 8000);
    }, 300);
  }

  function setLoading(active) {
    const overlay = document.getElementById('login-loading');
    const btn     = document.getElementById('btn-google-signin');
    if (overlay) overlay.classList.toggle('active', active);
    if (btn)     btn.disabled = active;
  }

  /** Llamado al entrar a la vista */
  function onEnter() {
    setLoading(false);
    if (typeof google !== 'undefined') {
      AuthService.init();
    } else {
      window.addEventListener('google-ready', () => {
        AuthService.init();
      }, { once: true });
    }
  }
  return { mount, onEnter, handleSignIn };
})();

window.LoginComponent = LoginComponent;
