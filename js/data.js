// Estado compartido y capa de datos (caché, altas, ediciones, borrados).

import { store } from './store.js';
import { fromGoogle, toGoogle, toPatch, taskDonePatch, sortItems, stripNulls } from './model.js';
import { addDays, startOfDay } from './dates.js';
import { AuthError } from './api.js';
import { markApplied } from './reminders-sync.js';
import { TASKS_PAST_DAYS, TASKS_FUTURE_DAYS } from './tasks.js';

export const state = {
  api: null,
  demo: false,
  calId: null,
  calName: '',
  online: navigator.onLine,
};

export const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

const cache = new Map(); // clave -> {t, items}
const TTL = 45_000;
let pending = 0;

let busyTimer;
function loading(delta) {
  const was = pending > 0;
  pending += delta;
  const now = pending > 0;
  if (was === now) return;
  // La pastilla de estado muestra «Sincronizando» solo si la espera se nota
  clearTimeout(busyTimer);
  if (now) busyTimer = setTimeout(() => emit('busy', true), 250);
  else emit('busy', false);
}

async function guard(fn) {
  loading(1);
  try { return await fn(); }
  catch (e) {
    if (e instanceof AuthError) emit('auth-required');
    throw e;
  } finally { loading(-1); }
}

export const toItems = (raw) => raw.map(fromGoogle);

export function invalidate() { cache.clear(); }

/** Elementos que ocurren entre start (incl.) y end (excl.) */
export async function fetchRange(start, end, { force = false } = {}) {
  const key = `${+start}-${+end}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.t < TTL) return hit.items;
  try {
    const raw = await guard(() => state.api.listEvents(state.calId, { timeMin: start, timeMax: end }));
    const items = toItems(raw).sort(sortItems);
    cache.set(key, { t: Date.now(), items });
    return items;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    // Sin conexión: usa la copia guardada si cubre el rango
    const off = store.get(`offline:${state.calId}`);
    if (off) {
      const items = toItems(off.raw).filter((i) => i.end > start && i.start < end).sort(sortItems);
      emit('offline', true);
      return items;
    }
    throw e;
  }
}

/** Tareas pendientes vencidas (hasta 90 días atrás) */
export async function fetchOverdue() {
  const today = startOfDay(new Date());
  const raw = await guard(() => state.api.listEvents(state.calId, {
    timeMin: addDays(today, -90), timeMax: new Date(),
    shared: ['fcType=task', 'fcDone=0'],
  })).catch((e) => { if (e instanceof AuthError) throw e; return []; });
  const now = new Date();
  return toItems(raw).filter((i) => i.type === 'task' && !i.done && (i.allDay ? i.end <= today : i.end < now)).sort(sortItems);
}

/** Guarda copia para uso sin conexión (próximas semanas) */
export async function saveOffline() {
  try {
    const now = startOfDay(new Date());
    const raw = await state.api.listEvents(state.calId, { timeMin: addDays(now, -7), timeMax: addDays(now, 60) });
    store.set(`offline:${state.calId}`, { t: Date.now(), raw: raw.map(stripRaw) });
  } catch { /* no crítico */ }
}
const stripRaw = (e) => ({
  id: e.id, recurringEventId: e.recurringEventId, summary: e.summary, start: e.start, end: e.end,
  location: e.location, description: e.description, colorId: e.colorId, reminders: e.reminders,
  extendedProperties: e.extendedProperties, recurrence: e.recurrence, status: e.status,
});

/** Todas las tareas de la pestaña «Tareas» (90 días atrás, un año adelante) */
export async function fetchTasks({ force = false } = {}) {
  const hit = cache.get('tasks');
  if (!force && hit && Date.now() - hit.t < TTL) return hit.items;
  const today = startOfDay(new Date());
  const start = addDays(today, -TASKS_PAST_DAYS), end = addDays(today, TASKS_FUTURE_DAYS);
  try {
    const raw = await guard(() => state.api.listEvents(state.calId, { timeMin: start, timeMax: end, shared: ['fcType=task'] }));
    const items = toItems(raw).filter((i) => i.type === 'task');
    cache.set('tasks', { t: Date.now(), items });
    return items;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    const off = store.get(`offline:${state.calId}`);
    if (off) {
      emit('offline', true);
      return toItems(off.raw).filter((i) => i.type === 'task');
    }
    throw e;
  }
}

export async function search(q) {
  const now = new Date();
  const raw = await guard(() => state.api.listEvents(state.calId, {
    q, timeMin: addDays(now, -365), timeMax: addDays(now, 730), maxResults: 250,
  }));
  return toItems(raw);
}

// ----------------- Mutaciones -----------------

function changed() { invalidate(); emit('changed'); }

export async function createItem(draft) {
  const body = toGoogle(draft);
  const ev = await guard(() => state.api.insertEvent(state.calId, body));
  if (draft.remBoth) markApplied(ev.id, body.extendedProperties.shared.fcRemV);
  changed();
  return fromGoogle(ev);
}

/**
 * @param {import('./model.js').Item} item  original
 * @param {Object} draft
 * @param {'single'|'series'} scope
 */
export async function updateItem(item, draft, scope = 'single') {
  const body = toGoogle(draft);
  let targetId = item.id;
  let orig = item.raw || {};
  if (item.recurringEventId && scope === 'series') {
    targetId = item.recurringEventId;
    // Mantiene la fecha de inicio de la serie y aplica la nueva hora/duración
    const master = await guard(() => state.api.getEvent(state.calId, targetId));
    orig = master;
    const m = fromGoogle(master);
    const s = new Date(m.start);
    if (!draft.allDay) s.setHours(draft.start.getHours(), draft.start.getMinutes(), 0, 0);
    const dur = (draft.end || draft.start) - draft.start;
    const series = toGoogle({ ...draft, start: s, end: new Date(s.getTime() + dur) });
    Object.assign(body, { start: series.start, end: series.end });
  } else if (item.recurringEventId) {
    delete body.recurrence; // una instancia no puede tener regla propia
  }
  const ev = await guard(() => state.api.patchEvent(state.calId, targetId, toPatch(body, orig)));
  if (draft.remBoth) markApplied(targetId, body.extendedProperties.shared.fcRemV);
  changed();
  return ev;
}

export async function deleteItem(item, scope = 'single') {
  const id = item.recurringEventId && scope === 'series' ? item.recurringEventId : item.id;
  await guard(() => state.api.deleteEvent(state.calId, id));
  changed();
}

export async function toggleDone(item, done = !item.done) {
  await guard(() => state.api.patchEvent(state.calId, item.id, taskDonePatch(item, done)));
  changed();
}

/** Restaura un evento borrado (para "Deshacer") */
export async function restore(raw) {
  const body = stripNulls({ ...raw });
  ['id', 'etag', 'htmlLink', 'iCalUID', 'created', 'updated', 'creator', 'organizer', 'sequence', 'kind', 'recurringEventId', 'originalStartTime'].forEach((k) => delete body[k]);
  await guard(() => state.api.insertEvent(state.calId, body));
  changed();
}
