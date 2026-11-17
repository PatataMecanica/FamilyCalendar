// Arranque de la app: sesión, elección de calendario, navegación y sincronización.

import { h, icon, clear } from './ui/dom.js';
import { store } from './store.js';
import {
  handleRedirect, getToken, signIn, canTrySilent, isConfigured, redirectUri,
} from './auth.js';
import { googleApi, AuthError } from './api.js';
import { state, bus, invalidate, saveOffline, toItems } from './data.js';
import { syncSharedReminders } from './reminders-sync.js';
import { renderUpcoming, resetUpcoming } from './views/upcoming.js';
import { renderCalendar, goToday } from './views/calendar.js';
import { renderSearch } from './views/search.js';
import { renderSettings, applyTheme, consumeSetupLink } from './views/settings.js';
import { openQuick } from './ui/quick.js';
import { toast } from './ui/toast.js';
import { sheetsOpen, closeAllSheets } from './ui/sheet.js';

const $ = (id) => document.getElementById(id);
const TITLES = { upcoming: 'Próximos', calendar: 'Calendario', search: 'Buscar', settings: 'Ajustes' };
let tab = store.get('tab', 'upcoming');
if (tab === 'search') tab = 'upcoming';
let lastRender = 0;

applyTheme();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------------- Pantallas de acceso ----------------
function gate(...children) {
  const g = $('gate');
  clear(g).append(h('div.gate-inner', ...children));
  g.hidden = false;
  $('app').hidden = true;
}
function hideGate() { $('gate').hidden = true; $('app').hidden = false; }

const brandPlate = (subtitle = 'Calendario compartido') => h('div.plate',
  h('div.logo', 'S&A'),
  h('div.logo-sub', h('span.label', subtitle)),
);

function showLogin(message) {
  gate(
    brandPlate(),
    message ? h('p', { style: { color: 'var(--rust)' } }, message) : h('p', 'Vuestro calendario de Google, sin ruido. Inicia sesión con la cuenta que tiene acceso al calendario compartido.'),
    h('button.btn.primary.block', { type: 'button', onclick: () => signIn({ selectAccount: !store.get('loginHint') }) }, 'Continuar con Google'),
    store.get('loginHint') ? h('button.btn.ghost.block', { type: 'button', onclick: () => signIn({ selectAccount: true }) }, 'Usar otra cuenta') : null,
    h('p.fine', 'Si Google avisa de «app no verificada», es normal: la app es vuestra. Pulsa «Continuar».'),
    h('p.fine', h('a', { href: '?demo=1' }, 'Ver demostración sin cuenta')),
  );
}

function showNotConfigured() {
  gate(
    brandPlate('Configuración pendiente'),
    h('p', 'Falta el ID de cliente de Google en ', h('code', 'js/config.js'), '. Sigue los pasos de SETUP.md del repositorio.'),
    h('p.fine', { style: { textAlign: 'left' } }, 'URL de redirección a autorizar: ', h('code', { style: { wordBreak: 'break-all' } }, redirectUri())),
    h('a.btn.primary.block', { href: '?demo=1', style: { textDecoration: 'none' } }, 'Ver demostración'),
  );
}

function showSessionExpired() {
  if (state.demo) return;
  if (!sheetsOpen() && canTrySilent()) { signIn({ silent: true }); return; }
  gate(
    brandPlate('Sesión caducada'),
    h('p', 'Por seguridad, Google renueva el acceso cada hora.'),
    h('button.btn.primary.block', { type: 'button', onclick: () => signIn({ silent: canTrySilent() }) }, 'Continuar'),
  );
}

async function showCalendarPicker() {
  gate(brandPlate('Elige el calendario'), h('div', { style: { display: 'grid', placeItems: 'center', padding: '20px' } }, h('div.spinner')));
  try {
    const cals = await state.api.listCalendars();
    const primary = cals.find((c) => c.primary);
    if (primary && !state.demo && !store.get('loginHint')) store.set('loginHint', primary.id);
    const sorted = [...cals].sort((a, b) => (a.primary ? 1 : 0) - (b.primary ? 1 : 0) || (a.summary || '').localeCompare(b.summary || '', 'es'));
    gate(
      brandPlate('Elige el calendario'),
      h('p', 'Elige el calendario que compartís. Se recordará en este dispositivo.'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        sorted.map((c) => h('button.cal-option', {
          type: 'button', '--c': c.backgroundColor || 'var(--accent)',
          onclick: () => selectCalendar(c.id, c.summaryOverride || c.summary),
        }, h('span.dot'), h('span.nm', c.summaryOverride || c.summary), c.primary ? h('small', 'PRINCIPAL') : null, icon('right', 'sm')))),
      state.calId ? h('button.btn.ghost.block', { type: 'button', onclick: () => { hideGate(); render(); } }, 'Cancelar') : null,
    );
  } catch (e) {
    if (e instanceof AuthError) return showSessionExpired();
    gate(brandPlate(), h('p', `No se pudo cargar la lista de calendarios: ${e.message}`), h('button.btn.primary.block', { type: 'button', onclick: showCalendarPicker }, 'Reintentar'));
  }
}

function selectCalendar(id, name) {
  state.calId = id; state.calName = name || '';
  if (!state.demo) { store.set('calId', id); store.set('calName', state.calName); }
  invalidate();
  startApp();
}

