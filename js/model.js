// Conversión entre eventos de Google Calendar y los elementos de la app (eventos y tareas).

import { fromISODate, toISODate, toRFC3339, addDays, localTimeZone } from './dates.js';
import { buildRecurrence } from './recurrence.js';

// Los 11 colores de evento de Google (colorId). El tono concreto lo pone cada estilo
// con las variables CSS --ev-N (css/styles.css); aquí solo van el id y el nombre.
// En Google Calendar se ven con el color equivalente de Google.
export const COLORS = [
  { id: '', name: 'Calendario', note: 'color del calendario' },
  { id: '1', name: 'Lavanda' },
  { id: '2', name: 'Salvia' },
  { id: '3', name: 'Uva' },
  { id: '4', name: 'Flamenco' },
  { id: '5', name: 'Plátano' },
  { id: '6', name: 'Mandarina' },
  { id: '7', name: 'Pavo real' },
  { id: '8', name: 'Grafito' },
  { id: '9', name: 'Arándano' },
  { id: '10', name: 'Albahaca' },
  { id: '11', name: 'Tomate' },
];
const known = (id) => COLORS.some((c) => c.id === (id || ''));
/** Valor CSS del color de un evento (se usa en la variable --c) */
export const colorHex = (id) => `var(--ev-${known(id) && id ? id : 0})`;
export const colorName = (id) => (COLORS.find((c) => c.id === (id || '')) || COLORS[0]).name;

const TASK_OPEN = '☐ ';
const TASK_DONE = '☑ ';

/** Codifica avisos como "popup:30,popup:1440" */
export const encodeReminders = (list) => list.map((r) => `${r.method || 'popup'}:${r.minutes}`).join(',');
export const decodeReminders = (s) => (s ? s.split(',').filter(Boolean).map((p) => {
  const [method, minutes] = p.split(':');
  return { method, minutes: Number(minutes) };
}) : []);
/** Hash corto y estable para versionar los avisos compartidos */
export function remHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export function sameReminders(a, b) {
  const norm = (l) => l.map((r) => `${r.method}:${r.minutes}`).sort().join(',');
  return norm(a) === norm(b);
}

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} [recurringEventId]
 * @property {'event'|'task'} type
 * @property {string} title
 * @property {boolean} done
 * @property {boolean} allDay
 * @property {Date} start
 * @property {Date} end  (exclusivo; en día completo es el día siguiente al último)
 * @property {string} location
 * @property {string} notes
 * @property {string} colorId
 * @property {{method:string,minutes:number}[]} reminders  avisos de la cuenta actual
 * @property {boolean} useDefaultReminders
 * @property {{method:string,minutes:number}[]} sharedReminders
 * @property {boolean} remBoth
 * @property {string[]} [recurrence]
 * @property {Object} raw
 */

/** @returns {Item} */
export function fromGoogle(ev) {
  const sh = (ev.extendedProperties && ev.extendedProperties.shared) || {};
  const isTask = sh.fcType === 'task';
  let title = ev.summary || '';
  if (isTask) title = title.replace(/^[☐☑✓✔]\s*/, '');
  const allDay = !!(ev.start && ev.start.date);
  const start = allDay ? fromISODate(ev.start.date) : new Date(ev.start.dateTime);
  const end = allDay ? fromISODate(ev.end.date) : new Date(ev.end.dateTime);
  const rem = ev.reminders || { useDefault: true };
  return {
    id: ev.id,
    recurringEventId: ev.recurringEventId,
    type: isTask ? 'task' : 'event',
    title: title || '(Sin título)',
    done: isTask && sh.fcDone === '1',
    allDay,
    start,
    end,
    location: ev.location || '',
    notes: ev.description || '',
    colorId: ev.colorId || '',
    reminders: rem.overrides || [],
    useDefaultReminders: !!rem.useDefault,
    sharedReminders: decodeReminders(sh.fcRem),
    remBoth: sh.fcRemBoth === '1',
    remVersion: sh.fcRemV || '',
    recurrence: ev.recurrence,
    status: ev.status,
    raw: ev,
  };
}

/**
 * Construye el recurso de Google a partir de un borrador del formulario.
 * @param {Object} d  {type,title,done,allDay,start,end,location,notes,colorId,reminders,remBoth,recur}
 */
