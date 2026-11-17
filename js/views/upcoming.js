import { h, clear } from '../ui/dom.js';
import { fetchRange, fetchOverdue } from '../data.js';
import { occursOn, sortItems } from '../model.js';
import {
  startOfDay, addDays, DAYS_LONG, MONTHS, weekdayMon, isoWeek, fmtDayLabel, toHM, cap,
} from '../dates.js';
import { itemCard, emptyState, list } from './common.js';
import { openQuick } from '../ui/quick.js';

let span = 14;

const plural = (n, one, many) => `${n === 1 ? one : many}`;

export async function renderUpcoming(root) {
  const now = new Date();
  const today = startOfDay(now);
  const [items, overdue] = await Promise.all([fetchRange(today, addDays(today, span)), fetchOverdue()]);
  clear(root);

  const todays = items.filter((i) => occursOn(i, today));
  const evCount = todays.filter((i) => i.type === 'event').length;
  const taskCount = todays.filter((i) => i.type === 'task' && !i.done).length;
  const next = items.find((i) => i.type === 'event' && !i.allDay && i.start > now);

  // Tarjeta principal: el día de hoy
  root.append(h('section.card.hero',
    h('div.label', `${DAYS_LONG[weekdayMon(today)]} · semana ${isoWeek(today)}`),
    h('div.big', String(today.getDate()), h('small', ` de ${MONTHS[today.getMonth()]}`)),
    h('div.sub', next
      ? `Siguiente: ${next.title} · ${fmtDayLabel(next.start, today).toLowerCase()} a las ${toHM(next.start)}`
      : 'Nada más con hora por ahora'),
    h('div.stats',
      h('span', h('i.mk'), h('b', String(evCount)), plural(evCount, 'evento hoy', 'eventos hoy')),
      h('span', h('i.mk.task'), h('b', String(taskCount)), plural(taskCount, 'tarea', 'tareas')),
      overdue.length ? h('span.late', h('b', String(overdue.length)), plural(overdue.length, 'vencida', 'vencidas')) : null,
    ),
  ));

  if (overdue.length) {
    root.append(h('section.card.notice',
      h('h2', 'Vencidas'),
      h('div.sub', { style: { marginBottom: '12px' } }, 'Tareas sin completar de días pasados'),
      list(overdue.map((it) => itemCard(it, { now }))),
    ));
  }

  for (let i = 0; i < span; i++) {
    const day = addDays(today, i);
    const dayItems = items.filter((it) => occursOn(it, day)).sort(sortItems);
    if (!dayItems.length && i !== 0) continue;
    root.append(h(`div.section${i === 0 ? '.today' : ''}`,
      h('h2', fmtDayLabel(day, today)),
      h('span.when', i < 2 ? cap(`${DAYS_LONG[weekdayMon(day)]} ${day.getDate()}`) : `${day.getDate()} de ${MONTHS[day.getMonth()]}`),
    ));
    if (!dayItems.length) {
      root.append(list(h('button.empty', { type: 'button', onclick: () => openQuick({ date: day }) }, h('b', 'Día despejado'), 'Toca para añadir algo')));
      continue;
    }
    const rows = [];
    let nowPlaced = i !== 0;
    for (const it of dayItems) {
      if (!nowPlaced && !it.allDay && it.start > now) { rows.push(h('div.nowline', `Ahora · ${toHM(now)}`)); nowPlaced = true; }
      rows.push(itemCard(it, { day, now }));
    }
    if (!nowPlaced && dayItems.some((it) => !it.allDay)) rows.push(h('div.nowline', `Ahora · ${toHM(now)}`));
    root.append(list(rows));
  }

  if (items.length === 0 && !overdue.length) root.append(list(emptyState('Sin planes', `Nada en los próximos ${span} días.`)));

  root.append(h('button.btn.ghost.more', { type: 'button', onclick: () => { span += 14; renderUpcoming(root); } }, `Ver ${span + 14} días`));
}

export function resetUpcoming() { span = 14; }
