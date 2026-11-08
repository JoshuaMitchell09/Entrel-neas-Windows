import { clamp } from '../core/MathUtil.js';
import { composition, WEIGHTS, grade } from './PhotoEvaluator.js';

export const DEFAULT_EDITS = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, sharpness: 0, vignette: 0, crop: null };

// Procesa la imagen con los ajustes de edición (operaciones reales sobre píxeles).
export function renderEdited(src, e, maxW = 0) {
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
  const cr = e.crop || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const cx = cr.x0 * sw, cy = cr.y0 * sh, cw = (cr.x1 - cr.x0) * sw, ch = (cr.y1 - cr.y0) * sh;
  let ow = Math.round(cw), oh = Math.round(ch);
  if (maxW && ow > maxW) { oh = Math.round(oh * maxW / ow); ow = maxW; }
  const c = document.createElement('canvas'); c.width = ow; c.height = oh;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, cx, cy, cw, ch, 0, 0, ow, oh);
  const img = ctx.getImageData(0, 0, ow, oh), d = img.data;
  const ev = Math.pow(2, e.exposure), con = 1 + e.contrast / 100, sat = 1 + e.saturation / 100, t = e.temperature / 100, vig = e.vignette / 100;
  const lut = new Float32Array(256); for (let i = 0; i < 256; i++) lut[i] = Math.pow(i / 255, 2.2);
  const inv = (v) => Math.pow(clamp(v, 0, 1), 1 / 2.2) * 255;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = (y * ow + x) * 4;
    let r = lut[d[i]] * ev * (1 + t * 0.18), g = lut[d[i + 1]] * ev, b = lut[d[i + 2]] * ev * (1 - t * 0.18);
    r = inv(r) / 255; g = inv(g) / 255; b = inv(b) / 255;
    r = (r - 0.5) * con + 0.5; g = (g - 0.5) * con + 0.5; b = (b - 0.5) * con + 0.5;
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    if (vig > 0) { const dx = x / ow - 0.5, dy = (y / oh - 0.5) * (oh / ow), rr = Math.sqrt(dx * dx + dy * dy) * 1.6; const k = 1 - vig * Math.max(0, rr * rr - 0.15); r *= k; g *= k; b *= k; }
    d[i] = clamp(r, 0, 1) * 255; d[i + 1] = clamp(g, 0, 1) * 255; d[i + 2] = clamp(b, 0, 1) * 255;
  }
  if (e.sharpness > 0) {
    const a = e.sharpness / 100 * 1.2, src2 = new Uint8ClampedArray(d);
    for (let y = 1; y < oh - 1; y++) for (let x = 1; x < ow - 1; x++) {
      const i = (y * ow + x) * 4;
      for (let k = 0; k < 3; k++) {
        const v = src2[i + k] * 5 - src2[i + k - 4] - src2[i + k + 4] - src2[i + k - ow * 4] - src2[i + k + ow * 4];
        d[i + k] = src2[i + k] + (v - src2[i + k]) * a * 0.25;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// Re-evaluación tras la edición: influencia moderada (máx. +8), no convierte una mala foto en perfecta.
export function evaluateEdits(rec, e) {
  const base = rec.eval, parts = { ...base.parts }, notes = [];
  const tech = base.tech;
  if (e.crop) {
    const cr = e.crop, area = (cr.x1 - cr.x0) * (cr.y1 - cr.y0);
    const cs = composition(base.compData, cr, { good: [], bad: [] }).score;
    if (cs > parts.composition) notes.push('El recorte mejoró la composición.'); else if (cs < parts.composition - 3) notes.push('El recorte empeoró la composición.');
    parts.composition = cs;
    const fill = clamp(tech.fill / (cr.y1 - cr.y0), 0, 1.2);
    parts.distance = base.compData ? clamp(Math.pow(fill / 0.42, 0.7) * 100, 0, 100) : parts.distance;
    if (area < 0.5) { const pen = (0.5 - area) * 40; parts.sharpness = Math.max(0, parts.sharpness - pen); notes.push('Recorte agresivo: se nota la pérdida de resolución.'); }
  }
  const d0 = tech.exposureDelta, d1 = d0 + e.exposure;
  const lost0 = 24 * Math.pow(Math.abs(d0), 1.25), lost1 = 24 * Math.pow(Math.abs(d1), 1.25);
  let expGain = (lost0 - lost1) * 0.5;
  if (expGain > 0) notes.push('La corrección de exposición recuperó parte de la imagen.');
  if (e.exposure > 0.7) { expGain -= (e.exposure - 0.7) * 6; notes.push('Levantar sombras aumentó el ruido.'); }
  if (e.exposure < -0.7) expGain -= (-e.exposure - 0.7) * 3;
  parts.exposure = clamp(parts.exposure + expGain, 0, 100);
  if (e.sharpness > 0) parts.sharpness = clamp(parts.sharpness + Math.min(4, e.sharpness * 0.05) - (e.sharpness > 70 ? 4 : 0), 0, 100);
  let total = 0; for (const k in WEIGHTS) total += parts[k] * WEIGHTS[k];
  let over = 0;
  if (Math.abs(e.saturation) > 35) over += 4; if (Math.abs(e.contrast) > 40) over += 3; if (Math.abs(e.temperature) > 45) over += 2; if (e.vignette > 70) over += 2;
  if (over) notes.push('Procesado excesivo: el editor prefiere imágenes naturales.');
  else if (e.vignette > 10 && e.vignette <= 45) total += 1;
  total -= over;
  if (base.parts.sharpness < 40) total = Math.min(total, parts.sharpness + 25);
  total = Math.round(clamp(total, 0, Math.min(100, base.score + 8)));
  const g = grade(total);
  return { score: total, grade: g.letter, label: g.label, parts, notes, delta: total - base.score };
}
