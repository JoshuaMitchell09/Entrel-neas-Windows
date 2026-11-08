import * as THREE from 'three';
import { seededRandom } from '../core/MathUtil.js';

// Generación procedural de texturas (sin assets externos): todo se dibuja en canvas.
const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(canvas, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}
function noiseFill(ctx, w, h, base, amp, seed = 1, scale = 1) {
  const rnd = seededRandom(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amp;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // Manchas suaves de baja frecuencia
  for (let i = 0; i < 40 * scale; i++) {
    const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rnd() * 0.08;
    g.addColorStop(0, rnd() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// Césped del estadio con franjas de corte y líneas reglamentarias pintadas.
// Cubre un área de (L + 2*m) x (W + 2*m) metros.
export function pitchTexture(L = 105, W = 68, m = 8, wet = false) {
  return cached(`pitch${L}${W}${m}${wet}`, () => {
    const ppm = 18; // píxeles por metro
    const TW = Math.round((L + 2 * m) * ppm), TH = Math.round((W + 2 * m) * ppm);
    const c = makeCanvas(TW, TH), ctx = c.getContext('2d');
    const rnd = seededRandom(7);
    const stripes = 14, sw = (L + 2 * m) / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? (wet ? '#2c6a2a' : '#3f8a35') : (wet ? '#336f2f' : '#4a9a3d');
      ctx.fillRect(i * sw * ppm, 0, sw * ppm + 1, TH);
    }
    // Ruido de hierba
    const img = ctx.getImageData(0, 0, TW, TH), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 26;
      d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.4;
    }
    ctx.putImageData(img, 0, 0);
    // Desgaste en áreas (zonas más claras/terrosas)
    const wear = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(140,120,70,${a})`); g.addColorStop(1, 'rgba(140,120,70,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    const X = (x) => (x + L / 2 + m) * ppm, Y = (z) => (z + W / 2 + m) * ppm;
    wear(X(-L / 2 + 3), Y(0), 5 * ppm, 0.35); wear(X(L / 2 - 3), Y(0), 5 * ppm, 0.35);
    wear(X(0), Y(0), 6 * ppm, 0.15);
    // Líneas
    ctx.strokeStyle = 'rgba(245,245,240,0.95)'; ctx.lineWidth = 0.12 * ppm;
    ctx.strokeRect(X(-L / 2), Y(-W / 2), L * ppm, W * ppm);
    ctx.beginPath(); ctx.moveTo(X(0), Y(-W / 2)); ctx.lineTo(X(0), Y(W / 2)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(0), Y(0), 9.15 * ppm, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(245,245,240,0.95)';
    ctx.beginPath(); ctx.arc(X(0), Y(0), 0.2 * ppm, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) {
      const gx = s * L / 2;
      // Área grande 16.5 x 40.32
      ctx.strokeRect(Math.min(X(gx), X(gx - s * 16.5)), Y(-20.16), 16.5 * ppm, 40.32 * ppm);
      ctx.strokeRect(Math.min(X(gx), X(gx - s * 5.5)), Y(-9.16), 5.5 * ppm, 18.32 * ppm);
      ctx.beginPath(); ctx.arc(X(gx - s * 11), Y(0), 0.2 * ppm, 0, Math.PI * 2); ctx.fill();
      // Media luna
      ctx.beginPath();
      const a0 = Math.acos(5.5 / 9.15);
      if (s > 0) ctx.arc(X(gx - 11), Y(0), 9.15 * ppm, Math.PI - a0, Math.PI + a0);
      else ctx.arc(X(gx + 11), Y(0), 9.15 * ppm, -a0, a0);
      ctx.stroke();
      // Arcos de esquina (hacia el interior del campo)
      for (const t of [-1, 1]) {
        const cx = X(gx), cy = Y(t * W / 2);
        let a0;
        if (s < 0 && t < 0) a0 = 0; else if (s > 0 && t < 0) a0 = Math.PI / 2; else if (s > 0 && t > 0) a0 = Math.PI; else a0 = Math.PI * 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 1 * ppm, a0, a0 + Math.PI / 2); ctx.stroke();
      }
    }
    // Zonas autorizadas para fotógrafos detrás de las porterías (pintadas en azul tenue)
    ctx.fillStyle = 'rgba(40,110,200,0.18)';
    for (const s of [-1, 1]) ctx.fillRect(Math.min(X(s * (L / 2 + 2.2)), X(s * (L / 2 + 6.5))), Y(-28), 4.3 * ppm, 56 * ppm);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.06 * ppm; ctx.setLineDash([0.5 * ppm, 0.4 * ppm]);
    for (const s of [-1, 1]) ctx.strokeRect(Math.min(X(s * (L / 2 + 2.2)), X(s * (L / 2 + 6.5))), Y(-28), 4.3 * ppm, 56 * ppm);
    ctx.setLineDash([]);
    const t = toTex(c, { wrap: false });
    return t;
  });
}

export function concreteTexture(tone = '#9a968c', seed = 3, repeat = [1, 1]) {
  const base = cached('concrete' + tone + seed, () => {
    const c = makeCanvas(512, 512), ctx = c.getContext('2d');
    noiseFill(ctx, 512, 512, tone, 22, seed);
    // Juntas
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();
    return c;
  });
  return toTex(base, { repeat });
}
export function asphaltTexture(repeat = [1, 1]) {
  const base = cached('asphalt', () => {
    const c = makeCanvas(512, 512), ctx = c.getContext('2d');
    noiseFill(ctx, 512, 512, '#3b3c3e', 40, 11, 2);
    const rnd = seededRandom(5);
    for (let i = 0; i < 12; i++) { // grietas
      ctx.strokeStyle = 'rgba(15,15,15,0.5)'; ctx.lineWidth = 1 + rnd();
      ctx.beginPath(); let x = rnd() * 512, y = rnd() * 512; ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return c;
  });
  return toTex(base, { repeat });
}
export function sidewalkTexture(repeat = [1, 1]) {
  const base = cached('sidewalk', () => {
    const c = makeCanvas(512, 512), ctx = c.getContext('2d');
    noiseFill(ctx, 512, 512, '#a8a39a', 18, 21);
    ctx.strokeStyle = 'rgba(60,55,50,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(512, i * 128); ctx.stroke(); }
    return c;
  });
  return toTex(base, { repeat });
}
// Pared pintada con suciedad en la base (estilo tico: colores vivos, zócalo).
export function paintedWallTexture(color, seed = 1, opts = {}) {
  const key = 'wall' + color + seed + JSON.stringify(opts);
  const base = cached(key, () => {
    const c = makeCanvas(512, 512), ctx = c.getContext('2d');
    noiseFill(ctx, 512, 512, color, 14, seed);
    const g = ctx.createLinearGradient(0, 512, 0, 380);
    g.addColorStop(0, 'rgba(40,30,20,0.45)'); g.addColorStop(1, 'rgba(40,30,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 380, 512, 132);
    if (opts.band) { ctx.fillStyle = opts.band; ctx.fillRect(0, 440, 512, 72); }
    const rnd = seededRandom(seed * 7);
    for (let i = 0; i < 18; i++) { // chorreados
      const x = rnd() * 512; const g2 = ctx.createLinearGradient(0, 0, 0, 200);
      g2.addColorStop(0, 'rgba(50,40,30,0.18)'); g2.addColorStop(1, 'rgba(50,40,30,0)');
      ctx.fillStyle = g2; ctx.fillRect(x, 0, 2 + rnd() * 5, 120 + rnd() * 160);
    }
    return c;
  });
  return toTex(base);
}
export function brickTexture(repeat = [1, 1]) {
  const base = cached('brick', () => {
    const c = makeCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#8a8378'; ctx.fillRect(0, 0, 512, 512);
    const rnd = seededRandom(9);
    const bh = 32, bw = 64;
    for (let y = 0; y < 512; y += bh) for (let x = -bw; x < 512; x += bw) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      const r = 150 + rnd() * 40, g = 70 + rnd() * 25, b = 50 + rnd() * 20;
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
    }
    const img = ctx.getImageData(0, 0, 512, 512), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 20; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
    return c;
  });
  return toTex(base, { repeat });
}
export function tileTexture(c1 = '#d8d4cc', c2 = '#c9c4ba', repeat = [1, 1]) {
  const base = cached('tile' + c1 + c2, () => {
    const c = makeCanvas(256, 256), ctx = c.getContext('2d');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { ctx.fillStyle = (x + y) % 2 ? c1 : c2; ctx.fillRect(x * 64, y * 64, 64, 64); }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke(); }
    return c;
  });
  return toTex(base, { repeat });
}
export function zincRoofTexture(repeat = [1, 1]) {
  const base = cached('zinc', () => {
    const c = makeCanvas(256, 256), ctx = c.getContext('2d');
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#7d8288'); g.addColorStop(0.5, '#b7bcc2'); g.addColorStop(1, '#6c7177');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, 256);
    }
    const rnd = seededRandom(4);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(140,70,30,${0.08 + rnd() * 0.15})`; ctx.fillRect(rnd() * 256, rnd() * 256, 10 + rnd() * 40, 6 + rnd() * 30); }
    return c;
  });
  return toTex(base, { repeat });
}
// Valla publicitaria de marca ficticia.
export function adTexture(text, bg, fg, sub = '', accent) {
  return cached('ad' + text + bg + fg + sub, () => {
    const c = makeCanvas(1024, 128), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -25));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 128);
    if (accent) { ctx.fillStyle = accent; ctx.fillRect(0, 0, 24, 128); ctx.fillRect(1000, 0, 24, 128); }
    ctx.fillStyle = fg; ctx.font = '900 76px "Arial Black", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, sub ? 52 : 66);
    if (sub) { ctx.font = '600 28px Arial, sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText(sub, 512, 104); ctx.globalAlpha = 1; }
    return toTex(c, { wrap: false });
  });
}
export function signTexture(text, bg, fg, w = 512, h = 128, font = 'bold 64px Georgia, serif', border) {
  return cached('sign' + text + bg + fg + w + h + font, () => {
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12); }
    ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h / (lines.length + 0.6))));
    return toTex(c, { wrap: false });
  });
}
export function windowTexture(lit = false) {
  return cached('win' + lit, () => {
    const c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = lit ? '#e8c27a' : '#2a3540'; ctx.fillRect(0, 0, 128, 128);
    const g = ctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    // Verjas típicas
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 5;
    for (let x = 16; x < 128; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
    ctx.strokeRect(2, 2, 124, 124);
    return toTex(c, { wrap: false });
  });
}
export function numberTexture(num, name, shirt, ink) {
  const c = makeCanvas(256, 256), ctx = c.getContext('2d');
  ctx.fillStyle = shirt; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px Arial, sans-serif'; ctx.fillText(name.toUpperCase(), 128, 40);
  ctx.font = '900 150px Arial Black, Arial, sans-serif'; ctx.fillText(String(num), 128, 150);
  const t = toTex(c, { wrap: false }); return t;
}
export function crestCanvas(team, size = 128) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d'), s = size / 128;
  ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(64, 6); ctx.lineTo(118, 22); ctx.lineTo(110, 82); ctx.quadraticCurveTo(64, 124, 64, 124); ctx.quadraticCurveTo(64, 124, 18, 82); ctx.lineTo(10, 22); ctx.closePath();
  ctx.fillStyle = team.colors.primary; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = team.colors.secondary; ctx.stroke();
  ctx.fillStyle = team.colors.secondary; ctx.fillRect(20, 52, 88, 18);
  ctx.fillStyle = team.colors.primary; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(team.short, 64, 62);
  ctx.fillStyle = team.colors.secondary; ctx.font = 'bold 22px Georgia'; ctx.fillText('★', 64, 34);
  return c;
}
export function crestTexture(team) { return cached('crest' + team.id, () => toTex(crestCanvas(team, 256), { wrap: false })); }
export function woodTexture() {
  return cached('wood', () => {
    const c = makeCanvas(256, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(0, 0, 256, 256);
    const rnd = seededRandom(13);
    for (let y = 0; y < 256; y += 2) { ctx.fillStyle = `rgba(60,30,10,${rnd() * 0.25})`; ctx.fillRect(0, y, 256, 1 + rnd() * 2); }
    return toTex(c);
  });
}
export function fabricTexture(color, stripe) {
  return cached('fab' + color + stripe, () => {
    const c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
    if (stripe) { ctx.fillStyle = stripe; for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 14, 128); }
    return toTex(c);
  });
}
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
export function glowSprite(color = '#ffffff') {
  return cached('glow' + color, () => {
    const c = makeCanvas(128, 128), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(0.2, color + 'cc'); g.addColorStop(0.5, color + '33'); g.addColorStop(1, color + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return toTex(c, { wrap: false });
  });
}
export { makeCanvas, toTex };

// ---------- Fotorrealismo: ruido fractal, nubes y mapas de normales ----------
function valueNoise2D(seed) {
  const rnd = seededRandom(seed), N = 256, perm = new Uint8Array(512), val = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = rnd(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y, wrap = 0) => {
    let xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi;
    const w = (v) => (wrap ? ((v % wrap) + wrap) % wrap : v) & 255;
    const h = (a, b) => val[perm[w(a) + perm[w(b)]] & 255];
    const u = sm(xf), v = sm(yf);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
}
// Bóveda de nubes (equirectangular, solo hemisferio superior, repetible en X).
export function cloudTexture(coverage = 0.5, seed = 3) {
  return cached('clouds' + coverage + seed, () => {
    const W = 1024, H = 256, c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const n = valueNoise2D(seed);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let f = 0, amp = 0.5, fr = 1 / 64, period = W / 64;
      for (let o = 0; o < 6; o++) { f += amp * n(x * fr, y * fr * 2.2, period); amp *= 0.5; fr *= 2; period *= 2; }
      const horizon = y / H; // 0 = cenit, 1 = horizonte
      let a = Math.max(0, (f - (1 - coverage) * 0.75) * 2.6);
      a = Math.min(1, a) * (0.35 + 0.65 * Math.min(1, horizon * 1.6));
      const shade = 0.72 + 0.28 * (1 - Math.min(1, (f - 0.4) * 1.8));
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255 * shade; d[i + 3] = 255 * a;
    }
    ctx.putImageData(img, 0, 0);
    const t = toTex(c, { wrap: true }); t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
// Mapa de normales a partir de un campo de altura de ruido (relieve fino repetible).
export function noiseNormalMap(key, size = 256, scale = 8, strength = 2, seed = 7, blades = false) {
  return cached('nrm' + key, () => {
    const c = makeCanvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
    const n = valueNoise2D(seed), hgt = new Float32Array(size * size), rnd = seededRandom(seed + 1);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let f = 0, amp = 0.5, fr = scale / size, per = scale;
      for (let o = 0; o < 4; o++) { f += amp * n(x * fr, y * fr, per); amp *= 0.5; fr *= 2; per *= 2; }
      hgt[y * size + x] = f + (blades ? rnd() * 0.35 : 0);
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const hL = hgt[y * size + ((x - 1 + size) % size)], hR = hgt[y * size + ((x + 1) % size)];
      const hU = hgt[((y - 1 + size) % size) * size + x], hD = hgt[((y + 1) % size) * size + x];
      let nx = (hL - hR) * strength, ny = (hU - hD) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c, { srgb: false });
  });
}
