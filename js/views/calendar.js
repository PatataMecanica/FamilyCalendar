// Vista de calendario: Mes / Semana / Día, con deslizamiento lateral.

import { h, icon, clear } from '../ui/dom.js';
import { fetchRange } from '../data.js';
import { colorHex, occursOn, sortItems } from '../model.js';
import {
  startOfDay, startOfWeek, startOfMonth, addDays, addMonths, sameDay, weekdayMon, toHM,
  MONTHS, MONTHS_SHORT, DAYS_SHORT, isoWeek, fmtDayLabel,
} from '../dates.js';
import { itemCard, emptyState } from './common.js';
import { openDetail } from '../ui/editor.js';
import { openQuick } from '../ui/quick.js';
import { store } from '../store.js';

const view = {
  mode: store.get('calMode', 'month'),
  cursor: startOfDay(new Date()),
  selected: startOfDay(new Date()),
  dir: 0,
};

export function goToday() { view.cursor = startOfDay(new Date()); view.selected = startOfDay(new Date()); view.dir = 0; }

function shiftPeriod(n) {
  view.dir = n;
  if (view.mode === 'month') { view.cursor = addMonths(startOfMonth(view.cursor), n); view.selected = sameMonth(view.cursor, new Date()) ? startOfDay(new Date()) : new Date(view.cursor); }
  else if (view.mode === 'week') { view.cursor = addDays(view.cursor, 7 * n); view.selected = new Date(view.cursor); }
  else { view.cursor = addDays(view.cursor, n); view.selected = new Date(view.cursor); }
}
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export async function renderCalendar(root, rerender) {
  const seg = h('div.seg', { role: 'group', 'aria-label': 'Vista' },
    [['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']].map(([k, l]) => h('button', {
      type: 'button', 'aria-pressed': String(view.mode === k),
      onclick: () => { view.mode = k; store.set('calMode', k); view.cursor = new Date(view.selected); view.dir = 0; rerender(); },
    }, l)));

  let title, sub, range;
  const c = view.cursor;
  if (view.mode === 'month') {
    const first = startOfWeek(startOfMonth(c));
    range = [first, addDays(first, 42)];
    title = MONTHS[c.getMonth()]; sub = String(c.getFullYear());
  } else if (view.mode === 'week') {
    const ws = startOfWeek(c);
    range = [ws, addDays(ws, 7)];
    const we = addDays(ws, 6);
    title = ws.getMonth() === we.getMonth() ? `${ws.getDate()}–${we.getDate()} ${MONTHS_SHORT[ws.getMonth()]}` : `${ws.getDate()} ${MONTHS_SHORT[ws.getMonth()]} – ${we.getDate()} ${MONTHS_SHORT[we.getMonth()]}`;
    sub = `SEM ${isoWeek(ws)}`;
  } else {
    range = [startOfDay(c), addDays(startOfDay(c), 1)];
    title = fmtDayLabel(c); sub = `${DAYS_SHORT[weekdayMon(c)]} ${c.getDate()} ${MONTHS_SHORT[c.getMonth()]}`;
    if (!/^(Hoy|Mañana|Ayer)$/.test(title)) { title = `${c.getDate()} ${MONTHS[c.getMonth()]}`; sub = `${DAYS_SHORT[weekdayMon(c)]} · ${c.getFullYear()}`; }
  }

  const items = await fetchRange(range[0], range[1]);
  clear(root);
  root.append(
    h('div.cal-toolbar', seg),
    h('div.period',
      h('h2', title, h('small', sub)),
      h('div.nav',
        h('button.icon-btn', { type: 'button', 'aria-label': 'Anterior', onclick: () => { shiftPeriod(-1); rerender(); } }, icon('left')),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Siguiente', onclick: () => { shiftPeriod(1); rerender(); } }, icon('right')),
      ),
    ),
  );
  const wrap = h(`div.cal-wrap${view.dir > 0 ? '.slide-l' : view.dir < 0 ? '.slide-r' : ''}`);
  root.append(wrap);
  view.dir = 0;

  if (view.mode === 'month') renderMonth(wrap, items, range[0], rerender);
  else renderTimeGrid(wrap, items, view.mode === 'week' ? range[0] : startOfDay(c), view.mode === 'week' ? 7 : 1, rerender);

  // Deslizamiento horizontal
  let x0 = null, y0 = null;
  wrap.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { shiftPeriod(dx < 0 ? 1 : -1); rerender(); }
  }, { passive: true });
}

