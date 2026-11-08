import * as THREE from 'three';
import { clamp, damp } from '../core/MathUtil.js';
import { SEE_THROUGH } from '../core/Collision.js';

// Cámara de exploración en tercera persona: seguimiento suave, colisión con paredes, zoom.
export class FollowCamera {
  constructor(game, camera) {
    this.game = game; this.camera = camera;
    this.yaw = 0; this.pitch = 0.18; this.dist = game.settings.data.cameraDistance; this.curDist = this.dist;
    this.target = new THREE.Vector3(); this.smoothTarget = new THREE.Vector3(); this.shoulder = 0.45;
    this.fpPitch = 0; this.bobT = 0; this.bob = new THREE.Vector2(); this.eyeY = 1.64;
  }
  get firstPerson() { return this.game.settings.data.view === 'primera'; }
  // Primera persona: ojos del fotógrafo con balanceo natural de la cabeza al caminar/correr.
  updateFP(dt, input, player, allowLook) {
    if (allowLook) { const d = input.lookDelta(dt); this.yaw -= d.dx; this.fpPitch = clamp(this.fpPitch - d.dy, -1.35, 1.35); }
    const sp = player.grounded ? player.speed : 0;
    this.bobT += dt * (sp > 0.3 ? (sp < 2.2 ? 1.8 + sp * 0.9 : 2.8 + sp * 0.42) : 0) * Math.PI;
    const k = Math.min(1, sp / 4);
    this.bob.x = damp(this.bob.x, Math.sin(this.bobT) * 0.028 * k, 12, dt);
    this.bob.y = damp(this.bob.y, Math.abs(Math.cos(this.bobT)) * 0.05 * k, 12, dt);
    this.eyeY = damp(this.eyeY, player.eyeHeight(), 10, dt);
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const eye = player.pos.clone().add(new THREE.Vector3(0, this.eyeY + this.bob.y - 0.025, 0)).addScaledVector(fwd, 0.1).addScaledVector(right, this.bob.x);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.fpPitch), Math.sin(this.fpPitch), Math.cos(this.yaw) * Math.cos(this.fpPitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(dir));
    this.camera.rotateZ(-this.bob.x * 0.4);
    const fov = this.game.settings.data.fov + 8 + (player.speed > 5 ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = damp(this.camera.fov, fov, 5, dt); this.camera.updateProjectionMatrix(); }
    this.smoothTarget.copy(player.pos).add(new THREE.Vector3(0, 1.55, 0));
  }
  snap(player) { this.yaw = player.yaw; this.smoothTarget.copy(player.pos).add(new THREE.Vector3(0, 1.55, 0)); this.vel?.set(0, 0, 0); }
  update(dt, input, player, allowLook) {
    if (this.firstPerson) return this.updateFP(dt, input, player, allowLook);
    if (allowLook) {
      const d = input.lookDelta(dt);
      this.yaw -= d.dx; this.pitch = clamp(this.pitch + d.dy, -0.6, 1.1);
      if (input.mouse.wheel && !player.cameraEquipped) this.dist = clamp(this.dist + input.mouse.wheel * 0.4, 1.6, 7);
    }
    const h = player.crouch ? 1.05 : 1.55;
    this.target.copy(player.pos).add(new THREE.Vector3(0, h, 0));
    // Resorte críticamente amortiguado: la cámara tiene masa (se retrasa al arrancar y se asienta al frenar)
    if (!this.vel) this.vel = new THREE.Vector3();
    const w = 9, wy = 6, dtc = Math.min(dt, 0.05);
    for (const [ax, ww] of [['x', w], ['y', wy], ['z', w]]) {
      const a = (this.target[ax] - this.smoothTarget[ax]) * ww * ww - 2 * ww * this.vel[ax];
      this.vel[ax] += a * dtc; this.smoothTarget[ax] += this.vel[ax] * dtc;
    }
    // Balanceo leve al correr e inclinación en curvas
    this.runT = (this.runT || 0) + dt * (player.speed > 3 ? player.speed * 2.2 : 0);
    const run = Math.min(1, Math.max(0, (player.speed - 3) / 3));
    this.roll = damp(this.roll || 0, (this.lastYaw !== undefined ? (this.yaw - this.lastYaw) / Math.max(dt, 1e-3) : 0) * -0.012, 6, dt); this.lastYaw = this.yaw;
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = this.smoothTarget.clone().addScaledVector(right, -this.shoulder);
    // Colisión de cámara: acortar el brazo si hay una pared en medio
    const hit = this.game.collision.raycast(pivot.x, pivot.y, pivot.z, dir.x, dir.y, dir.z, this.dist + 0.3, SEE_THROUGH);
    const want = Math.max(0.6, Math.min(this.dist, hit - 0.3));
    this.curDist = want < this.curDist ? want : damp(this.curDist, want, 4, dt);
    const pos = pivot.clone().addScaledVector(dir, this.curDist);
    pos.y = Math.max(pos.y, 0.3) + Math.abs(Math.sin(this.runT)) * 0.045 * run;
    this.camera.position.copy(pos);
    this.camera.lookAt(pivot.x, pivot.y + 0.1, pivot.z);
    this.camera.rotateZ(Math.max(-0.04, Math.min(0.04, this.roll)) + Math.sin(this.runT * 0.5) * 0.006 * run);
    const fov = this.game.settings.data.fov + (player.speed > 5 ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = damp(this.camera.fov, fov, 5, dt); this.camera.updateProjectionMatrix(); }
  }
  // Yaw de "hacia dónde mira la cámara" para que W avance en esa dirección.
  get moveYaw() { return this.yaw; }
}
