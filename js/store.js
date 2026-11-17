// Almacenamiento local tolerante a fallos (modo privado, almacenamiento bloqueado…)
// Todo lo que se guarda aquí vive solo en este dispositivo: nunca en el repositorio.

const PREFIX = 'sa-cal:';
const mem = new Map();

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return mem.has(key) ? mem.get(key) : fallback;
      return JSON.parse(raw);
    } catch {
      return mem.has(key) ? mem.get(key) : fallback;
    }
  },
  set(key, value) {
    mem.set(key, value);
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  },
  remove(key) {
    mem.delete(key);
    try { localStorage.removeItem(PREFIX + key); } catch { /* nada */ }
  },
};
