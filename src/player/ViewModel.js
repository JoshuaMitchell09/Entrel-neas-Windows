import * as THREE from 'three';
import { damp } from '../core/MathUtil.js';

// Manos y cámara visibles en primera persona (hijo de la cámara del juego).
export class ViewModel {
  constructor(game) {
    this.game = game; this.root = new THREE.Group(); this.root.visible = false; game.camera.add(this.root);
    const skin = new THREE.MeshStandardMaterial({ color: 0xc68d63, roughness: 0.6 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x2f3e46, roughness: 0.85 });
    const body = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.25 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
    const rig = (this.rig = new THREE.Group()); this.root.add(rig);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.105, 0.085), body); rig.add(cam); this.camMesh = cam; this.bodyMat = body;
    this.gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.085), body); this.gripMesh.position.y = -0.077; rig.add(this.gripMesh);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.07), rubber); grip.position.set(0.07, -0.005, 0.01); rig.add(grip);
    const prism = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.06), body); prism.position.set(0, 0.07, 0); rig.add(prism);
    this.lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 1, 20).rotateX(Math.PI / 2).translate(0, 0, -0.5), body); this.lens.position.set(0, -0.005, -0.04); rig.add(this.lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 20), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.5 })); ring.position.set(0, -0.005, -0.08); rig.add(ring); this.ring = ring;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.004), new THREE.MeshStandardMaterial({ color: 0x0b3d91, roughness: 0.8 })); strap.position.set(-0.08, -0.1, 0.03); rig.add(strap);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.32, 4, 10), sleeve); arm.rotation.x = Math.PI / 2 - 0.3; arm.rotation.z = s * 0.35; arm.position.set(s * 0.13, -0.13, 0.2); rig.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10).scale(0.9, 0.7, 1.3), skin); hand.position.set(s * 0.085, -0.03, s > 0 ? 0.01 : -0.06); rig.add(hand);
    }
    this.base = new THREE.Vector3(0.17, -0.19, -0.42); rig.position.copy(this.base); rig.rotation.set(0.08, -0.12, 0);
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
    this.sway = new THREE.Vector2(); this.lastYaw = 0; this.lastPitch = 0; this.t = 0;
  }
  update(dt) {
    const cb = this.game.inventory.camera;
    if (cb && this.lastBody !== cb.id) { this.lastBody = cb.id; const lk = cb.look || { size: 1, color: '#151515' }; this.camMesh.scale.setScalar(lk.size); this.gripMesh.visible = !!lk.grip; this.bodyMat.color.set(lk.color); this.game.player.avatar.setCameraBody(lk); }
    const g = this.game, p = g.player, show = !g.drone?.active && g.follow.firstPerson && p.cameraEquipped && !g.photoMode.active && !g.ui.screen && g.state === 'play';
    this.root.visible = show; if (!show) return;
    const L = g.inventory.lens; this.lens.scale.set(1 + L.max / 900, 1 + L.max / 900, 0.06 + L.max / 2200); this.ring.position.z = -0.04 - this.lens.scale.z * 0.8;
    const dy = g.follow.yaw - this.lastYaw, dp = g.follow.fpPitch - this.lastPitch; this.lastYaw = g.follow.yaw; this.lastPitch = g.follow.fpPitch;
    this.sway.x = damp(this.sway.x, -dy * 2.5, 8, dt); this.sway.y = damp(this.sway.y, dp * 2.5, 8, dt);
    this.t += dt * (p.speed > 0.3 ? 2 + p.speed : 0.6);
    const bob = Math.sin(this.t * 2) * 0.006 * (p.speed > 0.3 ? 1 : 0.3);
    this.rig.position.set(this.base.x + this.sway.x * 0.05, this.base.y + bob - this.sway.y * 0.04 - (p.speed > 5 ? 0.06 : 0), this.base.z);
  }
}
