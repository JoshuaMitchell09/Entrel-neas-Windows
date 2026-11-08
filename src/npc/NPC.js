import * as THREE from 'three';
import { Humanoid, SKIN_TONES, HAIR_COLORS } from '../characters/Humanoid.js';
import { dampAngle, rand, pick } from '../core/MathUtil.js';

// NPC genérico: rutas, animaciones de reposo, mirar al jugador y murmullos espaciales.
export class NPC {
  constructor(game, parent, o) {
    this.game = game; this.name = o.name || ''; this.role = o.role || 'extra';
    this.h = new Humanoid(o.look || {}); this.root = this.h.root; parent.add(this.root);
    this.pos = o.pos.clone(); this.yaw = o.yaw || 0; this.baseYaw = this.yaw; this.idle = o.idle || 'loco';
    this.route = o.route || null; this.ri = 0; this.speed = o.speed || 1.3; this.wait = 0; this.loop = o.loop !== false;
    this.facePlayer = o.facePlayer !== false && this.role !== 'extra'; this.vel = new THREE.Vector3(); this.talkT = rand(2, 10); this.chatty = o.chatty || 0;
    this.pitch = o.pitch || (o.look?.female ? 1.45 : 1);
    this.h.play(this.idle); this.override = null; this.overrideT = 0;
    if (o.camera) { this.h.showCamera(true); this.h.setLensLength(o.camera); }
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
  }
  playOnce(anim, dur) { this.override = anim; this.overrideT = dur; this.h.play(anim, dur); }
  update(dt, playerPos) {
    let speed = 0;
    if (this.route && this.wait <= 0) {
      const tgt = this.route[this.ri];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { this.ri++; if (this.ri >= this.route.length) { if (this.loop) this.ri = 0; else { this.route = null; } } this.wait = tgt.wait || 0; }
      else {
        // Ceder el paso al jugador
        const toP = playerPos ? Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z) : 99;
        const s = toP < 1.1 ? 0 : this.speed;
        this.vel.set(dx / d * s, 0, dz / d * s); this.pos.addScaledVector(this.vel, dt); speed = s;
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 6, dt);
      }
    } else this.wait -= dt;
    if (!speed) {
      this.vel.set(0, 0, 0);
      if (this.facePlayer && playerPos && this.pos.distanceTo(playerPos) < 5) this.yaw = dampAngle(this.yaw, Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z), 4, dt);
      else if (!this.route) this.yaw = dampAngle(this.yaw, this.baseYaw, 2, dt);
    }
    if (this.override) { this.overrideT -= dt; if (this.overrideT <= 0) { this.override = null; this.h.play(this.idle); } }
    else { const want = speed > 0.1 ? 'loco' : this.idle; if (this.h.state !== want) this.h.play(want); }
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    this.h.update(dt, speed);
    // Conversaciones ambientales
    if (this.chatty && playerPos && this.pos.distanceTo(playerPos) < 14) {
      this.talkT -= dt;
      if (this.talkT <= 0) { this.game.audio?.talk(this.pos.clone().setY(1.6), rand(0.8, 2), this.pitch); this.talkT = rand(3, 9) / this.chatty; }
    }
  }
}
// Apariencias
export function randomFan(team) {
  const r = Math.random();
  const shirt = r < 0.55 ? team.colors.primary : r < 0.75 ? team.colors.secondary : pick(['#f2f2f2', '#222222', '#3a6ea5', '#8d99ae', '#e9c46a']);
  return { skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS), shirt, shorts: '#2b2b2b', pants: Math.random() < 0.7 ? pick(['#2f3e57', '#3d3d3d', '#5b4a3a', '#1f2a44']) : null,
    boots: pick(['#eeeeee', '#222222', '#7a5c3a']), cap: Math.random() < 0.3 ? pick([team.colors.primary, '#111111', '#ffffff']) : null, height: rand(1.58, 1.88), backpack: Math.random() < 0.15 ? '#333' : null };
}
export const LOOKS = {
  mariana: { skin: '#d9a07a', hair: '#2b1c12', shirt: '#0b3d91', pants: '#2b2b38', boots: '#222222', height: 1.64, lanyard: true, female: true, longSleeves: false },
  alvaro: { skin: '#a86f48', hair: '#9e9e9e', shirt: '#4a5d23', pants: '#3a3a2e', boots: '#4a3626', height: 1.72, cap: '#222222', vest: '#f2c500', lanyard: true },
  guard: { skin: '#8d5a3b', hair: '#120c08', shirt: '#1b1f2a', pants: '#1b1f2a', boots: '#111111', height: 1.84, cap: '#1b1f2a', vest: '#2b2f3a', longSleeves: true },
  police: { skin: '#c68d63', hair: '#120c08', shirt: '#2f4d7a', pants: '#1d2b44', boots: '#111111', height: 1.78, cap: '#1d2b44', longSleeves: true },
  steward: { skin: '#b97c55', hair: '#2b1c12', shirt: '#333333', pants: '#2a2a2a', boots: '#111', height: 1.75, vest: '#ff7a00' },
  photog: { skin: '#e0ac85', hair: '#3a2817', shirt: '#222222', pants: '#3d4a5c', boots: '#222', height: 1.76, vest: '#0b3d91', cap: '#111111', lanyard: true },
  vendor: { skin: '#a86f48', hair: '#120c08', shirt: '#ffffff', pants: '#2b2b2b', boots: '#222', height: 1.7, cap: '#c8102e' },
  journalist: { skin: '#f1c9a5', hair: '#5a3b22', shirt: '#6d597a', pants: '#2b2b38', boots: '#222', height: 1.7, lanyard: true, backpack: '#222' },
};
