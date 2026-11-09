import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { clamp, damp, dampAngle } from '../core/MathUtil.js';
import { APRON_Z } from '../world/Stadium.js';

/*
 * Modo dron / tráiler: cámara libre con inercia, tomas automáticas tipo transmisión,
 * cámara lenta, franjas de cine y grabación de video (imagen + sonido del juego).
 * La grabación captura solo el render 3D: la interfaz no aparece en el video.
 */
const MODES = [
  { id: 'libre', label: 'Dron libre', help: 'WASD mover · ratón mirar · Espacio/Ctrl subir/bajar · Shift rápido' },
  { id: 'orbita', label: 'Órbita del estadio', help: 'A/D velocidad y sentido · W/S acercar · Espacio/Ctrl altura' },
  { id: 'sobrevuelo', label: 'Sobrevuelo cinematográfico', help: 'Recorrido automático alrededor del estadio · A/D velocidad' },
  { id: 'tv', label: 'Cámara de transmisión', help: 'Toma de TV desde la tribuna siguiendo el balón' },
  { id: 'riel', label: 'Riel de banda', help: 'Cámara a ras de cancha que acompaña la jugada' },
  { id: 'balon', label: 'Seguir el balón', help: 'Persecución del balón desde arriba' },
  { id: 'jugador', label: 'Seguir jugador', help: 'Q/E cambiar de jugador · ratón para girar alrededor' },
];
const SPEEDS = [1, 0.5, 0.25, 0.1];

