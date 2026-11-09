import { h } from '../ui/dom.js';

/*
 * Grabador de video del juego en horizontal (16:9) o vertical (9:16).
 * Copia cada cuadro del lienzo WebGL (recortado al formato elegido) a un lienzo 2D
 * y graba ese lienzo con el sonido del juego. La interfaz HTML no sale en el video.
 */
export class Recorder {
  constructor(game) { this.game = game; this.rec = null; this.aspect = 'h'; this.guide = null; }
  get active() { return !!this.rec; }
  // Rectángulo de recorte (en píxeles del lienzo) centrado según el formato
  crop(W, H, aspect = this.aspect) {
    const r = aspect === 'v' ? 9 / 16 : 16 / 9;
    let cw = W, ch = W / r; if (ch > H) { ch = H; cw = H * r; }
    return { x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch };
  }
  // Guía en pantalla: oscurece lo que queda fuera del video
  showGuide(aspect, label = '') {
    this.aspect = aspect;
    if (!this.guide) { this.guide = h('div', { class: 'rec-guide' }, this.guideLbl = h('div', { class: 'rg-lbl' }), this.guideRec = h('div', { class: 'rg-rec' })); this.game.ui.root.appendChild(this.guide); window.addEventListener('resize', () => this.layout()); }
    this.guide.style.display = ''; this.guideLbl.textContent = label || (aspect === 'v' ? '9:16 · VERTICAL' : '16:9 · HORIZONTAL'); this.layout();
  }
  hideGuide() { if (this.guide) this.guide.style.display = 'none'; }
  layout() {
    if (!this.guide) return;
    const c = this.crop(window.innerWidth, window.innerHeight);
    Object.assign(this.guide.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' });
    this.guide.classList.toggle('v', this.aspect === 'v');
  }
  start(aspect = this.aspect, name = 'EntreLineas') {
    const g = this.game; if (this.rec) return false;
    this.aspect = aspect; this.layout();
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { g.ui.toast('Este navegador no permite grabar video. Usá Chrome, Edge o Safari actualizado.', 'bad', 4000); return false; }
    const src = g.renderer.domElement, c = this.crop(src.width, src.height);
    const big = c.h >= 1000 && c.w >= 1000 * (aspect === 'v' ? 9 / 16 : 1);
    const W = aspect === 'v' ? (big ? 1080 : 720) : (big ? 1920 : 1280), H = aspect === 'v' ? (big ? 1920 : 1280) : (big ? 1080 : 720);
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H; this.ctx = this.canvas.getContext('2d');
    const stream = this.canvas.captureStream(30);
    try {
      const a = g.audio; if (a?.ctx && a.master) { if (!this.audDest) { this.audDest = a.ctx.createMediaStreamDestination(); a.master.connect(this.audDest); } const tr = this.audDest.stream.getAudioTracks()[0]; if (tr) stream.addTrack(tr); }
    } catch (e) { /* sin audio */ }
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    let rec; try { rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: big ? 16_000_000 : 9_000_000, audioBitsPerSecond: 192_000 }); } catch (e) { g.ui.toast('No se pudo iniciar la grabación.', 'bad'); return false; }
    const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type }), url = URL.createObjectURL(blob), d = new Date(), z = (n) => String(n).padStart(2, '0');
      const file = `${name}_${aspect === 'v' ? 'vertical' : 'horizontal'}_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.${ext}`;
      const a = document.createElement('a'); a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      g.ui.toast(`🎬 Video guardado: ${file} (${(blob.size / 1048576).toFixed(1)} MB)`, 'good', 6000);
    };
    rec.start(1000); this.rec = rec; this.started = performance.now(); this.guide?.classList.add('rec');
    return true;
  }
  stop() { if (!this.rec) return; try { this.rec.stop(); } catch (e) { /* */ } this.rec = null; this.guide?.classList.remove('rec'); }
  elapsed() { return this.rec ? Math.floor((performance.now() - this.started) / 1000) : 0; }
  // Se llama justo después de dibujar cada cuadro
  frame() {
    if (!this.rec) return;
    const src = this.game.renderer.domElement, c = this.crop(src.width, src.height);
    this.ctx.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, this.canvas.width, this.canvas.height);
    if (this.guideRec) { const s = this.elapsed(); this.guideRec.textContent = `● REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  }
}
