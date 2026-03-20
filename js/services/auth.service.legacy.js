// ============================================================
// CADASA TALLER — AUTH SERVICE v2
// Autenticación con Google OAuth2 (initTokenClient)
// Un solo flujo: Access Token + datos de usuario via /userinfo
// ============================================================
const AUTH_CONFIG = {
  CLIENT_ID:   '607252823419-qrsktr92hff3k3kjmm82t5st3aavhso6.apps.googleusercontent.com',
  SCOPES:      'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file email profile openid',
  STORAGE_KEY: 'cadasa_taller_user',
  TOKEN_KEY:   'cadasa_taller_token',
};

// ── Estado interno ───────────────────────────────────────────
const AuthState = {
  user:      null,
  listeners: [],

  setUser(userData) {
    this.user = userData;
    if (userData) {
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEY);
      sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    }
    this.notify();
  },

  getUser() {
    if (this.user) return this.user;
    try {
      const stored = localStorage.getItem(AUTH_CONFIG.STORAGE_KEY);
      if (stored) { this.user = JSON.parse(stored); return this.user; }
    } catch (_) {}
    return null;
  },

  isAuthenticated() { return this.getUser() !== null; },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  },

  notify() { this.listeners.forEach(fn => fn(this.user)); },
};

// ── Token client ─────────────────────────────────────────────
let _tokenClient      = null;
let _tokenClientReady = false;
let _tokenReadyCallbacks = [];

// ── onTokenReady ─────────────────────────────────────────────
function onTokenReady(fn) {
  // Ya listo y hay token en esta pestaña → ejecutar directo
  if (_tokenClientReady && sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY)) {
    fn();
    return;
  }

  // Ya listo pero sin usuario (modo demo) → ejecutar directo
  if (_tokenClientReady && !AuthState.getUser()) {
    fn();
    return;
  }

  let called = false;

  // Timeout de seguridad: 15s → caer al mock si Google no responde
  const timer = setTimeout(() => {
    if (!called) {
      called = true;
      console.warn('[Auth] ⚠ Timeout 15s — continuando sin token (modo demo)');
      fn();
    }
  }, 15000);

  _tokenReadyCallbacks.push(() => {
    if (!called) {
      called = true;
      clearTimeout(timer);
      fn();
    }
  });
}

// ── Init ─────────────────────────────────────────────────────
function initAuth() {
  if (typeof google === 'undefined') {
    console.warn('[Auth] Google SDK no disponible');
    return;
  }

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: AUTH_CONFIG.CLIENT_ID,
    scope:     AUTH_CONFIG.SCOPES,
    callback:  handleTokenResponse,
  });

  console.log('[Auth] Token client inicializado.');

  const savedUser  = AuthState.getUser();
  const savedToken = sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);

  if (savedUser && savedToken) {
    // Misma pestaña con token activo → listo inmediatamente
    console.log('[Auth] Token en sessionStorage — listo.');
    _tokenClientReady = true;
    _tokenReadyCallbacks.forEach(fn => fn());
    _tokenReadyCallbacks = [];

  } else if (savedUser && !savedToken) {
    // Nueva pestaña o token perdido → renovar silenciosamente sin popup
    console.log('[Auth] Usuario sin token — renovando silenciosamente...');
    _tokenClientReady = false;
    _tokenClient.requestAccessToken({ prompt: '' });

  } else {
    // Sin usuario → modo demo, no bloquear
    console.log('[Auth] Sin usuario — modo demo.');
    _tokenClientReady = true;
    _tokenReadyCallbacks.forEach(fn => fn());
    _tokenReadyCallbacks = [];
  }

  // Avisar a app.js que initAuth corrió
  window._onAuthReady?.();
}

// ── Callback tras obtener el Access Token ────────────────────
async function handleTokenResponse(response) {
  if (response.error) {
    console.error('[Auth] Error OAuth:', response.error);

    // Si falló la renovación silenciosa, liberar callbacks para no bloquear
    if (!_tokenClientReady) {
      console.warn('[Auth] Renovación silenciosa falló — continuando sin token');
      _tokenClientReady = true;
      _tokenReadyCallbacks.forEach(fn => fn());
      _tokenReadyCallbacks = [];
    }

    ToastService?.show('Error al iniciar sesión. Intenta de nuevo.', 'danger');
    _setLoginLoading(false);
    return;
  }

  const accessToken = response.access_token;
  sessionStorage.setItem(AUTH_CONFIG.TOKEN_KEY, accessToken);
  console.log('[Auth] Access Token obtenido.');

  // Notificar a todos los que esperaban el token
  _tokenClientReady = true;
  _tokenReadyCallbacks.forEach(fn => fn());
  _tokenReadyCallbacks = [];

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const info = await res.json();

    const user = {
      id:         info.sub,
      name:       info.name,
      email:      info.email,
      picture:    info.picture,
      givenName:  info.given_name,
      familyName: info.family_name,
      loginAt:    new Date().toISOString(),
    };

    AuthState.setUser(user);

    // Solo navegar al dashboard si fue un login manual (no renovación silenciosa)
    const currentRoute = Router?.current?.();
    if (currentRoute === 'login' || !currentRoute) {
      Router?.navigate('dashboard');
    }

  } catch (err) {
    console.error('[Auth] Error obteniendo datos del usuario:', err);
    ToastService?.show('No se pudieron obtener los datos del usuario.', 'danger');
    _setLoginLoading(false);
  }
}

// ── Iniciar sesión manual ────────────────────────────────────
function signIn() {
  if (!_tokenClient) {
    if (typeof google !== 'undefined') {
      initAuth();
    } else {
      ToastService?.show('Servicio de Google no disponible.', 'warning');
      return;
    }
  }
  _setLoginLoading(true);
  _tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ── Cerrar sesión ─────────────────────────────────────────────
function signOut() {
  const token = sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  if (token && typeof google !== 'undefined') {
    google.accounts.oauth2.revoke(token, () => {
      console.log('[Auth] Token revocado.');
    });
  }
  AuthState.setUser(null);
  Router?.navigate('login');
  ToastService?.show('Sesión cerrada correctamente.', 'success');
}

// ── Access Token para Sheets ──────────────────────────────────
function getAccessToken() {
  return sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
}

// ── Helper interno para controlar spinner del login ──────────
function _setLoginLoading(active) {
  const overlay = document.getElementById('login-loading');
  const btn     = document.getElementById('btn-google-signin');
  if (overlay) overlay.classList.toggle('active', active);
  if (btn)     btn.disabled = active;
}

// ── Exportar API pública ──────────────────────────────────────
window.AuthService = {
  init:            initAuth,
  signIn,
  signOut,
  getUser:         () => AuthState.getUser(),
  isAuthenticated: () => AuthState.isAuthenticated(),
  getAccessToken,
  onTokenReady,
  subscribe:       (fn) => AuthState.subscribe(fn),
};