function renderMonth(wrap, items, first, rerender) {
  const today = startOfDay(new Date());
  const grid = h('div.month-grid', { role: 'grid' });
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d) => grid.append(h('div.dow', d)));
  const month = view.cursor.getMonth();
  const maxBars = window.innerWidth >= 600 ? 4 : 3;
  for (let i = 0; i < 42; i++) {
    const day = addDays(first, i);
    if (i === 35 && day.getMonth() !== month) break; // 5 semanas bastan
    const list = items.filter((it) => occursOn(it, day)).sort(sortItems);
    const cls = [
      day.getMonth() !== month ? '.out' : '',
      sameDay(day, today) ? '.today' : '',
      sameDay(day, view.selected) ? '.sel' : '',
      weekdayMon(day) >= 5 ? '.weekend' : '',
    ].join('');
    const shown = list.slice(0, list.length > maxBars ? maxBars - 1 : maxBars);
    grid.append(h(`button.cell${cls}`, {
      type: 'button', 'aria-label': `${day.getDate()} ${MONTHS[day.getMonth()]}, ${list.length} elementos`,
      onclick: () => {
        if (sameDay(day, view.selected)) { view.mode = 'day'; store.set('calMode', 'day'); view.cursor = new Date(day); rerender(); return; }
        view.selected = day; if (day.getMonth() !== month) { view.dir = day < view.cursor ? -1 : 1; view.cursor = startOfMonth(day); }
        rerender();
      },
    },
    h('span.num', String(day.getDate())),
    shown.map((it) => h(`span.bar${it.type === 'task' ? '.task' : ''}${it.done ? '.done' : ''}`, { '--c': colorHex(it.colorId) }, it.title)),
    list.length > shown.length ? h('span.plus', `+${list.length - shown.length}`) : null,
    ));
  }
  wrap.append(grid);

  // Agenda del día seleccionado
  const sel = view.selected;
  const list = items.filter((it) => occursOn(it, sel)).sort(sortItems);
  const box = h('section.month-day-list',
    h('div.day-head', { style: { position: 'static' } },
      h(`span.d${sameDay(sel, today) ? '.today' : ''}`, fmtDayLabel(sel, today)),
      h('span.n', `${DAYS_SHORT[weekdayMon(sel)]} ${sel.getDate()} ${MONTHS_SHORT[sel.getMonth()]}`),
      h('span.rule'),
      h('button.pill-btn', { type: 'button', onclick: () => openQuick({ date: sel }) }, '+ Añadir'),
    ),
  );
  if (list.length) list.forEach((it) => box.append(itemCard(it, { day: sel })));
  else box.append(emptyState('Día despejado', 'Toca dos veces un día para abrir su vista.'));
  wrap.append(box);
}

