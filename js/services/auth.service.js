// ============================================================
// CADASA TALLER — AUTH SERVICE v3 (Supabase)
// Misma API pública que v2 — los componentes no cambian.
// Autenticación: Email + Password via supabase.auth
// ============================================================

// ── Estado interno ───────────────────────────────────────────
const AuthState = {
  user:      null,
  listeners: [],

  setUser(userData) {
    this.user = userData;
    this.notify();
  },

  getUser() {
    return this.user;
  },

  isAuthenticated() {
    return this.user !== null;
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  },

  notify() {
    this.listeners.forEach(fn => fn(this.user));
  },
};

// ── Mapear sesión de Supabase al formato de usuario de la app ─
async function _buildUser(supabaseUser) {
  if (!supabaseUser) return null;
  const db = window.SupabaseClient;
 
  const { data: profile, error } = await db
    .from('PROFILE')
    .select('nombre, area, role')
    .eq('email', supabaseUser.email)
    .single();
 
  if (error) {
    console.warn('[Auth] Perfil no encontrado en PROFILE:', error.message);
  }
 
  return {
    id:        supabaseUser.id,
    email:     supabaseUser.email,
    name:      profile?.nombre || supabaseUser.email,
    givenName: profile?.nombre || supabaseUser.email,
    area:      profile?.area   || null,
    role:      profile?.role   || 'user',
    picture:   null,
    loginAt:   new Date().toISOString(),
  };
}

// ── Init: escuchar cambios de sesión ─────────────────────────
function initAuth() {
  const db = window.SupabaseClient;

  // Recuperar sesión activa al arrancar
  db.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      const user = await _buildUser(session.user);
      AuthState.setUser(user);
      console.log('[Auth] Sesión activa restaurada.');
    } else {
      console.log('[Auth] Sin sesión activa.');
    }
    // Avisar a app.js que initAuth corrió
    window._onAuthReady?.();
  });

  // Escuchar cambios futuros (login, logout, token refresh)
  db.auth.onAuthStateChange((_event, session) => {
    const mapped = session?.user ? _mapUser(session.user) : null;
    AuthState.setUser(mapped);
  });
}

// ── Iniciar sesión (email + password) ────────────────────────
async function signIn(email, password) {
  const db = window.SupabaseClient;
  _setLoginLoading(true);

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[Auth] Error signIn:', error.message);
    ToastService?.show('Credenciales incorrectas. Intenta de nuevo.', 'danger');
    _setLoginLoading(false);
    return;
  }

  AuthState.setUser(_mapUser(data.user));
  _setLoginLoading(false);
  Router?.navigate('dashboard');
  ToastService?.show('Sesión iniciada correctamente.', 'success');
}

// ── Cerrar sesión ─────────────────────────────────────────────
async function signOut() {
  const db = window.SupabaseClient;
  await db.auth.signOut();
  AuthState.setUser(null);
  Router?.navigate('login');
  ToastService?.show('Sesión cerrada correctamente.', 'success');
}

// ── Métodos mantenidos por compatibilidad (ya no necesarios) ──
// onTokenReady: en Supabase no hay token de Sheets, pero se
// mantiene el método para no romper llamadas existentes.
function onTokenReady(fn) {
  // Ejecutar inmediatamente — no hay token externo que esperar
  fn();
}

function getAccessToken() {
  // Ya no se usa — mantenido para compatibilidad
  return null;
}

// ── Helper interno para controlar spinner del login ──────────
function _setLoginLoading(active) {
  const overlay = document.getElementById('login-loading');
  const btn     = document.getElementById('btn-google-signin');
  if (overlay) overlay.classList.toggle('active', active);
  if (btn)     btn.disabled = active;
}

// ── Exportar API pública (idéntica a v2) ─────────────────────
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