// Formulario de evento/tarea y hoja de detalle.

import { h, icon, clear } from './dom.js';
import { openSheet, choose } from './sheet.js';
import { toast } from './toast.js';
import {
  COLORS, colorHex, colorName, REMINDER_PRESETS_TIMED, REMINDER_PRESETS_ALLDAY, reminderLabel,
} from '../model.js';
import { parseRecurrence, describeRecurrence, DAY_ES } from '../recurrence.js';
import { toISODate, fromISODate, toHM, addDays, fmtLongDate, weekdayMon, cap, sameDay } from '../dates.js';
import { createItem, updateItem, deleteItem, toggleDone, restore, state } from '../data.js';
import { store } from '../store.js';

export const defaultReminders = (allDay) => store.get(allDay ? 'defRemAllDay' : 'defRemTimed', allDay ? [{ method: 'popup', minutes: 900 }] : [{ method: 'popup', minutes: 30 }]);

/** Borrador nuevo con valores por defecto */
export function newDraft(over = {}) {
  const now = new Date();
  const start = new Date(now); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);
  const type = over.type || 'event';
  const allDay = over.allDay ?? (type === 'task');
  const d = {
    type, title: '', done: false, allDay,
    start, end: new Date(start.getTime() + 3600000),
    location: '', notes: '', colorId: '',
    reminders: defaultReminders(allDay),
    remBoth: store.get('defRemBoth', true),
    recur: { freq: 'none' },
    ...over,
  };
  if (d.allDay) { d.start = new Date(d.start); d.start.setHours(0, 0, 0, 0); if (!over.end) d.end = new Date(d.start); }
  return d;
}

/**
 * Formulario completo para algo nuevo (botón «+», «+ Añadir» de un día o un hueco del calendario).
 * Empieza como evento (o como tarea si se pide, p. ej. desde la pestaña Tareas); arriba se cambia.
 * @param {{date?:Date, hour?:number, type?:'event'|'task'}} ctx  día y hora preseleccionados
 */
export function openNew({ date = null, hour = null, type = 'event' } = {}) {
  // Tarea: sin hora y para hoy (o ese día)
  if (type === 'task') return openEditor({ draft: date ? { type, start: new Date(date) } : { type } });
  if (!date) return openEditor({ draft: {} });
  const now = new Date();
  const start = new Date(date);
  // Sin hora: la siguiente en punto si es hoy; si no, a las 10
  start.setHours(hour ?? (sameDay(date, now) ? Math.min(now.getHours() + 1, 23) : 10), 0, 0, 0);
  return openEditor({ draft: { start, end: new Date(start.getTime() + 3600000) } });
}

function draftFromItem(it) {
  const end = it.allDay ? addDays(it.end, -1) : it.end;
  return {
    type: it.type, title: it.title, done: it.done, allDay: it.allDay,
    start: new Date(it.start), end: new Date(end),
    location: it.location, notes: it.notes, colorId: it.colorId,
    reminders: it.useDefaultReminders ? defaultReminders(it.allDay) : [...it.reminders],
    remBoth: it.remBoth,
    recur: parseRecurrence(it.recurrence),
  };
}

/** Pregunta el alcance para elementos recurrentes */
async function askScope(item, verb) {
  if (!item.recurringEventId) return 'single';
  return choose(`${verb} evento repetido`, [
    { key: 'single', label: 'Solo este' },
    { key: 'series', label: 'Toda la serie' },
  ]);
}

/**
 * Abre el formulario.
 * @param {{item?:import('../model.js').Item, draft?:Object, scope?:'single'|'series'}} opts
 */
