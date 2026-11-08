import * as THREE from 'three';
import { damp } from '../core/MathUtil.js';

// Registro de objetos interactivos. El jugador recibe un aviso contextual y pulsa E.
export class InteractionSystem {
  constructor(game) { this.game = game; this.items = []; this.current = null; }
  add(item) {
    item.enabled = item.enabled !== false; item.radius = item.radius || 2.2;
    item.position = item.position.clone ? item.position.clone() : new THREE.Vector3(item.position.x, item.position.y || 1, item.position.z);
    this.items.push(item); return item;
  }
  remove(item) { this.items = this.items.filter((i) => i !== item); }
  clear() { this.items = []; this.current = null; }
  update(playerPos, forward) {
    let best = null, bestScore = Infinity;
    for (const it of this.items) {
      if (!it.enabled) continue;
      const p = it.getPosition ? it.getPosition() : it.position;
      const dx = p.x - playerPos.x, dz = p.z - playerPos.z, d = Math.hypot(dx, dz);
      if (d > it.radius || Math.abs(p.y - playerPos.y - 1) > 2.5) continue;
      const facing = d > 0.01 ? (dx * forward.x + dz * forward.z) / d : 1;
      if (facing < -0.2 && d > 1.0) continue;
      const score = d - facing * 0.8;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    this.current = best;
    return best ? (typeof best.prompt === 'function' ? best.prompt(this.game) : best.prompt) : null;
  }
  interact() {
    if (this.current && this.current.enabled) { this.current.onInteract(this.game); return true; }
    return false;
  }
}

// Puerta con bisagra real y colisionador que se desactiva al abrirse.
export class Door {
  constructor({ scene, collision, x, z, width = 1.2, height = 2.2, axis = 'x', hingeSide = -1, mat, frameMat, label, openDir = 1, sliding = false }) {
    this.pivot = new THREE.Group();
    this.isOpen = false; this.angle = 0; this.target = 0; this.sliding = sliding; this.openDir = openDir;
    this.axis = axis; this.width = width;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.07), mat || new THREE.MeshStandardMaterial({ color: 0x6b4c34, roughness: 0.6 }));
    leaf.castShadow = true; leaf.receiveShadow = true;
    // La bisagra queda en el pivote; la hoja se desplaza medio ancho.
    leaf.position.set(-hingeSide * width / 2, height / 2, 0);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.3 }));
    handle.position.set(-hingeSide * (width - 0.12), 1.05, 0.06); this.pivot.add(handle);
    const handle2 = handle.clone(); handle2.position.z = -0.06; this.pivot.add(handle2);
    this.pivot.add(leaf); this.leaf = leaf;
    if (axis === 'x') this.pivot.position.set(x + hingeSide * width / 2, 0, z);
    else { this.pivot.position.set(x, 0, z + hingeSide * width / 2); this.pivot.rotation.y = Math.PI / 2; }
    this.baseRot = this.pivot.rotation.y; this.basePos = this.pivot.position.clone();
    scene.add(this.pivot);
    // Marco
    if (frameMat !== null) {
      const fm = frameMat || new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5, metalness: 0.4 });
      const fg = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.16, 0.1, 0.16), fm); top.position.y = height + 0.05; fg.add(top);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, 0.16), fm); p.position.set(s * (width / 2 + 0.04), height / 2, 0); fg.add(p); }
      fg.position.set(x, 0, z); if (axis !== 'x') fg.rotation.y = Math.PI / 2; scene.add(fg);
    }
    this.collider = axis === 'x' ? collision.addCentered(x, z, width, 0.2, height) : collision.addCentered(x, z, 0.2, width, height);
    this.collider.tag = 'door';
    this.label = label;
    this.center = new THREE.Vector3(x, 1.2, z);
  }
  open() { this.isOpen = true; this.target = 1; this.collider.enabled = false; }
  close() { this.isOpen = false; this.target = 0; this.collider.enabled = true; }
  update(dt) {
    this.angle = damp(this.angle, this.target, 5, dt);
    if (this.sliding) {
      const off = this.angle * this.width * this.openDir;
      if (this.axis === 'x') this.pivot.position.x = this.basePos.x + off; else this.pivot.position.z = this.basePos.z + off;
    } else this.pivot.rotation.y = this.baseRot + this.angle * 1.6 * this.openDir;
  }
}