export function toGoogle(d) {
  const isTask = d.type === 'task';
  const prefix = isTask ? (d.done ? TASK_DONE : TASK_OPEN) : '';
  const res = {
    summary: prefix + (d.title || '').trim(),
    location: d.location || '',
    description: d.notes || '',
    colorId: d.colorId || null,
  };
  if (d.allDay) {
    const s = new Date(d.start); s.setHours(0, 0, 0, 0);
    let e = new Date(d.end || d.start); e.setHours(0, 0, 0, 0);
    if (e <= s) e = addDays(s, 1);
    res.start = { date: toISODate(s), dateTime: null };
    res.end = { date: toISODate(e), dateTime: null };
  } else {
    const tz = localTimeZone();
    let e = d.end && d.end > d.start ? d.end : new Date(d.start.getTime() + (isTask ? 30 : 60) * 60000);
    res.start = { dateTime: toRFC3339(d.start), timeZone: tz, date: null };
    res.end = { dateTime: toRFC3339(e), timeZone: tz, date: null };
  }
  const reminders = (d.reminders || []).slice(0, 5);
  res.reminders = reminders.length ? { useDefault: false, overrides: reminders } : { useDefault: false, overrides: [] };
  const remStr = encodeReminders(reminders);
  res.extendedProperties = {
    shared: {
      fcType: isTask ? 'task' : 'event',
      fcDone: isTask ? (d.done ? '1' : '0') : null,
      fcRem: remStr || null,
      fcRemBoth: d.remBoth ? '1' : '0',
      fcRemV: d.remBoth ? remHash(remStr) : null,
    },
  };
  if (d.recur !== undefined) {
    const rr = buildRecurrence(d.recur);
    res.recurrence = rr || [];
  }
  return res;
}

/** Parche mínimo para marcar/desmarcar una tarea */
export function taskDonePatch(item, done) {
  return {
    summary: (done ? TASK_DONE : TASK_OPEN) + item.title,
    extendedProperties: { shared: { fcType: 'task', fcDone: done ? '1' : '0' } },
  };
}

/** Ordena: día completo primero, luego por hora de inicio, tareas pendientes antes que hechas */
export function sortItems(a, b) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.start - b.start) return a.start - b.start;
  if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
  if (a.done !== b.done) return a.done ? 1 : -1;
  return a.title.localeCompare(b.title, 'es');
}

/** ¿Ocurre el elemento en el día d? */
export function occursOn(item, d) {
  const s = new Date(d); s.setHours(0, 0, 0, 0);
  const e = addDays(s, 1);
  return item.start < e && item.end > s || (+item.start === +item.end && item.start >= s && item.start < e);
}

export function isOverdueTask(item, now = new Date()) {
  if (item.type !== 'task' || item.done) return false;
  if (item.allDay) { const t = new Date(now); t.setHours(0, 0, 0, 0); return item.start < t; }
  return item.end < now;
}

// Avisos predefinidos
export const REMINDER_PRESETS_TIMED = [
  { minutes: 0, label: 'Al empezar' },
  { minutes: 10, label: '10 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 1440, label: '1 día' },
  { minutes: 2880, label: '2 días' },
  { minutes: 10080, label: '1 semana' },
];
// Día completo: minutos antes de las 00:00 del día
export const REMINDER_PRESETS_ALLDAY = [
  { minutes: 900, label: 'Día antes 9:00' },
  { minutes: 360, label: 'Día antes 18:00' },
  { minutes: 2340, label: '2 días antes 9:00' },
  { minutes: 9540, label: '1 semana antes 9:00' },
];

export function reminderLabel(minutes, allDay) {
  const preset = (allDay ? REMINDER_PRESETS_ALLDAY : REMINDER_PRESETS_TIMED).find((p) => p.minutes === minutes);
  if (preset) return allDay ? preset.label : (minutes === 0 ? preset.label : `${preset.label} antes`);
  if (allDay) {
    const days = Math.ceil(minutes / 1440);
    const atMin = days * 1440 - minutes;
    const hh = String(Math.floor(atMin / 60)).padStart(2, '0'), mm = String(atMin % 60).padStart(2, '0');
    return `${days} día${days > 1 ? 's' : ''} antes ${hh}:${mm}`;
  }
  if (minutes % 10080 === 0) return `${minutes / 10080} sem antes`;
  if (minutes % 1440 === 0) return `${minutes / 1440} días antes`;
  if (minutes % 60 === 0) return `${minutes / 60} h antes`;
  return `${minutes} min antes`;
}

/** Quita claves con null (para inserciones; en PATCH los null sirven para borrar campos) */
export function stripNulls(o) {
  if (Array.isArray(o)) return o.map(stripNulls);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = stripNulls(v);
    return out;
  }
  return o;
}
