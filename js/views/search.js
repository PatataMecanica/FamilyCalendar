import { h, icon, clear } from '../ui/dom.js';
import { search } from '../data.js';
import { itemCard, emptyState } from './common.js';
import { fmtLongDate, cap, startOfDay } from '../dates.js';

let lastQuery = '';

export function renderSearch(root) {
  clear(root);
  const results = h('div');
  let timer, seq = 0;
  const input = h('input.input', {
    type: 'search', placeholder: 'Buscar eventos y tareas…', value: lastQuery, autocomplete: 'off', enterkeyhint: 'search',
    oninput: () => { clearTimeout(timer); timer = setTimeout(run, 350); },
  });
  async function run() {
    const q = input.value.trim();
    lastQuery = q;
    const my = ++seq;
    clear(results);
    if (q.length < 2) { results.append(emptyState('Buscar', 'Escribe al menos 2 letras. Busca en título, lugar y notas, desde hace un año hasta dentro de dos.')); return; }
    results.append(h('div', { style: { display: 'grid', placeItems: 'center', padding: '30px' } }, h('div.spinner')));
    try {
      const items = await search(q);
      if (my !== seq) return;
      clear(results);
      if (!items.length) { results.append(emptyState('Sin resultados', `Nada coincide con «${q}».`)); return; }
      const today = startOfDay(new Date());
      const upcoming = items.filter((i) => i.end >= today);
      const past = items.filter((i) => i.end < today).reverse();
      const section = (label, list) => {
        if (!list.length) return;
        results.append(h('div.section-rule', h('span.n', String(list.length).padStart(2, '0')), h('span.label', label)));
        let lastDay = '';
        list.forEach((it) => {
          const key = startOfDay(it.start).toDateString();
          if (key !== lastDay) { results.append(h('div.result-date', cap(fmtLongDate(it.start)))); lastDay = key; }
          results.append(itemCard(it, { day: startOfDay(it.start) }));
        });
      };
      section('Próximos', upcoming);
      section('Pasados', past);
    } catch (e) {
      if (my !== seq) return;
      clear(results).append(emptyState('Error', e.message));
    }
  }
  root.append(h('div.search-box', h('div.wrap', icon('search', 'sm'), input)), results);
  run();
  setTimeout(() => input.focus(), 50);
}
