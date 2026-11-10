import * as THREE from 'three';
import { Humanoid } from '../characters/Humanoid.js';
import { humanoidOpts, loadGlobalLook } from './Look.js';
import { clamp, damp, dampAngle } from '../core/MathUtil.js';

/*
 * Controlador en tercera persona del fotógrafo.
 * Caminar / correr / sprint, salto, agacharse (ángulo bajo), colisiones AABB,
 * cámara equipada (cambia la animación y la velocidad).
 */
export class PlayerController {
  constructor(game) {
    this.game = game;
    this.look = loadGlobalLook();
    this.avatar = new Humanoid(humanoidOpts(this.look));
    this.root = this.avatar.root; game.scene.add(this.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.vy = 0; this.grounded = true;
    this.radius = 0.32; this.speed = 0; this.crouch = false; this.cameraEquipped = false; this.inViewfinder = false;
    this.frozen = false; this.stamina = 1; this.stepAcc = 0; this.surface = 'concrete';
    this.footstepCb = null;
  }
  // Cambia la apariencia sin perder posición, cámara colgada ni lente
  applyLook(look) {
    this.look = { ...look };
    const old = this.root, parent = old.parent, vis = old.visible, bpVis = this.avatar.backpack?.visible !== false;
    this.avatar = new Humanoid(humanoidOpts(this.look));
    this.root = this.avatar.root; this.root.position.copy(old.position); this.root.rotation.copy(old.rotation); this.root.visible = vis;
    if (parent) { parent.remove(old); parent.add(this.root); }
    this.avatar.showCamera(this.cameraEquipped); this.avatar.setLensLength(this.game.inventory.lens.max, this.game.inventory.lens);
    if (this.avatar.backpack) this.avatar.backpack.visible = bpVis;
    this.attachScreen();
    this.avatar.setCameraBody(this.game.inventory.camera?.look);
    this.syncSecondCamera();
    this.game.viewModel?.setSkin(this.look.skin, this.look.shirt);
  }
  place(x, z, yaw = 0) { this.pos.set(x, 0, z); this.yaw = yaw; this.vel.set(0, 0, 0); this.root.position.copy(this.pos); this.root.rotation.y = yaw; }
  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  // Pantalla trasera de la cámara del personaje con la vista en vivo
  attachScreen() {
    const lv = this.game.liveView; if (!lv || this.avatar.lcd) return;
    const scr = lv.makeScreen(0.085, 0.058); scr.position.set(0.008, 0.002, -0.0488); scr.rotation.y = Math.PI; this.avatar.cameraRig.add(scr); this.avatar.lcd = scr;
  }
  syncSecondCamera() {
    const inv = this.game.inventory, show = inv.hasSecond && (!this.game.inEvent || inv.prepared !== false);
    this.avatar.setSecondCamera?.(show ? inv.camera2.look : null, inv.lens2?.max || 70);
  }
  setCameraEquipped(v) {
    this.cameraEquipped = v; this.avatar.showCamera(v);
  }
  update(dt, input, camYaw, allowMove) {
    { const L = this.game.inventory.lens; if (L && this.avatar.lensKey !== L.id) this.avatar.setLensLength(L.max, L); if (!this.avatar.lcd) this.attachScreen(); }
    const g = this.game, col = g.collision;
    let mv = allowMove && !this.frozen ? input.moveVector() : { x: 0, y: 0 };
    const sprint = input.isDown('sprint') && !this.cameraEquipped;
    const slow = input.isDown('walk') || this.inViewfinder;
    if (allowMove && input.wasPressed('crouch')) this.crouch = !this.crouch;
    let maxSpeed = slow ? 1.4 : sprint ? 6.4 : 3.6;
    if (this.cameraEquipped && !slow) maxSpeed = 2.8;
    if (this.crouch) maxSpeed = this.inViewfinder ? 0 : 1.2;
    const energized = (this.game.buffs?.energy || 0) > this.game.time;
    if (sprint && (mv.x || mv.y)) { this.stamina = Math.max(0, this.stamina - dt * (energized ? 0.05 : 0.12)); if (this.stamina < 0.05) maxSpeed = 3.6; }
    else this.stamina = Math.min(1, this.stamina + dt * 0.2);
    // Dirección relativa a la cámara
    const fwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    const wl = wish.length();
    if (wl > 1e-3) wish.multiplyScalar(1 / Math.max(1, wl));
    const target = wish.clone().multiplyScalar(maxSpeed);
    const accel = this.grounded ? 10 : 2;
    this.vel.x = damp(this.vel.x, target.x, accel, dt); this.vel.z = damp(this.vel.z, target.z, accel, dt);
    // Orientación: hacia el movimiento, o hacia la cámara en el visor
    if (this.inViewfinder || this.firstPerson) this.yaw = camYaw;
    else if (wl > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(wish.x, wish.z), 10, dt);
    // Salto
    if (allowMove && this.grounded && input.wasPressed('jump') && !this.inViewfinder && !this.crouch) { this.vy = 4.6; this.grounded = false; }
    this.vy -= 13 * dt;
    const next = this.pos.clone(); next.x += this.vel.x * dt; next.z += this.vel.z * dt; next.y += this.vy * dt;
    col.resolveCircle(next, this.radius, 1.75, 0.36);
    const gh = col.groundHeight(next.x, next.z, Math.max(next.y, this.pos.y), this.radius, 0.36);
    if (next.y <= gh) { next.y = gh; this.vy = 0; if (!this.grounded) this.game.audio?.footstep(this.surface, 1.3); this.grounded = true; }
    else if (next.y > gh + 0.05) this.grounded = false;
    // Velocidad real (tras colisión)
    const realV = Math.hypot(next.x - this.pos.x, next.z - this.pos.z) / Math.max(dt, 1e-4);
    this.speed = damp(this.speed, realV, 12, dt);
    this.pos.copy(next);
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    // Pasos (audio) sincronizados con la cadencia
    if (this.grounded && this.speed > 0.4) {
      this.stepAcc += dt * (this.speed < 2.2 ? 1.8 + this.speed * 0.9 : 2.8 + this.speed * 0.42) * 0.5;
      if (this.stepAcc >= 0.5) { this.stepAcc -= 0.5; this.game.audio?.footstep(this.surface, clamp(this.speed / 4, 0.4, 1.2)); }
    }
    // Animación
    const av = this.avatar;
    const st = this.crouch ? 'kneel' : this.inViewfinder ? 'camera' : this.cameraEquipped ? 'cameraLow' : 'loco';
    if (av.state !== st) av.play(st, 1);
    av.update(dt, this.crouch ? 0 : this.speed);
  }
  get firstPerson() { return this.game.settings.data.view === 'primera'; }
  eyeHeight() { return this.crouch ? 1.08 : 1.64; }
}