// ---------------- App ----------------
function setTab(t) {
  tab = t;
  store.set('tab', t);
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === t ? 'page' : 'false'));
  if (t === 'upcoming') resetUpcoming();
  window.scrollTo(0, 0);
  render();
}

function topActions() {
  const box = clear($('topActions'));
  if (!state.online) box.append(h('span.tag', { style: { fontFamily: 'var(--f-display)', fontSize: '11px', letterSpacing: '.14em', color: 'var(--rust)', padding: '3px 6px', boxShadow: 'inset 0 0 0 1px currentColor', borderRadius: '3px' } }, 'SIN CONEXIÓN'));
  if (tab === 'calendar') box.append(h('button.pill-btn', { type: 'button', onclick: () => { goToday(); render(); } }, 'Hoy'));
  if (tab === 'upcoming' || tab === 'calendar') {
    box.append(h('button.icon-btn', { type: 'button', 'aria-label': 'Actualizar', onclick: () => refresh(true) }, icon('sync')));
  }
}

let renderSeq = 0;
async function render() {
  const root = $('view');
  $('title').textContent = TITLES[tab];
  topActions();
  const my = ++renderSeq;
  try {
    if (tab === 'upcoming') await renderUpcoming(root);
    else if (tab === 'calendar') await renderCalendar(root, render);
    else if (tab === 'search') renderSearch(root);
    else renderSettings(root, render);
    lastRender = Date.now();
  } catch (e) {
    if (my !== renderSeq) return;
    if (e instanceof AuthError) return;
    console.error(e);
    if (e.status === 404) { toast('No se encuentra el calendario. Elige otro.', { error: true }); showCalendarPicker(); return; }
    clear(root).append(h('div.empty', { style: { marginTop: '40px' } }, h('span.label', 'Sin datos'), `No se pudo cargar: ${e.message}`, h('br'), h('br'),
      h('button.btn', { type: 'button', onclick: render }, 'Reintentar')));
  }
}

async function refresh(manual = false) {
  invalidate();
  await render();
  if (manual) toast('Actualizado');
}

async function backgroundSync() {
  if (state.demo || !state.calId) return;
  try {
    const n = await syncSharedReminders(state.api, state.calId, toItems);
    if (n) { toast(`Avisos compartidos aplicados a ${n} evento${n > 1 ? 's' : ''}`); invalidate(); }
  } catch (e) { if (!(e instanceof AuthError)) console.warn(e); }
  saveOffline();
}

let started = false;
function startApp() {
  hideGate();
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  render();
  backgroundSync();
  if (started) return;
  started = true;
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('fab').addEventListener('click', () => openQuick());
  bus.addEventListener('changed', () => { if (tab !== 'settings') render(); });
  bus.addEventListener('auth-required', () => { closeAllSheets(); showSessionExpired(); });
  bus.addEventListener('pick-calendar', showCalendarPicker);
  bus.addEventListener('sync', async () => { invalidate(); store.remove('remApplied'); await backgroundSync(); toast('Sincronizado'); });
  bus.addEventListener('offline', () => { if (state.online) { state.online = false; topActions(); } });
  window.addEventListener('online', () => { state.online = true; refresh(); });
  window.addEventListener('offline', () => { state.online = false; topActions(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!state.demo && !getToken()) { if (!sheetsOpen()) showSessionExpired(); return; }
    if (Date.now() - lastRender > 60_000 && !sheetsOpen()) { invalidate(); render(); backgroundSync(); }
  });
  // Re-dibuja a medianoche / cada 5 min para mantener "ahora" y "hoy" al día
  setInterval(() => { if (!sheetsOpen() && document.visibilityState === 'visible' && (tab === 'upcoming' || tab === 'calendar')) render(); }, 5 * 60_000);
}

// ---------------- Arranque ----------------
async function boot() {
  const params = new URLSearchParams(location.search);
  if (TITLES[params.get('tab')]) tab = params.get('tab');
  if (params.has('demo')) {
    const { demoApi } = await import('./demo.js');
    state.api = demoApi; state.demo = true;
    state.calId = 'demo-calendar'; state.calName = 'Casa (demo)';
    startApp();
    toast('Modo demostración: los cambios no se guardan');
    return;
  }
  state.api = googleApi;
  consumeSetupLink();
  const redirect = handleRedirect();
  if (!isConfigured()) return showNotConfigured();

  if (redirect && !redirect.ok) {
    const silentFail = ['interaction_required', 'login_required', 'consent_required', 'account_selection_required'].includes(redirect.error);
    return showLogin(silentFail ? null : redirect.error === 'access_denied' ? 'Has cancelado el acceso. Lo necesitamos para leer y escribir el calendario.' : `Error de acceso (${redirect.error}).`);
  }
  if (!getToken()) {
    if (canTrySilent()) return signIn({ silent: true });
    return showLogin();
  }
  state.calId = store.get('calId');
  state.calName = store.get('calName', '');
  if (!store.get('loginHint')) {
    // Recordar la cuenta (solo en este dispositivo) para renovar la sesión con un toque
    googleApi.listCalendars().then((cals) => { const p = cals.find((c) => c.primary); if (p) store.set('loginHint', p.id); }).catch(() => {});
  }
  if (!state.calId) return showCalendarPicker();
  startApp();
}

boot();
