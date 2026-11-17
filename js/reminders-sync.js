// "Avisos para los dos": en Google Calendar los avisos son personales de cada cuenta.
// Cuando alguien crea un evento con "Para los dos", la app guarda los avisos en el propio evento
// (propiedades compartidas). Al abrir la app, cada persona aplica esos avisos a su cuenta.
// Se recuerda en el dispositivo qué versión se aplicó, para no repetir ni pisar cambios manuales.

import { store } from './store.js';
import { addDays } from './dates.js';
import { sameReminders } from './model.js';

const KEY = 'remApplied';

export function markApplied(id, version) {
  if (!id || !version) return;
  const map = store.get(KEY, {});
  map[id] = version;
  store.set(KEY, map);
}

/**
 * @param {*} api  backend (googleApi o demoApi)
 * @param {string} calId
 * @param {(items:any[])=>any[]} toItems  conversor fromGoogle
 * @returns {Promise<number>} nº de eventos actualizados
 */
export async function syncSharedReminders(api, calId, toItems) {
  const now = new Date();
  const raw = await api.listEvents(calId, { timeMin: now, timeMax: addDays(now, 60), shared: 'fcRemBoth=1', maxResults: 500 });
  const items = toItems(raw);
  const applied = store.get(KEY, {});
  const done = new Set();
  let count = 0;
  for (const it of items) {
    const targetId = it.recurringEventId || it.id;
    if (done.has(targetId)) continue;
    done.add(targetId);
    const version = it.remVersion || 'v';
    if (applied[targetId] === version) continue;
    if (!it.useDefaultReminders && sameReminders(it.reminders, it.sharedReminders)) { applied[targetId] = version; continue; }
    try {
      await api.patchEvent(calId, targetId, {
        reminders: { useDefault: false, overrides: it.sharedReminders },
      });
      applied[targetId] = version;
      count++;
    } catch (e) {
      console.warn('No se pudieron aplicar avisos a', targetId, e);
    }
  }
  // Limpieza: conserva solo ids recientes (máx. 400)
  const keys = Object.keys(applied);
  if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => delete applied[k]);
  store.set(KEY, applied);
  return count;
}
