import { h, icon, clear } from '../ui/dom.js';
import { openSheet, choose } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { state, emit } from '../data.js';
import { store } from '../store.js';
import { getTemplates, setTemplates } from '../templates.js';
import { COLORS, colorHex, reminderLabel, REMINDER_PRESETS_TIMED, REMINDER_PRESETS_ALLDAY } from '../model.js';
import { defaultReminders } from '../ui/editor.js';
import { signOut } from '../auth.js';

export const APP_VERSION = '1.0.0';

export function renderSettings(root, rerender) {
  clear(root);
  const row = (ic, title, sub, onclick, extra = {}) => h(`button.set-row${extra.danger ? '.danger' : ''}`, { type: 'button', onclick },
    icon(ic), h('div.txt', title, sub ? h('small', sub) : null), extra.val ? h('span.val', extra.val) : null, icon('right', 'sm'));

  const theme = store.get('theme', 'auto');
  const tpls = getTemplates();

  root.append(
    h('section.set-group', h('span.label', 'Calendario'),
      h('div.set-card',
        row('cal', state.calName || 'Calendario', state.demo ? 'Modo demostración' : 'Toca para cambiar de calendario', () => emit('pick-calendar')),
        state.demo ? null : row('link', 'Enlace de configuración', 'Para configurar el otro móvil sin copiar nada', shareSetup),
        state.demo ? null : row('sync', 'Sincronizar ahora', 'Recarga los datos y aplica avisos compartidos', () => emit('sync')),
      )),
    h('section.set-group', h('span.label', 'Plantillas rápidas'),
      h('div.set-card',
        tpls.map((t, i) => h('button.set-row', { type: 'button', onclick: () => editTemplate(i, rerender) },
          h('span.tpl-chip-color', { '--c': colorHex(t.colorId) }),
          h('div.txt', t.name, h('small', t.type === 'task' ? 'Tarea' : t.allDay ? 'Evento · todo el día' : `Evento · ${t.duration || 60} min${t.hour != null ? ` · ${t.hour}:00` : ''}`)),
          icon('right', 'sm'))),
        h('button.set-row', { type: 'button', style: { color: 'var(--accent)' }, onclick: () => editTemplate(-1, rerender) }, icon('plus'), h('div.txt', 'Nueva plantilla')),
      )),
    h('section.set-group', h('span.label', 'Avisos por defecto'),
      h('div.set-card',
        row('bell', 'Eventos con hora', defaultReminders(false).map((r) => reminderLabel(r.minutes, false)).join(' · ') || 'Sin avisos', () => editDefaults(false, rerender)),
        row('bell', 'Todo el día y tareas', defaultReminders(true).map((r) => reminderLabel(r.minutes, true)).join(' · ') || 'Sin avisos', () => editDefaults(true, rerender)),
        h('div.set-row',
          icon('bolt'),
          h('div.txt', 'Para los dos por defecto', h('small', 'Activa «Para los dos» en eventos nuevos')),
          h('label.switch', h('input', { type: 'checkbox', checked: store.get('defRemBoth', true), onchange: (e) => store.set('defRemBoth', e.target.checked) }), h('span.track'), h('span.knob'))),
      )),
    h('section.set-group', h('span.label', 'Apariencia'),
      h('div.seg', { role: 'group', 'aria-label': 'Tema' }, [['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => h('button', {
        type: 'button', 'aria-pressed': String(theme === k),
        onclick: () => { store.set('theme', k); applyTheme(); rerender(); },
      }, l)))),
    h('section.set-group', h('span.label', 'Sesión'),
      h('div.set-card',
        state.demo
          ? row('out', 'Salir de la demo', null, () => { location.href = location.pathname; }, { danger: true })
          : row('out', 'Cerrar sesión', 'Revoca el acceso en este dispositivo', async () => {
            const ok = await choose('¿Cerrar sesión?', [{ key: 'y', label: 'Cerrar sesión', danger: true }, { key: 'n', label: 'Cancelar' }]);
            if (ok === 'y') { signOut(); location.reload(); }
          }, { danger: true }),
      )),
    h('p.about', `CALENDARIO S&A · v${APP_VERSION}`, h('br'), 'Datos en vuestro Google Calendar · Nada se guarda fuera de él', h('br'), 'Preferencias guardadas solo en este dispositivo'),
  );
}

export function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

