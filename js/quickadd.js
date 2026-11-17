// Intérprete de "alta rápida" en español.
// Ejemplos: "cena con Laura viernes 21h", "tarea pagar seguro el 25", "dentista mañana a las 9:30",
// "gimnasio de 18 a 19:30", "cumple mamá 3 de diciembre", "comprar pan hoy"

import { addDays, startOfDay, weekdayMon } from './dates.js';

const WEEKDAYS = {
  lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6,
  lun: 0, mar: 1, mie: 2, jue: 3, vie: 4, sab: 5, dom: 6,
};
const MONTHS = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  ene: 0, feb: 1, abr: 3, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};

/** Quita tildes y pasa a minúsculas conservando la longitud (para indexar sobre el original) */
function fold(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * @param {string} text
 * @param {Date} [now]
 * @returns {{title:string, type:'event'|'task', date:Date|null, allDay:boolean, start:Date|null, end:Date|null, matched:string[]}}
 */
export function parseQuickAdd(text, now = new Date()) {
  const original = text.trim();
  // Trabajamos sobre una versión "plegada" letra a letra, para que los índices coincidan.
  const src = original.split('').map((ch) => fold(ch).charAt(0) || ch).join('');
  const consumed = new Array(src.length).fill(false);
  const matched = [];
  const take = (re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const s = m.index, e = s + m[0].length;
      if (consumed.slice(s, e).some(Boolean)) { if (!re.global) return null; continue; }
      for (let i = s; i < e; i++) consumed[i] = true;
      matched.push(original.slice(s, e).trim());
      return m;
    }
    return null;
  };

  let type = 'event';
  if (take(/(?:^|\s)(?:tarea|todo|pendiente)\s*:?(?=\s|$)/g) || take(/^\s*\[\s?\]\s*/g)) type = 'task';

  const today = startOfDay(now);
  let date = null;
  let m;

  // --- Horas ---
  const parseHM = (h, mi, mer) => {
    let H = +h; const M = mi ? +mi : 0;
    if (mer) {
      if (/tarde|noche|pm/.test(mer) && H < 12) H += 12;
      if (/manana|am|madrugada/.test(mer) && H === 12) H = 0;
    }
    return H <= 23 && M <= 59 ? [H, M] : null;
  };
  const MER = '(?:\\s*(?:h|hrs?|horas?))?(?:\\s*(am|pm|de\\s+la\\s+(?:manana|tarde|noche|madrugada)|del\\s+mediodia))?';
  let startHM = null, endHM = null;

  // Rango: "de 18 a 20", "de 9:30 a 11h", "18-20h"
  let re = new RegExp(`(?:^|\\s)(?:de\\s+(?:las\\s+)?|desde\\s+las\\s+)(\\d{1,2})(?:[:.](\\d{2}))?${MER}\\s+(?:a|hasta)\\s+(?:las\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?${MER}(?=\\s|$|[,.])`, 'g');
  if ((m = take(re))) {
    endHM = parseHM(m[4], m[5], m[6] || m[3]);
    startHM = parseHM(m[1], m[2], m[3] || m[6]);
  }
  if (!startHM && (m = take(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*h(?=\s|$|[,.])/g))) {
    startHM = parseHM(m[1], m[2]); endHM = parseHM(m[3], m[4]);
  }
  if (!startHM) {
    re = new RegExp(`(?:^|\\s)a\\s+las?\\s+(\\d{1,2})(?:[:.](\\d{2}))?${MER}(?=\\s|$|[,.])`, 'g');
    if ((m = take(re))) startHM = parseHM(m[1], m[2], m[3]);
  }
  if (!startHM && (m = take(/(?:^|\s)(\d{1,2})[:.](\d{2})\s*(?:h|hrs?)?(?=\s|$|[,.])/g))) startHM = parseHM(m[1], m[2]);
  if (!startHM && (m = take(/(?:^|\s)(\d{1,2})\s*(?:h|hrs?|pm|am)(?=\s|$|[,.])/g))) {
    const pm = /pm/.test(m[0]);
    startHM = parseHM(m[1], null, pm ? 'pm' : null);
  }
  if (!startHM && (m = take(/(?:^|\s)(?:al\s+)?mediodia(?=\s|$|[,.])/g))) startHM = [14, 0];

  // --- Fechas ---
  if ((m = take(/(?:^|\s)pasado\s+manana(?=\s|$|[,.])/g))) date = addDays(today, 2);
  else if ((m = take(/(?:^|\s)manana(?=\s|$|[,.])/g))) date = addDays(today, 1);
  else if ((m = take(/(?:^|\s)(?:hoy|esta\s+noche|esta\s+tarde)(?=\s|$|[,.])/g))) date = today;

  if (!date) {
    // "25/12", "25-12-2026", "25/12/26"
    if ((m = take(/(?:^|\s)(?:el\s+)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?(?=\s|$|[,.])/g))) {
      const d = +m[1], mo = +m[2] - 1;
      let y = m[3] ? +m[3] : today.getFullYear();
      if (y < 100) y += 2000;
      date = new Date(y, mo, d);
      if (!m[3] && date < today) date = new Date(y + 1, mo, d);
    }
  }
  if (!date) {
    // "3 de diciembre", "el 3 diciembre", "3 dic"
    const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
    const re = new RegExp(`(?:^|\\s)(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(${monthNames})(?:\\s+(?:de\\s+)?(\\d{4}))?(?=\\s|$|[,.])`, 'g');
    if ((m = take(re))) {
      const d = +m[1], mo = MONTHS[m[2]];
      let y = m[3] ? +m[3] : today.getFullYear();
      date = new Date(y, mo, d);
      if (!m[3] && date < today) date = new Date(y + 1, mo, d);
    }
  }
  if (!date) {
    // "viernes", "el próximo lunes", "este sábado"
    const names = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
    const re = new RegExp(`(?:^|\\s)(?:el\\s+|este\\s+|esta\\s+)?(proximo\\s+|siguiente\\s+)?(${names})(?:\\s+que\\s+viene|\\s+proximo)?(?=\\s|$|[,.])`, 'g');
    if ((m = take(re))) {
      const target = WEEKDAYS[m[2]];
      let diff = (target - weekdayMon(today) + 7) % 7;
      if (diff === 0 && m[1]) diff = 7;
      date = addDays(today, diff);
    }
  }
  if (!date) {
    // "el 25" (día del mes; si ya pasó, el mes siguiente)
    if ((m = take(/(?:^|\s)el\s+(?:dia\s+)?(\d{1,2})(?=\s|$|[,.])/g))) {
      const d = +m[1];
      if (d >= 1 && d <= 31) {
        date = new Date(today.getFullYear(), today.getMonth(), d);
        if (date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, d);
      }
    }
  }
  if (!date && (m = take(/(?:^|\s)(?:dentro\s+de|en)\s+(\d{1,2})\s+dias?(?=\s|$|[,.])/g))) date = addDays(today, +m[1]);
  if (!date && (m = take(/(?:^|\s)la\s+semana\s+que\s+viene(?=\s|$|[,.])/g))) date = addDays(today, 7 - weekdayMon(today));

  // Heurística: horas 1-7 sin indicación → tarde (p. ej. "a las 5" = 17:00), salvo "de la mañana"
  if (startHM && startHM[0] >= 1 && startHM[0] <= 7 && !/manana|am|madrugada|:\d\d/.test(matched.join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
    startHM[0] += 12;
    if (endHM && endHM[0] < startHM[0] && endHM[0] + 12 <= 23) endHM[0] += 12;
  }
  if (startHM && endHM && endHM[0] < startHM[0] && endHM[0] + 12 <= 23) endHM[0] += 12;

  // Título: lo que no se ha consumido
  let title = '';
  for (let i = 0; i < original.length; i++) title += consumed[i] ? ' ' : original[i];
  title = title.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').replace(/^[\s,.:-]+|[\s,.:-]+$/g, '');
  title = title.replace(/\s+(?:el|la|a|de|para|en)$/i, '');
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  if (!date && startHM) {
    date = today;
    const t = new Date(today); t.setHours(startHM[0], startHM[1]);
    if (t < now) date = addDays(today, 1);
  }

  let start = null, end = null, allDay = true;
  if (date && startHM) {
    allDay = false;
    start = new Date(date); start.setHours(startHM[0], startHM[1], 0, 0);
    if (endHM) {
      end = new Date(date); end.setHours(endHM[0], endHM[1], 0, 0);
      if (end <= start) end = new Date(start.getTime() + 3600000);
    } else end = new Date(start.getTime() + 3600000);
  }

  return { title, type, date, allDay, start, end, matched };
}
