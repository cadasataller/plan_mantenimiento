// ============================================================
// CADASA TALLER — AUTH SERVICE v2
// Autenticación con Google OAuth2 (initTokenClient)
// Un solo flujo: Access Token + datos de usuario via /userinfo
// ============================================================
const AUTH_CONFIG = {
  CLIENT_ID:   '607252823419-qrsktr92hff3k3kjmm82t5st3aavhso6.apps.googleusercontent.com',
   SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file email profile openid',
  STORAGE_KEY: 'cadasa_taller_user',  // irá a localStorage
  TOKEN_KEY:   'cadasa_taller_token', // irá a sessionStorage
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

let _tokenClientReady = false;
let _tokenReadyCallbacks = [];

function onTokenReady(fn) {
  if (_tokenClientReady) {
    fn(); // ya está listo, ejecutar inmediatamente
  } else {
    _tokenReadyCallbacks.push(fn); // encolar para cuando llegue
  }
}

// ── Token client ─────────────────────────────────────────────
let _tokenClient = null;

// ── Init ─────────────────────────────────────────────────────
  function initAuth() {
    if (typeof google === 'undefined') { return; }

    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: AUTH_CONFIG.CLIENT_ID,
      scope:     AUTH_CONFIG.SCOPES,
      callback:  handleTokenResponse,
    });

    console.log('[Auth] Token client inicializado.');

    // Si hay usuario guardado pero no hay token activo → renovar silenciosamente
    const savedUser = AuthState.getUser();
    const savedToken = sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);

    if (savedUser && !savedToken) {
      console.log('[Auth] Usuario en caché, renovando token silenciosamente...');
      _tokenClientReady = false;
      _tokenClient.requestAccessToken({ prompt: '' });
    } else if (savedUser && savedToken) {
      _tokenClientReady = true;
    }
  }

// ── Callback tras obtener el Access Token ────────────────────
async function handleTokenResponse(response) {
  if (response.error) {
    console.error('[Auth] Error OAuth:', response.error);
    ToastService?.show('Error al iniciar sesión. Intenta de nuevo.', 'danger');
    // Quitar spinner del login si estaba activo
    _setLoginLoading(false);
    return;
  }

  const accessToken = response.access_token;
  sessionStorage.setItem(AUTH_CONFIG.TOKEN_KEY, accessToken);
  console.log('[Auth] Access Token obtenido.');

  // ← AGREGAR ESTO:
  _tokenClientReady = true;
  _tokenReadyCallbacks.forEach(fn => fn());
  _tokenReadyCallbacks = [];
  try {
    // Obtener datos del usuario desde la API de Google
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
    Router?.navigate('dashboard');

  } catch (err) {
    console.error('[Auth] Error obteniendo datos del usuario:', err);
    ToastService?.show('No se pudieron obtener los datos del usuario.', 'danger');
    _setLoginLoading(false);
  }
}

// ── Iniciar sesión ───────────────────────────────────────────
function signIn() {
  if (!_tokenClient) {
    // Si el script de Google aún no cargó, esperar e intentar de nuevo
    if (typeof google !== 'undefined') {
      initAuth();
    } else {
      ToastService?.show('Servicio de Google no disponible.', 'warning');
      return;
    }
  }
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
  onTokenReady,    // ← agregar
  subscribe:       (fn) => AuthState.subscribe(fn),
};