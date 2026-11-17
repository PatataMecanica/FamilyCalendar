import { h } from './dom.js';

export function toast(message, { action, onAction, error = false, duration = 4000 } = {}) {
  const root = document.getElementById('toasts');
  let t;
  const el = h(`div.toast${error ? '.error' : ''}`, { role: 'status' },
    h('span', message),
    action ? h('button', { onclick: () => { clearTimeout(t); el.remove(); onAction && onAction(); } }, action) : null,
  );
  root.append(el);
  while (root.children.length > 2) root.firstChild.remove();
  t = setTimeout(() => el.remove(), duration);
  return el;
}