export async function openEditor({ item = null, draft = null, scope = null } = {}) {
  if (item && !scope) { scope = await askScope(item, 'Editar'); if (!scope) return; }
  if (item && item.recurringEventId && scope === 'series') {
    // Para editar la serie mostramos la regla de la serie
    try {
      const master = await state.api.getEvent(state.calId, item.recurringEventId);
      item = { ...item, recurrence: master.recurrence };
    } catch { /* se mantiene sin regla */ }
  }
  const d = draft ? { ...newDraft(draft), ...draft } : item ? draftFromItem(item) : newDraft();
  const showRecur = !item || !item.recurringEventId || scope === 'series';

  const body = h('div');
  let sheet;

  // --- Campos ---
  const titleInput = h('input.field.big', {
    type: 'text', placeholder: 'Título', value: d.title, enterkeyhint: 'done', autocomplete: 'off',
    oninput: (e) => { d.title = e.target.value; },
  });

  const typeSeg = h('div.segm', { role: 'group', 'aria-label': 'Tipo' });
  const renderType = () => {
    clear(typeSeg).append(
      h('button', { type: 'button', 'aria-pressed': String(d.type === 'event'), onclick: () => setType('event') }, icon('event', 'sm'), 'Evento'),
      h('button', { type: 'button', 'aria-pressed': String(d.type === 'task'), onclick: () => setType('task') }, icon('task', 'sm'), 'Tarea'),
    );
  };
  function setType(t) {
    if (d.type === t) return;
    d.type = t;
    if (t === 'task' && !item) setAllDay(true);
    renderType(); renderWhen(); updateHead();
  }

  const when = h('div');
  function setAllDay(v) {
    const before = d.allDay;
    d.allDay = v;
    if (before !== v) {
      const def = defaultReminders(before);
      if (JSON.stringify(d.reminders) === JSON.stringify(def)) d.reminders = defaultReminders(v);
      if (v) { d.start.setHours(0, 0, 0, 0); d.end = new Date(d.start); }
      else {
        const n = new Date(); d.start.setHours(Math.min(n.getHours() + 1, 23), 0, 0, 0);
        d.end = new Date(d.start.getTime() + (d.type === 'task' ? 1800000 : 3600000));
      }
    }
    renderWhen(); renderReminders();
  }
  const dateInput = (date, onchange) => h('input.field', { type: 'date', value: toISODate(date), required: true, onchange: (e) => e.target.value && onchange(fromISODate(e.target.value)) });
  const timeInput = (date, onchange) => h('input.field', { type: 'time', value: toHM(date), step: 300, onchange: (e) => { if (!e.target.value) return; const [hh, mm] = e.target.value.split(':').map(Number); onchange(hh, mm); } });

  function renderWhen() {
    clear(when);
    const isTask = d.type === 'task';
    when.append(
      h('div.switch-row',
        h('div.txt', isTask ? 'Sin hora' : 'Todo el día', h('small', isTask ? 'La tarea vence ese día' : 'Ocupa el día completo')),
        h('label.switch', h('input', { type: 'checkbox', checked: d.allDay, onchange: (e) => setAllDay(e.target.checked) }), h('span.track'), h('span.knob')),
      ),
    );
    const keepDur = (newStart) => { const dur = d.end - d.start; d.start = newStart; d.end = new Date(newStart.getTime() + Math.max(dur, 0)); renderWhen(); };
    if (isTask) {
      const row = h('div.cols', h('label.fld', h('span.fl', 'Fecha límite'), dateInput(d.start, (nd) => { nd.setHours(d.start.getHours(), d.start.getMinutes()); keepDur(nd); })));
      if (!d.allDay) row.append(h('label.fld', h('span.fl', 'Hora'), timeInput(d.start, (hh, mm) => { const s = new Date(d.start); s.setHours(hh, mm); keepDur(s); })));
      when.append(row);
    } else if (d.allDay) {
      when.append(h('div.cols',
        h('label.fld', h('span.fl', 'Desde'), dateInput(d.start, (nd) => keepDur(nd))),
        h('label.fld', h('span.fl', 'Hasta'), dateInput(d.end, (nd) => { d.end = nd < d.start ? new Date(d.start) : nd; renderWhen(); })),
      ));
    } else {
      when.append(
        h('div.cols',
          h('label.fld', h('span.fl', 'Empieza'), dateInput(d.start, (nd) => { nd.setHours(d.start.getHours(), d.start.getMinutes()); keepDur(nd); })),
          h('label.fld', { style: { flex: '0 0 38%' } }, h('span.fl', 'Hora'), timeInput(d.start, (hh, mm) => { const s = new Date(d.start); s.setHours(hh, mm); keepDur(s); })),
        ),
        h('div.cols',
          h('label.fld', h('span.fl', 'Termina'), dateInput(d.end, (nd) => { nd.setHours(d.end.getHours(), d.end.getMinutes()); d.end = nd < d.start ? new Date(d.start.getTime() + 3600000) : nd; renderWhen(); })),
          h('label.fld', { style: { flex: '0 0 38%' } }, h('span.fl', 'Hora'), timeInput(d.end, (hh, mm) => { const e = new Date(d.end); e.setHours(hh, mm); if (e <= d.start) e.setTime(d.start.getTime() + 3600000); d.end = e; renderWhen(); })),
        ),
      );
    }
    if (showRecur) when.append(recurBlock());
  }

  function recurBlock() {
    const r = d.recur || { freq: 'none' };
    const wrap = h('div');
    const sel = h('select.field', {
      onchange: (e) => {
        d.recur = { ...r, freq: e.target.value, end: r.end || 'never' };
        if (d.recur.freq === 'WEEKLY' && !(d.recur.byDay && d.recur.byDay.length)) d.recur.byDay = [weekdayMon(d.start)];
        renderWhen();
      },
    },
    [['none', 'No se repite'], ['DAILY', 'Cada día'], ['WEEKLY', 'Cada semana'], ['MONTHLY', `Cada mes (día ${d.start.getDate()})`], ['YEARLY', 'Cada año']]
      .map(([v, l]) => h('option', { value: v, selected: r.freq === v }, l)));
    wrap.append(h('label.fld', h('span.fl', 'Repetir'), sel));
    if (r.freq === 'WEEKLY') {
      wrap.append(h('div.chips.days', { style: { marginTop: '10px' } }, DAY_ES.map((l, i) => h('button.chip', {
        type: 'button', 'aria-pressed': String((r.byDay || []).includes(i)), style: { minWidth: '40px', justifyContent: 'center' },
        onclick: () => {
          const set = new Set(r.byDay || []);
          set.has(i) ? set.delete(i) : set.add(i);
          if (!set.size) set.add(weekdayMon(d.start));
          d.recur = { ...r, byDay: [...set] }; renderWhen();
        },
      }, l))));
    }
    if (r.freq !== 'none') {
      const endSel = h('select.field', { onchange: (e) => { d.recur = { ...r, end: e.target.value }; if (d.recur.end === 'until' && !d.recur.until) d.recur.until = toISODate(addDays(d.start, 90)); if (d.recur.end === 'count' && !d.recur.count) d.recur.count = 10; renderWhen(); } },
        [['never', 'Sin fin'], ['until', 'Hasta una fecha'], ['count', 'Nº de veces']].map(([v, l]) => h('option', { value: v, selected: (r.end || 'never') === v }, l)));
      const row = h('div.cols', h('label.fld', h('span.fl', 'Termina'), endSel));
      if (r.end === 'until') row.append(h('label.fld', h('span.fl', 'Fecha'), h('input.field', { type: 'date', value: r.until, onchange: (e) => { d.recur = { ...r, until: e.target.value }; } })));
      if (r.end === 'count') row.append(h('label.fld', h('span.fl', 'Veces'), h('input.field', { type: 'number', min: 1, max: 999, inputmode: 'numeric', value: r.count, onchange: (e) => { d.recur = { ...r, count: Math.max(1, +e.target.value || 1) }; } })));
      wrap.append(row, h('p.hint', describeRecurrence(d.recur)));
    }
    return wrap;
  }

  // --- Avisos ---
  const remBox = h('div');
  function renderReminders() {
    clear(remBox);
    const list = d.reminders;
    const chips = h('div.chips', { style: { marginBottom: '10px' } },
      list.length ? list.map((r, i) => h('button.chip', { type: 'button', 'aria-pressed': 'true', 'aria-label': `Quitar aviso ${reminderLabel(r.minutes, d.allDay)}`, onclick: () => { d.reminders = list.filter((_, j) => j !== i); renderReminders(); } },
        icon('bell', 'xs'), reminderLabel(r.minutes, d.allDay), h('span.x', '×'))) : h('p.hint', { style: { margin: '0' } }, 'Sin avisos'));
    const presets = (d.allDay ? REMINDER_PRESETS_ALLDAY : REMINDER_PRESETS_TIMED).filter((p) => !list.some((r) => r.minutes === p.minutes));
    const add = h('div.chips', presets.map((p) => h('button.chip.add', {
      type: 'button', disabled: list.length >= 5,
      onclick: () => { if (d.reminders.length >= 5) return toast('Máximo 5 avisos'); d.reminders = [...list, { method: 'popup', minutes: p.minutes }].sort((a, b) => a.minutes - b.minutes); renderReminders(); },
    }, '+ ', p.label)));
    // Personalizado
    const num = h('input.field', { type: 'number', min: 0, max: 40320, inputmode: 'numeric', placeholder: 'Nº', style: { flex: '0 0 30%' } });
    const unit = h('select.field', {}, [['1', 'minutos antes'], ['60', 'horas antes'], ['1440', 'días antes'], ['10080', 'semanas antes']].map(([v, l]) => h('option', { value: v }, l)));
    const custom = h('div.cols', { style: { marginTop: '12px' } }, num, unit, h('button.btn.ghost', {
      type: 'button', style: { flex: '0 0 auto' }, 'aria-label': 'Añadir aviso personalizado',
      onclick: () => {
        const m = Math.round((+num.value || 0) * +unit.value);
        if (num.value === '' || m < 0 || m > 40320) return toast('Aviso entre 0 y 4 semanas', { error: true });
        if (d.reminders.length >= 5) return toast('Máximo 5 avisos');
        if (!d.reminders.some((r) => r.minutes === m)) d.reminders = [...d.reminders, { method: 'popup', minutes: m }].sort((a, b) => a.minutes - b.minutes);
        renderReminders();
      },
    }, icon('plus', 'sm')));
    remBox.append(chips, add, custom,
      h('div.switch-row', { style: { marginTop: '8px' } },
        h('div.txt', 'Para los dos', h('small', 'Los mismos avisos llegarán a ambas cuentas')),
        h('label.switch', h('input', { type: 'checkbox', checked: d.remBoth, onchange: (e) => { d.remBoth = e.target.checked; } }), h('span.track'), h('span.knob')),
      ));
  }

  // --- Color ---
  const colorBox = h('div');
  function renderColors() {
    clear(colorBox).append(
      h('div.swatches', COLORS.map((c) => h('button.swatch', {
        type: 'button', '--c': colorHex(c.id), 'aria-label': c.name, 'aria-pressed': String((d.colorId || '') === c.id),
        onclick: () => { d.colorId = c.id; renderColors(); },
      }))),
      h('div.swatch-name', colorName(d.colorId), (d.colorId || '') === '' ? ' · color del calendario' : ''),
    );
  }

  const sectionRule = (n, label) => h('h3.grp', label);
  body.append(
    typeSeg,
    h('div', { style: { height: '14px' } }),
    titleInput,
    sectionRule('01', 'Cuándo'), when,
    sectionRule('02', 'Avisos'), remBox,
    sectionRule('03', 'Color'), colorBox,
    sectionRule('04', 'Detalles'),
    h('label.fld', h('span.fl', 'Ubicación'), h('input.field', { type: 'text', value: d.location, placeholder: 'Dirección o lugar', autocomplete: 'off', oninput: (e) => { d.location = e.target.value; } })),
    h('label.fld', h('span.fl', 'Notas'), h('textarea.field', { placeholder: 'Detalles, enlaces, lista…', oninput: (e) => { d.notes = e.target.value; } }, d.notes)),
  );
  renderType(); renderWhen(); renderReminders(); renderColors();

  // --- Guardar / borrar ---
  const saveBtn = h('button.btn.primary', { type: 'button', onclick: save }, icon('check', 'sm'), 'Guardar');
  async function save() {
    d.title = titleInput.value.trim();
    if (!d.title) { titleInput.focus(); return toast('Ponle un título', { error: true }); }
    if (!d.allDay && d.end <= d.start) d.end = new Date(d.start.getTime() + 3600000);
    saveBtn.disabled = true;
    try {
      if (item) await updateItem(item, d, scope);
      else await createItem(d);
      sheet.close();
      toast(item ? 'Cambios guardados' : d.type === 'task' ? 'Tarea creada' : 'Evento creado');
    } catch (e) {
      console.error(e);
      toast(`No se pudo guardar: ${e.message}`, { error: true });
    } finally { saveBtn.disabled = false; }
  }
  const foot = h('div', { style: { display: 'contents' } },
    item ? h('button.btn.danger', { type: 'button', style: { flex: '0 0 auto' }, 'aria-label': 'Eliminar', onclick: async () => { if (await confirmDelete(item, scope)) sheet.close(); } }, icon('trash', 'sm')) : null,
    saveBtn,
  );

  const headTitle = () => `${item ? 'Editar' : 'Nueva'} ${d.type === 'task' ? 'tarea' : 'evento'}`.replace('Nueva evento', 'Nuevo evento');
  sheet = openSheet({ title: headTitle(), body, foot, tall: true });
  function updateHead() { sheet.el.querySelector('.sheet-head h2').textContent = headTitle(); }
  if (!item && !d.title) setTimeout(() => titleInput.focus(), 350);
  return sheet;
}

