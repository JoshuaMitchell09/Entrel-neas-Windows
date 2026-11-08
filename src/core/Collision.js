// Mundo de colisiones basado en AABB. Suficiente para personajes, puertas y cámara.
export const SEE_THROUGH = new Set(['curb', 'goal']);
export class CollisionWorld {
  constructor() { this.boxes = []; this.cellSize = 16; this.grid = new Map(); this.dirty = true; }
  add(minX, minY, minZ, maxX, maxY, maxZ, tag = 'solid') {
    const b = { minX, minY, minZ, maxX, maxY, maxZ, tag, enabled: true };
    this.boxes.push(b); this.dirty = true; return b;
  }
  // Caja centrada (cx, cz) con tamaño (sx, sz) y altura h desde y0.
  addCentered(cx, cz, sx, sz, h = 3, y0 = 0, tag) {
    return this.add(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + h, cz + sz / 2, tag);
  }
  // Caja orientada con rotación en Y aproximada mediante su AABB envolvente (para objetos pequeños).
  addRotated(cx, cz, sx, sz, rotY, h = 3, y0 = 0, tag) {
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    return this.addCentered(cx, cz, sx * c + sz * s, sx * s + sz * c, h, y0, tag);
  }
  rebuild() {
    this.grid.clear();
    const cs = this.cellSize;
    this.boxes.forEach((b, i) => {
      for (let x = Math.floor(b.minX / cs); x <= Math.floor(b.maxX / cs); x++)
        for (let z = Math.floor(b.minZ / cs); z <= Math.floor(b.maxZ / cs); z++) {
          const k = x + ',' + z;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(b);
        }
    });
    this.dirty = false;
  }
  query(x, z, r) {
    if (this.dirty) this.rebuild();
    const cs = this.cellSize, out = new Set();
    for (let gx = Math.floor((x - r) / cs); gx <= Math.floor((x + r) / cs); gx++)
      for (let gz = Math.floor((z - r) / cs); gz <= Math.floor((z + r) / cs); gz++) {
        const cell = this.grid.get(gx + ',' + gz);
        if (cell) for (const b of cell) if (b.enabled) out.add(b);
      }
    return out;
  }
  // Altura del suelo bajo un punto considerando cajas sobre las que se puede pisar.
  groundHeight(x, z, y, r, step = 0.35) {
    let g = 0;
    for (const b of this.query(x, z, r)) {
      if (b.tag === 'nostand') continue;
      if (x + r * 0.5 > b.minX && x - r * 0.5 < b.maxX && z + r * 0.5 > b.minZ && z - r * 0.5 < b.maxZ) {
        if (b.maxY <= y + step && b.maxY > g) g = b.maxY;
      }
    }
    return g;
  }
  // Resuelve un círculo (personaje) contra las cajas en XZ. Devuelve posición corregida.
  resolveCircle(pos, r, height = 1.8, step = 0.35) {
    for (let iter = 0; iter < 3; iter++) {
      for (const b of this.query(pos.x, pos.z, r + 0.5)) {
        if (b.maxY <= pos.y + step || b.minY >= pos.y + height) continue;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        } else {
          // Centro dentro de la caja: empujar por el eje de menor penetración.
          const pen = [pos.x - b.minX + r, b.maxX - pos.x + r, pos.z - b.minZ + r, b.maxZ - pos.z + r];
          const m = Math.min(...pen), i = pen.indexOf(m);
          if (i === 0) pos.x -= m; else if (i === 1) pos.x += m; else if (i === 2) pos.z -= m; else pos.z += m;
        }
      }
    }
    return pos;
  }
  // Rayo contra cajas (método slab). Devuelve distancia del primer impacto o Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxDist, ignore) {
    let best = maxDist;
    const inv = [1 / dx, 1 / dy, 1 / dz];
    const skip = ignore ? (typeof ignore === 'string' ? (t) => t === ignore : (t) => ignore.has(t)) : () => false;
    for (const b of this.boxes) {
      if (!b.enabled || skip(b.tag)) continue;
      let t1 = (b.minX - ox) * inv[0], t2 = (b.maxX - ox) * inv[0];
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.minY - oy) * inv[1]; t2 = (b.maxY - oy) * inv[1];
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.minZ - oz) * inv[2]; t2 = (b.maxZ - oz) * inv[2];
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(0, tmin) && tmin < best && tmax > 0) best = Math.max(0, tmin);
    }
    return best;
  }
}
