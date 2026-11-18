// Búsqueda (se abre con la lupa de Calendario): título, lugar y notas, de hace un año a dentro de dos.

import { h, clear } from './dom.js';
import { openSheet } from './sheet.js';
import { search, bus } from '../data.js';
import { itemCard, emptyState, list } from '../views/common.js';
import { startOfDay } from '../dates.js';

let lastQuery = '';

export function openSearch() {
  const results = h('div.search-results');
  let timer, seq = 0;
  const input = h('input.search', {
    type: 'search', placeholder: 'Buscar eventos y tareas…', value: lastQuery, autocomplete: 'off', enterkeyhint: 'search',
    'aria-label': 'Buscar',
    oninput: () => { clearTimeout(timer); timer = setTimeout(run, 350); },
    onkeydown: (e) => { if (e.key === 'Enter') { clearTimeout(timer); run(); input.blur(); } },
  });

  async function run() {
    const q = input.value.trim();
    lastQuery = q;
    const my = ++seq;
    clear(results);
    if (q.length < 2) { results.append(emptyState('Buscar', 'Escribe al menos 2 letras. Busca en título, lugar y notas, desde hace un año hasta dentro de dos.')); return; }
    results.append(h('div.spinner'));
    try {
      const items = await search(q);
      if (my !== seq) return;
      clear(results);
      if (!items.length) { results.append(list(emptyState('Sin resultados', `Nada coincide con «${q}».`))); return; }
      const today = startOfDay(new Date());
      const upcoming = items.filter((i) => i.end >= today);
      const past = items.filter((i) => i.end < today).reverse();
      const section = (label, rows) => {
        if (!rows.length) return;
        results.append(h('div.section', h('h2', label), h('span.when', `${rows.length} resultado${rows.length > 1 ? 's' : ''}`)));
        results.append(list(rows.map((it) => itemCard(it, { day: startOfDay(it.start), showDate: true }))));
      };
      section('Próximos', upcoming);
      section('Pasados', past);
    } catch (e) {
      if (my !== seq) return;
      clear(results).append(list(emptyState('Error', e.message)));
    }
  }

  // Si se edita, completa o borra algo desde un resultado, la lista se actualiza
  const onChanged = () => { if (input.value.trim().length >= 2) run(); };
  bus.addEventListener('changed', onChanged);

  openSheet({
    title: 'Buscar', tall: true,
    body: h('div', input, results),
    onClose: () => { clearTimeout(timer); bus.removeEventListener('changed', onChanged); },
  });
  run();
  setTimeout(() => input.focus(), 350);
}
