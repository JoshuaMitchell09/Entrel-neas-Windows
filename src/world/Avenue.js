import * as THREE from 'three';
import * as TX from '../gfx/Textures.js';
import { stdMat } from '../characters/Humanoid.js';

/*
 * Ampliación de la ciudad: la avenida sigue ~600 m al oeste hasta el barrio donde vive el fotógrafo.
 * Materiales compartidos (pocas texturas) para que el fusionado de geometría deje pocos draw calls;
 * árboles y faroles en InstancedMesh.
 */
export const AVE_X0 = -170, AVE_X1 = -790, HOME_X = -752;
export const BUS_STOPS = [
  { x: HOME_X + 22, name: 'Barrio Los Ángeles' },
  { x: -560, name: 'Iglesia' },
  { x: -360, name: 'Mercado' },
  { x: -205, name: 'Parque' },
  { x: -48, name: 'Estadio' },
];
const PALETTE = ['#e9d8a6', '#f4a261', '#a8dadc', '#ffb4a2', '#d8f3dc', '#ffd6a5', '#caf0f8', '#e5989b', '#cdb4db', '#b5e48c', '#f1faee', '#d6ccc2'];

export function buildAvenue(city) {
  const g = city.group, col = city.col, P = city.P, rnd = city.rnd, env = city.game.env;
  const len = AVE_X0 - AVE_X1, cx = (AVE_X0 + AVE_X1) / 2;
  // Suelo, calzada, aceras y marcas
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(len + 300, 700), new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx - 100, -0.035, P); ground.receiveShadow = true; g.add(ground);
  const road = new THREE.MeshStandardMaterial({ map: TX.asphaltTexture([len / 11, 3]), roughness: env.wet ? 0.28 : 0.85 });
  city.plane(len, 12, road, cx, 0, P + 10);
  const walk = new THREE.MeshStandardMaterial({ map: TX.sidewalkTexture([len / 4.5, 2]), roughness: 0.9 });
  city.box(len, 0.15, 4, walk, cx, 0.075, P + 2, { cast: false }); city.box(len, 0.15, 4, walk, cx, 0.075, P + 18, { cast: false });
  col.add(AVE_X1, 0, P, AVE_X0, 0.15, P + 4, 'curb'); col.add(AVE_X1, 0, P + 16, AVE_X0, 0.15, P + 20, 'curb');
  const line = new THREE.MeshBasicMaterial({ color: 0xf2c94c });
  for (let x = AVE_X1 + 3; x < AVE_X0; x += 6) city.plane(3, 0.15, line, x, 0.012, P + 10);
  const white = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  for (const zx of [-300, -480, -640]) for (let i = 0; i < 8; i++) city.plane(0.6, 11, white, zx - 3.5 + i, 0.013, P + 10);
  // Materiales compartidos de edificios
  const walls = PALETTE.map((c, i) => { const m = new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture(c, 200 + i, { band: TX.shade(c, -40) }), roughness: 0.9 }); return m; });
  const winM = new THREE.MeshStandardMaterial({ map: TX.windowTexture(false), roughness: 0.2, metalness: 0.2, emissive: 0xffd28a, emissiveIntensity: 0, emissiveMap: TX.windowTexture(true) }); env.register(winM, 'emissiveIntensity', 0, 0.45);
  const doorM = stdMat('#4a3a2c', 0.6), roofM = new THREE.MeshStandardMaterial({ map: TX.zincRoofTexture([3, 1]), roughness: 0.5, metalness: 0.6 }), gateM = stdMat('#2b2b2b', 0.4, 0.7);
  const SIGNS = [['Pulpería La Amistad', '#2a9d8f'], ['Soda Doña Mari', '#f6d55c'], ['Verdulería El Huerto', '#2b9348'], ['Iglesia de San José', '#6d597a'], ['Mercado Municipal', '#bc6c25'], ['Taller El Pistón', '#495057'], ['Farmacia Santa Ana', '#2b9348'], ['Panadería Mi Tierra', '#bc6c25'], ['Escuela Central', '#1d3557'], ['Bar La Cantina', '#3a5a40'], ['Ferretería El Clavo', '#e76f51'], ['Salón de Belleza Glamour', '#d62828']];
  let si = 0;
  const building = (x, z, w, d, h, facing) => {
    const m = walls[Math.floor(rnd() * walls.length)];
    city.box(w, h, d, m, x, h / 2, z); col.addCentered(x, z, w, d, h);
    const fz = z + facing * (d / 2 + 0.02);
    for (let wx = x - w / 2 + 1.3; wx < x + w / 2 - 1; wx += 2.6) for (let fy = 1.7; fy < h - 0.8; fy += 3) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), winM); win.position.set(wx, fy, fz); if (facing < 0) win.rotation.y = Math.PI; g.add(win);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.3), doorM); door.position.set(x + (rnd() - 0.5) * (w - 3), 1.15, fz + facing * 0.01); if (facing < 0) door.rotation.y = Math.PI; g.add(door);
    if (rnd() < 0.35) { const [name, bg] = SIGNS[si++ % SIGNS.length]; const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.6, 6.5), 0.85), new THREE.MeshBasicMaterial({ map: TX.signTexture(name, bg, '#ffffff', 768, 110, 'bold 56px Georgia, serif') })); s.position.set(x, 3.0, fz + facing * 0.03); if (facing < 0) s.rotation.y = Math.PI; g.add(s); }
    if (h < 6 && rnd() < 0.6) { const e = city.box(w + 0.4, 0.06, 1.4, roofM, x, 3.2, z + facing * (d / 2 + 0.6)); e.rotation.x = facing * 0.15; }
  };
  // Lado norte (frente a la calle, mira hacia −z) y lado sur (mira hacia +z), dejando huecos de calles
  const gaps = [-300, -480, -640];
  for (const [zc, facing, depth] of [[P + 20.5 + 5, -1, 10], [P - 0.5 - 6, 1, 12]]) {
    for (let x = AVE_X0; x > AVE_X1 + 2;) {
      const w = 8 + Math.floor(rnd() * 9);
      const xc = x - w / 2;
      const nearGap = gaps.some((gx) => Math.abs(xc - gx) < w / 2 + 4);
      const home = facing > 0 && Math.abs(xc - HOME_X) < w / 2 + 9;
      const stop = facing > 0 && BUS_STOPS.some((b) => Math.abs(xc - b.x) < 3 && b.x < AVE_X0);
      if (nearGap) { // calle lateral cerrada al fondo
        city.box(8, 3, 0.3, walls[0], xc, 1.5, facing < 0 ? zc + depth / 2 : zc - depth / 2); col.addCentered(xc, facing < 0 ? zc + depth / 2 : zc - depth / 2, 8, 0.3, 3);
        city.plane(8, depth, road, xc, 0.002, zc);
      } else if (!home && !stop) {
        const h = rnd() < 0.25 ? 9 + rnd() * 6 : rnd() < 0.5 ? 6.5 : 4.2;
        building(xc, zc, w - 0.2, depth, h, facing);
      } else if (stop) building(xc, zc, w - 0.2, depth, 4.2, facing);
      x -= w;
    }
  }
  // Muro de cierre al oeste
  city.box(2, 6, 60, walls[1], AVE_X1 - 1, 3, P + 10); col.add(AVE_X1 - 2, 0, P - 25, AVE_X1, 8, P + 40);
  // Árboles y faroles (instanciados)
  const trees = [], lamps = [];
  const clear = (x) => Math.abs(x - HOME_X) < 16 || BUS_STOPS.some((b) => Math.abs(x - b.x) < 6);
  for (let x = AVE_X0 - 8; x > AVE_X1 + 5; x -= 18 + rnd() * 6) { if (!clear(x)) trees.push([x, P + 1.4 + rnd() * 0.4, 0.8 + rnd() * 0.4]); trees.push([x - 9, P + 18.6, 0.7 + rnd() * 0.4]); }
  for (let x = AVE_X0 - 12; x > AVE_X1 + 5; x -= 28) { if (!clear(x)) lamps.push([x, P + 3.6, 1]); lamps.push([x - 14, P + 16.4, -1]); }
  const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 3, 7); trunkG.translate(0, 1.5, 0);
  const crownG = new THREE.IcosahedronGeometry(1.8, 1); crownG.translate(0, 4.0, 0);
  const tTr = new THREE.InstancedMesh(trunkG, stdMat('#6b4f35', 0.9), trees.length), tCr = new THREE.InstancedMesh(crownG, stdMat('#2f6b2a', 0.85), trees.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  trees.forEach(([x, z, k], i) => { m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), s.set(k, k, k)); tTr.setMatrixAt(i, m4); tCr.setMatrixAt(i, m4); col.addCentered(x, z, 0.4, 0.4, 3); });
  tTr.castShadow = tCr.castShadow = true; g.add(tTr, tCr);
  const poleG = new THREE.CylinderGeometry(0.08, 0.1, 6, 6); poleG.translate(0, 3, 0);
  const headG = new THREE.BoxGeometry(0.4, 0.15, 0.6); headG.translate(0, 5.9, 1.2);
  const armG = new THREE.BoxGeometry(0.12, 0.1, 1.4); armG.translate(0, 6, 0.65);
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0 }); env.register(lampM, 'emissiveIntensity', 0, 2.5);
  const lp = new THREE.InstancedMesh(poleG, stdMat('#3a3f44', 0.5, 0.7), lamps.length), la = new THREE.InstancedMesh(armG, stdMat('#3a3f44', 0.5, 0.7), lamps.length), lh = new THREE.InstancedMesh(headG, lampM, lamps.length);
  lamps.forEach(([x, z, f], i) => { m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f > 0 ? 0 : Math.PI), s.set(1, 1, 1)); lp.setMatrixAt(i, m4); la.setMatrixAt(i, m4); lh.setMatrixAt(i, m4); col.addCentered(x, z, 0.25, 0.25, 6); });
  g.add(lp, la, lh);
  // Paradas de bus
  city.busStops = [];
  for (const b of BUS_STOPS) {
    const bz = P + 1.8, sign = TX.signTexture(`🚌 PARADA · ${b.name.toUpperCase()}`, '#1d3557', '#ffffff', 768, 96, 'bold 44px Arial');
    city.box(4, 0.08, 1.8, stdMat('#2b2d42', 0.5, 0.5), b.x, 2.6, bz); city.box(4, 2.5, 0.05, new THREE.MeshStandardMaterial({ map: TX.adTexture('ASCENSO TOTAL', '#0b3d91', '#ffffff', 'Todo el fútbol tico'), roughness: 0.4 }), b.x, 1.3, bz - 0.85);
    for (const sx of [-1.9, 1.9]) city.box(0.08, 2.6, 0.08, stdMat('#2b2d42', 0.5, 0.6), b.x + sx, 1.3, bz + 0.8);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.45), new THREE.MeshBasicMaterial({ map: sign })); sg.position.set(b.x, 2.85, bz + 0.92); g.add(sg);
    city.box(2.6, 0.06, 0.45, new THREE.MeshStandardMaterial({ map: TX.woodTexture(), roughness: 0.7 }), b.x, 0.48, bz - 0.5);
    col.addCentered(b.x, bz - 0.85, 4, 0.2, 2.6);
    city.busStops.push({ ...b, pos: new THREE.Vector3(b.x, 0, P + 2.6) });
  }
  // Casa del fotógrafo: dos pisos, cochera, portón y buzón
  const hx = HOME_X, hd = 14, hz = P - 4.5 - hd / 2, hw = 13, hh = 6.4;
  const houseM = new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture('#f2e8cf', 77, { band: '#bc6c25' }), roughness: 0.85 });
  city.box(hw, hh, hd, houseM, hx, hh / 2, hz); col.addCentered(hx, hz, hw, hd, hh);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.78, 2.4, 4, 1), stdMat('#9a3b2a', 0.7)); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, hd / hw); roof.position.set(hx, hh + 1.2, hz); roof.castShadow = true; g.add(roof);
  const fz = hz + hd / 2 + 0.02;
  const hdoor = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3), stdMat('#5a2e1a', 0.5)); hdoor.position.set(hx - 2.5, 1.15, fz); g.add(hdoor);
  const garage = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.5), new THREE.MeshStandardMaterial({ map: TX.zincRoofTexture([1, 3]), roughness: 0.5, metalness: 0.6 })); garage.position.set(hx + 3, 1.25, fz); g.add(garage);
  for (const wx of [hx - 4.8, hx - 0.2]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), winM); w.position.set(wx, 1.7, fz); g.add(w); }
  for (const wx of [hx - 4, hx, hx + 4]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), winM); w.position.set(wx, 4.6, fz); g.add(w); }
  // Muro con portón y jardín
  city.box(3.2, 1.2, 0.2, houseM, hx - 4.9, 0.6, P - 0.4); city.box(8.2, 1.2, 0.2, houseM, hx + 2.4, 0.6, P - 0.4);
  col.addCentered(hx - 4.9, P - 0.4, 3.2, 0.2, 1.2); col.addCentered(hx + 2.4, P - 0.4, 8.2, 0.2, 1.2);
  for (const sx of [-1, 1]) { city.box(0.2, 1.2, 4.2, houseM, hx + sx * 6.5, 0.6, P - 2.5); col.addCentered(hx + sx * 6.5, P - 2.5, 0.2, 4.2, 1.2); }
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 3.9), stdMat('#4f7a3a', 1)); lawn.rotation.x = -Math.PI / 2; lawn.position.set(hx, 0.01, P - 2.5); lawn.receiveShadow = true; g.add(lawn);
  const gate = city.box(1.6, 1.4, 0.06, gateM, hx - 2.5, 0.7, P - 0.35); gate.visible = false; // portón abierto (hueco para salir)
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: TX.signTexture('🏠 MI CASA', '#ffffff', '#1d3557', 512, 110, 'bold 56px Arial') })); plate.position.set(hx - 4.8, 1.5, P - 0.28); g.add(plate);
  city.spots.home = new THREE.Vector3(hx - 2.5, 0, P + 1.6);
  city.spots.homeCar = new THREE.Vector3(hx + 4, 0, P + 5.6);
  // Límites: no se puede salir por detrás de los edificios
  col.add(AVE_X1, 0, P - 26, AVE_X0, 12, P - 24); col.add(AVE_X1, 0, P + 36, AVE_X0, 12, P + 38);
}
