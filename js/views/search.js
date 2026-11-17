import { h, clear } from '../ui/dom.js';
import { search } from '../data.js';
import { itemCard, emptyState, list } from './common.js';
import { startOfDay } from '../dates.js';

let lastQuery = '';

export function renderSearch(root) {
  clear(root);
  const results = h('div');
  let timer, seq = 0;
  const input = h('input.search', {
    type: 'search', placeholder: 'Buscar eventos y tareas…', value: lastQuery, autocomplete: 'off', enterkeyhint: 'search',
    oninput: () => { clearTimeout(timer); timer = setTimeout(run, 350); },
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
      const section = (label, list) => {
        if (!list.length) return;
        results.append(h('div.section', h('h2', label), h('span.when', `${list.length} resultado${list.length > 1 ? 's' : ''}`)));
        results.append(h('div.list', list.map((it) => itemCard(it, { day: startOfDay(it.start), showDate: true }))));
      };
      section('Próximos', upcoming);
      section('Pasados', past);
    } catch (e) {
      if (my !== seq) return;
      clear(results).append(list(emptyState('Error', e.message)));
    }
  }
  root.append(input, results);
  run();
  setTimeout(() => input.focus(), 50);
}
