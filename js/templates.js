// Plantillas rápidas (guardadas en el dispositivo; se comparten con el "enlace de configuración")
import { store } from './store.js';

const DEFAULTS = [
  { name: 'Compra', type: 'task', colorId: '5', allDay: true, duration: 60, reminders: [] },
  { name: 'Gimnasio', type: 'event', colorId: '10', allDay: false, duration: 75, reminders: [{ method: 'popup', minutes: 60 }] },
  { name: 'Cena fuera', type: 'event', colorId: '11', allDay: false, duration: 150, hour: 21, reminders: [{ method: 'popup', minutes: 120 }] },
  { name: 'Médico', type: 'event', colorId: '9', allDay: false, duration: 45, reminders: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 60 }] },
];

export function getTemplates() { return store.get('templates', DEFAULTS); }
export function setTemplates(list) { store.set('templates', list); }
