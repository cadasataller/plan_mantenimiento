// ============================================================
// CADASA TALLER — LOGIN COMPONENT (Supabase)
// Mismo branding y estructura. Solo cambia el formulario:
// email + password en lugar del botón de Google.
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
            <p class="login-subtitle">Accede con tu cuenta corporativa</p>
          </div>

          <div class="login-divider">
            <span>Acceso Seguro</span>
          </div>

          <!-- Campo email -->
          <div class="login-field">
            <label class="login-label" for="login-email">Nombre de usuario</label>
            <input
              class="login-input"
              id="login-email"
              type="text"
              placeholder="Escribe tu nombre de usuario"
              autocomplete="username"
              onkeydown="LoginComponent._onKeyDown(event)"
              onblur="LoginComponent._formatEmail()"
            />
          </div>

          <!-- Campo password -->
          <div class="login-field">
            <label class="login-label" for="login-password">Contraseña</label>
            <div class="login-input-wrap">
              <input
                class="login-input"
                id="login-password"
                type="password"
                placeholder="••••••••"
                autocomplete="current-password"
                onkeydown="LoginComponent._onKeyDown(event)"
              />
              <button
                class="btn-toggle-password"
                id="btn-toggle-pass"
                type="button"
                tabindex="-1"
                onclick="LoginComponent._togglePassword()"
                aria-label="Mostrar/ocultar contraseña">
                <svg id="icon-eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg id="icon-eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="display:none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Mensaje de error -->
          <div class="login-error" id="login-error" style="display:none"></div>

          <!-- Botón de ingreso -->
          <button class="btn-google" id="btn-google-signin" onclick="LoginComponent.handleSignIn()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>Ingresar al Sistema</span>
          </button>

          <div class="login-access-info">
            <strong>Acceso restringido</strong>
            Solo personal autorizado de CADASA. Escribe únicamente tu nombre de usuario
            (se agregará automáticamente <em>@cadasa.com</em>).
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

  /** Enter en cualquier campo dispara el login */
  function _onKeyDown(e) {
    if (e.key === 'Enter') handleSignIn();
  }

  /** Formatea el email agregando @cadasa.com si no lo tiene */
  function _formatEmail() {
    const emailEl = document.getElementById('login-email');
    if (!emailEl) return;
    
    let value = emailEl.value.trim();
    if (value && !value.includes('@')) {
      emailEl.value = value + '@cadasa.com';
    }
  }

  /** Mostrar / ocultar contraseña */
  function _togglePassword() {
    const input = document.getElementById('login-password');
    const show  = document.getElementById('icon-eye-show');
    const hide  = document.getElementById('icon-eye-hide');
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type  = isPassword ? 'text' : 'password';
    if (show) show.style.display = isPassword ? 'none'  : '';
    if (hide) hide.style.display = isPassword ? ''      : 'none';
  }

  /** Maneja clic en el botón de ingreso */
  async function handleSignIn() {
    const emailEl = document.getElementById('login-email');
    const passEl  = document.getElementById('login-password');
    const errEl   = document.getElementById('login-error');

    let email    = emailEl?.value.trim()  ?? '';
    const password = passEl?.value.trim()   ?? '';

    // Formatear email si no tiene @cadasa.com
    if (email && !email.includes('@')) {
      email = email + '@cadasa.com';
      // Actualizar el campo también
      if (emailEl) emailEl.value = email;
    }

    // Validación básica en cliente
    if (!email || !password) {
      _showError('Por favor ingresa tu nombre de usuario y contraseña.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      _showError('El nombre de usuario no tiene un formato válido.');
      return;
    }

    _hideError();
    // AuthService.signIn maneja el loading, el toast y la navegación
    await AuthService.signIn(email, password);
  }

  function _showError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent  = msg;
    el.style.display = 'block';
  }

  function _hideError() {
    const el = document.getElementById('login-error');
    if (el) el.style.display = 'none';
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
    _hideError();
    // Enfocar el campo email automáticamente
    setTimeout(() => document.getElementById('login-email')?.focus(), 100);
  }

  return { mount, onEnter, handleSignIn, _onKeyDown, _togglePassword, _formatEmail };
})();

window.LoginComponent = LoginComponent;