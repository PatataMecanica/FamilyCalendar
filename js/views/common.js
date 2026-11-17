import { h, icon } from '../ui/dom.js';
import { colorHex, isOverdueTask } from '../model.js';
import { toHM, addDays, sameDay, daysBetween, fmtShortDate, startOfDay } from '../dates.js';
import { openDetail, toggleDoneWithUndo } from '../ui/editor.js';

/**
 * Tarjeta de evento o tarea.
 * @param {import('../model.js').Item} it
 * @param {{day?:Date, now?:Date, showDate?:boolean}} o
 */
export function itemCard(it, { day = null, now = new Date(), showDate = false } = {}) {
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
      due = n <= 0 ? `vencida ${toHM(it.end)}` : n === 1 ? 'ayer' : `hace ${n} días`;
    } else if (!it.allDay) due = toHM(it.start);
    else if (showDate) due = fmtShortDate(it.start);
    const check = h('button.check', {
      'aria-label': it.done ? `Marcar "${it.title}" como pendiente` : `Completar "${it.title}"`,
      onclick: (e) => {
        e.stopPropagation();
        const card = e.currentTarget.closest('.item');
        card.classList.toggle('done');
        toggleDoneWithUndo(it);
      },
    }, icon('check'));
    return h(`div.item.task${it.done ? '.done' : ''}${overdue ? '.overdue' : ''}`, {
      '--c': c, role: 'button', tabindex: '0',
      onclick: () => openDetail(it),
      onkeydown: (e) => { if (e.key === 'Enter') openDetail(it); },
    },
    h('div.time', check),
    h('div.body', h('div.title', it.title), meta.length || due ? h('div.meta', due ? h('span.due', due) : null, ...meta) : null),
    null);
  }

  let timeCol;
  if (it.allDay) {
    const totalDays = daysBetween(it.start, it.end);
    if (totalDays > 1 && day) {
      const idx = daysBetween(it.start, day) + 1;
      timeCol = h('div.time', h('span.ad', 'DÍA'), h('span', `${idx}/${totalDays}`));
    } else timeCol = h('div.time', h('span.ad', 'TODO'), h('span.ad', 'EL DÍA'));
  } else {
    const startsToday = !day || sameDay(it.start, day);
    const endsToday = !day || sameDay(it.end, day) || +it.end === +startOfDay(addDays(day, 1));
    timeCol = h('div.time',
      h('span', startsToday ? toHM(it.start) : '…'),
      h('small', endsToday ? toHM(it.end) : '…'));
  }
  const isPast = day && sameDay(day, now) && !it.allDay && it.end < now;
  const isNow = !it.allDay && it.start <= now && it.end > now;
  if (showDate) meta.unshift(h('span', h('span.mono', { style: { fontSize: '12px' } }, fmtShortDate(it.start))));
  return h(`button.item${isPast ? '.past' : ''}${isNow ? '.now' : ''}`, { '--c': c, type: 'button', onclick: () => openDetail(it) },
    timeCol,
    h('div.body', h('div.title', it.title), meta.length ? h('div.meta', ...meta) : null),
    icon('right', 'sm chev'),
  );
}

export function emptyState(label, text) {
  return h('div.empty', h('span.label', label), text);
}
