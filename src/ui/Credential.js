import { crestCanvas } from '../gfx/Textures.js';

// Dibuja una acreditación de prensa realista en un canvas.
export function drawCredential(c, game) {
  const W = 420, H = 620; c.width = W * 2; c.height = H * 2; c.style.width = W + 'px'; c.style.height = H + 'px';
  const ctx = c.getContext('2d'); ctx.scale(2, 2);
  const cr = game.inventory.credential || {};
  // Base plástica
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#e9edf3');
  round(ctx, 0, 0, W, H, 18); ctx.fillStyle = bg; ctx.fill();
  // Ranura del cordón
  round(ctx, W / 2 - 40, 16, 80, 12, 6); ctx.fillStyle = '#c9d0db'; ctx.fill();
  // Encabezado
  const hd = ctx.createLinearGradient(0, 40, W, 140); hd.addColorStop(0, '#0b3d91'); hd.addColorStop(1, '#0a2a66');
  ctx.fillStyle = hd; ctx.fillRect(0, 40, W, 108);
  ctx.fillStyle = '#f2c500'; ctx.fillRect(0, 148, W, 6);
  ctx.fillStyle = '#fff'; ctx.font = '900 30px Arial Black, Arial'; ctx.fillText('LIGA TICA', 24, 84);
  ctx.font = '600 14px Arial'; ctx.fillStyle = '#c9d8ff'; ctx.fillText('PRIMERA DIVISIÓN · TEMPORADA 2026', 24, 108);
  ctx.font = '700 12px Arial'; ctx.fillStyle = '#f2c500'; ctx.fillText('ACREDITACIÓN OFICIAL', 24, 132);
  if (cr.home) { ctx.drawImage(crestCanvas(game.team(cr.home), 64), W - 150, 58); ctx.drawImage(crestCanvas(game.team(cr.away), 64), W - 80, 58); }
  // Foto (silueta)
  round(ctx, 24, 176, 130, 160, 8); ctx.fillStyle = '#cfd8e6'; ctx.fill();
  ctx.fillStyle = '#7a8aa3'; ctx.beginPath(); ctx.arc(89, 236, 30, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(89, 330, 52, 54, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#0b3d91'; ctx.fillRect(48, 300, 82, 10);
  // Datos
  ctx.fillStyle = '#0a0f1c'; ctx.font = '800 22px Arial'; wrap(ctx, (game.playerName || 'Fotógrafo').toUpperCase(), 172, 200, 230, 24);
  ctx.font = '600 13px Arial'; ctx.fillStyle = '#56627a';
  const rows = [['MEDIO', 'Ascenso Total'], ['FUNCIÓN', 'Reportero gráfico'], ['EVENTO', cr.event || '—'], ['FECHA', cr.date || '—'], ['ESTADIO', cr.stadium || '—']];
  let y = 248; for (const [k, v] of rows) { ctx.fillStyle = '#8a95a8'; ctx.font = '700 10px Arial'; ctx.fillText(k, 172, y); ctx.fillStyle = '#0a0f1c'; ctx.font = '600 13px Arial'; wrap(ctx, v, 172, y + 15, 230, 15); y += 36; }
  // Banda de zona
  ctx.fillStyle = '#e63946'; ctx.fillRect(0, 432, W, 70);
  ctx.fillStyle = '#fff'; ctx.font = '900 40px Arial Black, Arial'; ctx.fillText('PRENSA', 24, 482);
  ctx.font = '800 15px Arial'; ctx.fillText('FOTO · CAMPO', W - 140, 462); ctx.font = '600 12px Arial'; ctx.fillText('Zonas: P1 · P2 · TÚNEL', W - 156, 482);
  // QR simulado
  let s = 0; for (const ch of (cr.number || 'X')) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const qx = 24, qy = 516, q = 80, n = 21, cell = q / n;
  ctx.fillStyle = '#fff'; ctx.fillRect(qx - 4, qy - 4, q + 8, q + 8);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const finder = (i < 7 && j < 7) || (i > n - 8 && j < 7) || (i < 7 && j > n - 8);
    const on = finder ? (i % 6 === 0 || j % 6 === 0 || (i % 6 > 1 && i % 6 < 5 && j % 6 > 1 && j % 6 < 5) || i === n - 1 || j === n - 1 || i === n - 7 || j === n - 7) : (s & 1);
    if (on) { ctx.fillStyle = '#0a0f1c'; ctx.fillRect(qx + i * cell, qy + j * cell, cell + 0.2, cell + 0.2); }
  }
  ctx.fillStyle = '#0a0f1c'; ctx.font = '700 11px monospace'; ctx.fillText(`N.º ${cr.number || '—'}`, 120, 540);
  ctx.font = '600 10px Arial'; ctx.fillStyle = '#56627a'; ctx.fillText('Personal e intransferible. Prohibido', 120, 560); ctx.fillText('ingresar al terreno de juego.', 120, 574);
  // Holograma
  const holo = ctx.createLinearGradient(W - 110, 520, W - 20, 600);
  ['#ff9de2', '#9dfcff', '#fff59d', '#b5ff9d', '#d29dff'].forEach((col, i, a) => holo.addColorStop(i / (a.length - 1), col));
  ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(W - 64, 560, 34, 0, Math.PI * 2); ctx.fillStyle = holo; ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '900 12px Arial'; ctx.fillText('★ LT ★', W - 86, 565);
}
function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; }
  ctx.fillText(line, x, y);
}
