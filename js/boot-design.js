// Pone el modo (claro/oscuro) y el estilo guardados antes del primer pintado, para que no parpadee.
// Es un fichero aparte porque la política de seguridad no permite scripts en línea.
// La lógica completa está en applyDesign (js/views/settings.js).
(function () {
  try {
    var get = function (k) { try { return JSON.parse(localStorage.getItem('sa-cal:' + k)); } catch (e) { return null; } };
    var estilo = get('estilo'), tema = get('tema') || get('theme');
    var h = document.documentElement;
    h.dataset.style = estilo === 'neon' || estilo === 'retro' ? estilo : 'pastel';
    h.dataset.theme = tema === 'light' || tema === 'dark' ? tema : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (e) { /* sin almacenamiento: se queda en Pastel según el sistema */ }
})();
