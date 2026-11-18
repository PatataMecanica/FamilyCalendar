// Pestaña «Tareas»: todas las pendientes agrupadas, alta rápida arriba y las hechas recientes.

import { h, icon, clear } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { fetchTasks, createItem } from '../data.js';
import { groupTasks } from '../tasks.js';
import { parseQuickAdd } from '../quickadd.js';
import { newDraft } from '../ui/editor.js';
import { startOfDay, fmtDayLabel, toHM, DAYS_LONG, weekdayMon, cap } from '../dates.js';
import { itemCard, emptyState, list } from './common.js';

let showDone = false;
let refocus = false;

const HINT = 'Ej.: «pagar la luz el 25» · «llamar al taller mañana» · sin fecha, para hoy';

/** Borrador de tarea a partir del texto: con fecha u hora si se escriben, si no para hoy */
function draftFromText(txt, now = new Date()) {
  const p = parseQuickAdd(txt, now);
  if (p.start) return newDraft({ type: 'task', title: p.title, allDay: false, start: p.start, end: p.end });
  const day = p.date || startOfDay(now);
  return newDraft({ type: 'task', title: p.title, allDay: true, start: new Date(day), end: new Date(day) });
}

function quickAdd() {
  const preview = h('div.preview.hint', HINT);
  const go = h('button.go', { type: 'submit', disabled: true, 'aria-label': 'Añadir tarea' }, icon('check'));
  const input = h('input.field', {
    type: 'text', placeholder: 'Nueva tarea…', autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'done',
    'aria-label': 'Nueva tarea', oninput: update,
  });

  function update() {
    const txt = input.value.trim();
    go.disabled = !txt;
    clear(preview);
    if (!txt) { preview.className = 'preview hint'; preview.textContent = HINT; return; }
    preview.className = 'preview';
    const d = draftFromText(txt);
    preview.append(
      h('span.k', 'Tarea'),
      h('b', d.title || '—'),
      h('span', `· ${fmtDayLabel(d.start)}${d.allDay ? '' : `, ${toHM(d.start)}`}`),
    );
  }

  async function submit(e) {
    e.preventDefault();
    const txt = input.value.trim();
    if (!txt) return;
    const d = draftFromText(txt);
    if (!d.title) { toast('Falta el título', { error: true }); return; }
    go.disabled = true;
    try {
      refocus = true; // al volver a pintar, el cursor sigue en el campo para añadir otra
      await createItem(d);
      toast(`Tarea creada: ${d.title}`);
    } catch (err) {
      refocus = false;
      toast(`No se pudo crear: ${err.message}`, { error: true });
      go.disabled = false;
    }
  }

  const form = h('form.quick.task-add', { onsubmit: submit }, input, go);
  return { el: h('div', form, preview), input };
}

export async function renderTasks(root) {
  const now = new Date();
  const items = await fetchTasks();
  const g = groupTasks(items, now);
  clear(root);

  const add = quickAdd();
  root.append(add.el);
  if (refocus) { refocus = false; setTimeout(() => add.input.focus(), 0); }

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
    root.append(list(emptyState('Todo hecho', 'No hay tareas pendientes. Escribe arriba para añadir una.')));
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
