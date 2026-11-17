// Hoja "Nuevo": alta rápida por texto, plantillas y acceso al formulario completo.

import { h, icon, clear } from './dom.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { parseQuickAdd } from '../quickadd.js';
import { openEditor, newDraft, defaultReminders } from './editor.js';
import { createItem } from '../data.js';
import { getTemplates } from '../templates.js';
import { colorHex } from '../model.js';
import { fmtDayLabel, toHM, startOfDay } from '../dates.js';

/** @param {{date?:Date}} ctx  día preseleccionado (p. ej. desde el calendario) */
export function openQuick(ctx = {}) {
  let s;
  const baseDay = ctx.date ? startOfDay(ctx.date) : null;

  const preview = h('div.preview.hint', 'Ej.: «cena con Laura viernes 21h» · «tarea pagar seguro el 25»');
  const go = h('button.go', { type: 'submit', disabled: true, 'aria-label': 'Crear' }, icon('check'));
  const input = h('input.field', {
    type: 'text', placeholder: 'Escribe y listo…', autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'done',
    oninput: update,
  });
  let parsed = null;

  function draftFromParsed(p) {
    let date = p.date || baseDay;
    const allDay = p.allDay || !p.start;
    const over = { type: p.type, title: p.title, allDay };
    if (!allDay) { over.start = p.start; over.end = p.end; }
    else if (date) { over.start = new Date(date); over.end = new Date(date); }
    return newDraft(over);
  }

  function update() {
    const txt = input.value.trim();
    go.disabled = !txt;
    clear(preview);
    if (!txt) { preview.className = 'preview hint'; preview.textContent = 'Ej.: «cena con Laura viernes 21h» · «tarea pagar seguro el 25»'; parsed = null; return; }
    preview.className = 'preview';
    parsed = parseQuickAdd(txt);
    const d = draftFromParsed(parsed);
    preview.append(
      h('span.k', d.type === 'task' ? 'Tarea' : 'Evento'),
      h('b', d.title || '—'),
      h('span', `· ${fmtDayLabel(d.start)}${d.allDay ? '' : `, ${toHM(d.start)}–${toHM(d.end)}`}`),
    );
  }

  async function submit(e) {
    e && e.preventDefault();
    if (!parsed) return;
    const d = draftFromParsed(parsed);
    if (!d.title) { toast('Falta el título', { error: true }); return; }
    go.disabled = true;
    try {
      await createItem(d);
      toast(`${d.type === 'task' ? 'Tarea' : 'Evento'} creado: ${d.title}`);
      s.close();
    } catch (err) {
      toast(`No se pudo crear: ${err.message}`, { error: true });
      go.disabled = false;
    }
  }

  const form = h('form.quick', { onsubmit: submit }, input, go);

  const tpls = getTemplates();
  const tplRow = h('div.tpls', tpls.map((t) => h('button.tpl', {
    type: 'button', '--c': colorHex(t.colorId),
    onclick: () => {
      s.close();
      const day = baseDay || new Date();
      const over = { type: t.type, title: t.name, colorId: t.colorId, allDay: !!t.allDay, reminders: t.reminders && t.reminders.length ? t.reminders : defaultReminders(!!t.allDay) };
      if (!t.allDay) {
        const st = new Date(day);
        if (t.hour != null) st.setHours(t.hour, 0, 0, 0);
        else { const n = new Date(); st.setHours(Math.min(n.getHours() + 1, 23), 0, 0, 0); }
        over.start = st; over.end = new Date(st.getTime() + (t.duration || 60) * 60000);
      } else { over.start = new Date(day); over.end = new Date(day); }
      openEditor({ draft: over });
    },
  }, h('span.nm', h('i'), t.name), h('span.sub', t.type === 'task' ? 'Tarea' : t.allDay ? 'Todo el día' : `${t.duration || 60} min`))));

  const openFull = (type) => {
    s.close();
    const over = { type, title: input.value.trim() && parsed ? parsed.title : '' };
    if (parsed && input.value.trim()) Object.assign(over, draftFromParsed({ ...parsed, type }));
    else if (baseDay) {
      if (type === 'task') { over.start = new Date(baseDay); over.end = new Date(baseDay); }
      else { const st = new Date(baseDay); st.setHours(ctx.hour ?? 10, 0, 0, 0); over.start = st; over.end = new Date(st.getTime() + 3600000); over.allDay = false; }
    }
    openEditor({ draft: over });
  };

  const body = h('div',
    h('span.fl', { style: { marginTop: '4px' } }, 'Alta rápida'),
    form, preview,
    tpls.length ? h('span.fl', 'Plantillas') : null,
    tpls.length ? tplRow : null,
    h('span.fl', 'Completo'),
    h('div.types',
      h('button.type', { type: 'button', onclick: () => openFull('event') }, icon('event'), h('span.nm', 'Evento'), h('small', 'Con hora o todo el día')),
      h('button.type.task', { type: 'button', onclick: () => openFull('task') }, icon('task'), h('span.nm', 'Tarea'), h('small', 'Con casilla y fecha límite')),
    ),
  );
  s = openSheet({ title: baseDay ? `Nuevo · ${fmtDayLabel(baseDay)}` : 'Nuevo', body });
  setTimeout(() => input.focus(), 350);
}
