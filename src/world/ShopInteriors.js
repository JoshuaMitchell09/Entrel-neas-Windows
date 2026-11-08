import * as THREE from 'three';
import * as TX from '../gfx/Textures.js';
import { stdMat } from '../characters/Humanoid.js';

/*
 * Locales con interior real (pulpería, soda y bar): se entra caminando, sin pantallas de carga.
 * Cada local tiene paredes con vano de puerta y vitrina, mostrador, estantes llenos de productos
 * (un InstancedMesh por local), refri con bebidas, dependiente y una luz compartida que sigue al jugador.
 */
export const SHOP_KINDS = {
  pulperia: { name: 'Pulpería El Carmen', bg: '#2a9d8f', fg: '#ffffff', wall: '#f4a261', inner: '#f3e6c8', floor: ['#b84a3a', '#d8c7a8'] },
  soda: { name: 'Soda La Bendición', bg: '#f6d55c', fg: '#7a2e00', wall: '#e9d8a6', inner: '#fdf0d5', floor: ['#e8e2d4', '#c9c0ac'] },
  bar: { name: 'Bar El Higuerón', bg: '#3a5a40', fg: '#dad7cd', wall: '#a3b18a', inner: '#5b4636', floor: ['#4a3a2c', '#3a2c20'] },
};
const PRODUCT_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d', '#ffb703', '#8ecae6', '#d62828', '#06d6a0', '#ef476f', '#ffd166', '#118ab2', '#f15bb5', '#9b5de5'];

