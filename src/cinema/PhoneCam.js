import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { clamp, damp, dampAngle } from '../core/MathUtil.js';

/*
 * Grabar con el celular: el fotógrafo saca el teléfono y graba en horizontal (16:9) o vertical (9:16).
 * Cámara trasera (lo que ves) o selfie (el fotógrafo hablándole a la cámara con el brazo estirado).
 * Se puede caminar mientras se graba; el pulso de la mano mueve un poco la imagen, como un celular real.
 */
export class PhoneCam {
  constructor(game) { this.game = game; this.active = false; this.aspect = 'v'; this.selfie = false; this.yaw = 0; this.pitch = 0; this.fov = 62; this.t = 0; }
  enter(aspect = 'v', selfie = false) {
    const g = this.game; if (this.active || g.state !== 'play' || g.drone?.active || g.travel?.mode) return;
    if (g.photoMode.active) g.photoMode.exit();
    this.active = true; this.aspect = aspect; this.selfie = selfie; this.fov = selfie ? 70 : 62; this.lastSelfie = selfie;
    this.yaw = g.player.yaw + Math.PI; this.pitch = 0; this.pos = null;
    g.player.setCameraEquipped(false);
    g.recorder.showGuide(aspect);
    this.ensurePhoneMesh(); this.buildUI();
    g.input.pressed.clear(); g.input.consumePad(); g.input.wantLock = true;
    g.ui.toast(`📱 Cámara del celular · ${aspect === 'v' ? 'vertical 9:16' : 'horizontal 16:9'} · R grabar · V cambiar formato · F selfie · Esc salir`, 'info', 5000);
  }
  exit() {
    const g = this.game; if (!this.active) return;
    if (g.recorder.active) g.recorder.stop();
    this.active = false; g.recorder.hideGuide(); this.el?.remove(); this.el = null;
    if (this.phone) this.phone.visible = false;
    g.camera.fov = g.settings.data.fov; g.camera.updateProjectionMatrix();
    g.follow.yaw = this.yaw; g.follow.snap(g.player);
  }
  // Teléfono en la mano derecha del fotógrafo
  ensurePhoneMesh() {
    const av = this.game.player.avatar, hand = av.arms[1].el;
    if (!this.phone) {
      const ph = new THREE.Group();
      ph.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.155, 0.009), new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, metalness: 0.6 })));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.145), new THREE.MeshStandardMaterial({ color: 0x0b1a33, emissive: 0x3a6fd8, emissiveIntensity: 0.9 })); scr.position.z = -0.0051; scr.rotation.y = Math.PI; ph.add(scr);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12), new THREE.MeshStandardMaterial({ color: 0x050505 })); lens.rotation.x = Math.PI / 2; lens.position.set(-0.022, 0.06, 0.006); ph.add(lens);
      this.phone = ph;
    }
    if (this.phone.parent !== hand) hand.add(this.phone);
    this.phone.position.set(0, -0.31, 0.02); this.phone.visible = true;
  }
  input(dt) {
    const g = this.game, inp = g.input, rec = g.recorder;
    if (inp.keyPressed('Escape') || inp.padPressed('pause') || inp.padTriggerPressed(1)) { this.exit(); return; }
    if (inp.keyPressed('KeyR') || (inp.locked && inp.mouse.leftPressed) || inp.padTriggerPressed(7) || inp.padTriggerPressed(2)) { rec.active ? rec.stop() : rec.start(this.aspect, 'EntreLineas_celular'); this.renderUI(); g.audio?.ui(rec.active ? 'beep' : 'click'); }
    if ((inp.keyPressed('KeyV') || inp.padTriggerPressed(3)) && !rec.active) { this.aspect = this.aspect === 'v' ? 'h' : 'v'; rec.showGuide(this.aspect); this.renderUI(); }
    if (inp.keyPressed('KeyF') || inp.padTriggerPressed(11)) { this.selfie = !this.selfie; this.fov = this.selfie ? 70 : 62; this.renderUI(); }
    if (inp.mouse.wheel) this.fov = clamp(this.fov + inp.mouse.wheel * 3, 24, 80);
    if (inp.padHeld(12)) this.fov = clamp(this.fov - 30 * dt, 24, 80); if (inp.padHeld(13)) this.fov = clamp(this.fov + 30 * dt, 24, 80);
    const look = inp.lookDelta(dt);
    if (inp.locked || inp.pad) { this.yaw -= look.dx; this.pitch = clamp(this.pitch - look.dy, -1.2, 1.1); }
  }
  // Ángulo de movimiento para el jugador: con selfie camina hacia la cámara
  moveYaw() { return this.selfie ? this.yaw + Math.PI : this.yaw + Math.PI; }
  update(dt) {
    if (!this.active) return;
    const g = this.game, p = g.player, cam = g.camera; this.t += dt;
    if (!g.ui.screen) this.input(dt);
    if (!this.active) return;
    this.ensurePhoneMesh();
    if (this.lastSelfie !== this.selfie) { this.lastSelfie = this.selfie; this.renderUI(); }
    // Pulso de la mano: oscilación lenta + paso al caminar
    const walk = Math.min(1, p.speed / 3), sw = Math.sin(this.t * 1.3) * 0.006 + Math.sin(this.t * 7.5) * 0.012 * walk;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const head = p.pos.clone().add(new THREE.Vector3(0, p.crouch ? 1.05 : 1.55 * (p.avatar.scale || 1), 0));
    if (!this.selfie) {
      // Cámara trasera: el teléfono frente a los ojos; el fotógrafo no se ve
      const want = head.clone().addScaledVector(fwd, 0.35).add(new THREE.Vector3(0, -0.08 + Math.abs(Math.sin(this.t * 7.5)) * 0.02 * walk, 0));
      this.pos = this.pos ? this.pos.lerp(want, 1 - Math.exp(-18 * dt)) : want;
      cam.position.copy(this.pos); cam.rotation.set(this.pitch + sw, this.yaw + sw * 0.6, sw * 0.8, 'YXZ');
      p.root.visible = false;
    } else {
      // Selfie: brazo estirado, la cámara mira al fotógrafo
      p.yaw = dampAngle(p.yaw, this.yaw + Math.PI, 10, dt); p.root.rotation.y = p.yaw;
      const pf = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)), right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      const want = head.clone().addScaledVector(pf, 0.68).addScaledVector(right, 0.17).add(new THREE.Vector3(0, 0.1 + this.pitch * 0.25, 0));
      this.pos = this.pos ? this.pos.lerp(want, 1 - Math.exp(-14 * dt)) : want;
      cam.position.copy(this.pos); cam.lookAt(head.clone().add(new THREE.Vector3(0, -0.05, 0)));
      cam.rotation.z += sw * 0.8;
      p.root.visible = true;
      // Brazo derecho estirado sosteniendo el teléfono
      const aR = p.avatar.arms[1]; aR.sh.rotation.set(-1.5, 0.12, -0.12); aR.el.rotation.set(-0.12, 0, 0);
    }
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
  buildUI() { this.el = h('div', { class: 'pc-ui' }); this.game.ui.root.appendChild(this.el); this.renderUI(); }
  renderUI() {
    if (!this.el) return;
    const g = this.game, pad = g.input.lastDevice === 'pad', rec = g.recorder.active;
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'pc-top' }, h('b', {}, '📱 CÁMARA DEL CELULAR'), h('span', { class: 'pill' }, this.aspect === 'v' ? '9:16 vertical' : '16:9 horizontal'), h('span', { class: 'pill' }, this.selfie ? 'Selfie' : 'Trasera'), rec ? h('span', { class: 'dr-rec' }, '● GRABANDO') : null),
      h('div', { class: 'dr-help' }, pad ? 'R2 o □ grabar · △ formato · R3 selfie · cruceta ↑↓ zoom · ○ salir' : 'R o clic grabar · V formato vertical/horizontal · F selfie · rueda zoom · WASD caminar · Esc salir'));
  }
}
