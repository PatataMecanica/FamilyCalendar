// Inicio de sesión con Google (OAuth 2.0 para apps web sin servidor, flujo por redirección).
// Se usa redirección en lugar de ventana emergente porque funciona de forma fiable en apps
// instaladas en iPhone y Android. El token dura ~1 h y se guarda solo en este dispositivo.

import { CONFIG } from './config.js';
import { store } from './store.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SILENT_GUARD_MS = 2 * 60 * 1000;

export function redirectUri() {
  // URL de la app sin index.html, query ni hash (debe coincidir con la autorizada en Google Cloud)
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

export function isConfigured() {
  return CONFIG.CLIENT_ID && !CONFIG.CLIENT_ID.startsWith('PEGA_AQUI');
}

export function getToken() {
  const t = store.get('token');
  if (t && t.value && t.exp > Date.now() + 60_000) return t.value;
  return null;
}

export function clearToken() { store.remove('token'); }

/** Procesa la vuelta de Google (#access_token=… o #error=…). Devuelve {ok, error} o null si no aplica. */
export function handleRedirect() {
  const h = location.hash.slice(1);
  if (!h || !/(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  const expectedState = store.get('oauthState');
  store.remove('oauthState');
  // Limpia la URL para que el token no quede en el historial
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('state') !== expectedState) return { ok: false, error: 'state' };
  if (p.get('error')) return { ok: false, error: p.get('error') };
  const value = p.get('access_token');
  const expiresIn = Number(p.get('expires_in') || 3600);
  store.set('token', { value, exp: Date.now() + expiresIn * 1000 });
  store.remove('silentTry');
  return { ok: true };
}

/** Redirige a Google. silent=true intenta renovar sin interacción (prompt=none). */
export function signIn({ silent = false, selectAccount = false } = {}) {
  const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
  store.set('oauthState', state);
  if (silent) store.set('silentTry', Date.now());
  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: CONFIG.SCOPES.join(' '),
    include_granted_scopes: 'true',
    state,
  });
  const hint = store.get('loginHint');
  if (hint && !selectAccount) params.set('login_hint', hint);
  if (silent) params.set('prompt', 'none');
  else if (selectAccount) params.set('prompt', 'select_account');
  location.assign(`${AUTH_URL}?${params}`);
}

/** ¿Podemos intentar una renovación silenciosa ahora? (evita bucles de redirección) */
export function canTrySilent() {
  if (!store.get('loginHint')) return false;
  const last = store.get('silentTry', 0);
  return Date.now() - last > SILENT_GUARD_MS;
}

export function signOut() {
  const t = store.get('token');
  clearToken();
  store.remove('loginHint');
  if (t && t.value) {
    // Revoca el token en Google (no bloqueante)
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.value)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => {});
  }
}
