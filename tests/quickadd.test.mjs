import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd } from '../js/quickadd.js';
import { buildRecurrence, parseRecurrence, describeRecurrence } from '../js/recurrence.js';
import { toGoogle, fromGoogle, taskDonePatch } from '../js/model.js';
import { groupTasks, attentionCount } from '../js/tasks.js';

// "Ahora": martes 17 nov 2026, 10:00
const NOW = new Date(2026, 10, 17, 10, 0);
const ymd = (d) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const hm = (d) => d && `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

test('día de la semana + hora con h', () => {
  const r = parseQuickAdd('cena con Laura viernes 21h', NOW);
  assert.equal(r.title, 'Cena con Laura');
  assert.equal(ymd(r.start), '2026-11-20');
  assert.equal(hm(r.start), '21:00');
  assert.equal(hm(r.end), '22:00');
  assert.equal(r.allDay, false);
  assert.equal(r.type, 'event');
});

test('mañana a las 9:30', () => {
  const r = parseQuickAdd('Dentista mañana a las 9:30', NOW);
  assert.equal(r.title, 'Dentista');
  assert.equal(ymd(r.start), '2026-11-18');
  assert.equal(hm(r.start), '9:30');
});

test('a las 9 de la mañana no confunde "mañana" con fecha', () => {
  const r = parseQuickAdd('reunión jueves a las 9 de la mañana', NOW);
  assert.equal(ymd(r.start), '2026-11-19');
  assert.equal(hm(r.start), '9:00');
  assert.equal(r.title, 'Reunión');
});

test('rango de horas', () => {
  const r = parseQuickAdd('gimnasio de 18 a 19:30', NOW);
  assert.equal(r.title, 'Gimnasio');
  assert.equal(ymd(r.start), '2026-11-17');
  assert.equal(hm(r.start), '18:00');
  assert.equal(hm(r.end), '19:30');
});

test('rango tarde sin indicación (de 5 a 7)', () => {
  const r = parseQuickAdd('pádel el sábado de 5 a 7', NOW);
  assert.equal(ymd(r.start), '2026-11-21');
  assert.equal(hm(r.start), '17:00');
  assert.equal(hm(r.end), '19:00');
  assert.equal(r.title, 'Pádel');
});

test('tarea con día del mes', () => {
  const r = parseQuickAdd('tarea pagar seguro el 25', NOW);
  assert.equal(r.type, 'task');
  assert.equal(r.title, 'Pagar seguro');
  assert.equal(ymd(r.date), '2026-11-25');
  assert.equal(r.allDay, true);
});

test('día del mes ya pasado → mes siguiente', () => {
  const r = parseQuickAdd('revisión caldera el 3', NOW);
  assert.equal(ymd(r.date), '2026-12-3');
});

test('fecha con nombre de mes', () => {
  const r = parseQuickAdd('Cumple mamá 3 de diciembre', NOW);
  assert.equal(r.title, 'Cumple mamá');
  assert.equal(ymd(r.date), '2026-12-3');
  assert.equal(r.allDay, true);
});

test('fecha numérica pasada → año siguiente', () => {
  const r = parseQuickAdd('vacaciones 10/2', NOW);
  assert.equal(ymd(r.date), '2027-2-10');
});

test('hoy y tildes', () => {
  const r = parseQuickAdd('Comprar pan hoy', NOW);
  assert.equal(r.title, 'Comprar pan');
  assert.equal(ymd(r.date), '2026-11-17');
});

test('miércoles con tilde y próximo', () => {
  const r = parseQuickAdd('yoga el próximo miércoles a las 8', NOW);
  assert.equal(ymd(r.start), '2026-11-18');
  assert.equal(hm(r.start), '8:00'); // la heurística de tarde solo aplica a 1-7
});

test('mismo día de la semana sin "próximo" = hoy; con "próximo" = +7', () => {
  assert.equal(ymd(parseQuickAdd('algo martes', NOW).date), '2026-11-17');
  assert.equal(ymd(parseQuickAdd('algo el próximo martes', NOW).date), '2026-11-24');
});

test('solo hora ya pasada → mañana', () => {
  const r = parseQuickAdd('llamar a Pepe a las 9', NOW);
  assert.equal(ymd(r.start), '2026-11-18');
  assert.equal(r.title, 'Llamar a Pepe');
});

test('sin fecha', () => {
  const r = parseQuickAdd('Ideas para el salón', NOW);
  assert.equal(r.date, null);
  assert.equal(r.title, 'Ideas para el salón');
});

test('pasado mañana + 21:00', () => {
  const r = parseQuickAdd('Cine pasado mañana 21:00', NOW);
  assert.equal(ymd(r.start), '2026-11-19');
  assert.equal(hm(r.start), '21:00');
  assert.equal(r.title, 'Cine');
});

test('emoji no descuadra el título', () => {
  const r = parseQuickAdd('🎂 tarta mañana', NOW);
  assert.equal(r.title, '🎂 tarta');
});

test('recurrencia: build/parse/describe', () => {
  const rr = buildRecurrence({ freq: 'WEEKLY', byDay: [4, 0, 2], end: 'count', count: 10 });
  assert.deepEqual(rr, ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10']);
  const p = parseRecurrence(rr);
  assert.deepEqual(p.byDay, [0, 2, 4]);
  assert.equal(p.count, 10);
  assert.equal(describeRecurrence(p), 'Cada semana · L X V · 10 veces');
  const u = buildRecurrence({ freq: 'MONTHLY', interval: 2, end: 'until', until: '2027-06-30' });
  assert.deepEqual(u, ['RRULE:FREQ=MONTHLY;INTERVAL=2;UNTIL=20270630T235959Z']);
  assert.equal(parseRecurrence(u).until, '2027-06-30');
  assert.equal(buildRecurrence({ freq: 'none' }), undefined);
});

test('modelo: tarea ida y vuelta', () => {
  const g = toGoogle({
    type: 'task', title: 'Pagar luz', done: false, allDay: true,
    start: new Date(2026, 10, 20), end: new Date(2026, 10, 20),
    reminders: [{ method: 'popup', minutes: 900 }], remBoth: true, colorId: '5',
  });
  assert.equal(g.summary, '☐ Pagar luz');
  assert.equal(g.start.date, '2026-11-20');
  assert.equal(g.end.date, '2026-11-21');
  assert.equal(g.extendedProperties.shared.fcType, 'task');
  assert.equal(g.extendedProperties.shared.fcRem, 'popup:900');
  const it = fromGoogle({ id: 'x', ...g });
  assert.equal(it.type, 'task');
  assert.equal(it.title, 'Pagar luz');
  assert.equal(it.done, false);
  assert.equal(it.remBoth, true);
  assert.deepEqual(it.sharedReminders, [{ method: 'popup', minutes: 900 }]);
  const p = taskDonePatch(it, true);
  assert.equal(p.summary, '☑ Pagar luz');
  assert.equal(p.extendedProperties.shared.fcDone, '1');
});

// ---------- Pestaña Tareas ----------

test('agrupa tareas: vencidas, hoy, semana, más adelante y hechas', () => {
  // NOW = martes 17 nov 2026 10:00 → la semana acaba el domingo 22
  const t = (id, y, m, d, extra = {}) => ({
    id, type: 'task', title: id, done: false, allDay: true,
    start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1), ...extra,
  });
  const items = [
    t('vencida', 2026, 11, 15),
    t('hoy', 2026, 11, 17),
    { ...t('hoy-hora', 2026, 11, 17), allDay: false, start: new Date(2026, 10, 17, 18), end: new Date(2026, 10, 17, 18, 30) },
    { ...t('hoy-pasada', 2026, 11, 17), allDay: false, start: new Date(2026, 10, 17, 8), end: new Date(2026, 10, 17, 8, 30) },
    t('domingo', 2026, 11, 22),
    t('lunes', 2026, 11, 23),
    t('serie-1', 2026, 11, 19, { recurringEventId: 'S' }),
    t('serie-2', 2026, 11, 26, { recurringEventId: 'S' }),
    t('serie-vencida', 2026, 11, 12, { recurringEventId: 'S' }),
    t('hecha-reciente', 2026, 11, 10, { done: true }),
    t('hecha-antigua', 2026, 9, 1, { done: true }),
    t('hecha-futura', 2026, 12, 1, { done: true }),
    { ...t('evento', 2026, 11, 17), type: 'event' },
  ];
  const g = groupTasks(items, NOW);
  const ids = (l) => l.map((i) => i.id);
  assert.deepEqual(ids(g.overdue), ['serie-vencida', 'vencida', 'hoy-pasada']);
  assert.deepEqual(ids(g.today), ['hoy', 'hoy-hora']);
  assert.deepEqual(ids(g.week), ['serie-1', 'domingo']);
  assert.deepEqual(ids(g.later), ['lunes']);
  assert.deepEqual(ids(g.done), ['hecha-futura', 'hecha-reciente']);
  assert.equal(attentionCount(g), 5);
});
