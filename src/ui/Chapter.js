import { h } from './dom.js';
import { CHAPTERS, EPILOGUE } from '../career/Tiers.js';

// Pantalla de capítulo del modo historia (narrativa del camino del fotógrafo).
export function showChapter(ui, n) {
  const C = n === 'epilogo' ? EPILOGUE : CHAPTERS.find((c) => c.n === n);
  if (!C) return Promise.resolve();
  return new Promise((res) => {
    const layer = h('div', { class: 'screen chapter-layer', style: { zIndex: 45 } });
    const close = () => { document.removeEventListener('keydown', onKey, true); layer.classList.add('out'); setTimeout(() => { layer.remove(); res(); }, 350); };
    const onKey = (e) => { if (['Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    const g = ui.game, name = g.playerName && g.playerName !== 'Fotógrafo' ? g.playerName : null;
    layer.append(h('div', { class: 'chapter' },
      h('div', { class: 'ch-img' }, C.img),
      h('div', { class: 'ch-kicker' }, C.kicker), h('div', { class: 'ch-title' }, C.title),
      h('div', { class: 'ch-text' }, ...C.text.map((t) => h('p', {}, t))),
      h('div', { class: 'ch-goal' }, h('b', {}, '🎯 Objetivo: '), C.goal),
      h('button', { class: 'btn primary', onclick: close }, name && n === 1 ? `Empezar, ${name} →` : 'Continuar →')));
    ui.root.appendChild(layer);
    g.audio?.ui?.('mission');
    setTimeout(() => layer.querySelector('.btn.primary')?.focus(), 60);
  });
}