function renderTimeGrid(wrap, items, start, cols, rerender) {
  const today = startOfDay(new Date());
  const now = new Date();
  const days = Array.from({ length: cols }, (_, i) => addDays(start, i));
  const tg = h('div.tg', { '--cols': cols, 'data-cols': String(cols) });

  // Cabecera
  tg.append(h('div.tg-head', h('div'), days.map((d) => h(`button.hc${sameDay(d, today) ? '.today' : ''}`, {
    type: 'button', onclick: () => { if (cols > 1) { view.mode = 'day'; store.set('calMode', 'day'); view.cursor = d; view.selected = d; rerender(); } },
  }, h('span.w', DAYS_SHORT[weekdayMon(d)]), h('span.dn', String(d.getDate())),
  ))));

  // Fila de todo el día (incluye tareas sin hora)
  const allDayRow = h('div.tg-allday', h('div.lbl', 'Día'));
  let anyAllDay = false;
  days.forEach((d) => {
    const list = items.filter((it) => it.allDay && occursOn(it, d)).sort(sortItems);
    if (list.length) anyAllDay = true;
    allDayRow.append(h('div.ac', list.map((it) => h(`button.chipev${it.type === 'task' ? '.task' : ''}${it.done ? '.done' : ''}`, {
      type: 'button', '--c': colorHex(it.colorId), onclick: () => openDetail(it),
    }, it.title))));
  });
  if (anyAllDay) tg.append(allDayRow);

  // Cuerpo
  const scroll = h('div.tg-scroll');
  const body = h('div.tg-body');
  const hours = h('div.tg-hours');
  for (let hr = 1; hr < 24; hr++) hours.append(h('span', { style: { top: `calc(var(--hour) * ${hr})` } }, `${String(hr).padStart(2, '0')}`));
  body.append(hours);

  days.forEach((d) => {
    const col = h(`div.tg-col${weekdayMon(d) >= 5 ? '.weekend' : ''}`);
    col.addEventListener('click', (e) => {
      if (e.target !== col) return;
      const rect = col.getBoundingClientRect();
      const hourPx = rect.height / 24;
      const hr = Math.min(23, Math.max(0, Math.floor((e.clientY - rect.top) / hourPx)));
      openQuick({ date: d, hour: hr });
    });
    const timed = items.filter((it) => !it.allDay && occursOn(it, d)).sort((a, b) => a.start - b.start || b.end - a.end);
    layoutColumns(timed, d).forEach(({ it, top, height, lane, lanes }) => {
      col.append(h(`button.tg-ev${it.type === 'task' ? '.task' : ''}${it.done ? '.done' : ''}`, {
        type: 'button', '--c': colorHex(it.colorId),
        style: {
          top: `calc(var(--hour) * ${top})`, height: `max(calc(var(--hour) * ${height} - 2px), 18px)`,
          left: `calc(${(100 / lanes) * lane}% + 1px)`, width: `calc(${100 / lanes}% - 2px)`, right: 'auto',
        },
        onclick: () => openDetail(it),
      }, height >= 0.75 ? h('span.t', toHM(it.start)) : null, it.title));
    });
    if (sameDay(d, today)) {
      const nowH = now.getHours() + now.getMinutes() / 60;
      col.append(h('div.tg-now', { style: { top: `calc(var(--hour) * ${nowH})` } }));
    }
    body.append(col);
  });
  scroll.append(body);
  tg.append(scroll);
  wrap.append(tg);

  // Desplaza a una hora útil: ahora (si es hoy) o 7:00
  requestAnimationFrame(() => {
    const hourPx = body.getBoundingClientRect().height / 24;
    const showsToday = days.some((d) => sameDay(d, today));
    const target = showsToday ? Math.max(0, now.getHours() - 2) : 7;
    scroll.scrollTop = hourPx * target;
  });

  // Lista bajo la rejilla en vista Día
  if (cols === 1) {
    const list = items.filter((it) => occursOn(it, start)).sort(sortItems);
    const box = h('section.month-day-list',
      h('div.day-head', { style: { position: 'static' } }, h('span.d', 'Agenda'), h('span.rule'), h('button.pill-btn', { type: 'button', onclick: () => openQuick({ date: start }) }, '+ Añadir')));
    if (list.length) list.forEach((it) => box.append(itemCard(it, { day: start })));
    else box.append(emptyState('Día despejado', 'Toca un hueco de la rejilla para crear algo a esa hora.'));
    wrap.append(box);
  }
}

/** Reparte eventos solapados en carriles */
function layoutColumns(list, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const out = [];
  let cluster = [], clusterEnd = 0;
  const flush = () => {
    const lanesEnd = [];
    cluster.forEach((o) => {
      let lane = lanesEnd.findIndex((e) => e <= o.s);
      if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(0); }
      lanesEnd[lane] = o.e; o.lane = lane;
    });
    cluster.forEach((o) => { o.lanes = lanesEnd.length; out.push(o); });
    cluster = []; clusterEnd = 0;
  };
  for (const it of list) {
    const s = Math.max(it.start, dayStart), e = Math.min(Math.max(it.end, +it.start + 15 * 60000), dayEnd);
    if (cluster.length && s >= clusterEnd) flush();
    const top = (s - dayStart) / 3600000;
    const height = Math.max((e - s) / 3600000, 0.25);
    cluster.push({ it, s, e, top, height });
    clusterEnd = Math.max(clusterEnd, e);
  }
  if (cluster.length) flush();
  return out;
}

