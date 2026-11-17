// Construcción y lectura de reglas RRULE (subconjunto que usa la app)

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * @typedef {{freq:'none'|'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY', interval?:number, byDay?:number[], end?:'never'|'until'|'count', until?:string, count?:number}} Recur
 * byDay: índices lunes=0…domingo=6. until: 'YYYY-MM-DD'.
 */

/** @param {Recur} r @returns {string[]|undefined} array para event.recurrence */
export function buildRecurrence(r) {
  if (!r || r.freq === 'none') return undefined;
  const parts = [`FREQ=${r.freq}`];
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'WEEKLY' && r.byDay && r.byDay.length) {
    parts.push(`BYDAY=${[...r.byDay].sort((a, b) => a - b).map((i) => BYDAY[i]).join(',')}`);
  }
  if (r.end === 'until' && r.until) parts.push(`UNTIL=${r.until.replace(/-/g, '')}T235959Z`);
  else if (r.end === 'count' && r.count > 0) parts.push(`COUNT=${r.count}`);
  return [`RRULE:${parts.join(';')}`];
}

/** @param {string[]|undefined} rec @returns {Recur} */
export function parseRecurrence(rec) {
  const line = (rec || []).find((l) => l.startsWith('RRULE:'));
  if (!line) return { freq: 'none' };
  const kv = Object.fromEntries(line.slice(6).split(';').map((p) => p.split('=')));
  const out = { freq: kv.FREQ || 'none', interval: kv.INTERVAL ? +kv.INTERVAL : 1, end: 'never' };
  if (kv.BYDAY) out.byDay = kv.BYDAY.split(',').map((d) => BYDAY.indexOf(d.replace(/^[+-]?\d+/, ''))).filter((i) => i >= 0);
  if (kv.UNTIL) { const u = kv.UNTIL; out.end = 'until'; out.until = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`; }
  else if (kv.COUNT) { out.end = 'count'; out.count = +kv.COUNT; }
  return out;
}

/** Descripción breve en español */
export function describeRecurrence(r) {
  if (!r || r.freq === 'none') return 'No se repite';
  const n = r.interval && r.interval > 1 ? r.interval : 1;
  let s = {
    DAILY: n > 1 ? `Cada ${n} días` : 'Cada día',
    WEEKLY: n > 1 ? `Cada ${n} semanas` : 'Cada semana',
    MONTHLY: n > 1 ? `Cada ${n} meses` : 'Cada mes',
    YEARLY: n > 1 ? `Cada ${n} años` : 'Cada año',
  }[r.freq] || 'Se repite';
  if (r.freq === 'WEEKLY' && r.byDay && r.byDay.length) s += ` · ${[...r.byDay].sort((a, b) => a - b).map((i) => DAY_ES[i]).join(' ')}`;
  if (r.end === 'until' && r.until) { const [y, m, d] = r.until.split('-'); s += ` · hasta ${+d}/${+m}/${y}`; }
  if (r.end === 'count' && r.count) s += ` · ${r.count} veces`;
  return s;
}

export { DAY_ES };
