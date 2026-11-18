// Backend de demostración en memoria (?demo=1). Imita la parte de la API de Google Calendar que usa la app.
// Permite probar la interfaz sin cuenta de Google. Los datos se pierden al recargar.

import { addDays, startOfDay, toISODate, toRFC3339, fromISODate, addMonths } from './dates.js';
import { stripNulls } from './model.js';
import { parseRecurrence } from './recurrence.js';

let seq = 1;
const masters = new Map();     // id -> evento
const overrides = new Map();   // instanceId -> parche
const exdates = new Set();     // instanceId borradas

const clone = (o) => JSON.parse(JSON.stringify(o));

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === null) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') out[k] = deepMerge(a[k], v);
    else out[k] = v;
  }
  return out;
}

function evStart(e) { return e.start.date ? fromISODate(e.start.date) : new Date(e.start.dateTime); }
function evEnd(e) { return e.end.date ? fromISODate(e.end.date) : new Date(e.end.dateTime); }

function shift(e, from, to) {
  const delta = to - from;
  const out = clone(e);
  if (e.start.date) {
    out.start.date = toISODate(new Date(fromISODate(e.start.date).getTime() + delta));
    out.end.date = toISODate(new Date(fromISODate(e.end.date).getTime() + delta));
  } else {
    out.start.dateTime = toRFC3339(new Date(new Date(e.start.dateTime).getTime() + delta));
    out.end.dateTime = toRFC3339(new Date(new Date(e.end.dateTime).getTime() + delta));
  }
  return out;
}

function expand(master, timeMin, timeMax) {
  const r = parseRecurrence(master.recurrence);
  if (r.freq === 'none') return [master];
  const out = [];
  const s0 = evStart(master);
  const until = r.end === 'until' ? addDays(fromISODate(r.until), 1) : null;
  let count = 0;
  const step = r.interval || 1;
  const push = (d) => {
    count++;
    if (r.end === 'count' && count > r.count) return false;
    if (until && d >= until) return false;
    const inst = shift(master, s0, d);
    const key = `${master.id}_${toISODate(d).replace(/-/g, '')}`;
    if (exdates.has(key)) return true;
    let e = { ...inst, id: key, recurringEventId: master.id, originalStartTime: inst.start };
    delete e.recurrence;
    if (overrides.has(key)) e = deepMerge(e, overrides.get(key));
    out.push(e);
    return true;
  };
  for (let i = 0; i < 800; i++) {
    let d;
    if (r.freq === 'DAILY') d = addDays(s0, i * step);
    else if (r.freq === 'MONTHLY') d = addMonths(s0, i * step);
    else if (r.freq === 'YEARLY') d = addMonths(s0, i * step * 12);
    else if (r.freq === 'WEEKLY') {
      const days = r.byDay && r.byDay.length ? r.byDay : [((s0.getDay() + 6) % 7)];
      const weekStart = addDays(startOfDay(s0), -((s0.getDay() + 6) % 7) + i * 7 * step);
      let stop = false;
      for (const wd of [...days].sort()) {
        const dd = addDays(weekStart, wd);
        dd.setHours(s0.getHours(), s0.getMinutes(), 0, 0);
        if (dd < s0) continue;
        if (dd > timeMax) { stop = true; break; }
        if (!push(dd)) { stop = true; break; }
      }
      if (stop) break;
      continue;
    }
    if (d > timeMax) break;
    if (!push(d)) break;
  }
  return out;
}

function matchesShared(e, shared) {
  if (!shared) return true;
  const props = (e.extendedProperties && e.extendedProperties.shared) || {};
  const list = Array.isArray(shared) ? shared : [shared];
  return list.every((s) => { const [k, v] = s.split('='); return props[k] === v; });
}

