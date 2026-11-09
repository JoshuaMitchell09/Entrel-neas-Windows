import { cardImageSync } from './CardPhoto.js';
import { crestCanvas } from '../gfx/Textures.js';

// Dibuja una acreditación de prensa realista en un canvas.
export function drawCredential(c, game) {
  const W = 420, H = 620; c.width = W * 2; c.height = H * 2; c.style.width = W + 'px'; c.style.height = H + 'px';
  const ctx = c.getContext('2d'); ctx.scale(2, 2);
  const cr = game.inventory.credential || {};
  if (cr.cup) return drawCupCredential(ctx, W, H, cr, game);
  const off = cr.official ? game.team(cr.official) : null;
  // Base plástica
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#e9edf3');
  round(ctx, 0, 0, W, H, 18); ctx.fillStyle = bg; ctx.fill();
  // Ranura del cordón
  round(ctx, W / 2 - 40, 16, 80, 12, 6); ctx.fillStyle = '#c9d0db'; ctx.fill();
  // Encabezado
  const hd = ctx.createLinearGradient(0, 40, W, 140); hd.addColorStop(0, off ? off.colors.primary : '#0b3d91'); hd.addColorStop(1, off ? '#111111' : '#0a2a66');
  ctx.fillStyle = hd; ctx.fillRect(0, 40, W, 108);
  ctx.fillStyle = '#f2c500'; ctx.fillRect(0, 148, W, 6);
  ctx.fillStyle = '#fff'; ctx.font = '900 30px Arial Black, Arial'; ctx.fillText(off ? off.short + ' · STAFF' : 'LIGA TICA', 24, 84);
  ctx.font = '600 14px Arial'; ctx.fillStyle = '#e8eefc'; ctx.fillText(off ? off.name.toUpperCase() : ({ segunda: 'SEGUNDA DIVISIÓN', menores: 'LIGAS MENORES · TORNEO JUVENIL' }[cr.league] || 'PRIMERA DIVISIÓN') + ' · TEMPORADA 2026', 24, 108, cr.home ? W - 186 : W - 48);
  ctx.font = '700 12px Arial'; ctx.fillStyle = '#f2c500'; ctx.fillText(off ? 'PERSONAL DEL CLUB · ACCESO TOTAL' : 'ACREDITACIÓN OFICIAL', 24, 132);
  if (cr.home) { ctx.drawImage(crestCanvas(game.team(cr.home), 64), W - 150, 58); ctx.drawImage(crestCanvas(game.team(cr.away), 64), W - 80, 58); }
  // Foto del fotógrafo (la que subió al crear la carrera) o silueta
  const ph = cardImageSync(game.cardPhoto);
  round(ctx, 24, 176, 130, 160, 8); ctx.fillStyle = '#cfd8e6'; ctx.fill();
  if (ph) {
    ctx.save(); round(ctx, 24, 176, 130, 160, 8); ctx.clip(); ctx.drawImage(ph, 24, 176, 130, 160); ctx.restore();
    ctx.strokeStyle = 'rgba(10,15,28,.25)'; ctx.lineWidth = 1; round(ctx, 24.5, 176.5, 129, 159, 8); ctx.stroke();
    // Sello holográfico sobre la esquina de la foto (anti-falsificación)
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#9dfcff'; ctx.beginPath(); ctx.arc(140, 322, 20, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#7a8aa3'; ctx.beginPath(); ctx.arc(89, 236, 30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(89, 330, 52, 54, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#0b3d91'; ctx.fillRect(48, 300, 82, 10);
  }
  // Datos
  ctx.fillStyle = '#0a0f1c'; ctx.font = '800 22px Arial'; wrap(ctx, (game.playerName || 'Fotógrafo').toUpperCase(), 172, 200, 230, 24);
  ctx.font = '600 13px Arial'; ctx.fillStyle = '#56627a';
  const rows = [['MEDIO', off ? off.name : 'Ascenso Total'], ['FUNCIÓN', off ? 'Fotógrafo oficial del club' : 'Reportero gráfico'], ['EVENTO', cr.event || '—'], ['FECHA', cr.date || '—'], ['ESTADIO', cr.stadium || '—']];
  let y = 248; for (const [k, v] of rows) { ctx.fillStyle = '#8a95a8'; ctx.font = '700 10px Arial'; ctx.fillText(k, 172, y); ctx.fillStyle = '#0a0f1c'; ctx.font = '600 13px Arial'; wrap(ctx, v, 172, y + 15, 230, 15); y += 36; }
  // Banda de zona
  ctx.fillStyle = off ? '#1f9d55' : '#e63946'; ctx.fillRect(0, 432, W, 70);
  ctx.fillStyle = '#fff'; ctx.font = '900 40px Arial Black, Arial'; ctx.fillText(off ? 'ALL ACCESS' : 'PRENSA', 24, 482);
  ctx.font = '800 15px Arial'; ctx.fillText(off ? 'ACCESO TOTAL' : 'FOTO · CAMPO', W - 140, 462); ctx.font = '600 12px Arial'; ctx.fillText(off ? 'Vestuario · Palco · Túnel' : 'Zonas: P1 · P2 · TÚNEL', W - 156, 482);
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

// Acreditación especial de la Copa Centroamericana (competencia ficticia): fondo fucsia/naranja con
// triángulos y grano, casillas de número y sticker, holograma verde y franja amarilla de FOTÓGRAFO con chaleco.
function drawCupCredential(ctx, W, H, cr, game) {
  round(ctx, 0, 0, W, H, 14); ctx.save(); ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#f2542d'); bg.addColorStop(0.55, '#d23a5a'); bg.addColorStop(1, '#a3195b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // Triángulos (montañas) en magenta
  ctx.fillStyle = '#b0205c';
  for (const [x, w, h] of [[-40, 210, 300], [120, 180, 380], [250, 230, 290], [330, 200, 420]]) { ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x + w / 2, 470 - h); ctx.lineTo(x + w, 470); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,190,150,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(10, 120); ctx.lineTo(90, 470); ctx.moveTo(10, 120); ctx.lineTo(150, 200); ctx.stroke();
  // Grano (textura impresa)
  let s = 12345; for (let i = 0; i < 5000; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const x = (s >>> 0) % W, y = ((s >>> 9) >>> 0) % 470; ctx.fillStyle = i % 2 ? 'rgba(255,120,60,.18)' : 'rgba(120,10,70,.16)'; ctx.fillRect(x, y, 1.6, 1.6); }
  // Perforaciones del cordón
  ctx.fillStyle = '#2a0b1c'; for (const x of [40, W - 40]) { ctx.beginPath(); ctx.arc(x, 30, 9, 0, Math.PI * 2); ctx.fill(); }
  // Casillas: holograma, número y sticker de color
  const box = (x, label) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 70, 92, 92); if (label) { ctx.fillStyle = '#111'; ctx.font = '800 15px Arial'; ctx.textAlign = 'center'; ctx.fillText('STICKER', x + 46, 112); ctx.fillText('COLOR', x + 46, 130); ctx.textAlign = 'left'; } };
  box(36); box(164); box(292, true);
  const holo = ctx.createRadialGradient(82, 116, 4, 82, 116, 50); holo.addColorStop(0, '#0c3b12'); holo.addColorStop(0.4, '#2fae3a'); holo.addColorStop(0.75, '#8af06a'); holo.addColorStop(1, '#1d6b23');
  ctx.fillStyle = holo; ctx.beginPath(); ctx.arc(82, 116, 50, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(82 + Math.cos(a) * 16, 116 + Math.sin(a) * 16); ctx.lineTo(82 + Math.cos(a) * 46, 116 + Math.sin(a) * 46); ctx.stroke(); }
  ctx.fillStyle = '#2a2a2a'; ctx.font = 'italic 600 54px "Comic Sans MS", "Segoe Print", cursive'; ctx.textAlign = 'center'; ctx.fillText(String(cr.seat || 54), 210, 136);
  // Trofeo estilizado (ficticio) y nombre de la copa
  ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(185, 205); ctx.lineTo(235, 205); ctx.lineTo(214, 262); ctx.lineTo(234, 300); ctx.lineTo(186, 300); ctx.lineTo(206, 262); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(210, 228); ctx.lineTo(218, 250); ctx.lineTo(210, 280); ctx.lineTo(202, 250); ctx.closePath(); ctx.fill();
  ctx.font = '600 17px Arial'; ctx.fillText('Confederación Regional', W / 2, 330);
  ctx.font = '900 36px Arial'; ctx.fillText('COPA', W / 2, 372); ctx.fillText('CENTRO', W / 2, 410); ctx.fillText('AMERICANA', W / 2, 448);
  ctx.textAlign = 'left';
  // Franja amarilla con el chaleco verde
  ctx.fillStyle = '#ffd400'; ctx.fillRect(0, 488, W, H - 488);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(24, 506, 96, 96);
  ctx.fillStyle = '#2e8b2e'; ctx.beginPath(); ctx.moveTo(44, 520); ctx.lineTo(60, 516); ctx.lineTo(64, 524); ctx.lineTo(80, 524); ctx.lineTo(84, 516); ctx.lineTo(100, 520); ctx.lineTo(100, 594); ctx.lineTo(44, 594); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(48, 548, 48, 12); ctx.fillStyle = '#2e8b2e'; ctx.font = '700 8px Arial'; ctx.fillText('PRENSA', 56, 557);
  ctx.fillStyle = '#111111'; ctx.font = '900 31px Arial'; ctx.fillText('PHOTOGRAPHER', 136, 545); ctx.fillText('FOTÓGRAFO', 136, 582);
  // Datos del portador (pequeño, debajo de las casillas)
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 12px Arial'; ctx.fillText(`${(game.playerName || '').toUpperCase()} · ASCENSO TOTAL · ${cr.event || ''}`.slice(0, 64), 36, 180);
  ctx.restore();
}
