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

// Puerta automática de vidrio: dos hojas transparentes que se deslizan hacia los lados.
// Solo se abre cuando el acceso está autorizado (después del control de seguridad) y alguien se acerca.
export class GlassSlidingDoor {
  constructor({ scene, collision, x, z, width = 4, height = 3, label = 'ACCESO DE PRENSA', signTexture = null }) {
    this.group = new THREE.Group(); this.group.position.set(x, 0, z); scene.add(this.group);
    this.pivot = this.group; this.width = width; this.height = height; this.label = label;
    this.isOpen = false; this.authorized = false; this.angle = 0; this.target = 0; this.watch = null; this.watchers = [];
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6ee, metalness: 0.15, roughness: 0.04, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide });
    const alu = new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.85, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.5, roughness: 0.4 });
    const frost = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false });
    const hw = width / 2;
    this.leaves = [];
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.06, height - 0.16, 0.02), glass); pane.position.set(0, height / 2, 0); pane.renderOrder = 2; leaf.add(pane);
      // Marco de aluminio de la hoja
      for (const yy of [0.04, height - 0.04]) { const b = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.08, 0.05), alu); b.position.y = yy; leaf.add(b); }
      for (const xx of [-hw / 2 + 0.03, hw / 2 - 0.03]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, 0.05), alu); b.position.set(xx, height / 2, 0); leaf.add(b); }
      // Franja esmerilada de seguridad (para que el vidrio se note) y jaladera vertical
      const band = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.08, 0.1, 0.024), frost); band.position.y = 1.5; leaf.add(band);
      const band2 = band.clone(); band2.position.y = 1.0; band2.scale.y = 0.5; leaf.add(band2);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8), alu); bar.position.set(-s * (hw / 2 - 0.12), 1.15, 0.05); leaf.add(bar);
      if (signTexture) { const lg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.2), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false })); lg.position.set(0, 1.5, 0.014); lg.renderOrder = 3; leaf.add(lg); const lg2 = lg.clone(); lg2.rotation.y = Math.PI; lg2.position.z = -0.014; leaf.add(lg2); }
      leaf.userData.side = s; leaf.userData.base = s * hw / 2; leaf.position.x = leaf.userData.base;
      this.group.add(leaf); this.leaves.push(leaf);
    }
    // Riel superior con sensor de movimiento y luz de estado
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 2 + 0.4, 0.22, 0.2), dark); rail.position.set(0, height + 0.11, -0.04); this.group.add(rail);
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.1), dark); sensor.position.set(0, height + 0.02, 0.1); this.group.add(sensor);
    this.light = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); this.light.position.set(0.1, height + 0.02, 0.16); this.group.add(this.light);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width * 2, 0.012, 0.12), alu); floor.position.set(0, 0.006, 0); this.group.add(floor);
    this.collider = collision.addCentered(x, z, width, 0.2, height); this.collider.tag = 'door';
    this.center = new THREE.Vector3(x, 1.2, z); this.pos = new THREE.Vector3(x, 0, z);
  }
  // Autoriza el paso; la puerta se abre sola al acercarse.
  open() { this.authorized = true; this.target = 1; this.light.material.color.set(0x33ff66); }
  lock() { this.authorized = false; this.light.material.color.set(0xff3030); }
  close() { this.target = 0; }
  update(dt) {
    if (this.authorized) {
      let near = false;
      for (const w of [this.watch, ...this.watchers]) if (w && Math.abs(w.x - this.pos.x) < this.width * 0.75 + 0.6 && Math.abs(w.z - this.pos.z) < 3.4) { near = true; break; }
      const was = this.target; this.target = near ? 1 : 0;
      if (this.target !== was) this.onToggle?.(this.target === 1);
    }
    // Movimiento con aceleración y frenado suave, como un operador automático
    this.angle = damp(this.angle, this.target, this.target ? 3.8 : 2.6, dt);
    for (const l of this.leaves) l.position.x = l.userData.base + l.userData.side * this.angle * (this.width / 2 - 0.05);
    this.isOpen = this.angle > 0.85;
    this.collider.enabled = this.angle < 0.7;
  }
}