function seed() {
  const today = startOfDay(new Date());
  const at = (dayOffset, h, m = 0) => { const d = addDays(today, dayOffset); d.setHours(h, m, 0, 0); return d; };
  const timed = (summary, s, mins, extra = {}) => ({
    summary, start: { dateTime: toRFC3339(s) }, end: { dateTime: toRFC3339(new Date(s.getTime() + mins * 60000)) },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
    extendedProperties: { shared: { fcType: 'event' } }, ...extra,
  });
  const allday = (summary, dayOffset, days = 1, extra = {}) => ({
    summary, start: { date: toISODate(addDays(today, dayOffset)) }, end: { date: toISODate(addDays(today, dayOffset + days)) },
    reminders: { useDefault: false, overrides: [] }, extendedProperties: { shared: { fcType: 'event' } }, ...extra,
  });
  const task = (title, dayOffset, done = false, extra = {}) => ({
    summary: (done ? '☑ ' : '☐ ') + title,
    start: { date: toISODate(addDays(today, dayOffset)) }, end: { date: toISODate(addDays(today, dayOffset + 1)) },
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { shared: { fcType: 'task', fcDone: done ? '1' : '0' } }, ...extra,
  });
  [
    timed('Dentista', at(0, 9, 30), 45, { location: 'Clínica Arganzuela', colorId: '9' }),
    timed('Reunión con el banco', at(0, 12, 0), 60, { colorId: '8' }),
    task('Comprar regalo cumple Marta', 0, false, { colorId: '5' }),
    timed('Cena con Laura y Dani', at(0, 21, 0), 150, { location: 'Casa Lucio', colorId: '11', reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 120 }] }, extendedProperties: { shared: { fcType: 'event', fcRem: 'popup:120', fcRemBoth: '1' } } }),
    task('Pagar seguro del coche', -2, false, { colorId: '6' }),
    task('Llamar al fontanero', -1, false),
    task('Devolver libro biblioteca', -1, true),
    timed('Gimnasio', at(1, 19, 0), 75, { colorId: '10', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'] }),
    task('Recoger paquete Correos', 1, false, { colorId: '7' }),
    timed('Revisión ITV', at(2, 10, 15), 60, { colorId: '2', location: 'ITV Getafe' }),
    allday('Escapada a Asturias', 4, 3, { colorId: '7', location: 'Cangas de Onís' }),
    timed('Yoga', at(3, 8, 0), 60, { colorId: '1' }),
    task('Reservar casa rural', 3, true, { colorId: '3' }),
    allday('Cumpleaños de mamá', 9, 1, { colorId: '4', recurrence: ['RRULE:FREQ=YEARLY'] }),
    timed('Cine: estreno', at(6, 22, 0), 120, { colorId: '3' }),
    timed('Compra semanal', at(5, 11, 0), 60, { colorId: '5', recurrence: ['RRULE:FREQ=WEEKLY'] }),
    task('Renovar DNI', 12, false, { colorId: '8' }),
    task('Sacar el reciclaje', 1, false, { colorId: '2', recurrence: ['RRULE:FREQ=WEEKLY'] }),
    task('Pedir cita revisión caldera', 5, false),
    task('Declaración de la renta', 40, false, { colorId: '11' }),
    task('Pagar comunidad', -6, true, { colorId: '6' }),
  ].forEach((e) => { const id = `demo${seq++}`; masters.set(id, { id, status: 'confirmed', ...e }); });
}
seed();

export const demoApi = {
  async listCalendars() {
    return [{ id: 'demo-calendar', summary: 'Casa (demo)', accessRole: 'owner', backgroundColor: '#C8A15A' },
      { id: 'demo-primary', summary: 'Personal (demo)', accessRole: 'owner', primary: true }];
  },
  async listEvents(calId, { timeMin, timeMax, q, shared } = {}) {
    timeMin = timeMin || new Date(0); timeMax = timeMax || addDays(new Date(), 3650);
    let out = [];
    for (const m of masters.values()) out = out.concat(expand(m, timeMin, timeMax));
    out = out.filter((e) => evEnd(e) > timeMin && evStart(e) < timeMax && matchesShared(e, shared));
    if (q) { const qq = q.toLowerCase(); out = out.filter((e) => `${e.summary} ${e.location || ''} ${e.description || ''}`.toLowerCase().includes(qq)); }
    out.sort((a, b) => evStart(a) - evStart(b));
    await new Promise((r) => setTimeout(r, 60));
    return clone(out);
  },
  async getEvent(calId, id) { return clone(masters.get(id)); },
  async insertEvent(calId, body) {
    const id = `demo${seq++}`;
    const e = { id, status: 'confirmed', ...stripNulls(body) };
    masters.set(id, e);
    return clone(e);
  },
  async patchEvent(calId, id, body) {
    if (masters.has(id)) { const e = deepMerge(masters.get(id), body); if (body.recurrence && !body.recurrence.length) delete e.recurrence; masters.set(id, e); return clone(e); }
    overrides.set(id, deepMerge(overrides.get(id) || {}, body));
    return { id, ...body };
  },
  async deleteEvent(calId, id) {
    if (masters.has(id)) masters.delete(id); else exdates.add(id);
    return null;
  },
};
