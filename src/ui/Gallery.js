import { h, clear, scoreColor } from './dom.js';
import { LABELS } from '../photography/PhotoEvaluator.js';
import { DEFAULT_EDITS, renderEdited, evaluateEdits } from '../photography/EditEval.js';
import { formatMoney } from '../core/MathUtil.js';

const MOMENTS = { gol: 'Gol', celebracion: 'Celebración', atajada: 'Atajada', remate: 'Remate', disputa: 'Disputa', entrada: 'Entrada', regate: 'Regate', calentamiento: 'Calentamiento', penal: 'Penal', expulsion: 'Expulsión', publico: 'Público', tecnico: 'Técnico' };
const MAX_DELIVERY = 10;

async function loadImage(game, rec) {
  const blob = await game.photos.getBlob(rec.id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const img = new Image(); img.src = url; await img.decode().catch(() => {});
  return { img, url };
}
function badge(rec, game) { const s = game.photos.finalScore(rec); const g = rec.editedEval ? rec.editedEval.grade : rec.eval.grade; return h('div', { class: 'badge', style: { background: scoreColor(s), color: '#111' } }, `${g} ${s}`); }

export class Gallery {
  constructor(game, opts = {}) {
    this.game = game; this.mode = opts.mode || 'browse'; this.onDeliver = opts.onDeliver;
    this.filter = this.mode === 'deliver' ? 'session' : 'all'; this.moment = ''; this.sort = 'time'; this.compare = false; this.cmpSel = [];
    this.root = h('div', { style: { height: '100%' } }); this.render();
  }
  list() {
    const g = this.game; let L = g.photos.records.slice();
    if (this.filter === 'session') L = L.filter((r) => r.sessionId === g.career.sessionId);
    if (this.filter === 'fav') L = L.filter((r) => r.favorite);
    if (this.filter === 'sel') L = L.filter((r) => r.selected);
    if (this.filter === 'delivered') L = L.filter((r) => r.delivered);
    if (this.moment) L = L.filter((r) => r.eval.moment.type === this.moment || r.eval.tags.includes(this.moment));
    if (this.sort === 'score') L.sort((a, b) => g.photos.finalScore(b) - g.photos.finalScore(a)); else L.reverse();
    return L;
  }
  render() {
    const g = this.game; clear(this.root);
    const L = this.list(); const selCount = g.photos.records.filter((r) => r.selected && !r.delivered && r.sessionId === g.career.sessionId).length;
    const fbtn = (k, label) => h('button', { class: 'btn small' + (this.filter === k ? ' active' : ''), onclick: () => { this.filter = k; this.render(); } }, label);
    const bar = h('div', { class: 'filters' },
      fbtn('all', 'Todas'), fbtn('session', 'Este evento'), fbtn('fav', '★ Favoritas'), fbtn('sel', 'Seleccionadas'), fbtn('delivered', 'Entregadas'),
      h('select', { onchange: (e) => { this.moment = e.target.value; this.render(); } }, h('option', { value: '' }, 'Todos los momentos'), ...Object.entries(MOMENTS).map(([k, v]) => h('option', { value: k, selected: this.moment === k ? true : null }, v))),
      h('select', { onchange: (e) => { this.sort = e.target.value; this.render(); } }, h('option', { value: 'time', selected: this.sort === 'time' ? true : null }, 'Más recientes'), h('option', { value: 'score', selected: this.sort === 'score' ? true : null }, 'Mejor puntuación')),
      h('button', { class: 'btn small' + (this.compare ? ' active' : ''), onclick: () => { this.compare = !this.compare; this.cmpSel = []; this.render(); } }, this.compare ? 'Elegí 2 fotos…' : 'Comparar'),
      h('span', { style: { flex: 1 } }),
      h('span', { class: 'muted', style: { fontSize: '13px' } }, `${L.length} fotos · tarjeta ${g.inventory.cardUsed}/${g.inventory.cardCapacity}`),
      this.mode === 'deliver' ? h('button', { class: 'btn primary', disabled: selCount === 0 ? true : null, onclick: () => this.deliver() }, `Entregar al editor (${selCount}/${MAX_DELIVERY})`) : null);
    const grid = h('div', { class: 'gal' });
    if (!L.length) grid.append(h('div', { class: 'muted', style: { padding: '30px' } }, 'No hay fotografías con este filtro. Equipá la cámara (G), levantá el visor (clic derecho) y disparé (clic izquierdo).'));
    for (const r of L) {
      const el = h('div', { class: 'ph' + (r.selected ? ' sel' : '') + (this.cmpSel.includes(r) ? ' cmp' : '') },
        h('img', { src: r.thumb, loading: 'lazy' }), badge(r, g), r.favorite ? h('div', { class: 'fav' }, '★') : null,
        r.delivered ? h('span', { class: 'pill on dlv' }, 'Entregada') : null,
        h('div', { class: 'cap' }, `${r.meta.minute}' · ${r.eval.moment.label}${r.eval.subject ? ' · ' + r.eval.subject.name : ''}`),
        h('div', { class: 'chk', title: 'Seleccionar para entrega', onclick: (e) => { e.stopPropagation(); this.toggleSelect(r); } }));
      el.addEventListener('click', () => {
        if (this.compare) { this.cmpSel.push(r); if (this.cmpSel.length === 2) this.openCompare(this.cmpSel[0], this.cmpSel[1]); else this.render(); }
        else this.openViewer(r, L);
      });
      grid.append(el);
    }
    this.root.append(bar, grid);
  }
  toggleSelect(r) {
    const g = this.game;
    if (r.delivered) { g.ui.toast('Esa foto ya fue entregada.', 'warn'); return; }
    const n = g.photos.records.filter((x) => x.selected && !x.delivered && x.sessionId === g.career.sessionId).length;
    if (!r.selected && n >= MAX_DELIVERY && r.sessionId === g.career.sessionId) { g.ui.toast(`El editor acepta máximo ${MAX_DELIVERY} fotos por evento.`, 'warn'); return; }
    r.selected = !r.selected; g.photos.update(r); g.audio?.ui('click'); this.render();
  }
  async openViewer(r, list) {
    const g = this.game; clear(this.root);
    const li = await loadImage(g, r); if (!li) { this.render(); return; }
    let shown = li.img;
    if (r.edits) shown = renderEdited(li.img, r.edits);
    const wrap = h('div', { class: 'imgwrap' }, shown);
    wrap.addEventListener('click', () => wrap.classList.toggle('zoom'));
    const ev = r.editedEval || r.eval, idx = list.indexOf(r);
    const brk = h('div', { class: 'breakdown' }, ...Object.entries(LABELS).map(([k, lab]) => {
      const v = Math.round(ev.parts[k]); return h('div', { class: 'row' }, h('span', {}, lab), h('div', { class: 'b' }, h('i', { style: { width: v + '%', background: scoreColor(v) } })), h('span', {}, v));
    }));
    const m = r.meta, t = r.eval.tech;
    const exif = h('div', { class: 'exif' }, ...[
      ['Fecha', new Date(m.date).toLocaleString('es-CR')], ['Evento', m.event], ['Marcador', m.matchScore], ['Minuto', `${m.minute}'`],
      ['Cámara', m.camera], ['Lente', m.lens], ['Focal', `${m.focal} mm (equiv. ${m.focalEff} mm)`], ['Apertura', `f/${m.aperture}`], ['Velocidad', m.shutter], ['ISO', m.iso],
      ['Balance', m.wb], ['Enfoque', `${m.afMode} · ${m.focusDist} m`], ['Modo', m.drive === 'burst' ? 'Ráfaga' : 'Individual'],
      ['Sujeto', r.eval.subject ? `${r.eval.subject.number ? '#' + r.eval.subject.number + ' ' : ''}${r.eval.subject.name}${r.eval.subject.team ? ' (' + r.eval.subject.team + ')' : ''}` : '—'],
      ['Jugada', r.eval.moment.label], ['Dist. sujeto', `${t.subjDist} m`], ['Desenfoque', `foco ${t.cocPx}px · mov. ${t.motionPx}px · pulso ${t.shakePx}px`], ['Exposición', `${t.exposureDelta >= 0 ? '+' : ''}${t.exposureDelta} EV · lum. ${t.measuredMean}`],
      ['Resolución', `${m.W}×${m.H}`],
    ].map(([k, v]) => h('div', {}, h('span', { class: 'muted' }, k + ': '), String(v))));
    const side = h('div', { class: 'side card' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, h('div', { class: 'bigscore', style: { color: scoreColor(ev.score) } }, ev.score), h('div', {}, h('div', { class: 'h2', style: { margin: 0 } }, ev.label), h('div', { class: 'muted' }, `Valor estimado: ${formatMoney(r.eval.value * (ev.score / Math.max(1, r.eval.score)))}`))),
      r.editedEval ? h('div', { class: 'muted', style: { fontSize: '12px', margin: '6px 0' } }, `Editada (${r.editedEval.delta >= 0 ? '+' : ''}${r.editedEval.delta} sobre la original ${r.eval.score})`) : null,
      h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Evaluación'), brk,
      h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Comentarios'), h('div', { style: { fontSize: '14px', lineHeight: 1.5 } }, ...r.eval.comments.map((c) => h('div', {}, '• ' + c)), ...(r.editedEval?.notes || []).map((c) => h('div', { style: { color: '#9bd' } }, '• ' + c))),
      h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Datos EXIF'), exif,
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' } },
        h('button', { class: 'btn small', onclick: () => { r.favorite = !r.favorite; g.photos.update(r); this.openViewer(r, list); } }, r.favorite ? '★ Quitar favorita' : '☆ Favorita'),
        h('button', { class: 'btn small' + (r.selected ? ' active' : ''), onclick: () => { this.toggleSelect(r); this.openViewer(r, list); } }, r.selected ? '✓ Seleccionada' : 'Seleccionar'),
        h('button', { class: 'btn small', onclick: () => this.openEditor(r, li.img, list) }, '✎ Editar'),
        h('button', { class: 'btn small', onclick: () => this.exportJpg(r, li.img) }, '⇩ Exportar JPG'),
        h('button', { class: 'btn small danger', onclick: async () => { if (await g.ui.confirm('La fotografía se eliminará de la tarjeta y del archivo.', 'Eliminar')) { await g.photos.remove(r.id); if (r.sessionId === g.career.sessionId) g.inventory.cardUsed = Math.max(0, g.inventory.cardUsed - 1); URL.revokeObjectURL(li.url); this.render(); } } }, '🗑 Eliminar')),
      h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px' } },
        h('button', { class: 'btn small', disabled: idx <= 0 ? true : null, onclick: () => this.openViewer(list[idx - 1], list) }, '← Anterior'),
        h('button', { class: 'btn small', onclick: () => { URL.revokeObjectURL(li.url); this.render(); } }, 'Volver a la galería'),
        h('button', { class: 'btn small', disabled: idx >= list.length - 1 ? true : null, onclick: () => this.openViewer(list[idx + 1], list) }, 'Siguiente →')));
    this.root.append(h('div', { class: 'viewer' }, wrap, side));
  }
  async openCompare(a, b) {
    const g = this.game; clear(this.root);
    const col = async (r) => {
      const li = await loadImage(g, r); const im = r.edits ? renderEdited(li.img, r.edits, 1200) : li.img;
      if (im.tagName === 'CANVAS') im.style.width = '100%';
      const ev = r.editedEval || r.eval;
      return h('div', {}, im, h('div', { class: 'card' }, h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('b', {}, ev.label), h('b', { style: { color: scoreColor(ev.score), fontSize: '22px' } }, ev.score)),
        h('div', { class: 'breakdown' }, ...Object.entries(LABELS).map(([k, lab]) => { const v = Math.round(ev.parts[k]); return h('div', { class: 'row' }, h('span', {}, lab), h('div', { class: 'b' }, h('i', { style: { width: v + '%', background: scoreColor(v) } })), h('span', {}, v)); })),
        h('div', { class: 'exif' }, `${r.meta.focal}mm · f/${r.meta.aperture} · ${r.meta.shutter} · ISO ${r.meta.iso}`),
        h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: () => { this.toggleSelect(r); this.openCompare(a, b); } }, r.selected ? '✓ Seleccionada' : 'Seleccionar esta')));
    };
    this.root.append(h('div', { class: 'filters' }, h('button', { class: 'btn small', onclick: () => { this.compare = false; this.cmpSel = []; this.render(); } }, '← Volver')), h('div', { class: 'compare' }, await col(a), await col(b)));
  }
  async exportJpg(r, img) {
    const c = renderEdited(img, r.edits || DEFAULT_EDITS);
    c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `EntreLineas_${r.meta.event.replace(/[^\w]+/g, '_')}_${r.meta.minute}min_${r.id.slice(-5)}.jpg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/jpeg', 0.94);
    this.game.ui.toast('Fotografía exportada como JPG.', 'good');
  }
  openEditor(r, img, list, init) {
    const g = this.game; clear(this.root); g.ui.screenCleanup?.(); g.ui.screenCleanup = null;
    const e = { ...DEFAULT_EDITS, ...(init || r.edits || {}) };
    const canvasWrap = h('div', { class: 'canvaswrap' });
    const cropBox = h('div', { class: 'crop', style: { display: 'none' } });
    let preview = null, cropMode = false;
    const scoreEl = h('div'), notesEl = h('div', { style: { fontSize: '13px', color: '#9bd', marginTop: '6px' } });
    const draw = () => {
      const tmp = { ...e, crop: cropMode ? null : e.crop };
      const c = renderEdited(img, tmp, 1100); c.style.maxWidth = '100%'; c.style.maxHeight = '100%';
      clear(canvasWrap).append(c, cropBox); preview = c;
      const ev = evaluateEdits(r, e);
      scoreEl.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px"><div class="bigscore" style="color:${scoreColor(ev.score)}">${ev.score}</div><div><b>${ev.label}</b><div class="muted">Original ${r.eval.score} · ${ev.delta >= 0 ? '+' : ''}${ev.delta}</div></div></div>`;
      notesEl.innerHTML = ev.notes.map((n) => '• ' + n).join('<br>');
      if (cropMode && e.crop) showCrop(e.crop); else cropBox.style.display = 'none';
    };
    const showCrop = (cr) => {
      const rect = preview.getBoundingClientRect(), wr = canvasWrap.getBoundingClientRect();
      Object.assign(cropBox.style, { display: 'block', left: rect.left - wr.left + cr.x0 * rect.width + 'px', top: rect.top - wr.top + cr.y0 * rect.height + 'px', width: (cr.x1 - cr.x0) * rect.width + 'px', height: (cr.y1 - cr.y0) * rect.height + 'px' });
    };
    // Recorte con arrastre (proporción 3:2 bloqueada opcional)
    let drag = null, lock = true;
    canvasWrap.addEventListener('mousedown', (ev) => {
      if (!cropMode || !preview) return; const rect = preview.getBoundingClientRect();
      drag = { x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height };
    });
    const onMove = (ev) => {
      if (!drag) return; const rect = preview.getBoundingClientRect();
      let x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)), y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      if (lock) { const w = Math.abs(x - drag.x); const hh = w * (rect.width / rect.height) / 1.5; y = drag.y + Math.sign(y - drag.y || 1) * hh; y = Math.max(0, Math.min(1, y)); }
      e.crop = { x0: Math.min(drag.x, x), x1: Math.max(drag.x, x), y0: Math.min(drag.y, y), y1: Math.max(drag.y, y) };
      showCrop(e.crop);
    };
    const onUp = () => { if (drag) { drag = null; if (e.crop && (e.crop.x1 - e.crop.x0 < 0.08 || e.crop.y1 - e.crop.y0 < 0.08)) e.crop = null; draw(); } };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    g.ui.screenCleanup = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    const slider = (key, label, min, max, step, fmt) => {
      const val = h('span', {}, fmt(e[key]));
      const inp = h('input', { type: 'range', min, max, step, value: e[key] });
      inp.addEventListener('input', () => { e[key] = +inp.value; val.textContent = fmt(e[key]); clearTimeout(this.dt); this.dt = setTimeout(draw, 60); });
      return h('div', { class: 'slider' }, h('label', {}, h('span', {}, label), val), inp);
    };
    const pct = (v) => (v > 0 ? '+' : '') + v;
    const side = h('div', { class: 'card', style: { overflow: 'auto' } },
      h('div', { class: 'h2' }, 'Edición'), scoreEl, notesEl,
      slider('exposure', 'Exposición (EV)', -2, 2, 0.1, (v) => (v > 0 ? '+' : '') + (+v).toFixed(1)), slider('contrast', 'Contraste', -60, 60, 1, pct), slider('saturation', 'Saturación', -60, 60, 1, pct),
      slider('temperature', 'Temperatura', -60, 60, 1, pct), slider('sharpness', 'Nitidez', 0, 100, 1, (v) => v), slider('vignette', 'Viñeta', 0, 100, 1, (v) => v),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' } },
        h('button', { class: 'btn small', onclick: (ev) => { cropMode = !cropMode; ev.target.classList.toggle('active', cropMode); ev.target.textContent = cropMode ? 'Aplicar recorte' : '⬚ Recortar'; draw(); } }, '⬚ Recortar'),
        h('button', { class: 'btn small', onclick: (ev) => { lock = !lock; ev.target.textContent = lock ? 'Proporción 3:2' : 'Proporción libre'; } }, 'Proporción 3:2'),
        h('button', { class: 'btn small', onclick: () => { e.crop = null; draw(); } }, 'Quitar recorte'),
        h('button', { class: 'btn small', onclick: () => this.openEditor(r, img, list, { ...DEFAULT_EDITS }) }, 'Restablecer')),
      h('div', { class: 'muted', style: { fontSize: '12px' } }, 'La edición puede mejorar moderadamente una foto (máx. +8), pero no corrige un mal enfoque ni un momento perdido.'),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px' } },
        h('button', { class: 'btn primary', onclick: async () => { const isDefault = JSON.stringify({ ...e }) === JSON.stringify(DEFAULT_EDITS); r.edits = isDefault ? null : { ...e }; r.editedEval = isDefault ? null : evaluateEdits(r, e); await g.photos.update(r); g.ui.toast('Edición guardada.', 'good'); g.ui.screenCleanup?.(); g.ui.screenCleanup = null; this.openViewer(r, list); } }, 'Guardar edición'),
        h('button', { class: 'btn', onclick: () => { g.ui.screenCleanup?.(); g.ui.screenCleanup = null; this.openViewer(r, list); } }, 'Cancelar')));
    this.root.append(h('div', { class: 'editor' }, canvasWrap, side));
    requestAnimationFrame(draw);
  }
  async deliver() {
    const g = this.game;
    const sel = g.photos.records.filter((r) => r.selected && !r.delivered && r.sessionId === g.career.sessionId);
    if (!sel.length) return;
    if (!(await g.ui.confirm(`Vas a entregar ${sel.length} fotografía(s) al editor. Después de la entrega no podrás cambiar la selección.`, 'Entregar', false))) return;
    this.onDeliver?.(sel);
  }
}
