import * as THREE from 'three';
import { damp } from '../core/MathUtil.js';
import { buildLens, GEAR } from '../gfx/CameraGear.js';

// Manos y cámara visibles en primera persona (hijo de la cámara del juego).
export class ViewModel {
  constructor(game) {
    this.game = game; this.root = new THREE.Group(); this.root.visible = false; game.camera.add(this.root);
    const skin = (this.skinMat = new THREE.MeshStandardMaterial({ color: game.player?.look?.skin || 0xc68d63, roughness: 0.6 }));
    const sleeve = (this.sleeveMat = new THREE.MeshStandardMaterial({ color: game.player?.look?.shirt || 0x2f3e46, roughness: 0.85 }));
    const body = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.25 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
    const rig = (this.rig = new THREE.Group()); this.root.add(rig);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.105, 0.085), body); rig.add(cam); this.camMesh = cam; this.bodyMat = body;
    this.gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.085), body); this.gripMesh.position.y = -0.077; rig.add(this.gripMesh);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.07), rubber); grip.position.set(0.07, -0.005, 0.01); rig.add(grip);
    const prism = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.06), body); prism.position.set(0, 0.07, 0); rig.add(prism);
    // Detalles del cuerpo: diales, disparador, zapata, pantalla superior y placa de marca
    const dial = (x, y, z, r, h, m) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m); d.position.set(x, y, z); rig.add(d); return d; };
    dial(-0.048, 0.058, 0.005, 0.013, 0.01, GEAR.rib()); dial(0.045, 0.058, 0.0, 0.011, 0.009, GEAR.rib()); dial(0.06, 0.06, -0.022, 0.007, 0.006, GEAR.metal());
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.005, 0.02), GEAR.metal()); shoe.position.set(0, 0.09, 0); rig.add(shoe);
    const topLcd = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.002, 0.018), new THREE.MeshStandardMaterial({ color: 0x0a1a10, emissive: 0x0f2a18, roughness: 0.2 })); topLcd.position.set(0.042, 0.0535, 0.012); rig.add(topLcd);
    const mount = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.004, 8, 28), GEAR.metal()); mount.position.set(0, -0.005, -0.043); rig.add(mount);
    const eyecup = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.012), rubber); eyecup.position.set(0, 0.07, 0.034); rig.add(eyecup);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 10).rotateX(Math.PI / 2), GEAR.matte()); b.position.set(0.06, 0.03 - i * 0.012, 0.051); rig.add(b); }
    // Pantalla trasera con la vista en vivo (pixelada)
    if (game.liveView) { const scr = game.liveView.makeScreen(0.088, 0.06); scr.position.set(-0.008, -0.004, 0.0515); rig.add(scr); scr.traverse((o) => { o.renderOrder = 11; }); }
    else this.needScreen = true;
    this.lensKey = null; this.lens = null;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.004), new THREE.MeshStandardMaterial({ color: 0x0b3d91, roughness: 0.8 })); strap.position.set(-0.08, -0.1, 0.03); rig.add(strap);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.32, 4, 10), sleeve); arm.rotation.x = Math.PI / 2 - 0.3; arm.rotation.z = s * 0.35; arm.position.set(s * 0.13, -0.13, 0.2); rig.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10).scale(0.9, 0.7, 1.3), skin); hand.position.set(s * 0.085, -0.03, s > 0 ? 0.01 : -0.06); rig.add(hand);
    }
    this.base = new THREE.Vector3(0.16, -0.165, -0.36); rig.position.copy(this.base); rig.rotation.set(-0.42, -0.2, 0.02); // al pecho, con la pantalla hacia los ojos
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
    this.sway = new THREE.Vector2(); this.lastYaw = 0; this.lastPitch = 0; this.t = 0;
  }
  setSkin(skin, shirt) { this.skinMat.color.set(skin); this.sleeveMat.color.set(shirt); }
  update(dt) {
    const cb = this.game.inventory.camera;
    if (cb && this.lastBody !== cb.id) { this.lastBody = cb.id; const lk = cb.look || { size: 1, color: '#151515' }; this.camMesh.scale.setScalar(lk.size); this.gripMesh.visible = !!lk.grip; this.bodyMat.color.set(lk.color); this.game.player.avatar.setCameraBody(lk); }
    const g = this.game, p = g.player, show = !g.drone?.active && g.follow.firstPerson && p.cameraEquipped && !g.photoMode.active && !g.ui.screen && g.state === 'play';
    this.root.visible = show; if (!show) return;
    const L = g.inventory.lens;
    if (L && this.lensKey !== L.id) { this.lensKey = L.id; if (this.lens) this.rig.remove(this.lens); this.lens = buildLens(L); this.lens.rotation.y = Math.PI; this.lens.position.set(0, -0.005, -0.043); this.lens.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } }); this.rig.add(this.lens); }
    if (this.needScreen && g.liveView) { this.needScreen = false; const scr = g.liveView.makeScreen(0.088, 0.06); scr.position.set(-0.008, -0.004, 0.0515); this.rig.add(scr); scr.traverse((o) => { o.renderOrder = 11; }); }
    const dy = g.follow.yaw - this.lastYaw, dp = g.follow.fpPitch - this.lastPitch; this.lastYaw = g.follow.yaw; this.lastPitch = g.follow.fpPitch;
    this.sway.x = damp(this.sway.x, -dy * 2.5, 8, dt); this.sway.y = damp(this.sway.y, dp * 2.5, 8, dt);
    this.t += dt * (p.speed > 0.3 ? 2 + p.speed : 0.6);
    const bob = Math.sin(this.t * 2) * 0.006 * (p.speed > 0.3 ? 1 : 0.3);
    this.rig.position.set(this.base.x + this.sway.x * 0.05, this.base.y + bob - this.sway.y * 0.04 - (p.speed > 5 ? 0.06 : 0), this.base.z);
  }
}