export function buildShopInterior(city, kind, x, z, w, d, h, wallMat) {
  const K = SHOP_KINDS[kind], g = city.group, col = city.col, rnd = city.rnd;
  const t = 0.25, Hc = 3.3, front = z + d / 2, back = z - d / 2, L = x - w / 2, R = x + w / 2;
  const doorX = x - w * 0.18, doorW = 1.8, doorH = 2.6;
  const box = (bw, bh, bd, mat, bx, by, bz, o = {}) => city.box(bw, bh, bd, mat, bx, by, bz, o);
  const innerM = new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture(K.inner, 12, { band: TX.shade(K.inner, -35) }), roughness: 0.9 }); innerM.map.repeat.set(w / 5, 1);
  // ---- Cáscara: paredes trasera y laterales, losa, piso y cielorraso ----
  box(w, h, t, wallMat, x, h / 2, back + t / 2); col.addCentered(x, back + t / 2, w, t, h);
  for (const sx of [L + t / 2, R - t / 2]) { box(t, h, d, wallMat, sx, h / 2, z); col.addCentered(sx, z, t, d, h); }
  box(w, 0.3, d, wallMat, x, h - 0.15, z, { cast: true });
  // Revestimiento interior (otro color que la fachada)
  const ib = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * t, Hc), innerM); ib.position.set(x, Hc / 2, back + t + 0.01); g.add(ib);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(d - t, Hc), innerM); p.rotation.y = s * Math.PI / 2 * -1; p.position.set(s < 0 ? L + t + 0.01 : R - t - 0.01, Hc / 2, z); p.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(p); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * t, d - t), new THREE.MeshStandardMaterial({ map: TX.tileTexture(K.floor[0], K.floor[1], [w / 1.2, d / 1.2]), roughness: kind === 'bar' ? 0.7 : 0.45 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(x, 0.012, z); floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * t, d - t), stdMat(kind === 'bar' ? '#2b211a' : '#f2efe8', 0.9)); ceil.rotation.x = Math.PI / 2; ceil.position.set(x, Hc, z); g.add(ceil);
  col.add(L, Hc, back, R, Hc + 0.3, front, 'nostand');
  // Lámparas (emisivas) del cielorraso
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: kind === 'bar' ? 0xffb36b : 0xfff3dc, emissiveIntensity: kind === 'bar' ? 1.2 : 1.8 });
  for (let k = -1; k <= 1; k += 2) box(kind === 'bar' ? 0.35 : 1.2, 0.05, kind === 'bar' ? 0.35 : 0.25, lampM, x + k * w * 0.2, Hc - 0.03, z, { cast: false, receive: false });
  // ---- Fachada: zócalo + vitrina de vidrio + dintel, con vano de puerta ----
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd9e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const frameM = stdMat('#3a3f45', 0.4, 0.7);
  const segs = [[L, doorX - doorW / 2], [doorX + doorW / 2, R]];
  for (const [a, b] of segs) {
    const sw = b - a, cx = (a + b) / 2; if (sw < 0.05) continue;
    box(sw, 0.9, t, wallMat, cx, 0.45, front - t / 2); col.addCentered(cx, front - t / 2, sw, t, 2.6);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.2, 1.65), glass); gl.position.set(cx, 0.9 + 0.83, front - t / 2); gl.renderOrder = 2; g.add(gl);
    box(sw, 0.06, t + 0.04, frameM, cx, 0.92, front - t / 2, { cast: false }); box(0.06, 1.7, t + 0.04, frameM, a + 0.05, 1.75, front - t / 2, { cast: false }); box(0.06, 1.7, t + 0.04, frameM, b - 0.05, 1.75, front - t / 2, { cast: false });
  }
  box(w, h - doorH, t, wallMat, x, doorH + (h - doorH) / 2, front - t / 2); col.add(L, doorH, front - t, R, h, front, 'nostand');
  // Marco de la puerta (abierta, con cortina de tiritas en la pulpería)
  box(0.08, doorH, t + 0.06, frameM, doorX - doorW / 2, doorH / 2, front - t / 2, { cast: false }); box(0.08, doorH, t + 0.06, frameM, doorX + doorW / 2, doorH / 2, front - t / 2, { cast: false });
  // Tapete
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), stdMat('#3b2f2a', 1)); mat.rotation.x = -Math.PI / 2; mat.position.set(doorX, 0.02, front - 0.8); g.add(mat);
  // ---- Mobiliario según el tipo de local ----
  const items = [];   // productos instanciados: [x, y, z, sx, sy, sz, color]
  const wood = new THREE.MeshStandardMaterial({ map: TX.woodTexture(), roughness: 0.6 });
  const shelfM = kind === 'bar' ? wood : stdMat('#d9d9d9', 0.5, 0.6);
  const cz = back + d * 0.36; // línea del mostrador
  const cW = Math.min(w - 2.4, 5.2), cX = x + w * 0.12;
  // Mostrador
  box(cW, 1.0, 0.7, kind === 'bar' ? wood : stdMat('#f2f2f2', 0.5), cX, 0.5, cz, { cast: true });
  box(cW + 0.1, 0.05, 0.8, kind === 'bar' ? stdMat('#2a1c12', 0.35) : wood, cX, 1.02, cz, { cast: false });
  col.addCentered(cX, cz, cW, 0.7, 1.05, 0, 'nostand');
  // Estantes detrás del mostrador (pared trasera)
  const shelfW = Math.min(w - 1.2, 6.4), shelfX = cX;
  for (let lv = 0; lv < 5; lv++) {
    const y = 0.35 + lv * 0.45;
    box(shelfW, 0.04, 0.42, shelfM, shelfX, y, back + t + 0.24, { cast: false });
    for (let px = shelfX - shelfW / 2 + 0.14; px < shelfX + shelfW / 2 - 0.1; px += kind === 'bar' ? 0.16 : 0.2 + rnd() * 0.08) {
      if (rnd() < 0.08) continue;
      const c = PRODUCT_COLORS[Math.floor(rnd() * PRODUCT_COLORS.length)];
      if (kind === 'bar') items.push([px, y + 0.17, back + t + 0.22, 0.07, 0.32, 0.07, rnd() < 0.5 ? '#2d5a27' : rnd() < 0.5 ? '#6b3a1a' : '#c9c9c9', 1]);
      else items.push([px, y + 0.12, back + t + 0.22, 0.14 + rnd() * 0.06, 0.18 + rnd() * 0.08, 0.12, c, rnd() < 0.3 ? 1 : 0]);
    }
  }
  col.addCentered(shelfX, back + t + 0.24, shelfW, 0.45, 2.4);
  // Refri de bebidas con puerta de vidrio e iluminación interna
  const fx = L + t + 0.55, fz = back + t + 0.45;
  if (kind !== 'bar' || true) {
    box(1.0, 2.0, 0.8, stdMat(kind === 'pulperia' ? '#c8102e' : '#e8e8e8', 0.4, 0.3), fx + 0.1, 1.0, fz + 0.15);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.75), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 1.1 })); inside.position.set(fx + 0.1, 1.0, fz + 0.2); g.add(inside);
    for (let lv = 0; lv < 4; lv++) for (let k = 0; k < 5; k++) items.push([fx - 0.22 + k * 0.16, 0.38 + lv * 0.42, fz + 0.38, 0.065, 0.24, 0.065, ['#b3001b', '#b3001b', '#f77f00', '#2a9d8f', '#4cc9f0', '#3a2a1a'][Math.floor(rnd() * 6)], 1]);
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.85), glass); fg.position.set(fx + 0.1, 1.0, fz + 0.56); fg.renderOrder = 2; g.add(fg);
    col.addCentered(fx + 0.1, fz + 0.15, 1.0, 0.8, 2.0);
  }
  if (kind === 'pulperia') {
    // Góndola central con bolsas de papas y confites, frascos de vidrio en el mostrador, rótulo de ofertas
    const gx = x - w * 0.12, gz2 = z + d * 0.12;
    for (let lv = 0; lv < 3; lv++) {
      box(2.4, 0.04, 0.7, shelfM, gx, 0.3 + lv * 0.5, gz2, { cast: false });
      for (let k = 0; k < 9; k++) for (const sz2 of [-0.18, 0.18]) items.push([gx - 1.05 + k * 0.26, 0.3 + lv * 0.5 + 0.16, gz2 + sz2, 0.2, 0.28, 0.07, PRODUCT_COLORS[Math.floor(rnd() * PRODUCT_COLORS.length)], 0]);
    }
    box(0.05, 1.4, 0.7, shelfM, gx - 1.2, 0.7, gz2); box(0.05, 1.4, 0.7, shelfM, gx + 1.2, 0.7, gz2);
    col.addCentered(gx, gz2, 2.5, 0.75, 1.5);
    const jarM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
    for (let k = 0; k < 4; k++) { const jx = cX - cW / 2 + 0.4 + k * 0.42; const j = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14), jarM); j.position.set(jx, 1.2, cz + 0.1); j.renderOrder = 2; g.add(j); items.push([jx, 1.14, cz + 0.1, 0.17, 0.16, 0.17, PRODUCT_COLORS[(k * 3) % PRODUCT_COLORS.length], 1]); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: TX.signTexture('¡HAY PAN\nFRESCO!', '#fff8e1', '#c8102e', 512, 256, 'bold 64px Arial') })); sign.position.set(R - t - 0.02, 2.2, z + 0.5); sign.rotation.y = -Math.PI / 2; g.add(sign);
  }
  const seats = [];
  if (kind === 'soda' || kind === 'bar') {
    // Mesas con sillas
    const tables = kind === 'soda' ? [[x - w * 0.22, z + d * 0.2], [x + w * 0.2, z + d * 0.22], [x - w * 0.22, z - d * 0.02]] : [[x - w * 0.24, z + d * 0.22], [x + w * 0.22, z + d * 0.24]];
    const topM = kind === 'soda' ? stdMat('#e9ecef', 0.4) : wood, legM = stdMat('#555', 0.5, 0.6);
    for (const [tx, tz] of tables) {
      box(1.0, 0.05, 1.0, topM, tx, 0.76, tz, { cast: true }); box(0.07, 0.74, 0.07, legM, tx, 0.37, tz, { cast: false });
      col.addCentered(tx, tz, 1.0, 1.0, 0.8, 0, 'nostand');
      for (const [sx, sz, yaw] of [[-0.75, 0, Math.PI / 2], [0.75, 0, -Math.PI / 2]]) {
        box(0.42, 0.05, 0.42, legM, tx + sx, 0.46, tz + sz, { cast: false }); box(0.42, 0.5, 0.05, legM, tx + sx * 1.22, 0.72, tz + sz, { cast: false, ry: Math.PI / 2 });
        seats.push({ pos: new THREE.Vector3(tx + sx, 0, tz + sz), yaw });
      }
      if (kind === 'soda') { items.push([tx - 0.15, 0.82, tz, 0.22, 0.04, 0.22, '#ffffff', 0]); items.push([tx + 0.2, 0.84, tz + 0.1, 0.07, 0.1, 0.07, '#5a3a1a', 1]); }
      else items.push([tx, 0.88, tz, 0.07, 0.2, 0.07, '#e8b84a', 1]);
    }
    // Pizarra de menú (soda) o tele con el partido (bar)
    if (kind === 'soda') {
      const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.2), new THREE.MeshBasicMaterial({ map: TX.signTexture('MENÚ\nCasado ₡3 800\nGallo pinto ₡2 800\nEmpanada ₡900\nFresco ₡1 000', '#1f2a1f', '#f1faee', 512, 320, 'bold 38px Arial') }));
      menu.position.set(L + t + 0.02, 2.0, z + 0.6); menu.rotation.y = Math.PI / 2; g.add(menu);
    } else {
      const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshStandardMaterial({ map: TX.signTexture('⚽ EN VIVO\nLIGA TICA', '#0a7a3a', '#ffffff', 512, 288, 'bold 56px Arial'), emissive: 0xffffff, emissiveIntensity: 0.9 }));
      tv.material.emissiveMap = tv.material.map; tv.position.set(R - t - 0.06, 2.3, z + 0.3); tv.rotation.y = -Math.PI / 2; g.add(tv);
      box(0.08, 1.0, 1.7, stdMat('#111', 0.4), R - t - 0.02, 2.3, z + 0.3, { cast: false });
      // Bancos altos frente a la barra
      for (let k = 0; k < 4; k++) { const sx = cX - cW / 2 + 0.5 + k * (cW - 1) / 3; box(0.36, 0.06, 0.36, stdMat('#8a1c1c', 0.6), sx, 0.78, cz + 0.75, { cast: false }); box(0.06, 0.76, 0.06, legM, sx, 0.38, cz + 0.75, { cast: false }); seats.push({ pos: new THREE.Vector3(sx, 0.3, cz + 0.75), yaw: Math.PI, bar: true }); }
    }
  }
  // Rótulo de horario en la vitrina
  const hours = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTexture(kind === 'bar' ? 'ABIERTO\n4 pm – 12 am' : 'ABIERTO\n6 am – 9 pm', '#ffffff', '#c8102e', 256, 160, 'bold 36px Arial'), transparent: true }));
  hours.position.set(doorX + doorW / 2 + 0.6, 1.6, front + 0.005); g.add(hours);
  // ---- Productos: un solo draw call por local ----
  const geo = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  for (const [geom, flag] of [[geo, 0], [cyl, 1]]) {
    const list = items.filter((it) => it[7] === flag); if (!list.length) continue;
    const im = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({ roughness: flag ? 0.25 : 0.55, metalness: flag ? 0.2 : 0 }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach((it, i) => { m4.compose(new THREE.Vector3(it[0], it[1], it[2]), q, new THREE.Vector3(it[3], it[4], it[5])); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(it[6])); });
    im.castShadow = false; im.receiveShadow = true; g.add(im);
  }
  return {
    kind, name: K.name, center: new THREE.Vector3(x, 0, z), door: new THREE.Vector3(doorX, 0, front),
    bounds: { x0: L, x1: R, z0: back, z1: front },
    counter: new THREE.Vector3(cX, 1.0, cz + 0.9), keeper: new THREE.Vector3(cX, 0, cz - 0.75), keeperYaw: 0, seats,
    lightPos: new THREE.Vector3(x, Hc - 0.4, z), warm: kind === 'bar',
  };
}
