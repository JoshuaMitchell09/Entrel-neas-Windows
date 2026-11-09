import { h } from './dom.js';

// Foto del carnet (acreditación): se recorta al formato de la foto (13:16), se comprime y se guarda con la partida.
export const CARD_W = 260, CARD_H = 320;

function readFile(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
}
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
// Recorte centrado tipo "cover", un poco hacia arriba para que entre la cara
export async function fileToCardPhoto(file) {
  const im = await loadImage(await readFile(file));
  const c = document.createElement('canvas'); c.width = CARD_W; c.height = CARD_H;
  const x = c.getContext('2d'), ar = CARD_W / CARD_H, iar = im.width / im.height;
  let sw, sh; if (iar > ar) { sh = im.height; sw = sh * ar; } else { sw = im.width; sh = sw / ar; }
  const sx = (im.width - sw) / 2, sy = Math.max(0, (im.height - sh) * 0.3);
  x.imageSmoothingQuality = 'high'; x.drawImage(im, sx, sy, sw, sh, 0, 0, CARD_W, CARD_H);
  return c.toDataURL('image/jpeg', 0.86);
}
// Imagen ya decodificada (el carnet se dibuja en un canvas de forma síncrona)
const cache = { src: null, img: null };
export function cardImage(src) {
  if (!src) return Promise.resolve(null);
  if (cache.src === src && cache.img) return Promise.resolve(cache.img);
  return loadImage(src).then((img) => { cache.src = src; cache.img = img; return img; }).catch(() => null);
}
export function cardImageSync(src) { return src && cache.src === src ? cache.img : null; }

// Selector reutilizable: vista previa + «Subir foto» / «Quitar». onChange(dataURL | null)
export function cardPhotoPicker(ui, value, onChange) {
  let cur = value || null;
  const prev = h('div', { class: 'cp-prev' });
  const paint = () => { prev.replaceChildren(cur ? h('img', { src: cur, alt: 'Foto del carnet' }) : h('div', { class: 'cp-empty' }, '👤', h('span', {}, 'Sin foto'))); rm.style.display = cur ? '' : 'none'; };
  const inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    try { cur = await fileToCardPhoto(f); paint(); onChange(cur); ui.toast('Foto lista para el carnet.', 'good'); }
    catch (e) { ui.toast('No se pudo leer esa imagen. Probá con una foto JPG o PNG.', 'warn', 3500); }
  });
  const rm = h('button', { class: 'btn small', onclick: () => { cur = null; paint(); onChange(null); } }, 'Quitar');
  const el = h('div', { class: 'cp' }, prev,
    h('div', { class: 'cp-side' }, h('b', {}, 'Foto para el carnet'), h('div', { class: 'muted', style: { fontSize: '12px', margin: '2px 0 8px' } }, 'Opcional. Aparece en tu acreditación de prensa. Mejor una foto de frente, con la cara bien iluminada.'),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn small primary', onclick: () => inp.click() }, '📷 Subir foto'), rm), inp));
  paint();
  return el;
}
