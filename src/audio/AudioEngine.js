import { clamp, rand } from '../core/MathUtil.js';

/*
 * Audio 100 % procedural con WebAudio. Fuentes espaciales (HRTF) para balón, pasos, carros y conversaciones.
 * El público se filtra según interior/exterior y distancia al estadio.
 */
export class AudioEngine {
  constructor(game) {
    this.game = game; this.ctx = null; this.started = false; this.excite = 0.1; this.interior = 0; this.outside = 0; this.crowdOn = false;
    this.nextChant = 8; this.nextDrum = 0; this.drumBeat = 0; this.chanting = 0; this.t = 0; this.nextBird = 2; this.nextBabble = 1;
  }
  start() {
    if (this.started) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = (this.ctx = new AC()); this.started = true;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master); this.out = comp;
    this.sfx = ctx.createGain(); this.sfx.connect(comp);
    this.amb = ctx.createGain(); this.amb.connect(comp);
    this.music = ctx.createGain(); this.music.connect(comp);
    // Reverb para interiores y estadio
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(2.2, 2.5); this.revGain = ctx.createGain(); this.revGain.gain.value = 0.15;
    this.reverb.connect(this.revGain); this.revGain.connect(comp);
    // Bus del público con filtro para "detrás de paredes"
    this.crowdFilter = ctx.createBiquadFilter(); this.crowdFilter.type = 'lowpass'; this.crowdFilter.frequency.value = 8000;
    this.crowdBus = ctx.createGain(); this.crowdBus.gain.value = 0; this.crowdFilter.connect(this.crowdBus); this.crowdBus.connect(this.amb); this.crowdBus.connect(this.reverb);
    this.noise = this.noiseBuffer(4, 'pink'); this.white = this.noiseBuffer(2, 'white'); this.brown = this.noiseBuffer(4, 'brown');
    this.crowdBed = this.loop(this.noise, 'bandpass', 700, 0.6, this.crowdFilter, 0.0);
    this.crowdRoar = this.loop(this.white, 'bandpass', 1500, 0.8, this.crowdFilter, 0.0);
    this.cityBed = this.loop(this.brown, 'lowpass', 300, 0.7, this.amb, 0.0);
    this.rainBed = this.loop(this.white, 'highpass', 1200, 0.5, this.amb, 0.0);
    this.windBed = this.loop(this.brown, 'lowpass', 500, 1, this.amb, 0.0);
    this.applyVolumes();
    this.custom = {}; this.loadCustomAudio();
  }
  // ---------- Audio propio del jugador (archivos en public/audio o elegidos en Ajustes) ----------
  static CUSTOM = {
    menu: { file: 'menu', label: 'Música de inicio' },
    estadio_cueva: { file: 'cueva', label: 'Ambiente · Estadio La Cueva', multi: true, stadium: 'cueva' },
    estadio_alajuela: { file: 'alajuela', label: 'Ambiente · Estadio de Alajuela', multi: true, stadium: 'alajuela' },
    estadio_cartago: { file: 'cartago', label: 'Ambiente · Estadio de Cartago', multi: true, stadium: 'cartago' },
    estadio_irazu: { file: 'irazu', label: 'Ambiente · Metropolitano Irazú', multi: true, stadium: 'irazu' },
    estadio: { file: 'estadio', label: 'Ambiente general (estadios sin audio propio)', multi: true },
  };
  static EXT = ['m4a', 'mp3', 'ogg', 'wav', 'mp4', 'webm'];
  idb() {
    return new Promise((res) => { try { const rq = indexedDB.open('entrelineas-audio', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('files'); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } });
  }
  async storedBlob(key) {
    const db = await this.idb(); if (!db) return null;
    return new Promise((res) => { const rq = db.transaction('files').objectStore('files').get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); });
  }
  async storeBlob(key, blob) {
    const db = await this.idb(); if (!db) return;
    await new Promise((res) => { const tx = db.transaction('files', 'readwrite'); blob ? tx.objectStore('files').put(blob, key) : tx.objectStore('files').delete(key); tx.oncomplete = res; tx.onerror = res; });
  }
  async decode(arrayBuf) { try { return await this.ctx.decodeAudioData(arrayBuf); } catch (e) { return null; } }
  async fetchAudio(name) {
    for (const ext of AudioEngine.EXT) {
      try {
        const r = await fetch(`audio/${name}.${ext}`);
        const type = r.headers.get('content-type') || '';
        if (!r.ok || type.includes('text/html')) continue;
        const buf = await this.decode(await r.arrayBuffer()); if (buf) return buf;
      } catch (e) { /* no existe */ }
    }
    return null;
  }
  // Ganancia para normalizar el volumen (RMS) de grabaciones de distintas fuentes.
  normGain(buf, target = 0.12) {
    const d = buf.getChannelData(0); let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 64) { sum += d[i] * d[i]; n++; }
    const rms = Math.sqrt(sum / Math.max(1, n)) || 0.05;
    return Math.min(4, Math.max(0.15, target / rms));
  }
  async loadCustomAudio() {
    // Música de inicio
    let menu = null; const mb = await this.storedBlob('menu');
    if (mb) menu = await this.decode(await mb.arrayBuffer());
    if (!menu) menu = await this.fetchAudio('menu');
    this.setMenu(menu);
    this.listCache = {}; this.counts = {};
    for (const key of Object.keys(AudioEngine.CUSTOM)) if (key !== 'menu') this.counts[key] = (await this.loadList(key)).length;
    this.applyStadium();
  }
  // Lista de grabaciones de un estadio: guardadas en el navegador + archivos <nombre>_1..8 en public/audio
  async loadList(key) {
    if (this.listCache[key]) return this.listCache[key];
    const def = AudioEngine.CUSTOM[key], list = [];
    const stored = (await this.storedBlob(key)) || [];
    for (const blob of stored) { const b = await this.decode(await blob.arrayBuffer()); if (b) list.push(b); }
    for (let i = 1; i <= 8; i++) { const b = await this.fetchAudio(`${def.file}_${i}`); if (b) list.push(b); }
    this.listCache[key] = list; return list;
  }
  // El ambiente que suena depende del estadio: el suyo propio o, si no tiene, el general.
  setStadium(id) { this.stadiumId = id; if (this.listCache) this.applyStadium(); }
  applyStadium() {
    const own = this.stadiumId && this.listCache['estadio_' + this.stadiumId];
    const list = own && own.length ? own : this.listCache.estadio || [];
    if (this.crowdSource === list) return;
    this.crowdSource = list; this.setCrowdList(list);
  }
  setMenu(buf) {
    const old = this.custom.menu; if (old) { try { old.src.stop(); } catch (e) { /* */ } old.g.disconnect(); }
    delete this.custom.menu; if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.music); src.start();
    this.custom.menu = { src, g, duration: buf.duration, norm: this.normGain(buf, 0.16) };
  }
  setCrowdList(list) {
    if (this.crowdPlayer?.cur) { try { this.crowdPlayer.cur.src.stop(); } catch (e) { /* */ } }
    if (!this.customCrowd) { this.customCrowd = this.ctx.createGain(); this.customCrowd.gain.value = 0; this.customCrowd.connect(this.crowdFilter); }
    this.crowdList = list.map((b) => ({ buf: b, norm: this.normGain(b) }));
    this.crowdPlayer = { cur: null, order: [], next: 0 };
    if (list.length) this.custom.crowd = { count: list.length }; else delete this.custom.crowd;
    this.game.events?.emit('audio:custom', 'estadio');
  }
  // Encadena grabaciones con fundido cruzado, en orden aleatorio sin repetir seguidas.
  crowdTick() {
    const P = this.crowdPlayer, L = this.crowdList; if (!P || !L?.length) return;
    const now = this.ctx.currentTime, fade = 2.5;
    if (P.cur && now < P.cur.end - fade) return;
    if (!P.order.length) { P.order = L.map((_, i) => i).sort(() => Math.random() - 0.5); if (P.last !== undefined && P.order[0] === P.last && P.order.length > 1) P.order.push(P.order.shift()); }
    const idx = P.order.shift(); P.last = idx; const it = L[idx];
    const src = this.ctx.createBufferSource(); src.buffer = it.buf;
    const g = this.ctx.createGain(); src.connect(g); g.connect(this.customCrowd);
    const dur = it.buf.duration, offset = L.length === 1 ? 0 : 0;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(it.norm, now + (P.cur ? fade : 0.5));
    if (P.cur) { const pg = P.cur.g.gain; pg.setValueAtTime(pg.value, now); pg.linearRampToValueAtTime(0, now + fade); const ps = P.cur.src; setTimeout(() => { try { ps.stop(); } catch (e) { /* */ } }, fade * 1000 + 200); }
    src.start(now, offset);
    P.cur = { src, g, end: now + dur - offset };
  }
  async loadFile(key, file) {
    if (!this.ctx) this.start();
    const files = key === 'estadio' ? [...file] : [file];
    const bufs = [];
    for (const f of files) { const b = await this.decode(await f.arrayBuffer()); if (b) bufs.push([f, b]); }
    if (!bufs.length) return false;
    if (key === 'menu') { await this.storeBlob('menu', bufs[0][0]); this.setMenu(bufs[0][1]); }
    else {
      const prev = (await this.storedBlob(key)) || [];
      await this.storeBlob(key, [...prev, ...bufs.map(([f]) => f)]);
      this.listCache[key] = [...(this.listCache[key] || []), ...bufs.map(([, b]) => b)]; this.counts[key] = this.listCache[key].length;
      this.crowdSource = null; this.applyStadium();
    }
    return true;
  }
  async clearFile(key) {
    await this.storeBlob(key, null);
    if (key === 'menu') { this.setMenu(await this.fetchAudio('menu')); return; }
    delete this.listCache[key]; this.counts[key] = (await this.loadList(key)).length; this.crowdSource = null; this.applyStadium();
  }
  countFor(key) { return key === 'menu' ? (this.custom.menu ? 1 : 0) : this.counts?.[key] || 0; }
  hasCustom(key) { return key === 'menu' ? !!this.custom?.menu : this.countFor(key) > 0; }
  applyVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings.data;
    this.master.gain.value = s.master; this.sfx.gain.value = s.sfx; this.amb.gain.value = s.ambient; this.music.gain.value = s.music;
  }
  impulse(dur, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  noiseBuffer(sec, kind) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w * 0.5;
    }
    return b;
  }
  loop(buf, type, freq, q, dest, gain) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(dest); src.start();
    return { src, f, g };
  }
  setGain(node, v, t = 0.4) { if (!this.ctx) return; node.g.gain.setTargetAtTime(v, this.ctx.currentTime, t); }
  panner(pos) {
    const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.maxDistance = 300; p.rolloffFactor = 1.1;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; p.connect(this.sfx); p.connect(this.reverb); return p;
  }
  updateListener(cam) {
    if (!this.ctx) return;
    const l = this.ctx.listener, p = cam.position, f = cam.getWorldDirection(cam.userData.tmpDir || (cam.userData.tmpDir = cam.position.clone()));
    if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }
  // Estado ambiental: ubicación, intensidad del partido, clima.
  update(dt, st) {
    if (!this.ctx) return;
    this.t += dt;
    const { inStadiumBowl, interior, distToStadium, excite, weather, time, crowd, city, clasico } = st;
    this.excite = excite;
    // Público: fuerte en la grada, apagado en pasillos, lejano en la calle
    let crowdLvl = crowd ? (inStadiumBowl ? 1 : interior ? 0.55 : clamp(1.2 - distToStadium / 120, 0.08, 0.6)) : 0;
    this.crowdFilter.frequency.setTargetAtTime(inStadiumBowl ? 9000 : interior ? 520 : 900, this.ctx.currentTime, 0.3);
    this.revGain.gain.setTargetAtTime(interior ? 0.5 : inStadiumBowl ? 0.18 : 0.08, this.ctx.currentTime, 0.4);
    this.crowdBus.gain.setTargetAtTime(crowdLvl * (clasico ? 1.25 : 1), this.ctx.currentTime, 0.5);
    const menu = this.custom?.menu, customCrowd = !!this.custom?.crowd;
    if (customCrowd) { this.crowdTick(); this.customCrowd.gain.setTargetAtTime((st.menu ? 0.35 : 0.8 + excite * 0.55), this.ctx.currentTime, 0.6); }
    if (menu) menu.g.gain.setTargetAtTime(st.menu ? 0.9 * menu.norm : 0, this.ctx.currentTime, st.menu ? 0.8 : 0.5);
    this.setGain(this.crowdBed, (0.22 + excite * 0.35) * (customCrowd ? 0.3 : 1), 0.3);
    this.setGain(this.crowdRoar, Math.max(0, excite - 0.35) * 0.55, 0.15);
    this.crowdRoar.f.frequency.setTargetAtTime(1100 + excite * 900, this.ctx.currentTime, 0.2);
    this.setGain(this.cityBed, city ? (inStadiumBowl ? 0.05 : interior ? 0.08 : 0.35) : 0, 1);
    this.setGain(this.rainBed, weather === 'rain' ? (interior ? 0.08 : 0.3) : 0, 1);
    this.setGain(this.windBed, interior ? 0.02 : 0.08 + (weather === 'rain' ? 0.08 : 0), 1);
    // Cánticos y bombo de la barra
    if (crowd && crowdLvl > 0.05) {
      this.nextChant -= dt * (1 + excite * 2 + (clasico ? 1 : 0)) * (this.custom?.crowd ? 0.2 : 1);
      if (this.nextChant <= 0) { this.chant(); this.nextChant = rand(18, 34); this.chanting = 9; }
      if (this.chanting > 0 || clasico || excite > 0.5) {
        this.chanting -= dt; this.nextDrum -= dt;
        if (this.nextDrum <= 0) { const pattern = [1, 0, 1, 1, 0, 1, 0, 0]; if (pattern[this.drumBeat++ % 8]) this.drum(0.5 * crowdLvl); this.nextDrum = 0.24; }
      }
    }
    // Pájaros de día / grillos de noche en la calle
    if (city && !inStadiumBowl && !interior) {
      this.nextBird -= dt;
      if (this.nextBird <= 0) { if (time === 'night') this.cricket(); else this.bird(); this.nextBird = rand(1.5, 5); }
    }
  }
  env(g, t0, a, peak, d) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0008, t0 + a + d); }
  noiseHit(dest, dur, type, freq, q, peak, at = 0) {
    const ctx = this.ctx, t0 = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = this.white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); this.env(g, t0, 0.002, peak, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  tone(dest, type, f0, f1, dur, peak, at = 0) {
    const ctx = this.ctx, t0 = ctx.currentTime + at, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain(); this.env(g, t0, 0.004, peak, dur); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  whistle(n = 1) {
    if (!this.ctx) return;
    for (let i = 0; i < n; i++) {
      const at = i * 0.45, len = n === 3 && i === 2 ? 0.9 : 0.32;
      const ctx = this.ctx, t0 = ctx.currentTime + at;
      for (const f of [2750, 2810]) {
        const o = ctx.createOscillator(); o.frequency.value = f; const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.02); g.gain.setValueAtTime(0.06, t0 + len); g.gain.linearRampToValueAtTime(0, t0 + len + 0.05);
        o.connect(g); g.connect(this.sfx); g.connect(this.reverb); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.1); lfo.stop(t0 + len + 0.1);
      }
    }
  }
  kick(pos, strength) {
    if (!this.ctx) return;
    const p = this.panner(pos); const k = clamp(strength / 25, 0.2, 1);
    this.tone(p, 'sine', 160, 50, 0.12, 0.7 * k); this.noiseHit(p, 0.05, 'bandpass', 1800, 1, 0.5 * k);
  }
  post() { if (!this.ctx) return; this.tone(this.sfx, 'triangle', 880, 860, 1.1, 0.25); this.tone(this.sfx, 'sine', 1320, 1300, 0.9, 0.12); this.goalRoar(0.6); }
  honk(pos) { if (!this.ctx) return; const p = this.panner(pos); this.tone(p, 'square', 420, 410, 0.35, 0.12); this.tone(p, 'square', 520, 510, 0.35, 0.08); }
  footstep(surface, k = 1) {
    if (!this.ctx) return;
    const f = surface === 'grass' ? 700 : surface === 'tile' ? 2600 : 1500;
    this.noiseHit(this.sfx, surface === 'grass' ? 0.08 : 0.05, 'bandpass', f * rand(0.85, 1.15), 1.2, 0.12 * k);
    this.tone(this.sfx, 'sine', 120, 60, 0.05, 0.08 * k);
  }
  // Obturador: cada cámara suena distinto (espejo + cortinilla).
  shutter(type) {
    if (!this.ctx) return;
    const cfg = { basic: [0.5, 900, 0.06, 0.045, 0.35], sport: [0.35, 1500, 0.04, 0.03, 0.28], pro: [0.25, 2400, 0.03, 0.02, 0.24], flagship: [0.12, 3800, 0.018, 0.012, 0.18] }[type] || [0.4, 1200, 0.05, 0.04, 0.3];
    const [mirror, f, d1, gap, peak] = cfg;
    this.noiseHit(this.sfx, d1, 'bandpass', f, 2, peak);
    this.tone(this.sfx, 'square', f * 0.25, f * 0.1, d1, peak * 0.25 * mirror);
    this.noiseHit(this.sfx, d1 * 0.8, 'bandpass', f * 1.4, 2, peak * 0.8, gap);
  }
  ui(kind) {
    if (!this.ctx) return;
    const m = {
      tick: () => this.tone(this.sfx, 'sine', 1800, 1700, 0.03, 0.05),
      af: () => { this.tone(this.sfx, 'sine', 2600, 2600, 0.05, 0.06); this.tone(this.sfx, 'sine', 2600, 2600, 0.05, 0.06, 0.08); },
      error: () => this.tone(this.sfx, 'square', 220, 180, 0.2, 0.06),
      mission: () => { [523, 659, 784, 1046].forEach((f, i) => this.tone(this.sfx, 'triangle', f, f, 0.3, 0.12, i * 0.09)); },
      viewfinder: () => this.noiseHit(this.sfx, 0.03, 'highpass', 3000, 1, 0.1),
      door: () => { this.tone(this.sfx, 'sine', 90, 60, 0.4, 0.2); this.noiseHit(this.sfx, 0.25, 'lowpass', 500, 1, 0.15); },
      beep: () => this.tone(this.sfx, 'sine', 1400, 1400, 0.12, 0.08),
      scanner: () => { this.tone(this.sfx, 'sawtooth', 110, 110, 1.6, 0.03); this.noiseHit(this.sfx, 1.6, 'lowpass', 300, 1, 0.08); },
      cash: () => { [1318, 1568].forEach((f, i) => this.tone(this.sfx, 'triangle', f, f, 0.25, 0.1, i * 0.08)); },
      click: () => this.tone(this.sfx, 'sine', 900, 800, 0.025, 0.05),
      warn: () => { this.tone(this.sfx, 'square', 600, 600, 0.12, 0.05); this.tone(this.sfx, 'square', 450, 450, 0.18, 0.05, 0.14); },
    }[kind];
    m?.();
  }
  drum(v) { this.tone(this.crowdFilter, 'sine', 95, 45, 0.25, 0.5 * v); this.noiseHit(this.crowdFilter, 0.06, 'lowpass', 400, 1, 0.3 * v); }
  // Cántico: coro de voces sintéticas con filtros de formantes.
  chant() {
    const ctx = this.ctx, base = ctx.currentTime + 0.1;
    const melody = [[0, 0.4], [0, 0.4], [3, 0.4], [5, 0.8], [3, 0.4], [0, 0.8], [-2, 0.4], [0, 1.2]];
    const root = 196 * Math.pow(2, Math.floor(rand(-2, 3)) / 12);
    let t = base;
    for (const [semi, dur] of melody) {
      for (let v = 0; v < 6; v++) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = root * Math.pow(2, semi / 12) * (1 + (Math.random() - 0.5) * 0.02) * (v % 2 ? 2 : 1);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 5;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1000; f2.Q.value = 6;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + 0.05); g.gain.setValueAtTime(0.02, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(this.crowdFilter); o.start(t); o.stop(t + dur + 0.05);
      }
      t += dur;
    }
  }
  goalRoar(k = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.9 * k, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.001, t0 + 7);
    s.connect(f); f.connect(g); g.connect(this.crowdFilter); s.start(t0); s.stop(t0 + 7.2);
  }
  groan() { if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(700, t0); f.frequency.linearRampToValueAtTime(380, t0 + 1.4); const g = ctx.createGain(); this.env(g, t0, 0.15, 0.5, 1.6); s.connect(f); f.connect(g); g.connect(this.crowdFilter); s.start(t0); s.stop(t0 + 2); }
  bird() { const f = rand(2500, 4200); for (let i = 0; i < 3; i++) this.tone(this.amb, 'sine', f, f * rand(1.2, 1.5), 0.08, 0.02, i * 0.12); }
  cricket() { for (let i = 0; i < 4; i++) this.tone(this.amb, 'square', 4200, 4300, 0.03, 0.008, i * 0.06); }
  // Conversación (murmullo con formantes) en una posición del mundo.
  talk(pos, dur = 1.2, pitch = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, p = this.panner(pos), t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 140 * pitch;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0;
    for (let t = 0; t < dur; t += 0.11) {
      f.frequency.setValueAtTime(rand(400, 1400), t0 + t); g.gain.setValueAtTime(Math.random() < 0.8 ? 0.05 : 0, t0 + t);
      o.frequency.setValueAtTime(140 * pitch * rand(0.9, 1.15), t0 + t);
    }
    g.gain.setValueAtTime(0, t0 + dur);
    o.connect(f); f.connect(g); g.connect(p); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  say(text) {
    if (!this.game.settings.data.voices || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-CR'; u.volume = 0.6 * this.game.settings.data.master; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* sin voz */ }
  }
}
