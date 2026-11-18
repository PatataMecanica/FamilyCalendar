import { h, icon, clear } from '../ui/dom.js';
import { openSheet, choose } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { state, emit } from '../data.js';
import { store } from '../store.js';
import { reminderLabel, REMINDER_PRESETS_TIMED, REMINDER_PRESETS_ALLDAY } from '../model.js';
import { defaultReminders } from '../ui/editor.js';
import { signOut } from '../auth.js';

export const APP_VERSION = '1.5.0';

// Estilos y modos, igual que en Gastos S&A
export const ESTILOS = { pastel: 'Pastel', neon: 'Neón', retro: 'Ochentas' };
export const TEMAS = { auto: 'Sistema', light: 'Claro', dark: 'Oscuro' };
const darkMq = matchMedia('(prefers-color-scheme: dark)');

export function getDesign() {
  let tema = store.get('tema');
  if (tema == null) { tema = store.get('theme', 'auto'); if (TEMAS[tema]) store.set('tema', tema); store.remove('theme'); }
  if (!TEMAS[tema]) tema = 'auto';
  let estilo = store.get('estilo', 'pastel');
  if (!ESTILOS[estilo]) estilo = 'pastel';
  return { tema, estilo };
}

/** Pone data-theme y data-style en <html> y ajusta el color de la barra del navegador */
export function applyDesign() {
  const { tema, estilo } = getDesign();
  const root = document.documentElement;
  root.dataset.theme = tema === 'auto' ? (darkMq.matches ? 'dark' : 'light') : tema;
  root.dataset.style = estilo;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = bg; });
}
darkMq.addEventListener?.('change', applyDesign);

export function renderSettings(root, rerender) {
  clear(root);
  const row = (ic, title, sub, onclick, extra = {}) => h(`button.mrow${extra.danger ? '.danger' : ''}`, { type: 'button', onclick },
    icon(ic), h('div.txt', title, sub ? h('small', sub) : null), icon('right', 'sm go'));
  const section = (title) => h('div.section', h('h2', title));

  const { tema, estilo } = getDesign();
  const setDesign = (k, v) => { store.set(k, v); applyDesign(); rerender(); };

  root.append(
    section('Apariencia'),
    h('div.card',
      h('span.fl', { style: { marginTop: '0' } }, 'Estilo'),
      h('div.segm.three.styles', { role: 'group', 'aria-label': 'Estilo' }, Object.entries(ESTILOS).map(([k, n]) => h(`button${estilo === k ? '.on' : ''}`, {
        type: 'button', 'aria-pressed': String(estilo === k), onclick: () => setDesign('estilo', k),
      }, h(`i.sw.${k}`), n))),
      h('span.fl', 'Modo'),
      h('div.segm.three', { role: 'group', 'aria-label': 'Modo' }, Object.entries(TEMAS).map(([k, n]) => h(`button${tema === k ? '.on' : ''}`, {
        type: 'button', 'aria-pressed': String(tema === k), onclick: () => setDesign('tema', k),
      }, n))),
    ),
    section('Calendario'),
    h('div.card.menu',
      row('cal', state.calName || 'Calendario', state.demo ? 'Modo demostración' : 'Toca para cambiar de calendario', () => emit('pick-calendar')),
      state.demo ? null : row('link', 'Enlace de configuración', 'Para configurar el otro móvil sin copiar nada', shareSetup),
      state.demo ? null : row('sync', 'Sincronizar ahora', 'Recarga los datos y aplica avisos compartidos', () => emit('sync')),
    ),
    section('Avisos por defecto'),
    h('div.card.menu',
      row('bell', 'Eventos con hora', defaultReminders(false).map((r) => reminderLabel(r.minutes, false)).join(' · ') || 'Sin avisos', () => editDefaults(false, rerender)),
      row('bell', 'Todo el día y tareas', defaultReminders(true).map((r) => reminderLabel(r.minutes, true)).join(' · ') || 'Sin avisos', () => editDefaults(true, rerender)),
      h('div.mrow',
        icon('bolt'),
        h('div.txt', 'Para los dos por defecto', h('small', 'Activa «Para los dos» en eventos nuevos')),
        h('label.switch', h('input', { type: 'checkbox', checked: store.get('defRemBoth', true), onchange: (e) => store.set('defRemBoth', e.target.checked) }), h('span.track'), h('span.knob'))),
    ),
    section('Sesión'),
    h('div.card.menu',
      state.demo
        ? row('out', 'Salir de la demo', null, () => { location.href = location.pathname; }, { danger: true })
        : row('out', 'Cerrar sesión', 'Revoca el acceso en este dispositivo', async () => {
          const ok = await choose('¿Cerrar sesión?', [{ key: 'y', label: 'Cerrar sesión', danger: true }, { key: 'n', label: 'Cancelar' }]);
          if (ok === 'y') { signOut(); location.reload(); }
        }, { danger: true }),
    ),
    h('p.about', `Calendario S&A · v${APP_VERSION}`, h('br'), 'Los datos viven en vuestro Google Calendar', h('br'), 'Las preferencias se guardan solo en este dispositivo'),
  );
}

async function shareSetup() {
  const payload = { c: state.calId, n: state.calName };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = `${location.origin}${location.pathname}#setup=${b64}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Calendario S&A', text: 'Abre este enlace para configurar el calendario compartido', url }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado. Envíalo por mensaje.'); }
  catch { prompt('Copia este enlace:', url); }
}

/** Lee #setup=… si viene en la URL. Devuelve true si se aplicó algo. */
export function consumeSetupLink() {
  const m = location.hash.match(/^#setup=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
    const p = JSON.parse(json);
    if (p.c && typeof p.c === 'string') { store.set('calId', p.c); store.set('calName', String(p.n || '')); }
    return true;
  } catch { return false; }
}

function editDefaults(allDay, rerender) {
  let cur = [...defaultReminders(allDay)];
  const body = h('div');
  const draw = () => clear(body).append(
    h('p', { style: { margin: '0 0 12px', color: 'var(--ink-3)', fontSize: '14px' } }, 'Se aplican al crear algo nuevo. Siempre puedes cambiarlos en cada evento.'),
    h('div.chips', (allDay ? REMINDER_PRESETS_ALLDAY : REMINDER_PRESETS_TIMED).map((p) => {
      const on = cur.some((r) => r.minutes === p.minutes);
      return h('button.chip', { type: 'button', 'aria-pressed': String(on), onclick: () => {
        cur = on ? cur.filter((r) => r.minutes !== p.minutes) : [...cur, { method: 'popup', minutes: p.minutes }].sort((a, b) => a.minutes - b.minutes).slice(0, 5);
        draw();
      } }, p.label);
    })),
  );
  draw();
  const s = openSheet({
    title: allDay ? 'Avisos · todo el día' : 'Avisos · con hora', body,
    foot: h('button.btn.primary', { type: 'button', onclick: () => { store.set(allDay ? 'defRemAllDay' : 'defRemTimed', cur); s.close(); rerender(); } }, 'Guardar'),
  });
}