async function confirmDelete(item, scope) {
  if (item.recurringEventId && !scope) { scope = await askScope(item, 'Eliminar'); if (!scope) return false; }
  if (!item.recurringEventId) {
    const ok = await choose(`¿Eliminar "${item.title}"?`, [{ key: 'yes', label: 'Eliminar', danger: true }, { key: 'no', label: 'Cancelar' }]);
    if (ok !== 'yes') return false;
  }
  try {
    await deleteItem(item, scope || 'single');
    if (!item.recurringEventId) toast('Eliminado', { action: 'Deshacer', onAction: () => restore(item.raw).catch((e) => toast(e.message, { error: true })) });
    else toast(scope === 'series' ? 'Serie eliminada' : 'Eliminado');
    return true;
  } catch (e) {
    toast(`No se pudo eliminar: ${e.message}`, { error: true });
    return false;
  }
}

/** Hoja de detalle (al tocar un elemento) */
export function openDetail(item) {
  const c = colorHex(item.colorId);
  const whenTxt = (() => {
    if (item.allDay) {
      const last = addDays(item.end, -1);
      return +last > +item.start ? `${cap(fmtLongDate(item.start))} → ${fmtLongDate(last)}` : `${cap(fmtLongDate(item.start))} · todo el día`;
    }
    return `${cap(fmtLongDate(item.start))} · ${toHM(item.start)}–${toHM(item.end)}`;
  })();
  const rows = [];
  if (item.location) {
    rows.push(h('div.fact', icon('pin', 'sm'), h('a', { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`, target: '_blank', rel: 'noopener' }, item.location)));
  }
  const rec = item.recurringEventId ? 'Evento repetido' : item.recurrence ? describeRecurrence(parseRecurrence(item.recurrence)) : null;
  if (rec) rows.push(h('div.fact', icon('repeat', 'sm'), h('span', rec)));
  const rems = item.useDefaultReminders ? null : item.reminders;
  rows.push(h('div.fact', icon('bell', 'sm'), h('span',
    rems && rems.length ? rems.map((r) => reminderLabel(r.minutes, item.allDay)).join(' · ') : item.useDefaultReminders ? 'Avisos por defecto del calendario' : 'Sin avisos',
    item.remBoth ? h('span.tag', 'Los dos') : null)));
  if (item.notes) rows.push(h('div.fact', icon('notes', 'sm'), h('div.notes', stripHtml(item.notes))));
  rows.push(h('div.fact', icon('palette', 'sm'), h('span', colorName(item.colorId))));

  let s;
  const body = h('div',
    h('div.detail', { '--c': c }, h('div.bar'),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div.kind', item.type === 'task' ? (item.done ? 'Tarea · hecha' : 'Tarea') : 'Evento'),
        h('h3', item.title),
        h('div.when', whenTxt),
      )),
    h('div.facts', rows),
  );
  const foot = h('div', { style: { display: 'contents' } },
    h('button.btn.danger', { type: 'button', style: { flex: '0 0 auto' }, 'aria-label': 'Eliminar', onclick: async () => { if (await confirmDelete(item)) s.close(); } }, icon('trash', 'sm')),
    item.type === 'task'
      ? h('button.btn.ghost', { type: 'button', onclick: async () => { s.close(); await toggleDoneWithUndo(item); } }, icon('check', 'sm'), item.done ? 'Reabrir' : 'Hecha')
      : null,
    h('button.btn.primary', { type: 'button', onclick: () => { s.close(); openEditor({ item }); } }, icon('edit', 'sm'), 'Editar'),
  );
  s = openSheet({ title: item.type === 'task' ? 'Tarea' : 'Evento', body, foot });
}

export async function toggleDoneWithUndo(item) {
  const to = !item.done;
  try {
    await toggleDone(item, to);
    toast(to ? `✓ ${item.title}` : 'Tarea reabierta', { action: 'Deshacer', onAction: () => toggleDone({ ...item, done: to }, !to).catch(() => {}) });
  } catch (e) { toast(`No se pudo actualizar: ${e.message}`, { error: true }); }
}

function stripHtml(s) {
  // DOMParser no ejecuta scripts ni carga recursos
  const doc = new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
  return doc.body.textContent || '';
}