async function shareSetup() {
  const payload = { c: state.calId, n: state.calName, t: getTemplates() };
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
    if (Array.isArray(p.t)) setTemplates(p.t.slice(0, 20).map(sanitizeTpl));
    return true;
  } catch { return false; }
}

function sanitizeTpl(t) {
  return {
    name: String(t.name || 'Plantilla').slice(0, 40),
    type: t.type === 'task' ? 'task' : 'event',
    colorId: COLORS.some((c) => c.id === t.colorId) ? t.colorId : '',
    allDay: !!t.allDay,
    duration: Math.min(1440, Math.max(5, +t.duration || 60)),
    hour: t.hour != null && +t.hour >= 0 && +t.hour <= 23 ? +t.hour : undefined,
    reminders: Array.isArray(t.reminders) ? t.reminders.slice(0, 5).map((r) => ({ method: 'popup', minutes: Math.min(40320, Math.max(0, +r.minutes || 0)) })) : [],
  };
}

function editTemplate(index, rerender) {
  const list = getTemplates();
  const t = index >= 0 ? { ...list[index] } : { name: '', type: 'event', colorId: '', allDay: false, duration: 60, reminders: [] };
  const body = h('div');
  let s;
  const draw = () => {
    clear(body).append(
      h('label.field', h('span.label', 'Nombre'), h('input.input', { type: 'text', value: t.name, maxlength: 40, oninput: (e) => { t.name = e.target.value; } })),
      h('div.seg.big', { style: { marginBottom: '12px' } },
        h('button', { type: 'button', 'aria-pressed': String(t.type === 'event'), onclick: () => { t.type = 'event'; draw(); } }, 'Evento'),
        h('button', { type: 'button', 'aria-pressed': String(t.type === 'task'), onclick: () => { t.type = 'task'; t.allDay = true; draw(); } }, 'Tarea')),
      h('div.switch-row', h('div.txt', 'Todo el día'), h('label.switch', h('input', { type: 'checkbox', checked: t.allDay, onchange: (e) => { t.allDay = e.target.checked; draw(); } }), h('span.track'), h('span.knob'))),
      t.allDay ? null : h('div.row',
        h('label.field', h('span.label', 'Duración (min)'), h('input.input', { type: 'number', min: 5, max: 1440, inputmode: 'numeric', value: t.duration || 60, onchange: (e) => { t.duration = +e.target.value || 60; } })),
        h('label.field', h('span.label', 'Hora fija (opcional)'), h('input.input', { type: 'number', min: 0, max: 23, inputmode: 'numeric', placeholder: '—', value: t.hour ?? '', onchange: (e) => { t.hour = e.target.value === '' ? undefined : Math.min(23, Math.max(0, +e.target.value)); } }))),
      h('div.section-rule', h('span.label', 'Color')),
      h('div.swatches', COLORS.map((c) => h('button.swatch', { type: 'button', '--c': c.hex, 'aria-label': c.name, 'aria-pressed': String((t.colorId || '') === c.id), onclick: () => { t.colorId = c.id; draw(); } }))),
      h('div.section-rule', h('span.label', 'Avisos')),
      h('div.chips', (t.allDay ? REMINDER_PRESETS_ALLDAY : REMINDER_PRESETS_TIMED).map((p) => {
        const on = (t.reminders || []).some((r) => r.minutes === p.minutes);
        return h('button.chip', { type: 'button', 'aria-pressed': String(on), onclick: () => {
          t.reminders = on ? t.reminders.filter((r) => r.minutes !== p.minutes) : [...(t.reminders || []), { method: 'popup', minutes: p.minutes }].slice(0, 5);
          draw();
        } }, p.label);
      })),
    );
  };
  draw();
  const foot = h('div', { style: { display: 'contents' } },
    index >= 0 ? h('button.btn.danger', { type: 'button', style: { flex: '0 0 auto' }, 'aria-label': 'Eliminar plantilla', onclick: () => { list.splice(index, 1); setTemplates(list); s.close(); rerender(); } }, icon('trash', 'sm')) : null,
    h('button.btn.primary', { type: 'button', onclick: () => {
      if (!t.name.trim()) return toast('Ponle un nombre', { error: true });
      const clean = sanitizeTpl({ ...t, name: t.name.trim() });
      if (index >= 0) list[index] = clean; else list.push(clean);
      setTemplates(list); s.close(); rerender();
    } }, icon('check', 'sm'), 'Guardar'));
  s = openSheet({ title: index >= 0 ? 'Editar plantilla' : 'Nueva plantilla', body, foot });
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
