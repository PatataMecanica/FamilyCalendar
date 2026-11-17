import { h, clear } from '../ui/dom.js';
import { fetchRange, fetchOverdue } from '../data.js';
import { occursOn, sortItems } from '../model.js';
import {
  startOfDay, addDays, DAYS_LONG, MONTHS, weekdayMon, isoWeek, fmtDayLabel, MONTHS_SHORT, DAYS_SHORT, toHM,
} from '../dates.js';
import { itemCard, emptyState } from './common.js';
import { openQuick } from '../ui/quick.js';

let span = 14;

export async function renderUpcoming(root) {
  const now = new Date();
  const today = startOfDay(now);
  const [items, overdue] = await Promise.all([fetchRange(today, addDays(today, span)), fetchOverdue()]);
  clear(root);

  const todays = items.filter((i) => occursOn(i, today));
  const evCount = todays.filter((i) => i.type === 'event').length;
  const taskCount = todays.filter((i) => i.type === 'task' && !i.done).length;

  root.append(
    h('section.hero',
      h('div.big', String(today.getDate()).padStart(2, '0')),
      h('div.plate-info',
        h('div.dow', DAYS_LONG[weekdayMon(today)]),
        h('div.month', `${MONTHS[today.getMonth()]} ${today.getFullYear()}`),
        h('div.stamp', `N.º ${String(today.getDate()).padStart(2, '0')} · ${MONTHS_SHORT[today.getMonth()]} · SEM ${isoWeek(today)}`),
      ),
    ),
    h('div.summary',
      h('span.legend', h('span.sq'), h('b', String(evCount)), evCount === 1 ? 'evento' : 'eventos'),
      h('span.legend', h('span.sq.task'), h('b', String(taskCount)), taskCount === 1 ? 'tarea' : 'tareas'),
      overdue.length ? h('span.legend', { style: { color: 'var(--rust)' } }, h('b', { style: { color: 'var(--rust)' } }, String(overdue.length)), 'vencidas') : null,
    ),
  );

  if (overdue.length) {
    root.append(h('section.overdue-box',
      h('div.hd', h('span.label', 'Vencidas'), h('div.hazard')),
      overdue.map((it) => itemCard(it, { now })),
    ));
  }

  for (let i = 0; i < span; i++) {
    const day = addDays(today, i);
    const list = items.filter((it) => occursOn(it, day)).sort(sortItems);
    if (!list.length && i !== 0) continue;
    const group = h('section.day-group');
    group.append(h('div.day-head',
      h(`span.d${i === 0 ? '.today' : ''}`, fmtDayLabel(day, today)),
      h('span.n', `${DAYS_SHORT[weekdayMon(day)]} ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`),
      h('span.rule'),
      h('span.cnt', list.length ? String(list.length).padStart(2, '0') : ''),
    ));
    if (!list.length) {
      group.append(h('button.empty', { type: 'button', style: { width: '100%', margin: '4px 0 0', padding: '18px' }, onclick: () => openQuick({ date: day }) }, h('span.label', 'Día despejado'), 'Toca para añadir algo'));
    }
    let nowPlaced = i !== 0;
    for (const it of list) {
      if (!nowPlaced && !it.allDay && it.start > now) {
        group.append(h('div.now-line', `AHORA ${toHM(now)}`));
        nowPlaced = true;
      }
      group.append(itemCard(it, { day, now }));
    }
    if (!nowPlaced && list.some((it) => !it.allDay)) group.append(h('div.now-line', `AHORA ${toHM(now)}`));
    root.append(group);
  }

  if (items.length === 0 && !overdue.length) {
    root.append(emptyState('Sin planes', `Nada en los próximos ${span} días.`));
  }

  root.append(h('button.btn.ghost.more-btn', { type: 'button', onclick: () => { span += 14; renderUpcoming(root); } }, `Ver ${span + 14} días`));
}

export function resetUpcoming() { span = 14; }
