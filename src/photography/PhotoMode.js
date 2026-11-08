import * as THREE from 'three';
import { PhotoPipeline } from './PhotoPipeline.js';
import { PhotoEvaluator } from './PhotoEvaluator.js';
import { SHUTTERS, APERTURES, ISOS, WBS, lensMaxAperture, fmtShutter } from './Equipment.js';
import { clamp, damp } from '../core/MathUtil.js';
import { SEE_THROUGH } from '../core/Collision.js';

export const PARAMS = ['shutter', 'aperture', 'iso', 'ev', 'wb', 'af', 'focus'];
export const PARAM_LABELS = { shutter: 'Obturación', aperture: 'Apertura', iso: 'ISO', ev: 'Comp. exposición', wb: 'Balance de blancos', af: 'Modo de enfoque', focus: 'Enfoque manual' };

/*
 * Modo fotografía: visor en primera persona que simula una cámara real.
 */
export class PhotoMode {
  constructor(game) {
    this.game = game; this.pipeline = new PhotoPipeline(game); this.evaluator = new PhotoEvaluator(game);
    this.active = false; this.yaw = 0; this.pitch = 0; this.prevYaw = 0; this.prevPitch = 0;
    this.angVel = new THREE.Vector2(); this.sway = new THREE.Vector2(); this.swayT = 0;
    this.s = { shutterIdx: 10, apertureIdx: 2, isoIdx: 0, ev: 0, wbIdx: 0, af: 'AF-C', drive: 'single', focal: 70, focusDist: 20 };
    this.param = 0; this.afTarget = null; this.afTargetDist = 20; this.afLocked = false; this.afPoint = new THREE.Vector2(0, 0);
    this.burstT = 0; this.bufferUsed = 0; this.bufferClear = 0; this.queue = 0; this.lastShotAt = -1; this.liveDrain = 0;
    this.lastResult = null; this.blackout = 0; this.wbJitter = (Math.random() - 0.5) * 300; this.shotCount = 0;
    this.pendingCaptures = [];
  }
  get cam() { return this.game.inventory.camera; }
  get lens() { return this.game.inventory.lens; }
  enter() {
    const g = this.game, p = g.player;
    if (!this.cam || !this.lens) { g.ui.toast('No tenés cámara o lente equipados.', 'warn'); return false; }
    if (g.inventory.batteryCharge <= 0) { g.ui.toast('Batería agotada. Cambiala con B si tenés repuesto.', 'warn'); return false; }
    this.active = true; p.inViewfinder = true; p.root.visible = false;
    this.yaw = g.follow.yaw; this.pitch = g.follow.firstPerson ? g.follow.fpPitch : -g.follow.pitch * 0.4; this.prevYaw = this.yaw; this.prevPitch = this.pitch;
    this.tYaw = this.yaw; this.tPitch = this.pitch; this.vYaw = 0; this.vPitch = 0; this.kick = 0;
    this.clampFocal(); this.clampAperture();
    g.audio?.ui('viewfinder');
    g.events.emit('photo:enter');
    return true;
  }
  exit() {
    const g = this.game; this.active = false; g.player.inViewfinder = false; g.player.root.visible = true;
    g.follow.yaw = this.yaw; g.follow.fpPitch = this.pitch; g.camera.fov = g.settings.data.fov; g.camera.updateProjectionMatrix();
    g.events.emit('photo:exit');
  }
  clampFocal() { const L = this.lens; this.s.focal = clamp(this.s.focal, L.min, L.max); }
  clampAperture() {
    const maxA = lensMaxAperture(this.lens, this.s.focal);
    while (APERTURES[this.s.apertureIdx] < maxA - 0.01 && this.s.apertureIdx < APERTURES.length - 1) this.s.apertureIdx++;
  }
  get shutter() { const v = SHUTTERS[this.s.shutterIdx]; return Math.max(v, this.cam.minShutter); }
  get aperture() { return APERTURES[this.s.apertureIdx]; }
  get focalEff() { return this.s.focal * this.cam.crop; }
  get vfov() { return THREE.MathUtils.radToDeg(2 * Math.atan(12 / this.focalEff)); }
  get sceneEV() { return this.game.env.sceneEV; }
  get iso() {
    const v = ISOS[this.s.isoIdx];
    if (v !== 'AUTO') return v;
    const ev = Math.log2(this.aperture * this.aperture / this.shutter) - this.sceneEV + this.s.ev;
    const iso = 100 * Math.pow(2, ev);
    return Math.round(clamp(iso, 100, this.cam.maxISO));
  }
  get exposureDelta() {
    const camEV = Math.log2(this.aperture * this.aperture / this.shutter) - Math.log2(this.iso / 100);
    return this.sceneEV - camEV;
  }
  get wbK() { const w = WBS[this.s.wbIdx]; return w.k || (this.game.env.lightK + this.wbJitter); }
  get noiseAmp() { const st = Math.max(0, Math.log2(this.iso / 100)); return this.cam.noise * 0.0085 * Math.pow(st, 1.4) + 0.004; }
  opticsState() {
    const env = this.game.env;
    return { focusDist: this.s.focusDist, focal: this.s.focal * 1, aperture: this.aperture, crop: this.cam.crop, shutter: this.shutter, vfov: this.vfov,
      gain: env.exposure * Math.pow(2, this.exposureDelta), noiseAmp: this.noiseAmp, wbK: this.wbK, rainOnLens: env.weather === 'rain' && !this.game.inventory.has('raincover') };
  }
  // Velocidad angular de trepidación (rad/s) según lente, estabilización, monopié y postura.
  shakeRate() {
    const p = this.game.player, inv = this.game.inventory;
    let r = 0.036 * (1 + this.lens.weight * 0.35);
    r /= Math.pow(2, this.lens.stab * 0.85);
    const still = p.speed < 0.3;
    if (inv.has('monopod') && still && (this.lens.weight > 1 || p.crouch)) r /= Math.pow(2, 2.5);
    if (p.crouch) r *= 0.8;
    if (!still) r *= 3;
    const b = this.game.buffs || {}, t = this.game.time;
    if (b.steady > t) r *= 0.72; if (b.tipsy > t) r *= 1.55;
    return r;
  }
  update(dt) {
    const g = this.game, inp = g.input, p = g.player;
    if (!this.active) return;
    // Mirar (sensibilidad proporcional al campo de visión para que el teleobjetivo sea manejable)
    const look = inp.lookDelta(dt);
    const k = clamp(this.vfov / 40, 0.05, 1.2);
    // Inercia del equipo: la orientación sigue al pulso con un resorte cuya rigidez depende del peso del lente
    if (this.tYaw === undefined) { this.tYaw = this.yaw; this.tPitch = this.pitch; this.vYaw = 0; this.vPitch = 0; }
    this.tYaw -= look.dx * k; this.tPitch = clamp(this.tPitch - look.dy * k, -1.2, 1.2);
    const w = 30 / (1 + this.lens.weight * 0.55 + (this.game.inventory.has('monopod') ? 0.3 : 0));
    const sYaw = (this.tYaw - this.yaw) * w * w - 2 * w * this.vYaw, sPitch = (this.tPitch - this.pitch) * w * w - 2 * w * this.vPitch;
    this.vYaw += sYaw * dt; this.vPitch += sPitch * dt;
    this.yaw += this.vYaw * dt; this.pitch = clamp(this.pitch + this.vPitch * dt, -1.25, 1.25);
    // Golpe del espejo/obturador
    if (this.kick > 0) { this.pitch += this.kick * dt * 6; this.kick = Math.max(0, this.kick - dt * 0.6); }
    // Zoom
    if (inp.mouse.wheel || inp.wasPressed('zoomIn') || inp.wasPressed('zoomOut') || (inp.padAxes && Math.abs(inp.padTrigger(7) - inp.padTrigger(6)) > 0.9 && false)) {
      const dir = inp.mouse.wheel ? -inp.mouse.wheel : inp.wasPressed('zoomIn') ? 1 : -1;
      if (this.lens.min === this.lens.max) g.ui.toast('Lente de focal fija: acercate caminando.', 'info', 1200);
      else { this.s.focal = clamp(this.s.focal * Math.pow(1.08, dir), this.lens.min, this.lens.max); this.clampAperture(); g.audio?.ui('tick'); }
    }
    // Mando: cruceta para zoom
    // Mando: cruceta ↑/↓ mantenida = zoom continuo
    if (inp.pad && (inp.padHeld(12) || inp.padHeld(13)) && this.lens.min !== this.lens.max) {
      this.s.focal = clamp(this.s.focal * Math.pow(1.7, (inp.padHeld(12) ? 1 : -1) * dt), this.lens.min, this.lens.max); this.clampAperture();
    }
    // Parámetros (Q/E seleccionar; Z/X modificar)
    if (inp.wasPressed('paramPrev')) { this.param = (this.param + PARAMS.length - 1) % PARAMS.length; g.audio?.ui('tick'); }
    if (inp.wasPressed('paramNext')) { this.param = (this.param + 1) % PARAMS.length; g.audio?.ui('tick'); }
    const dec = inp.wasPressed('paramDec') || (inp.pad && inp.padTriggerPressed(14)), inc = inp.wasPressed('paramInc') || (inp.pad && inp.padTriggerPressed(15));
    if (dec || inc) this.changeParam(PARAMS[this.param], inc ? 1 : -1);
    if (PARAMS[this.param] === 'focus' && this.s.af === 'MF' && (inp.isDown('paramDec') || inp.isDown('paramInc'))) {
      this.s.focusDist = clamp(this.s.focusDist * Math.pow(inp.isDown('paramInc') ? 1.6 : 0.625, dt), 1, 400);
    }
    if (inp.wasPressed('driveMode')) { this.s.drive = this.s.drive === 'single' ? 'burst' : 'single'; g.ui.toast(this.s.drive === 'burst' ? `Ráfaga (${this.cam.fps} fps)` : 'Disparo individual', 'info', 1000); g.audio?.ui('tick'); }
    // Balanceo natural del pulso (más visible con teleobjetivos)
    this.swayT += dt;
    const sw = this.shakeRate() * 0.09;
    this.sway.set(Math.sin(this.swayT * 1.3) * 0.6 + Math.sin(this.swayT * 3.7) * 0.4, Math.sin(this.swayT * 1.1 + 1) * 0.5 + Math.sin(this.swayT * 2.9) * 0.3).multiplyScalar(sw);
    // Pasos con el visor arriba: el cuadro rebota al ritmo de la marcha
    const ps = this.game.player.speed;
    if (ps > 0.3) { this.stepT = (this.stepT || 0) + dt * (1.8 + ps * 0.9) * Math.PI; this.sway.x += Math.sin(this.stepT) * 0.0016 * ps; this.sway.y += Math.abs(Math.cos(this.stepT)) * 0.0022 * ps; }
    // Velocidad angular (para paneo y desenfoque)
    const yawRate = -(this.yaw - this.prevYaw) / Math.max(dt, 1e-4), pitchRate = -(this.pitch - this.prevPitch) / Math.max(dt, 1e-4);
    this.angVel.x = damp(this.angVel.x, yawRate, 18, dt); this.angVel.y = damp(this.angVel.y, pitchRate, 18, dt);
    this.prevYaw = this.yaw; this.prevPitch = this.pitch;
    // Colocar la cámara en el ojo
    const cam = g.camera, eye = p.pos.clone(); eye.y += p.eyeHeight();
    const yw = this.yaw + this.sway.x, pt = this.pitch + this.sway.y;
    const fwd = new THREE.Vector3(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt));
    eye.addScaledVector(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.12);
    cam.position.copy(eye); cam.lookAt(eye.clone().add(fwd)); cam.updateMatrixWorld();
    // El visor muestra el cuadro 3:2; la cámara principal abarca la pantalla completa
    const sw2 = window.innerWidth, sh2 = window.innerHeight, frameH = Math.min(sh2, sw2 / 1.5);
    const vf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.vfov) / 2) * sh2 / frameH);
    cam.fov = THREE.MathUtils.radToDeg(vf); cam.near = 0.1; cam.updateProjectionMatrix();
    p.yaw = this.yaw; p.avatar.lookPitch = this.pitch;
    this.updateAF(dt);
    // Batería por visor encendido
    this.liveDrain += dt * 0.035;
    if (this.liveDrain >= 1) { this.liveDrain -= 1; g.inventory.drainBattery(1); }
    // Disparo
    this.burstT -= dt; this.bufferClear += dt;
    if (this.bufferClear > 0.25) { this.bufferUsed = Math.max(0, this.bufferUsed - Math.ceil(this.cam.fps / 4)); this.bufferClear = 0; }
    const fire = inp.mouse.leftPressed || (inp.pad && inp.padTriggerPressed(7));
    const hold = inp.mouse.left || (inp.pad && inp.padTrigger(7) > 0.5);
    if (this.s.drive === 'single') { if (fire) this.trigger(); }
    else if (hold && this.burstT <= 0) {
      const full = this.bufferUsed >= this.cam.buffer;
      this.trigger(); this.burstT = full ? 0.5 : 1 / this.cam.fps;
    }
    this.blackout = Math.max(0, this.blackout - dt);
  }
  changeParam(name, d) {
    const s = this.s, g = this.game;
    if (name === 'shutter') { s.shutterIdx = clamp(s.shutterIdx + d, 0, SHUTTERS.length - 1); while (SHUTTERS[s.shutterIdx] < this.cam.minShutter - 1e-9) s.shutterIdx--; }
    if (name === 'aperture') { s.apertureIdx = clamp(s.apertureIdx + d, 0, APERTURES.length - 1); this.clampAperture(); }
    if (name === 'iso') { s.isoIdx = clamp(s.isoIdx + d, 0, ISOS.length - 1); while (ISOS[s.isoIdx] !== 'AUTO' && ISOS[s.isoIdx] > this.cam.maxISO) s.isoIdx--; }
    if (name === 'ev') s.ev = clamp(Math.round((s.ev + d / 3) * 3) / 3, -3, 3);
    if (name === 'wb') s.wbIdx = (s.wbIdx + d + WBS.length) % WBS.length;
    if (name === 'af') { const m = ['AF-C', 'AF-S', 'MF']; s.af = m[(m.indexOf(s.af) + d + 3) % 3]; this.afLocked = false; }
    if (name === 'focus' && s.af !== 'MF') g.ui.toast('Pasá a MF para enfocar manualmente.', 'info', 1200);
    if (name === 'focus' && s.af === 'MF') s.focusDist = clamp(s.focusDist * (d > 0 ? 1.15 : 0.87), 1, 400);
    g.audio?.ui('tick');
  }
  // Rayo central contra sujetos (cápsulas) y geometría.
  probe(ndcX = 0, ndcY = 0) {
    const g = this.game, cam = g.camera;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const o = ray.ray.origin, d = ray.ray.direction;
    let best = null, bt = Infinity;
    const subs = g.match ? g.match.subjects() : [];
    const tol = Math.max(0.28, Math.tan(THREE.MathUtils.degToRad(this.vfov) * 0.03));
    for (const s of subs) {
      const a = s.pos.clone().setY(0.15), b = s.pos.clone().setY(1.75);
      const v = b.clone().sub(a), w = o.clone().sub(a);
      const A = d.dot(d), B = d.dot(v), C = v.dot(v), D = d.dot(w), E = v.dot(w), den = A * C - B * B;
      let tc = den > 1e-6 ? (A * E - B * D) / den : 0; tc = clamp(tc, 0, 1);
      const sc = Math.max(0, (B * tc - D) / A);
      const dist = o.clone().addScaledVector(d, sc).distanceTo(a.clone().addScaledVector(v, tc));
      const rad = 0.3 + sc * tol * 0.02;
      if (dist < rad && sc < bt) { bt = sc; best = s; }
    }
    if (g.match) { const bp = g.match.ball.pos; const t = d.dot(bp.clone().sub(o)); if (t > 0) { const cl = o.clone().addScaledVector(d, t); if (cl.distanceTo(bp) < 0.25 && t < bt) { bt = t; best = { kind: 'ball', ref: g.match.ball, pos: bp, vel: g.match.ball.vel, name: 'Balón' }; } } }
    let geo = g.collision.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 600, SEE_THROUGH);
    if (d.y < -0.001) geo = Math.min(geo, -o.y / d.y);
    if (best && bt < geo) return { subject: best, dist: bt };
    return { subject: null, dist: Math.min(geo, 400) };
  }
  updateAF(dt) {
    const s = this.s, cam = this.cam, lens = this.lens;
    if (s.af === 'MF') { this.afLocked = false; return; }
    const speed = (2.5 + 14 * cam.afSpeed * lens.af) * ((this.game.buffs?.focus || 0) > this.game.time ? 1.2 : 1);
    if (s.af === 'AF-C') {
      let target = null, dist;
      // Seguimiento: si hay un sujeto rastreado y la cámara lo permite, mantenerlo aunque salga del punto AF
      if (this.afTarget && this.afTarget.kind !== 'ball') {
        const pr = this.afTarget.pos.clone().setY(1.1).project(this.game.camera);
        const r = Math.hypot(pr.x, pr.y * 0.66);
        if (pr.z < 1 && r < 0.12 + cam.tracking * 0.45) { target = this.afTarget; dist = this.game.camera.position.distanceTo(this.afTarget.pos.clone().setY(1.1)); }
      }
      if (!target) { const pr = this.probe(); target = pr.subject; dist = pr.dist; }
      this.afTarget = target; this.afTargetDist = dist;
    } else if (this.game.input.wasPressed('autofocus')) {
      const pr = this.probe(); this.afTarget = pr.subject; this.afTargetDist = pr.dist; this.afLocked = true; this.game.audio?.ui('af');
    }
    if (s.af === 'AF-S' && !this.afLocked) return;
    if (s.af === 'AF-C' && this.game.input.wasPressed('autofocus')) { const pr = this.probe(); this.afTarget = pr.subject; this.afTargetDist = pr.dist; this.game.audio?.ui('af'); }
    // Mover el foco en espacio logarítmico (el AF real tarda)
    const lf = Math.log(s.focusDist), lt = Math.log(Math.max(1, this.afTargetDist));
    s.focusDist = Math.exp(lf + (lt - lf) * (1 - Math.exp(-speed * dt)));
  }
  get focusOk() { return Math.abs(Math.log(this.s.focusDist) - Math.log(Math.max(1, this.afTargetDist))) < 0.04; }
  trigger() {
    const g = this.game, inv = g.inventory;
    if (inv.batteryCharge <= 0) { g.ui.toast('Batería agotada. Presioná B para cambiarla.', 'warn'); g.audio?.ui('error'); return; }
    if (inv.cardUsed >= inv.cardCapacity) { g.ui.toast('Tarjeta llena. Borrá fotos en la galería (P).', 'warn'); g.audio?.ui('error'); return; }
    if (g.rules && !g.rules.canShoot()) return;
    this.bufferUsed++; inv.drainBattery(1); inv.cardUsed++;
    g.audio?.shutter(this.cam.sound); g.input.rumble(0.05, 0.35, 45);
    this.kick = ({ basic: 0.0035, sport: 0.0022, pro: 0.0012, flagship: 0.0004, classic: 0.0045, mirrorless: 0.0002, silent: 0 }[this.cam.sound] || 0.002) / (1 + this.lens.weight * 0.5);
    this.blackout = { flagship: 0.02, basic: 0.09, classic: 0.12, mirrorless: 0, silent: 0 }[this.cam.sound] ?? 0.05;
    this.capture();
  }
  capture() {
    const g = this.game, env = g.env, p = g.player, match = g.match;
    const q = g.settings.q, H = Math.round(q.photoRes / 1.5), W = Math.round(H * 1.5);
    const optics = this.opticsState();
    const camObj = g.camera;
    // Orientación del fotograma: sin el balanceo visual; el balanceo se modela como trepidación
    const camPos = camObj.position.clone(), camQuat = camObj.quaternion.clone();
    const rate = this.shakeRate(), dir = Math.random() * Math.PI * 2;
    const shake = { x: Math.cos(dir) * rate, y: Math.sin(dir) * rate };
    const camInfo = { position: camPos, quaternion: camQuat, angVel: this.angVel.clone(), shakeAt: (tau) => ({ x: shake.x * tau, y: shake.y * tau }) };
    // Muestras temporales según desenfoque esperado
    const pxPerRad = H / THREE.MathUtils.degToRad(this.vfov);
    const subs = match && match.group.visible ? match.subjects() : [];
    let maxPx = (Math.hypot(this.angVel.x, this.angVel.y) + rate) * this.shutter * pxPerRad;
    for (const s of subs) { const d = camPos.distanceTo(s.pos); if (d > 1) maxPx = Math.max(maxPx, s.vel.length() * this.shutter / d * pxPerRad); }
    const burst = this.s.drive === 'burst' && this.bufferUsed > 2;
    const N = clamp(Math.ceil(maxPx / 1.6), 1, burst ? 6 : 14);
    const dyn = match && match.group.visible ? match.dynamicObjects() : [];
    // Instantánea del estado para la evaluación (antes de mover objetos)
    const subjects = subs.map((s) => ({ ...s, pos: s.pos.clone(), vel: s.vel.clone(), yaw: s.ref.yaw ?? s.h?.root.rotation.y ?? 0, keypoints: s.h ? s.h.keyPoints([]) : [s.pos.clone()] }));
    const res = this.pipeline.capture(g.scene, optics, camInfo, dyn, g.stadium?.crowd, W, H, N);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    const sunH = env.sunDir ? new THREE.Vector3(env.sunDir.x, 0, env.sunDir.z).normalize() : null;
    const camH = fwd.clone().setY(0).normalize();
    const backlight = env.time === 'sunset' && sunH && camH.dot(sunH) > 0.75;
    const zonePress = g.stadium ? g.stadium.zoneAt(p.pos.x, p.pos.z, g.stadium.zones.press) : null;
    const center = this.probe();
    const crowdShot = !center.subject && g.stadium && (() => { const hit = camPos.clone().addScaledVector(fwd, center.dist); return (Math.abs(hit.x) > 62 || Math.abs(hit.z) > 42) && hit.y > 0.8; })();
    const shot = {
      camPos, camQuat, vfov: this.vfov, W, H, focal: this.s.focal, crop: this.cam.crop, focalEff: this.focalEff, aperture: this.aperture, shutter: this.shutter, iso: this.iso,
      focusDist: this.s.focusDist, exposureDelta: this.exposureDelta, noiseAmp: this.noiseAmp, wbErrorMired: 1e6 / this.wbK - 1e6 / env.lightK,
      angVel: { x: this.angVel.x, y: this.angVel.y }, shakeAmp: rate * this.shutter, crouch: p.crouch, subjects,
      afTargetRef: this.afTarget?.ref || null, centerDist: center.dist, ballPos: match ? match.ball.pos.clone() : null,
      matchTime: match ? match.time : 0, matchPhase: match ? match.phase : 'none', events: match ? match.events.slice(-60) : [], excite: match ? match.excite : 0,
      pixels: res.pixels, weather: env.weather, backlight, inPressZone: !!zonePress, inStadium: Math.abs(p.pos.x) < 64 && Math.abs(p.pos.z) < 44, crowdShot,
      prevMetas: g.photos.sessionMetas(), assignment: g.career?.currentAssignment(), eventMultiplier: g.career?.eventMultiplier() || 1,
    };
    const ev = this.evaluator.evaluate(shot);
    const minute = match ? Math.floor(match.minute) : 0;
    const meta = {
      date: new Date().toISOString(), event: g.career?.currentEventName() || 'Exploración', eventId: shot.momentEvent?.id ?? null, sessionId: g.career?.sessionId,
      camera: this.cam.name, lens: this.lens.name, focal: Math.round(this.s.focal), focalEff: Math.round(this.focalEff), aperture: this.aperture, shutter: fmtShutter(this.shutter), shutterS: this.shutter, iso: this.iso,
      wb: WBS[this.s.wbIdx].label, afMode: this.s.af, drive: this.s.drive, focusDist: +this.s.focusDist.toFixed(1), minute, momentType: ev.moment.type, samples: N,
      matchScore: match ? `${match.teams[0].short} ${match.score[0]}-${match.score[1]} ${match.teams[1].short}` : '', W, H,
    };
    this.shotCount++;
    g.photos.addCapture(res.canvas, meta, ev).then((rec) => { this.lastResult = rec; g.events.emit('photo:taken', rec); });
  }
}
