// Deslizar entre pestañas (como en Gastos S&A).
// La página (cabecera y vista) sigue al dedo y la pestaña vecina asoma por el lado,
// pintada en una segunda página fija (.peek) tal como se verá al llegar: arriba del todo.
// Al soltar, o se completa el cambio o todo vuelve a su sitio.
//
// Diferencia con Gastos: aquí las vistas se pintan de forma asíncrona (piden datos a Google),
// así que al completar el cambio la vecina sigue a la vista hasta que la pestaña de verdad
// ha terminado de pintarse, para que no asome la anterior.

import { h } from './dom.js';

const SLOP = 10;   // px antes de decidir si el gesto es horizontal
const EDGE = 24;   // px del borde reservados al gesto «atrás» del navegador

/**
 * @param {{
 *   app: HTMLElement,
 *   tabs: string[],
 *   current: () => string,
 *   blocked: () => boolean,                       // p. ej. con una hoja abierta
 *   paint: (tab: string, page: HTMLElement) => void, // pinta la vecina dentro de .page
 *   go: (tab: string) => Promise<void>|void,      // cambia de pestaña de verdad
 *   mark: (tab: string) => void,                   // marca la pestaña en la barra
 * }} o
 */
export function initTabSwipe({ app, tabs, current, blocked, paint, go, mark }) {
  const nav = document.getElementById('nav');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const width = () => document.documentElement.clientWidth;
  let g = null;      // gesto en curso: { target, x, y, mode: null | 'swipe', dx, vx, lastX, lastT }
  let peek = null;   // { el, tab, side }  side: 1 si entra por la derecha, -1 por la izquierda
  let timer = 0, finish = null, switching = false;

  // ¿hay algo bajo el dedo que ya se mueva en horizontal por su cuenta?
  const scrollsX = (el) => {
    for (; el && el !== app; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  };

  function dropPeek() { if (peek) { peek.el.remove(); peek = null; } }
  function setPeek(side) {
    const tab = tabs[tabs.indexOf(current()) + side];
    if (peek && peek.tab === tab) return;
    dropPeek();
    if (!tab) return;
    const page = h('div.page');
    const el = h('div.peek', { 'aria-hidden': 'true', style: { width: `${width()}px` } }, page);
    el.inert = true;
    document.body.insertBefore(el, nav);
    peek = { el, tab, side };
    paint(tab, page);
  }

  function place(dx, ms) {
    const tr = ms ? `transform ${ms}ms cubic-bezier(.2, .8, .2, 1)` : 'none';
    app.style.transition = tr;
    app.style.transform = `translate3d(${dx}px, 0, 0)`;
    if (peek) {
      peek.el.style.transition = tr;
      peek.el.style.transform = `translate3d(${dx + peek.side * width()}px, 0, 0)`;
    }
  }
  function reset() {
    clearTimeout(timer); finish = null;
    app.style.transition = app.style.transform = app.style.willChange = '';
    dropPeek();
  }

  // Lleva la página hasta su destino y, si toca, cambia de pestaña al llegar.
  function settle(tab, dx, vx) {
    const to = tab ? -peek.side * width() : 0;
    const ms = calm.matches ? 0 : Math.round(Math.min(320, Math.max(160, Math.abs(to - dx) / Math.max(Math.abs(vx), 1.4))));
    if (tab) mark(tab);
    finish = async () => {
      clearTimeout(timer); finish = null;
      if (!tab) { reset(); return; }
      switching = true;
      place(to, 0);
      try { await go(tab); } catch { /* go() ya enseña el error */ }
      switching = false;
      reset();
    };
    if (!ms) { finish(); return; }
    place(to, ms);
    timer = setTimeout(() => finish && finish(), ms + 20);
  }

  // El gesto se escucha en el elemento tocado y no en document: si una sincronización
  // repinta la vista a medio arrastre, ese elemento sale del documento y sus eventos
  // ya no suben hasta aquí, pero él los sigue recibiendo.
  function listen(on) {
    const fn = on ? 'addEventListener' : 'removeEventListener';
    g.target[fn]('touchmove', move, { passive: false });
    g.target[fn]('touchend', end);
    g.target[fn]('touchcancel', end);
  }
  function drop() { if (g) { listen(false); g = null; } }
  function cancel() { if (g && g.mode === 'swipe') settle(null, g.dx, 0); drop(); }

  document.addEventListener('touchstart', (e) => {
    if (g && g.mode === 'swipe') { cancel(); return; } // un segundo dedo: es otra cosa (zoom)
    if (switching) return;
    if (finish) finish(); // un gesto nuevo no espera a que acabe la animación anterior
    drop();
    if (e.touches.length !== 1 || nav.hidden || app.hidden || blocked() || !app.contains(e.target)) return;
    if (e.target.closest('input, textarea, select') || scrollsX(e.target)) return;
    const p = e.touches[0];
    if (!standalone() && (p.clientX < EDGE || p.clientX > width() - EDGE)) return;
    g = { target: e.target, x: p.clientX, y: p.clientY, mode: null, dx: 0, vx: 0, lastX: p.clientX, lastT: e.timeStamp };
    listen(true);
  }, { passive: true });

  function move(e) {
    if (e.touches.length !== 1) { cancel(); return; }
    const p = e.touches[0], dx = p.clientX - g.x, dy = p.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // si el navegador ya está desplazando la página, el gesto es suyo
      if (!e.cancelable || Math.abs(dx) < Math.abs(dy) * 1.5) { drop(); return; }
      g.mode = 'swipe';
      g.x = p.clientX; // se parte de aquí para que la página no dé un salto
      g.lastX = p.clientX; g.lastT = e.timeStamp;
      app.style.willChange = 'transform';
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      e.preventDefault();
      return;
    }
    if (e.cancelable) e.preventDefault();
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) { // velocidad suavizada, en px/ms
      const v = (p.clientX - g.lastX) / dt;
      g.vx = g.vx ? 0.6 * v + 0.4 * g.vx : v; g.lastX = p.clientX; g.lastT = e.timeStamp;
    }
    if (dx) setPeek(dx < 0 ? 1 : -1);
    g.dx = peek ? Math.max(-width(), Math.min(width(), dx)) : dx * 0.22; // en los extremos, resistencia de goma
    place(g.dx, 0);
  }

  function end(e) {
    if (g.mode !== 'swipe') { drop(); return; }
    const { dx } = g, vx = e.timeStamp - g.lastT > 90 ? 0 : g.vx; // si el dedo se paró antes de soltar, no hay impulso
    drop();
    const along = vx * dx > 0, fling = along && Math.abs(vx) > 0.35 && Math.abs(dx) > 16;
    const back = !along && Math.abs(vx) > 0.35;
    const commit = e.type === 'touchend' && peek && !back && (fling || Math.abs(dx) > width() * 0.4);
    settle(commit ? peek.tab : null, dx, vx);
  }
}
