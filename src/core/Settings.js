import { DEFAULT_BINDINGS } from './Input.js';
const KEY = 'entrelineas.settings.v1';
export const QUALITY_PRESETS = {
  bajo: { pixelRatio: 0.75, shadows: 0, shadowSize: 1024, crowd: 0.35, bloom: false, photoRes: 1200, antialias: false },
  medio: { pixelRatio: 1, shadows: 1, shadowSize: 2048, crowd: 0.65, bloom: true, photoRes: 1500, antialias: true },
  alto: { pixelRatio: 1, shadows: 2, shadowSize: 4096, crowd: 1, bloom: true, photoRes: 1800, antialias: true },
  ultra: { pixelRatio: 1.5, shadows: 2, shadowSize: 4096, crowd: 1, bloom: true, photoRes: 2400, antialias: true },
};
/** Primera ejecución en Windows: elige la calidad según la tarjeta gráfica detectada. */
export function detectQuality() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'bajo';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(r)) return 'bajo';
    if (/rtx ?[2-9]0[6-9]0|rtx ?[3-9]0[7-9]0|rx ?[67][89]00|rx ?7[6-9]00|arc a7/.test(r)) return 'ultra';
    if (/nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|arc a/.test(r)) return 'alto';
    if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega|adreno|mali/.test(r)) return navigator.hardwareConcurrency >= 8 ? 'medio' : 'bajo';
    return 'medio';
  } catch (e) { return 'medio'; }
}
export class Settings {
  constructor() {
    this.data = {
      quality: 'medio', sensitivity: 1, invertY: false, fov: 60, cameraDistance: 3.4,
      master: 0.85, music: 0.5, sfx: 0.9, ambient: 0.8, voices: false, subtitles: true,
      showFps: false, halfSeconds: 240, view: 'tercera', bindings: { ...DEFAULT_BINDINGS }, resolutionScale: 1,
    };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); Object.assign(this.data, d); this.data.bindings = { ...DEFAULT_BINDINGS, ...(d.bindings || {}) }; }
      else this.data.quality = detectQuality();
    } catch (e) { /* almacenamiento no disponible */ }
  }
  get q() { return QUALITY_PRESETS[this.data.quality] || QUALITY_PRESETS.medio; }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }
}
