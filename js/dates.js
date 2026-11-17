// Utilidades de fecha (zona horaria local del dispositivo, semana empieza en lunes)

export const DAYS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
export const DAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const pad = (n) => String(n).padStart(2, '0');

/** Lunes = 0 … Domingo = 6 */
export const weekdayMon = (d) => (d.getDay() + 6) % 7;

export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addMinutes(d, n) { return new Date(d.getTime() + n * 60000); }
export function addMonths(d, n) {
  const x = new Date(d); const day = x.getDate();
  x.setDate(1); x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}
export function startOfWeek(d) { return addDays(startOfDay(d), -weekdayMon(d)); }
export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

/** 'YYYY-MM-DD' en hora local */
export function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/** Parsea 'YYYY-MM-DD' como fecha local (no UTC) */
export function fromISODate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
/** 'HH:MM' */
export function toHM(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
/** Valor para <input type="datetime-local"> */
export function toLocalInput(d) { return `${toISODate(d)}T${toHM(d)}`; }
export function fromLocalInput(s) { const [date, time] = s.split('T'); const d = fromISODate(date); const [h, m] = (time || '00:00').split(':').map(Number); d.setHours(h, m, 0, 0); return d; }

/** RFC3339 con offset local, p. ej. 2026-11-17T09:30:00+01:00 */
export function toRFC3339(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${toISODate(d)}T${toHM(d)}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function localTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function fmtDayLabel(d, today = new Date()) {
  const diff = daysBetween(today, d);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return `${cap(DAYS_LONG[weekdayMon(d)])} ${d.getDate()}`;
}
export function fmtLongDate(d) { return `${DAYS_LONG[weekdayMon(d)]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; }
export function fmtShortDate(d) { return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`; }
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Número de semana ISO */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}
