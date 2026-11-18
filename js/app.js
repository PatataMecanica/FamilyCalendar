// Arranque de la app: sesión, elección de calendario, navegación y sincronización.

import { h, clear } from './ui/dom.js';
import { store } from './store.js';
import {
  handleRedirect, getToken, signIn, canTrySilent, isConfigured, redirectUri,
} from './auth.js';
import { googleApi, AuthError } from './api.js';
import { state, bus, invalidate, saveOffline, toItems, fetchTasks } from './data.js';
import { groupTasks, attentionCount } from './tasks.js';
import { syncSharedReminders } from './reminders-sync.js';
import { renderUpcoming, resetUpcoming } from './views/upcoming.js';
import { renderCalendar, goToday } from './views/calendar.js';
import { renderTasks } from './views/tasks.js';
import { renderSettings, applyDesign, consumeSetupLink } from './views/settings.js';
import { openQuick } from './ui/quick.js';
import { toast } from './ui/toast.js';
import { sheetsOpen, closeAllSheets } from './ui/sheet.js';

const $ = (id) => document.getElementById(id);
const TITLES = { upcoming: 'Próximos', calendar: 'Calendario', tasks: 'Tareas', settings: 'Ajustes' };
let tab = store.get('tab', 'upcoming');
if (!TITLES[tab]) tab = 'upcoming'; // p. ej. la antigua pestaña «Buscar»
let lastRender = 0;

applyDesign();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------------- Pantallas de acceso ----------------
function gate(...children) {
  const g = $('gate');
  clear(g).append(h('div.welcome', ...children));
  g.hidden = false;
  $('app').hidden = true;
  $('nav').hidden = true;
}
function hideGate() { $('gate').hidden = true; $('app').hidden = false; $('nav').hidden = false; }

const brandPlate = (subtitle = 'Calendario compartido') => h('div',
  h('div.logo', 'S', h('em', '&'), 'A'),
  h('div.tagline', subtitle),
);

function showLogin(message) {
  gate(
    brandPlate(),
    message ? h('p.intro', { style: { color: 'var(--danger)' } }, message) : h('p.intro', 'Vuestro calendario de Google, sin ruido. Entra con la cuenta que tiene acceso al calendario compartido.'),
    h('div.stack',
      h('button.btn.block', { type: 'button', onclick: () => signIn({ selectAccount: !store.get('loginHint') }) }, 'Continuar con Google'),
      store.get('loginHint') ? h('button.btn.ghost.block', { type: 'button', onclick: () => signIn({ selectAccount: true }) }, 'Usar otra cuenta') : null),
    h('p.fine', 'Si Google avisa de «app no verificada», es normal: la app es vuestra. Pulsa «Continuar».'),
    h('p.fine', h('a', { href: '?demo=1' }, 'Ver demostración sin cuenta')),
  );
}

function showNotConfigured() {
  gate(
    brandPlate('Configuración pendiente'),
    h('p.intro', 'Falta el ID de cliente de Google en ', h('code', 'js/config.js'), '. Sigue los pasos de SETUP.md del repositorio.'),
    h('a.btn.block', { href: '?demo=1' }, 'Ver demostración'),
    h('p.fine', 'URL de redirección a autorizar: ', h('code', redirectUri())),
  );
}

function showSessionExpired() {
  if (state.demo) return;
  if (!sheetsOpen() && canTrySilent()) { signIn({ silent: true }); return; }
  gate(
    brandPlate('Sesión caducada'),
    h('p.intro', 'Por seguridad, Google renueva el acceso cada hora.'),
    h('button.btn.block', { type: 'button', onclick: () => signIn({ silent: canTrySilent() }) }, 'Continuar'),
  );
}

