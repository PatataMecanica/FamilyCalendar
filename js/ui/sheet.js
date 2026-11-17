// Hoja inferior reutilizable (se cierra deslizando hacia abajo, tocando fuera o con "atrás")

import { h, icon } from './dom.js';

const stack = [];

// Integración con el botón "atrás" (Android / gesto en iOS): una entrada de historial mientras haya hojas abiertas
let hasEntry = false;
let ignorePops = 0;
window.addEventListener('popstate', () => {
  if (ignorePops) { ignorePops--; return; }
  hasEntry = false;
  const top = stack[stack.length - 1];
  if (top) top.close(true);
  if (stack.length) { history.pushState({ sheet: true }, ''); hasEntry = true; }
});
function ensureEntry() {
  if (!hasEntry) { history.pushState({ sheet: true }, ''); hasEntry = true; }
}
function releaseEntry() {
  setTimeout(() => {
    if (!stack.length && hasEntry) { hasEntry = false; ignorePops++; history.back(); }
  }, 0);
}

/**
 * @param {{title?:string, body:Node, foot?:Node|null, onClose?:()=>void, headActions?:Node[], tall?:boolean}} opts
 * @returns {{close:()=>void, el:HTMLElement, body:HTMLElement}}
 */
export function openSheet({ title = '', body, foot = null, onClose, headActions = [], tall = false }) {
  const root = document.getElementById('sheets');
  const scrim = h('div.scrim');
  const bodyEl = h('div.sheet-body', body);
  const sheet = h('section.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Panel' },
    h('div.sheet-grip'),
    h('div.sheet-head',
      h('h2', title),
      ...headActions,
      h('button.icon-btn', { type: 'button', 'aria-label': 'Cerrar', onclick: () => close() }, icon('close')),
    ),
    bodyEl,
    foot ? h('div.sheet-foot', foot) : null,
  );
  if (tall) sheet.style.height = 'calc(100dvh - var(--safe-t) - 24px)';
  root.append(scrim, sheet);
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('open'); sheet.classList.add('open'); }));

  let closed = false;
  function close(fromPop = false) {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
    if (!fromPop) releaseEntry();
    scrim.classList.remove('open'); sheet.classList.remove('open');
    sheet.style.transform = '';
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 320);
    if (onClose) onClose();
  }
  scrim.addEventListener('click', () => close());

  // Deslizar hacia abajo desde la cabecera para cerrar
  let y0 = null, dy = 0;
  const grabZone = [sheet.querySelector('.sheet-grip'), sheet.querySelector('.sheet-head')];
  grabZone.forEach((z) => {
    z.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
    z.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    z.addEventListener('touchend', () => {
      sheet.style.transition = '';
      if (dy > 90) close(); else sheet.style.transform = '';
      y0 = null;
    });
  });

  const api = { close, el: sheet, body: bodyEl };
  stack.push(api);
  ensureEntry();
  return api;
}

export function closeTopSheet() {
  const top = stack[stack.length - 1];
  if (top) { top.close(); return true; }
  return false;
}
export function closeAllSheets() { [...stack].forEach((s) => s.close()); }
export const sheetsOpen = () => stack.length > 0;

/** Pregunta de opción rápida. Devuelve la clave elegida o null. */
export function choose(title, options) {
  return new Promise((resolve) => {
    let picked = null;
    const s = openSheet({
      title,
      body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        options.map((o) => h(`button.btn.block${o.danger ? '.danger' : ''}${o.primary ? '.primary' : ''}`, {
          onclick: () => { picked = o.key; s.close(); },
        }, o.label)),
      ),
      onClose: () => resolve(picked),
    });
  });
}
