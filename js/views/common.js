import { h, icon } from '../ui/dom.js';
import { colorHex, isOverdueTask } from '../model.js';
import { toHM, addDays, sameDay, daysBetween, fmtShortDate, startOfDay } from '../dates.js';
import { openDetail, toggleDoneWithUndo } from '../ui/editor.js';

/**
 * Fila de evento o tarea (va dentro de una .list).
 * Evento: hora + barrita de su color. Tarea: casilla redonda de su color.
 * @param {import('../model.js').Item} it
 * @param {{day?:Date, now?:Date, showDate?:boolean, dateFmt?:(d:Date)=>string}} o
 *   showDate: muestra la fecha (con dateFmt, por defecto «20 nov»)
 */
export function itemCard(it, { day = null, now = new Date(), showDate = false, dateFmt = fmtShortDate } = {}) {
  const c = colorHex(it.colorId);
  const meta = [];
  if (it.location) meta.push(h('span', icon('pin', 'xs'), it.location));
  if (it.recurringEventId || (it.recurrence && it.recurrence.length)) meta.push(h('span', icon('repeat', 'xs')));
  if (!it.useDefaultReminders && it.reminders.length) meta.push(h('span', icon('bell', 'xs'), it.reminders.length > 1 ? it.reminders.length : ''));
  if (it.remBoth && it.reminders.length) meta.push(h('span.tag', 'Los dos'));

  if (it.type === 'task') {
    const overdue = isOverdueTask(it, now);
    let due;
    if (overdue) {
      const n = daysBetween(it.start, now);
      due = n <= 0 ? `vencida a las ${toHM(it.end)}` : n === 1 ? 'venció ayer' : `venció hace ${n} días`;
    } else if (showDate) due = it.allDay ? dateFmt(it.start) : `${dateFmt(it.start)} · ${toHM(it.start)}`;
    else if (!it.allDay) due = toHM(it.start);
    const check = h('button.ck', {
      type: 'button',
      'aria-label': it.done ? `Marcar "${it.title}" como pendiente` : `Completar "${it.title}"`,
      onclick: (e) => {
        e.stopPropagation();
        e.currentTarget.closest('.row').classList.toggle('done');
        toggleDoneWithUndo(it);
      },
    }, icon('check'));
    return h(`div.row.task${it.done ? '.done' : ''}${overdue ? '.overdue' : ''}`, {
      '--c': c, role: 'button', tabindex: '0',
      onclick: () => openDetail(it),
      onkeydown: (e) => { if (e.key === 'Enter') openDetail(it); },
    },
    check,
    h('div.txt', h('div.c', it.title), meta.length || due ? h('div.m', due ? h('span.due', due) : null, ...meta) : null));
  }

  let tm;
  if (it.allDay) {
    const totalDays = daysBetween(it.start, it.end);
    if (totalDays > 1 && day) tm = h('div.tm', `${daysBetween(it.start, day) + 1}/${totalDays}`, h('span.ad', 'días'));
    else tm = h('div.tm', h('span.ad', 'Todo'), h('span.ad', 'el día'));
  } else {
    const startsToday = !day || sameDay(it.start, day);
    const endsToday = !day || sameDay(it.end, day) || +it.end === +startOfDay(addDays(day, 1));
    tm = h('div.tm', startsToday ? toHM(it.start) : '…', h('small', endsToday ? toHM(it.end) : '…'));
  }
  const isPast = day && sameDay(day, now) && !it.allDay && it.end < now;
  const isNow = !it.allDay && it.start <= now && it.end > now;
  if (showDate) meta.unshift(h('span', dateFmt(it.start)));
  return h(`button.row${isPast ? '.past' : ''}${isNow ? '.now' : ''}`, { '--c': c, type: 'button', onclick: () => openDetail(it) },
    tm,
    h('span.bar'),
    h('div.txt', h('div.c', it.title), meta.length ? h('div.m', ...meta) : null),
  );
}

/** Lista (tarjeta) con filas */
export const list = (...rows) => h('div.list', ...rows);

export function emptyState(title, text) {
  return h('div.empty', h('b', title), text);
}
