import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecurrence, parseRecurrence, describeRecurrence } from '../js/recurrence.js';
import { toGoogle, fromGoogle, taskDonePatch } from '../js/model.js';
import { groupTasks, attentionCount } from '../js/tasks.js';

// "Ahora": martes 17 nov 2026, 10:00
const NOW = new Date(2026, 10, 17, 10, 0);

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
