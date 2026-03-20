// ============================================================
// CADASA TALLER — AUTH SERVICE
// Maneja autenticación con Google OAuth 2.0
// ============================================================

const AUTH_CONFIG = {
  CLIENT_ID: '607252823419-qrsktr92hff3k3kjmm82t5st3aavhso6.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file email profile openid',
  STORAGE_KEY: 'cadasa_taller_user',
};

let googleClient = null;
let tokenClient = null;
let accessToken = null;

/** Estado reactivo del usuario */
const AuthState = {
  user: null,
  accessToken: null,
  listeners: [],

  setUser(userData) {
    this.user = userData;
    if (userData) {
      sessionStorage.setItem(AUTH_CONFIG.STORAGE_KEY, JSON.stringify(userData));
    } else {
      sessionStorage.removeItem(AUTH_CONFIG.STORAGE_KEY);
      this.setAccessToken(null);
    }
    this.notify();
  },

  setAccessToken(token) {
    this.accessToken = token;
    if (token) {
      sessionStorage.setItem(AUTH_CONFIG.STORAGE_KEY + '_token', token);
    } else {
      sessionStorage.removeItem(AUTH_CONFIG.STORAGE_KEY + '_token');
    }
  },

  getAccessToken() {
    if (this.accessToken) return this.accessToken;
    return sessionStorage.getItem(AUTH_CONFIG.STORAGE_KEY + '_token');
  },

  getUser() {
    if (this.user) return this.user;
    try {
      const stored = sessionStorage.getItem(AUTH_CONFIG.STORAGE_KEY);
      if (stored) {
        this.user = JSON.parse(stored);
        return this.user;
      }
    } catch (_) { /* */ }
    return null;
  },

  isAuthenticated() {
    return this.getUser() !== null;
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  },

  notify() {
    this.listeners.forEach(fn => fn(this.user));
  },
};

/** Inicializar Google Identity Services */
function initGoogleAuth(onReady) {
  if (typeof google === 'undefined') {
    console.error('[Auth] Google GSI no cargado.');
    return;
  }

  // Evitar inicialización múltiple
  if (googleClient) {
    if (typeof onReady === 'function') onReady();
    return;
  }

  google.accounts.id.initialize({
    client_id: AUTH_CONFIG.CLIENT_ID,
    callback: handleGoogleCallback,
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: false, // Desactivar FedCM para evitar errores en iframes (AI Studio)
    itp_support: true,           // Mejorar compatibilidad con iframes y bloqueo de cookies
  });

  // Inicializar Token Client para OAuth2 (Sheets API)
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: AUTH_CONFIG.CLIENT_ID,
    scope: AUTH_CONFIG.SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        AuthState.setAccessToken(tokenResponse.access_token);
        console.log('[Auth] Access Token obtenido.');
        // Notificar a los suscriptores que el token cambió (opcional, notify() ya se llama en setUser)
        AuthState.notify();
      }
    },
  });

  googleClient = true;

  if (typeof onReady === 'function') onReady();
}

/** Callback recibido tras autenticación Google */
function handleGoogleCallback(response) {
  if (!response?.credential) {
    console.error('[Auth] No se recibió credencial.');
    ToastService?.show('Error al iniciar sesión. Intenta de nuevo.', 'danger');
    return;
  }

  try {
    const payload = decodeJwt(response.credential);

    const user = {
      id:         payload.sub,
      name:       payload.name,
      email:      payload.email,
      picture:    payload.picture,
      givenName:  payload.given_name,
      familyName: payload.family_name,
      token:      response.credential,
      loginAt:    new Date().toISOString(),
    };

    AuthState.setUser(user);
    Router?.navigate('dashboard');

  } catch (err) {
    console.error('[Auth] Error decodificando token:', err);
    ToastService?.show('Error procesando credenciales.', 'danger');
  }
}

/** Decodifica JWT (solo payload, sin verificar firma) */
function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT inválido');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const decoded = atob(padded);
  return JSON.parse(decoded);
}

/** Renderiza el botón oficial de Google en un contenedor */
function renderGoogleButton(containerId) {
  if (!googleClient && typeof google !== 'undefined') {
    initGoogleAuth();
  }

  if (typeof google === 'undefined') {
    console.warn('[Auth] GSI no disponible todavía');
    return;
  }

  google.accounts.id.renderButton(
    document.getElementById(containerId),
    {
      type:  'standard',
      theme: 'outline',
      size:  'large',
      text:  'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 360,
      locale: 'es',
    }
  );
}

/** Trigger del popup de Google (botón propio) */
function signInWithGoogle() {
  if (typeof google === 'undefined') {
    ToastService?.show('Servicio de Google no disponible.', 'warning');
    return;
  }

  // Primero autenticar identidad (ID Token)
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed()) {
      console.warn('[Auth] One Tap bloqueado, usando botón estándar.');
    }
  });

  // Solicitar token de acceso si no tenemos uno
  if (!AuthState.getAccessToken()) {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

/** Cerrar sesión */
function signOut() {
  const user = AuthState.getUser();

  if (typeof google !== 'undefined' && user?.email) {
    google.accounts.id.revoke(user.email, () => {});
  }

  AuthState.setUser(null);
  Router?.navigate('login');
  ToastService?.show('Sesión cerrada correctamente.', 'success');
}

// Exportar al scope global
window.AuthService = {
  init: initGoogleAuth,
  signIn: signInWithGoogle,
  signOut,
  renderGoogleButton,
  getUser: () => AuthState.getUser(),
  getAccessToken: () => AuthState.getAccessToken(),
  requestAccessToken: () => tokenClient?.requestAccessToken({ prompt: '' }),
  isAuthenticated: () => AuthState.isAuthenticated(),
  subscribe: (fn) => AuthState.subscribe(fn),
};
