// Pestaña «Tareas»: todas las pendientes agrupadas y las hechas recientes. Se añaden con el «+», que aquí empieza como tarea.

import { h, clear } from '../ui/dom.js';
import { fetchTasks } from '../data.js';
import { groupTasks } from '../tasks.js';
import { DAYS_LONG, weekdayMon, cap } from '../dates.js';
import { itemCard, emptyState, list } from './common.js';

let showDone = false;

export async function renderTasks(root) {
  const now = new Date();
  const items = await fetchTasks();
  const g = groupTasks(items, now);
  clear(root);

  const pendingCount = g.overdue.length + g.today.length + g.week.length + g.later.length;
  const weekday = (d) => cap(DAYS_LONG[weekdayMon(d)]);
  const section = (label, rows, { cls = '', opts = {} } = {}) => {
    if (!rows.length) return;
    root.append(h(`div.section${cls}`, h('h2', label), h('span.when', String(rows.length))));
    root.append(list(rows.map((it) => itemCard(it, { now, ...opts }))));
  };

  section('Vencidas', g.overdue, { cls: '.late' });
  section('Hoy', g.today, { cls: '.today' });
  section('Esta semana', g.week, { opts: { showDate: true, dateFmt: weekday } });
  section('Más adelante', g.later, { opts: { showDate: true } });

  if (!pendingCount) {
    root.append(h('div.section', h('h2', 'Pendientes')));
    root.append(list(emptyState('Todo hecho', 'No hay tareas pendientes. Añade una con el +.')));
  }

  if (g.done.length) {
    const doneList = list(g.done.map((it) => itemCard(it, { now, showDate: true })));
    doneList.hidden = !showDone;
    const toggle = h('button.toggle', {
      type: 'button', 'aria-expanded': String(showDone),
      onclick: () => {
        showDone = !showDone;
        doneList.hidden = !showDone;
        toggle.setAttribute('aria-expanded', String(showDone));
        toggle.textContent = showDone ? 'Ocultar' : `Ver ${g.done.length}`;
      },
    }, showDone ? 'Ocultar' : `Ver ${g.done.length}`);
    root.append(h('div.section', h('h2', 'Hechas'), toggle), doneList);
  }

  return g;
}