async function showCalendarPicker() {
  gate(brandPlate('Elige el calendario'), h('div.spinner'));
  try {
    const cals = await state.api.listCalendars();
    const primary = cals.find((c) => c.primary);
    if (primary && !state.demo && !store.get('loginHint')) store.set('loginHint', primary.id);
    const sorted = [...cals].sort((a, b) => (a.primary ? 1 : 0) - (b.primary ? 1 : 0) || (a.summary || '').localeCompare(b.summary || '', 'es'));
    gate(
      brandPlate('Elige el calendario'),
      h('p.intro', 'Elige el calendario que compartís. Se recordará en este dispositivo.'),
      h('div.stack',
        sorted.map((c) => h('button.cal-option', {
          type: 'button', '--c': c.backgroundColor || 'var(--accent)',
          onclick: () => selectCalendar(c.id, c.summaryOverride || c.summary),
        }, h('span.dot'), h('span.nm', c.summaryOverride || c.summary), c.primary ? h('small', 'Principal') : null)),
        state.calId ? h('button.btn.ghost.block', { type: 'button', onclick: () => { hideGate(); render(); } }, 'Cancelar') : null),
    );
  } catch (e) {
    if (e instanceof AuthError) return showSessionExpired();
    gate(brandPlate(), h('p.intro', `No se pudo cargar la lista de calendarios: ${e.message}`), h('button.btn.block', { type: 'button', onclick: showCalendarPicker }, 'Reintentar'));
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
  markTab();
  if (t === 'upcoming') resetUpcoming();
  window.scrollTo(0, 0);
  render();
}

function markTab() {
  document.querySelectorAll('#nav button[data-tab]').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

// Pastilla de estado (como en Gastos S&A): al día / sincronizando / sin conexión. Al tocarla, actualiza.
let busy = false;
function syncPill() {
  let cls = '', txt = state.demo ? 'Demo' : 'Al día';
  if (busy) { cls = '.busy'; txt = 'Sincronizando'; }
  else if (!state.online) { cls = '.err'; txt = 'Sin conexión'; }
  return h(`button.sync${cls}`, { type: 'button', 'aria-label': `${txt}. Toca para actualizar`, onclick: () => refresh(true) }, h('i'), txt);
}
function topActions() {
  const box = clear($('topActions'));
  if (tab === 'calendar') box.append(h('button.pill', { type: 'button', onclick: () => { goToday(); render(); } }, 'Hoy'));
  box.append(syncPill());
}

// Contador en la pestaña Tareas: vencidas + pendientes de hoy
function setBadge(groups) {
  const b = $('taskBadge');
  const n = attentionCount(groups);
  b.textContent = n > 99 ? '99+' : String(n);
  b.hidden = n === 0;
  b.classList.toggle('late', groups.overdue.length > 0);
  const btn = b.closest('button');
  btn.setAttribute('aria-label', n ? `Tareas, ${n} para hoy o vencidas` : 'Tareas');
}
async function updateBadge() {
  try { setBadge(groupTasks(await fetchTasks())); } catch { /* no crítico */ }
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
    else if (tab === 'tasks') { setBadge(await renderTasks(root)); lastRender = Date.now(); return; }
    else renderSettings(root, render);
    lastRender = Date.now();
    updateBadge();
  } catch (e) {
    if (my !== renderSeq) return;
    if (e instanceof AuthError) return;
    console.error(e);
    if (e.status === 404) { toast('No se encuentra el calendario. Elige otro.', { error: true }); showCalendarPicker(); return; }
    clear(root).append(h('div.card.empty', h('b', 'Sin datos'), `No se pudo cargar: ${e.message}`,
      h('div.btns', { style: { justifyContent: 'center' } }, h('button.btn.sm', { type: 'button', onclick: render }, 'Reintentar'))));
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
  markTab();
  render();
  backgroundSync();
  if (started) return;
  started = true;
  document.querySelectorAll('#nav button[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  bus.addEventListener('busy', (e) => { if (busy !== e.detail) { busy = e.detail; topActions(); } });
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
  setInterval(() => { if (!sheetsOpen() && document.visibilityState === 'visible' && (tab === 'upcoming' || tab === 'calendar' || tab === 'tasks')) render(); }, 5 * 60_000);
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
