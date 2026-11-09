import * as THREE from 'three';
import { seededRandom } from '../core/MathUtil.js';

/*
 * Paisaje lejano del Valle Central: cordillera brumosa (la niebla le da perspectiva aérea)
 * y un valle urbano de casas con techos de zinc y teja, árboles y torres, todo instanciado.
 */
export class Scenery {
  constructor(game, center = new THREE.Vector3(), keepOut = 180) {
    this.group = new THREE.Group(); game.scene.add(this.group);
    const rnd = seededRandom(1234);
    this.mountains(rnd);
    this.game = game; this.valley(rnd, center, keepOut, false);
  }
  mountains(rnd) {
    const seg = 220, R = 1500, pos = [], col = [], idx = [];
    const ridge = (a) => {
      let h = 0; for (let k = 1; k <= 6; k++) h += Math.sin(a * k * 1.7 + k * 1.3 + Math.sin(a * k * 0.9) * 0.8) / k;
      return 120 + h * 70 + Math.max(0, Math.sin(a - 0.6)) * 260; // volcán más alto hacia el norte
    };
    const c0 = new THREE.Color(0x3c5546), c1 = new THREE.Color(0x6f8a78);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, h = Math.max(30, ridge(a) + (rnd() - 0.5) * 18);
      const r = R + Math.sin(a * 3.1) * 180;
      pos.push(Math.cos(a) * r, -20, Math.sin(a) * r, Math.cos(a) * r * 0.97, h, Math.sin(a) * r * 0.97);
      col.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
      if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    m.frustumCulled = false; this.group.add(m);
  }
  valley(rnd, center, keepOut, night) {
    const N = 2600, houses = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.85 }), N);
    const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 0.45, 4).rotateY(Math.PI / 4).translate(0, 0.22, 0), new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.3 }), N);
    const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x3f6b33 }), 1800);
    const d = new THREE.Object3D(), c = new THREE.Color();
    const walls = ['#e9d8a6', '#f4a261', '#a8dadc', '#ffffff', '#d8f3dc', '#ffd6a5', '#cdb4db', '#e0e0e0', '#b5e48c'];
    const roofC = ['#9a3412', '#b45309', '#8d99ae', '#9aa1a8', '#7f1d1d', '#a8adb3'];
    let n = 0, t = 0;
    // Zonas ocupadas por la ciudad: calle y plaza del estadio + la avenida hasta el barrio (con margen)
    const P = this.game.city?.P ?? 97, gz = this.game.city?.gz ?? 63;
    const busy = (x, z, m = 0) => (z > gz - 5 - m && z < P + 60 + m && x > -840 - m && x < 240 + m);
    let guard = 0;
    while (n < N && guard++ < N * 20) {
      const a = rnd() * Math.PI * 2, r = keepOut + 40 + Math.pow(rnd(), 0.7) * 1050;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      if (busy(x, z, 12)) continue; // la calle, la plaza y la avenida ya existen
      const w = 7 + rnd() * 9, dd = 7 + rnd() * 10, hgt = rnd() < 0.85 ? 3.5 + rnd() * 3 : 9 + rnd() * 22;
      d.position.set(x, 0, z); d.rotation.set(0, Math.round(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.2, 0); d.scale.set(w, hgt, dd); d.updateMatrix();
      houses.setMatrixAt(n, d.matrix); c.set(walls[Math.floor(rnd() * walls.length)]); if (night) c.multiplyScalar(0.5); houses.setColorAt(n, c);
      d.position.y = hgt; d.scale.set(w * 1.15, 2 + rnd() * 2, dd * 1.15); d.updateMatrix(); roofs.setMatrixAt(n, d.matrix); c.set(roofC[Math.floor(rnd() * roofC.length)]); roofs.setColorAt(n, c);
      n++;
      const tx = x + (rnd() - 0.5) * 20, tz = z + (rnd() - 0.5) * 20;
      if (t < 1800 && rnd() < 0.7 && !busy(tx, tz, 8)) { const s = 3 + rnd() * 5; d.position.set(tx, s * 0.9, tz); d.rotation.set(0, rnd() * 6, 0); d.scale.set(s, s * 0.8, s); d.updateMatrix(); trees.setMatrixAt(t++, d.matrix); }
    }
    trees.count = t; houses.count = n; roofs.count = n;
    for (const m of [houses, roofs, trees]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.receiveShadow = false; m.castShadow = false; m.frustumCulled = false; this.group.add(m); }
    // Luces de la ciudad de noche
    {
      const NP = 1600, pos = new Float32Array(NP * 3);
      for (let i = 0; i < NP; i++) { let x, z; do { const a = rnd() * Math.PI * 2, r = keepOut + 60 + rnd() * 1100; x = center.x + Math.cos(a) * r; z = center.z + Math.sin(a) * r; } while (busy(x, z, 10)); pos.set([x, 2 + rnd() * 8, z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd08a, size: 2.2, sizeAttenuation: false, fog: false }));
      this.group.add(pts); this.game.env.register(pts, 'visible', 0, 1);
    }
  }
  dispose() { this.group.parent?.remove(this.group); }
}
