// Service worker: guarda la "carcasa" de la app para que abra al instante y sin conexión.
// Las llamadas a Google (API y acceso) nunca se cachean.
const VERSION = 'sa-cal-v1.6.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/styles.css', 'js/boot-design.js',
  'js/app.js', 'js/api.js', 'js/auth.js', 'js/config.js', 'js/data.js', 'js/dates.js', 'js/demo.js',
  'js/model.js', 'js/recurrence.js', 'js/reminders-sync.js', 'js/store.js', 'js/tasks.js',
  'js/ui/dom.js', 'js/ui/editor.js', 'js/ui/search.js', 'js/ui/sheet.js', 'js/ui/swipe.js', 'js/ui/toast.js',
  'js/views/calendar.js', 'js/views/common.js', 'js/views/settings.js', 'js/views/tasks.js', 'js/views/upcoming.js',
  'fonts/fraunces-latin-400-normal.woff2', 'fonts/fraunces-latin-400-italic.woff2', 'fonts/fraunces-latin-500-normal.woff2', 'fonts/fraunces-latin-600-normal.woff2',
  'fonts/dm-sans-latin-400-normal.woff2', 'fonts/dm-sans-latin-500-normal.woff2', 'fonts/dm-sans-latin-600-normal.woff2',
  'fonts/chakra-petch-latin-500-normal.woff2', 'fonts/chakra-petch-latin-600-normal.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Navegación: red primero (para recibir actualizaciones y la vuelta del login), caché si no hay red
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }
  // Recursos: caché al instante y actualización en segundo plano
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
