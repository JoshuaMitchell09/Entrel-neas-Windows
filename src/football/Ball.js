import * as THREE from 'three';
import { makeCanvas, toTex } from '../gfx/Textures.js';

export const BALL_R = 0.11;
let ballTex = null;
function ballTexture() {
  if (ballTex) return ballTex;
  const c = makeCanvas(256, 128), ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, 256, 128);
  // Paneles modernos: franjas curvas en dos colores
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#d62828' : '#1d3557';
    ctx.beginPath(); const x = i * 44 + 10;
    ctx.moveTo(x, 10); ctx.bezierCurveTo(x + 30, 40, x - 10, 80, x + 20, 118); ctx.lineTo(x + 32, 118); ctx.bezierCurveTo(x + 2, 80, x + 42, 40, x + 12, 10); ctx.fill();
  }
  ballTex = toTex(c, { wrap: true });
  return ballTex;
}
export class Ball {
  constructor(scene) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
    this.mesh.castShadow = true; scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, BALL_R, 0); this.vel = new THREE.Vector3(); this.owner = null; this.lastTouch = null;
    this.shot = null; this.dead = false; this.inNet = false; this.spinAxis = new THREE.Vector3(1, 0, 0);
  }
  place(x, z) { this.pos.set(x, BALL_R, z); this.vel.set(0, 0, 0); this.owner = null; this.shot = null; this.inNet = false; }
  update(dt) {
    if (this.owner) return;
    const g = 9.81;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y > BALL_R + 0.01 || this.vel.y > 0.01) {
      this.vel.y -= g * dt;
      this.vel.multiplyScalar(1 - 0.06 * dt); // arrastre del aire
      if (this.pos.y < BALL_R) {
        this.pos.y = BALL_R;
        if (this.vel.y < -1.2) { this.vel.y = -this.vel.y * 0.55; this.vel.x *= 0.85; this.vel.z *= 0.85; this.bounced = true; }
        else this.vel.y = 0;
      }
    } else {
      this.pos.y = BALL_R; this.vel.y = 0;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) { const ns = Math.max(0, sp - (2.4 + sp * 0.06) * dt); this.vel.x *= ns / sp; this.vel.z *= ns / sp; }
    }
  }
  syncMesh(dt) {
    this.mesh.position.copy(this.pos);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.05) { this.spinAxis.set(this.vel.z, 0, -this.vel.x).normalize(); this.mesh.rotateOnWorldAxis(this.spinAxis, (sp / BALL_R) * dt); }
  }
}
