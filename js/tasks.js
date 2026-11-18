// Agrupación de tareas para la pestaña «Tareas» (sin DOM, se prueba en tests/).

import { isOverdueTask, sortItems } from './model.js';
import { startOfDay, startOfWeek, addDays } from './dates.js';

/** Días hacia atrás y hacia delante que abarca la pestaña */
export const TASKS_PAST_DAYS = 90;
export const TASKS_FUTURE_DAYS = 365;
/** Hechas que se muestran (las más recientes) */
export const DONE_DAYS = 30;
export const DONE_LIMIT = 30;

/**
 * Reparte las tareas en grupos.
 * - Vencidas: todas las pendientes de días pasados (también cada repetición).
 * - Hoy, Esta semana (hasta el domingo), Más adelante: pendientes.
 *   De una tarea que se repite solo se muestra la próxima repetición.
 * - Hechas: las de los últimos 30 días o futuras, de la más reciente a la más antigua.
 * @param {import('./model.js').Item[]} items
 * @param {Date} [now]
 */
export function groupTasks(items, now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(startOfWeek(today), 7);
  const doneFrom = addDays(today, -DONE_DAYS);
  const tasks = items.filter((i) => i.type === 'task').sort(sortItems);

  const g = { overdue: [], today: [], week: [], later: [], done: [] };
  const seenSeries = new Set();
  for (const t of tasks) {
    if (t.done) {
      if (t.start >= doneFrom) g.done.push(t);
      continue;
    }
    if (isOverdueTask(t, now)) { g.overdue.push(t); continue; }
    if (t.recurringEventId) {
      if (seenSeries.has(t.recurringEventId)) continue;
      seenSeries.add(t.recurringEventId);
    }
    if (t.start < tomorrow) g.today.push(t);
    else if (t.start < weekEnd) g.week.push(t);
    else g.later.push(t);
  }
  g.done = g.done.sort((a, b) => b.start - a.start).slice(0, DONE_LIMIT);
  return g;
}

/** Lo que «pide atención» ahora: vencidas + pendientes de hoy (para el contador de la barra) */
export const attentionCount = (g) => g.overdue.length + g.today.length;
