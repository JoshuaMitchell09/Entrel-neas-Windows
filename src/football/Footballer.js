import * as THREE from 'three';
import { Humanoid, SKIN_TONES, HAIR_COLORS } from '../characters/Humanoid.js';
import { numberTexture } from '../gfx/Textures.js';
import { dampAngle } from '../core/MathUtil.js';

export class Footballer {
  constructor(scene, team, teamIdx, info, role, slot, captain = false) {
    this.captain = captain;
    this.team = teamIdx; this.teamData = team; this.info = info; this.role = role; this.slot = slot;
    this.number = info.number; this.name = info.surname;
    const gk = role === 'GK';
    const shirt = gk ? team.gk.shirt : team.colors.primary;
    const tex = numberTexture(info.number, info.surname, shirt, gk ? '#ffffff' : team.colors.ink);
    this.h = new Humanoid({
      skin: SKIN_TONES[info.skin], hair: HAIR_COLORS[info.hair], shirt, shorts: gk ? team.gk.shorts : team.colors.shorts,
      socks: gk ? team.gk.shorts : team.colors.socks, boots: ['#111111', '#f5f5f5', '#ff5722', '#00b0ff', '#ffeb3b'][info.number % 5],
      numberTex: tex, height: info.height, armband: captain, gloves: gk ? '#e0e0e0' : null, longSleeves: gk, bald: info.hair === 5 && info.skin > 4,
    });
    this.root = this.h.root; scene.add(this.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0;
    this.target = new THREE.Vector3(); this.lock = 0; this.fallenT = 0; this.decisionT = Math.random(); this.tackleCD = 0;
    this.pendingKick = null; this.mode = 'play'; this.stamina = 1; this.sentOff = false; this.yellow = 0;
    this.maxSpeed = (role === 'GK' ? 6.2 : 7.4) * (team.style?.pace || 1) * (0.94 + Math.random() * 0.1);
    this.skill = 0.5 + Math.random() * 0.4; this.anim = 'loco';
    this.root.traverse((o) => { if (o.isMesh) o.userData.footballer = this; });
  }
  place(x, z, yaw) { this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.sync(0); }
  // Locomoción realista: la dirección gira con velocidad angular limitada (más lenta cuanto más rápido corre)
  // y la rapidez cambia con aceleración/frenado acotados.
  moveToward(tx, tz, speed, dt, accel = 8) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const desired = d > 0.25 ? Math.min(speed, d * 1.4) : 0;
    let sp = Math.hypot(this.vel.x, this.vel.z);
    let dir = sp > 0.15 ? Math.atan2(this.vel.x, this.vel.z) : Math.atan2(dx, dz);
    if (d > 1e-3) {
      const want = Math.atan2(dx, dz); let diff = want - dir; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
      const maxTurn = (sp < 2 ? 12 : 9.5 - sp * 0.85) * (accel / 8) * dt;
      // Giro muy cerrado a alta velocidad: frenar para cambiar de dirección
      const sharp = Math.abs(diff) > 1.6 && sp > 3;
      dir += Math.max(-Math.max(0.05, maxTurn), Math.min(Math.max(0.05, maxTurn), diff));
      const target = sharp ? Math.min(desired, sp * 0.4) : desired;
      const acc = target > sp ? (4.2 + accel * 0.25) * (1 - sp / (this.maxSpeed + 1.5)) + 1.2 : 7.5 + accel * 0.3;
      sp += Math.max(-acc * dt, Math.min(acc * dt, target - sp));
    } else sp = Math.max(0, sp - 8 * dt);
    const prevSp = this.vel.length();
    this.vel.set(Math.sin(dir) * sp, 0, Math.cos(dir) * sp);
    this.accel = (sp - prevSp) / Math.max(dt, 1e-3);
    return d;
  }
  faceToward(x, z, dt, rate = 8) { this.yaw = dampAngle(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), rate, dt); }
  playAnim(name, dur, side = 1) { this.h.play(name, dur, side); this.anim = name; this.lock = dur; }
  // Caída tipo muñeco de trapo en la dirección de un empujón (vector mundo).
  ragdoll(dirX, dirZ, dur) {
    const fx = Math.cos(this.yaw) * dirX - Math.sin(this.yaw) * dirZ, fz = Math.sin(this.yaw) * dirX + Math.cos(this.yaw) * dirZ;
    this.h.fallDir = { x: fx, z: fz }; this.mode = 'fallen'; this.fallenT = dur; this.playAnim('ragdoll', dur);
    this.vel.set(dirX * 2.2, 0, dirZ * 2.2);
  }
  integrate(dt) {
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.6 && this.lock <= 0 && this.mode !== 'fallen') this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 9, dt);
  }
  sync(dt, ballPos) {
    // Inclinación en curvas y aceleración, mirada al balón
    const prevYaw = this.prevYaw ?? this.yaw; let dy = this.yaw - prevYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    this.prevYaw = this.yaw;
    const spd = Math.hypot(this.vel.x, this.vel.z), turnRate = dt > 0 ? dy / dt : 0;
    this.h.turnLean = (this.h.turnLean || 0) + ((-turnRate * spd * 0.022) - (this.h.turnLean || 0)) * Math.min(1, dt * 8);
    this.h.accelLean = (this.h.accelLean || 0) + ((this.accel || 0) * 0.03 - (this.h.accelLean || 0)) * Math.min(1, dt * 6);
    if (ballPos) { let la = Math.atan2(ballPos.x - this.pos.x, ballPos.z - this.pos.z) - this.yaw; while (la > Math.PI) la -= 2 * Math.PI; while (la < -Math.PI) la += 2 * Math.PI; const tgt = Math.max(-1.1, Math.min(1.1, la)) * 0.8; this.h.lookYaw += (tgt - this.h.lookYaw) * Math.min(1, dt * 5); }
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.lock > 0) {
      this.lock -= dt;
      if (this.lock <= 0 && this.anim === 'dive') { this.playAnim('getup', 0.85); }
      else if (this.lock <= 0 && ['kick', 'header', 'slide', 'throw', 'catch', 'getup'].includes(this.anim)) { this.h.play(this.role === 'GK' ? 'gkReady' : 'loco'); this.anim = 'loco'; }
    }
    if (this.lock <= 0 && this.mode === 'play' && this.role === 'GK' && this.anim !== 'gkReady' && this.anim !== 'dive') { this.h.play(sp < 1.5 ? 'gkReady' : 'loco'); this.anim = sp < 1.5 ? 'gkReady' : 'loco'; }
    if (this.role === 'GK' && this.anim === 'gkReady' && sp >= 2.5) { this.h.play('loco'); this.anim = 'loco'; }
    this.h.update(dt, sp);
  }
  get isActing() { return this.lock > 0; }
}