export class DroneCam {
  constructor(game) {
    this.game = game; this.active = false; this.mode = 0; this.timeScale = 1; this.speedIdx = 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.tYaw = 0; this.tPitch = 0;
    this.fov = 55; this.tFov = 55; this.orbitA = 0; this.orbitSpd = 0.08; this.orbitR = 95; this.orbitH = 38; this.flyT = 0; this.flySpd = 1;
    this.look = new THREE.Vector3(); this.target = 0; this.letterbox = 0; this.showUI = true; this.rec = null; this.last = performance.now();
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
  }
  get M() { return MODES[this.mode]; }
  enter() {
    const g = this.game; if (this.active || g.state !== 'play' || !g.stadium) return;
    if (g.photoMode.active) g.photoMode.exit();
    this.active = true; this.timeScale = 1; this.speedIdx = 0;
    const c = g.camera; this.pos.copy(c.position).add(new THREE.Vector3(0, 2.5, 0)); this.vel.set(0, 0, 0);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    this.yaw = this.tYaw = Math.atan2(-fwd.x, -fwd.z); this.pitch = this.tPitch = Math.asin(clamp(fwd.y, -1, 1));
    this.fov = this.tFov = c.fov; this.camPos.copy(c.position); this.camLook.copy(c.position).add(fwd.multiplyScalar(10));
    this.orbitA = Math.atan2(c.position.z, c.position.x);
    this.buildUI(); g.input.wantLock = true; g.input.pressed.clear(); g.input.consumePad();
    g.ui.toast('🎥 Modo dron · 1-7 tomas · R grabar · L cámara lenta · B franjas de cine · K o Esc salir', 'info', 5000);
    g.audio?.ui('click');
  }
  exit() {
    const g = this.game; if (!this.active) return;
    if (this.rec) this.stopRec();
    this.active = false; this.timeScale = 1; this.letterbox = 0; g.post.letterbox = 0; g.recorder.hideGuide();
    this.el?.remove(); this.el = null;
    g.camera.fov = g.settings.data.fov; g.camera.updateProjectionMatrix(); g.follow.snap(g.player);
    g.ui.toast('Modo dron desactivado', 'info', 1500);
  }
  setMode(i) { this.mode = (i + MODES.length) % MODES.length; this.cut = true; this.renderUI(); this.game.audio?.ui('tick'); }
  // ---------- Entrada (teclado, ratón, control) ----------
  input(dt) {
    const g = this.game, inp = g.input;
    if (inp.keyPressed('KeyK') || inp.padPressed('crouch')) { this.exit(); return; }
    for (let i = 0; i < MODES.length; i++) if (inp.keyPressed('Digit' + (i + 1))) this.setMode(i);
    if (inp.padTriggerPressed(0) || inp.keyPressed('KeyN')) this.setMode(this.mode + 1);
    if (inp.keyPressed('KeyR') || inp.padTriggerPressed(2)) this.rec ? this.stopRec() : this.startRec();
    if (inp.keyPressed('KeyL') || inp.padTriggerPressed(3)) { this.speedIdx = (this.speedIdx + 1) % SPEEDS.length; this.timeScale = SPEEDS[this.speedIdx]; this.renderUI(); }
    if (inp.keyPressed('KeyB') || inp.padTriggerPressed(8)) { this.letterbox = this.letterbox ? 0 : 1; this.renderUI(); }
    if ((inp.keyPressed('KeyV') || inp.padTriggerPressed(10)) && !this.rec) { this.aspect = this.aspect === 'v' ? 'h' : 'v'; if (this.aspect === 'v') { this.letterbox = 0; this.game.recorder.showGuide('v'); } else this.game.recorder.hideGuide(); this.renderUI(); }
    if (inp.keyPressed('KeyH') || inp.padTriggerPressed(9)) { this.showUI = !this.showUI; if (this.el) this.el.style.display = this.showUI ? '' : 'none'; }
    // Zoom (campo de visión)
    if (inp.mouse.wheel) this.tFov = clamp(this.tFov + inp.mouse.wheel * 3, 12, 95);
    const z = inp.padTrigger(7) - inp.padTrigger(6); if (z) this.tFov = clamp(this.tFov - z * 40 * dt, 12, 95);
    if (inp.isDown('zoomIn')) this.tFov = clamp(this.tFov - 30 * dt, 12, 95); if (inp.isDown('zoomOut')) this.tFov = clamp(this.tFov + 30 * dt, 12, 95);
    if (this.mode === 6 && (inp.keyPressed('KeyE') || inp.padTriggerPressed(5))) { this.target++; this.cut = true; }
    if (this.mode === 6 && (inp.keyPressed('KeyQ') || inp.padTriggerPressed(4))) { this.target--; this.cut = true; }
  }
  update() {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.active) return;
    const g = this.game, inp = g.input, cam = g.camera, m = g.match;
    if (!g.ui.screen) this.input(dt);
    if (!this.active) return;
    const mv = inp.moveVector(), look = inp.lookDelta(dt);
    const up = (inp.down.has('Space') ? 1 : 0) - (inp.down.has('ControlLeft') || inp.down.has('KeyC') ? 1 : 0) + (inp.padHeld(5) ? 1 : 0) - (inp.padHeld(4) ? 1 : 0);
    const fast = inp.isDown('sprint') ? 3.2 : inp.down.has('AltLeft') ? 0.3 : 1;
    const ball = m?.ball.pos || new THREE.Vector3();
    let want = new THREE.Vector3(), lookAt = new THREE.Vector3(), lambda = 4;
    const id = this.M.id;
    if (id === 'libre' || id === 'jugador') { this.tYaw -= look.dx; this.tPitch = clamp(this.tPitch - look.dy, -1.45, 1.45); }
    if (id === 'libre') {
      this.yaw = dampAngle(this.yaw, this.tYaw, 10, dt); this.pitch = damp(this.pitch, this.tPitch, 10, dt);
      const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const acc = new THREE.Vector3().addScaledVector(f, mv.y).addScaledVector(r, mv.x).add(new THREE.Vector3(0, up, 0)).multiplyScalar(14 * fast);
      this.vel.x = damp(this.vel.x, acc.x, 2.2, dt); this.vel.y = damp(this.vel.y, acc.y, 2.2, dt); this.vel.z = damp(this.vel.z, acc.z, 2.2, dt);
      this.pos.addScaledVector(this.vel, dt); this.pos.y = clamp(this.pos.y, 0.4, 160);
      this.pos.x = clamp(this.pos.x, -320, 320); this.pos.z = clamp(this.pos.z, -320, 320);
      cam.position.copy(this.pos); cam.rotation.set(this.pitch, this.yaw, -this.vel.dot(r) * 0.006, 'YXZ');
      // Pequeña oscilación de dron
      cam.position.y += Math.sin(now * 0.0013) * 0.04; cam.rotation.z += Math.sin(now * 0.0009) * 0.004;
      this.camPos.copy(cam.position); this.applyFov(cam, dt); return;
    }
    if (id === 'orbita') {
      this.orbitSpd = clamp(this.orbitSpd + mv.x * 0.08 * dt, -0.35, 0.35); this.orbitR = clamp(this.orbitR - mv.y * 30 * dt * fast, 25, 220); this.orbitH = clamp(this.orbitH + up * 12 * dt * fast, 3, 120);
      this.orbitA += this.orbitSpd * dt;
      want.set(Math.cos(this.orbitA) * this.orbitR, this.orbitH, Math.sin(this.orbitA) * this.orbitR * 0.75); lookAt.set(0, 2, 0); lambda = 3;
    } else if (id === 'sobrevuelo') {
      this.flySpd = clamp(this.flySpd + mv.x * 0.5 * dt, 0.2, 3); this.flyT += dt * 0.025 * this.flySpd;
      const t = this.flyT * Math.PI * 2;
      want.set(Math.cos(t) * (120 + 40 * Math.sin(t * 2)), 22 + 26 * (0.5 + 0.5 * Math.sin(t * 3)), Math.sin(t) * (90 + 30 * Math.cos(t * 2)));
      lookAt.set(Math.cos(t + 0.6) * 20, 0, Math.sin(t + 0.6) * 12); lambda = 1.6;
    } else if (id === 'tv') {
      want.set(clamp(ball.x * 0.25, -20, 20), 10.5, APRON_Z + 5.5); lookAt.set(ball.x, 0.5, ball.z * 0.9); lambda = 2.2;
      this.tFov = clamp(32 - (Math.abs(ball.x) * 0.1) + Math.max(0, ball.z) * 0.12, 18, 40);
    } else if (id === 'riel') {
      want.set(clamp(ball.x, -55, 55), 1.9, -APRON_Z + 2.5); lookAt.set(ball.x, 1, ball.z); lambda = 1.8;
    } else if (id === 'balon') {
      const v = m?.ball.vel || new THREE.Vector3(1, 0, 0), dir = new THREE.Vector3(v.x, 0, v.z); if (dir.lengthSq() < 0.5) dir.copy(this.camLook).sub(this.camPos).setY(0);
      dir.normalize(); want.copy(ball).addScaledVector(dir, -14).setY(Math.max(9, ball.y + 9)); lookAt.copy(ball); lambda = 1.5;
    } else if (id === 'jugador') {
      const list = m ? m.all : [];
      if (list.length) {
        const p = list[((this.target % list.length) + list.length) % list.length];
        this.yaw = dampAngle(this.yaw, this.tYaw, 8, dt); this.pitch = damp(this.pitch, clamp(this.tPitch, -0.2, 0.9), 8, dt);
        const back = 5.5;
        want.set(p.pos.x + Math.sin(this.yaw) * back * Math.cos(this.pitch), 1.6 + Math.sin(this.pitch) * back + 0.8, p.pos.z + Math.cos(this.yaw) * back * Math.cos(this.pitch));
        lookAt.set(p.pos.x, 1.5, p.pos.z); lambda = 5;
        if (this.lastTarget !== p) { this.lastTarget = p; this.renderUI(`${p.name} · #${p.number} (${p.teamData.short})`); }
      }
    }
    if (this.cut) { this.camPos.copy(want); this.camLook.copy(lookAt); this.cut = false; }
    this.camPos.x = damp(this.camPos.x, want.x, lambda, dt); this.camPos.y = damp(this.camPos.y, want.y, lambda, dt); this.camPos.z = damp(this.camPos.z, want.z, lambda, dt);
    this.camLook.x = damp(this.camLook.x, lookAt.x, lambda * 1.3, dt); this.camLook.y = damp(this.camLook.y, lookAt.y, lambda * 1.3, dt); this.camLook.z = damp(this.camLook.z, lookAt.z, lambda * 1.3, dt);
    cam.position.copy(this.camPos); cam.lookAt(this.camLook);
    this.pos.copy(cam.position); const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); this.tYaw = id === 'jugador' ? this.tYaw : Math.atan2(-f.x, -f.z); this.tPitch = id === 'jugador' ? this.tPitch : Math.asin(clamp(f.y, -1, 1));
    if (id !== 'jugador') { this.yaw = this.tYaw; this.pitch = this.tPitch; }
    this.applyFov(cam, dt);
  }
  applyFov(cam, dt) {
    this.fov = damp(this.fov, this.tFov, 5, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.game.post.letterbox = damp(this.game.post.letterbox || 0, this.letterbox, 6, dt);
    if (this.rec && this.recEl) { const s = Math.floor((performance.now() - this.recStart) / 1000); this.recEl.textContent = `● REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  }
  // ---------- Grabación ----------
  startRec() { const g = this.game; if (g.recorder.start(this.aspect || 'h', 'EntreLineas_dron')) { this.rec = true; this.recStart = performance.now(); g.ui.toast('● Grabando… (R para detener)', 'bad', 2000); this.renderUI(); } }
  stopRec() { if (!this.rec) return; this.game.recorder.stop(); this.rec = null; this.renderUI(); }
  // ---------- Interfaz ----------
  buildUI() {
    this.el = h('div', { class: 'drone-ui' }); this.game.ui.root.appendChild(this.el); this.renderUI();
  }
  renderUI(extra) {
    if (!this.el) return;
    const g = this.game;
    this.el.innerHTML = '';
    this.el.append(
      h('div', { class: 'dr-top' }, h('b', {}, '🎥 MODO DRON'), h('span', {}, this.M.label), extra ? h('span', { class: 'muted' }, extra) : null,
        this.timeScale < 1 ? h('span', { class: 'pill' }, `Cámara lenta ×${this.timeScale}`) : null, this.letterbox ? h('span', { class: 'pill' }, 'Cine 2.39:1') : null, h('span', { class: 'pill' }, this.aspect === 'v' ? '9:16 vertical' : '16:9 horizontal'),
        this.recEl = this.rec ? h('span', { class: 'dr-rec' }, '● REC 00:00') : null),
      h('div', { class: 'dr-modes' }, MODES.map((mo, i) => h('button', { class: 'btn small' + (i === this.mode ? ' primary' : ''), onclick: () => this.setMode(i) }, `${i + 1} ${mo.label}`))),
      h('div', { class: 'dr-help' }, this.M.help, h('br'), g.input.lastDevice === 'pad'
        ? '✕ siguiente toma · □ grabar · △ cámara lenta · L3 vertical/horizontal · Create franjas · Options ocultar panel · L1/R1 bajar/subir · L2/R2 zoom · ○ salir'
        : 'Rueda zoom · R grabar · V vertical/horizontal · L cámara lenta · B franjas de cine · H ocultar panel · K / Esc salir'),
    );
    if (!this.rec) this.recEl = null;
  }
}
