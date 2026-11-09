import * as THREE from 'three';
import * as TX from '../gfx/Textures.js';
import { stdMat } from '../characters/Humanoid.js';
import { seededRandom } from '../core/MathUtil.js';
import { mergeStatic } from '../gfx/Merge.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildShopInterior, SHOP_KINDS } from './ShopInteriors.js';
import { buildAvenue, AVE_X1 } from './Avenue.js';

const SHOPS = [
  ['Soda La Bendición', '#f6d55c', '#7a2e00', '#e9d8a6'], ['Pulpería El Carmen', '#2a9d8f', '#ffffff', '#f4a261'],
  ['Ferretería La Económica', '#e76f51', '#ffffff', '#e9c46a'], ['Bazar Dulce Hogar', '#8ecae6', '#023047', '#ffb4a2'],
  ['Farmacia San Rafael', '#2b9348', '#ffffff', '#d8f3dc'], ['Barbería El Crack', '#1d3557', '#f1faee', '#a8dadc'],
  ['Panadería La Espiga', '#bc6c25', '#fefae0', '#ffd6a5'], ['Cevichera El Puerto', '#0077b6', '#ffffff', '#caf0f8'],
  ['Tienda Gol Tico', '#d00000', '#ffffff', '#ffd60a'], ['Bar El Higuerón', '#3a5a40', '#dad7cd', '#a3b18a'],
  ['Librería El Estudiante', '#6d597a', '#ffffff', '#e5989b'], ['Taller Hnos. Mora', '#495057', '#ffd60a', '#adb5bd'],
];
const HOUSE_COLORS = ['#e9d8a6', '#f4a261', '#a8dadc', '#ffb4a2', '#d8f3dc', '#ffd6a5', '#caf0f8', '#e5989b', '#cdb4db', '#fefae0', '#b5e48c', '#f9c74f'];
const CAR_COLORS = ['#c0c0c0', '#1d3557', '#e63946', '#f1faee', '#2a2a2a', '#457b9d', '#8d99ae', '#ffb703', '#6a994e', '#9a031e'];

export class City {
  constructor(game, gateZ) {
    this.game = game; this.col = game.collision; this.group = new THREE.Group(); game.scene.add(this.group);
    this.gz = gateZ; this.P = gateZ + 34; // borde sur de la acera sur
    this.rnd = seededRandom(42);
    this.cars = []; this.spots = {}; this.lamps = []; this.vendorSpots = []; this.shops = [];
    this.night = game.env.time === 'night';
    this.buildGround(); this.buildStreet(); this.buildBuildings(); buildAvenue(this); this.buildPlaza(); this.buildParking(); this.buildProps(); this.buildCars(); this.bounds();
    // Luz compartida de interiores (se crea desde el inicio para no recompilar materiales al entrar)
    if (this.shops.length) { this.shopLight = new THREE.PointLight(0xfff0d8, 0, 13, 1.4); this.group.add(this.shopLight); }
    for (const c of this.cars) c.obj.userData.noMerge = true;
    this.merged = mergeStatic(this.group, 300);
  }
  box(w, h, d, mat, x, y, z, { cast = true, receive = true, ry = 0, parent = this.group } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
  }
  plane(w, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; this.group.add(m); return m; }
  buildGround() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 1 }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.03; g.receiveShadow = true; this.group.add(g);
  }
  buildStreet() {
    const P = this.P;
    const sn = TX.noiseNormalMap('concrete', 256, 10, 2.5, 11).clone(); sn.needsUpdate = true; sn.repeat.set(80, 2);
    const walk = new THREE.MeshStandardMaterial({ map: TX.sidewalkTexture([75, 2]), normalMap: sn, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.9 });
    const walk2 = new THREE.MeshStandardMaterial({ map: TX.sidewalkTexture([75, 2]), roughness: 0.9 });
    const an = TX.noiseNormalMap('asphalt', 256, 32, 3, 21, true).clone(); an.needsUpdate = true; an.repeat.set(60, 3);
    const road = new THREE.MeshStandardMaterial({ map: TX.asphaltTexture([30, 3]), normalMap: an, normalScale: new THREE.Vector2(0.7, 0.7), roughness: this.game.env.wet ? 0.28 : 0.85 });
    this.plane(340, 12, road, 0, 0.0, P + 10);
    // Aceras con cordón (bordillo) de 15 cm
    const sw = this.box(340, 0.15, 4, walk, 0, 0.075, P + 2, { cast: false }); sw.material = walk;
    this.box(340, 0.15, 4, walk2, 0, 0.075, P + 18, { cast: false });
    this.col.add(-170, 0, P, 170, 0.15, P + 4, 'curb'); this.col.add(-170, 0, P + 16, 170, 0.15, P + 20, 'curb');
    // Marcas viales
    const line = new THREE.MeshBasicMaterial({ color: 0xf2c94c });
    for (let x = -168; x < 168; x += 6) { const l = this.plane(3, 0.15, line, x, 0.012, P + 10); }
    const white = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    for (let i = 0; i < 8; i++) this.plane(0.6, 11, white, -3.5 + i * 1, 0.013, P + 10); // paso peatonal (zebra)
    this.spots.crosswalk = new THREE.Vector3(0, 0, P + 10);
  }
  building(x, z, w, d, h, facing, shop, color, interior = null) {
    const env = this.game.env;
    // facing: +1 la fachada mira hacia +z ; -1 hacia -z
    // Materiales compartidos (por color) para que la geometría se fusione en pocos draw calls
    const wallMat = this.carMat('wall' + color, () => { const m = new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture(color, color.length * 7 + color.charCodeAt(2), { band: TX.shade(color, -40) }), roughness: 0.9 }); m.map.repeat.set(2, 1); return m; });
    const fz = z + facing * (d / 2 + 0.01);
    let b = null;
    if (interior) this.shops.push(buildShopInterior(this, interior, x, z, w, d, h, wallMat));
    else { b = this.box(w, h, d, wallMat, x, h / 2, z); this.col.addCentered(x, z, w, d, h); }
    // Alero de zinc
    const roofM = this.carMat('zinc', () => new THREE.MeshStandardMaterial({ map: TX.zincRoofTexture([4, 1]), roughness: 0.5, metalness: 0.6 }));
    const eave = this.box(w + 0.6, 0.06, 1.6, roofM, x, h * 0.55 > 3.2 ? 3.2 : h * 0.55, z + facing * (d / 2 + 0.75)); eave.rotation.x = facing * 0.18;
    for (const s of [-1, 1]) this.box(0.08, 3.1, 0.08, stdMat('#333333', 0.5, 0.6), x + s * (w / 2 - 0.1), 1.55, z + facing * (d / 2 + 1.45), { cast: true });
    // Puerta y ventanas con verjas
    const lit = this.rnd() > 0.3;
    const winM = this.carMat(lit ? 'winLit' : 'winDark', () => { const m = new THREE.MeshStandardMaterial({ map: TX.windowTexture(false), roughness: 0.2, metalness: 0.2, emissive: 0xffd28a, emissiveIntensity: 0, emissiveMap: TX.windowTexture(true) }); if (lit) env.register(m, 'emissiveIntensity', 0, 0.45); return m; });
    const doorM = stdMat(TX.shade(color, -70), 0.6);
    const doorX = x + (this.rnd() - 0.5) * (w - 3);
    if (!interior) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), shop ? this.carMat('shopDoor', () => new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.3, metalness: 0.5 })) : doorM);
      door.position.set(doorX, 1.2, fz + facing * 0.01); if (facing < 0) door.rotation.y = Math.PI; this.group.add(door);
    }
    for (let wx = x - w / 2 + 1.2; wx < x + w / 2 - 1; wx += 2.4) {
      if (!interior && Math.abs(wx - doorX) < 1.6) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), winM); win.position.set(wx, interior ? 4.6 : 1.6, fz + facing * 0.02); if (facing < 0) win.rotation.y = Math.PI;
      if (!interior || h > 5) this.group.add(win);
      if (!interior && h > 5) { const w2 = win.clone(); w2.position.y = 4.6; this.group.add(w2); }
    }
    if (shop) {
      const [name, bg, fg] = shop;
      const signM = new THREE.MeshStandardMaterial({ map: TX.signTexture(name, bg, fg, 768, 110, 'bold 60px Georgia, serif', fg), emissive: 0xffffff, emissiveIntensity: 0 }); signM.emissiveMap = signM.map; env.register(signM, 'emissiveIntensity', 0, 0.25);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.6, 7), 0.9), signM);
      sign.position.set(x, interior ? 3.05 : 2.75, fz + facing * 0.04); if (facing < 0) sign.rotation.y = Math.PI; this.group.add(sign);
    }
    // Tanque/antena en el techo
    if (this.rnd() > 0.5) this.box(1.2, 1.2, 1.2, stdMat('#2f4f6f', 0.6), x + (this.rnd() - 0.5) * w * 0.6, h + 0.6, z);
    if (interior) return null;
    return b;
  }
  buildBuildings() {
    const P = this.P; let si = 0;
    // Lado norte (frente al estadio): fila continua
    for (let x = -165; x < 165;) {
      const w = 8 + Math.floor(this.rnd() * 8), h = this.rnd() > 0.7 ? 7 : 4.2, d = 10;
      const shop = this.rnd() > 0.35 ? SHOPS[si++ % SHOPS.length] : null;
      this.building(x + w / 2, P + 20 + 0.5 + d / 2, w - 0.2, d, h, -1, shop, shop ? shop[3] : HOUSE_COLORS[Math.floor(this.rnd() * HOUSE_COLORS.length)]);
      x += w;
    }
    // Lado sur: edificios a ambos lados de la plaza
    for (const side of [-1, 1]) {
      // Del lado oeste (por donde llega el fotógrafo) los primeros locales tienen interior y se puede entrar
      const kinds = side < 0 ? ['bar', 'pulperia', 'soda'] : [];
      for (let x = 62; x < 165;) {
        const kind = kinds.length && x > 66 ? kinds.shift() : null;
        let w = 8 + Math.floor(this.rnd() * 7); const h = this.rnd() > 0.6 ? 7 : 4.2, d = 12;
        let shop = this.rnd() > 0.3 ? SHOPS[si++ % SHOPS.length] : null;
        if (kind) { w = Math.max(w, 11); const K = SHOP_KINDS[kind]; shop = [K.name, K.bg, K.fg, K.wall]; }
        this.building(side * (x + w / 2), P - 0.5 - d / 2, w - 0.2, d, h, 1, shop, shop ? shop[3] : HOUSE_COLORS[Math.floor(this.rnd() * HOUSE_COLORS.length)], kind);
        x += w;
      }
    }
  }
  buildPlaza() {
    const gz = this.gz, P = this.P;
    const pav = new THREE.MeshStandardMaterial({ map: TX.brickTexture([30, 8]), roughness: 0.85, color: 0xd8d0c8 });
    this.plane(124, P - gz, pav, 0, 0.005, (gz + P) / 2);
    // Muros laterales de la plaza (separan de los lotes vecinos)
    const wallM = new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture('#d9d2c3', 77), roughness: 0.9 });
    for (const s of [-1, 1]) { this.box(0.4, 2.4, P - gz - 12, wallM, s * 62, 1.2, gz + (P - gz - 12) / 2); this.col.addCentered(s * 62, gz + (P - gz - 12) / 2, 0.4, P - gz - 12, 2.4); }
    // Puesto de acreditaciones de prensa (Mariana)
    // El toldo de acreditaciones está dentro del parqueo de prensa (lado este de la plaza)
    const tx = 27.5, tz = gz + 19.5;
    const canopy = new THREE.MeshStandardMaterial({ map: TX.fabricTexture('#0b3d91', '#1356c4'), roughness: 0.8, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.4, 4, 1, true), canopy); roof.rotation.y = Math.PI / 4; roof.position.set(tx, 3.4, tz); roof.castShadow = true; this.group.add(roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.08, 2.7, 0.08, stdMat('#dddddd', 0.4, 0.7), tx + sx * 3.1, 1.35, tz + sz * 3.1);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.6), new THREE.MeshBasicMaterial({ map: TX.signTexture('ACREDITACIONES · PRENSA', '#0b3d91', '#ffffff', 1024, 100, 'bold 62px Arial') }));
    banner.position.set(tx, 2.4, tz + 3.12); this.group.add(banner);
    const table = this.box(4, 0.08, 1, stdMat('#f4f4f4', 0.6), tx, 0.78, tz + 1.4);
    this.box(4, 0.74, 0.04, new THREE.MeshStandardMaterial({ map: TX.signTexture('ASCENSO TOTAL · LIGA TICA', '#0b3d91', '#f2c500', 1024, 160, 'bold 54px Arial') }), tx, 0.4, tz + 1.9, { cast: false });
    this.col.addCentered(tx, tz + 1.4, 4.2, 1.1, 1.0);
    // Laptop, impresora de credenciales, cajas de acreditaciones
    this.box(0.36, 0.02, 0.25, stdMat('#222', 0.4, 0.5), tx - 1, 0.83, tz + 1.3);
    const scr = this.box(0.36, 0.24, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x5a9ae4, emissiveIntensity: 0.8 }), tx - 1, 0.95, tz + 1.18, { cast: false }); scr.rotation.x = -0.2;
    this.box(0.4, 0.25, 0.35, stdMat('#e8e8e8', 0.5), tx + 1.1, 0.95, tz + 1.3);
    this.box(0.3, 0.12, 0.22, stdMat('#c8a165', 0.8), tx + 0.3, 0.88, tz + 1.35);
    this.spots.mariana = new THREE.Vector3(tx, 0, tz + 0.5);
    this.spots.accreditationTable = new THREE.Vector3(tx, 1, tz + 2.6);
    // Boleterías
    for (const x of [26, 36]) {
      this.box(6, 3, 3, new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture('#c8102e', 5), roughness: 0.8 }), x, 1.5, gz + 6);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.6), new THREE.MeshBasicMaterial({ map: TX.signTexture('BOLETERÍA', '#111', '#ffcc00', 512, 80, 'bold 54px Arial') }));
      s.position.set(x, 2.6, gz + 7.52); this.group.add(s);
      this.col.addCentered(x, gz + 6, 6, 3, 3);
    }
    // Carretas de vendedores (con sombrilla)
    const vendors = [['COPOS', '#e63946'], ['GRANIZADOS', '#2a9d8f'], ['GORRAS Y CAMISETAS', '#f4a261'], ['CHICHARRONES', '#bc6c25'], ['MANÍ Y CONFITES', '#6d597a']];
    const vpos = [[-44, P - 5], [-8, P - 6], [12, gz + 18], [-40, gz + 14], [-24, P - 10]];
    vendors.forEach(([name, color], i) => {
      const [x, z] = vpos[i];
      const cart = new THREE.Group(); cart.position.set(x, 0, z); this.group.add(cart);
      this.box(1.8, 0.9, 0.9, new THREE.MeshStandardMaterial({ map: TX.signTexture(name, color, '#ffffff', 512, 256, 'bold 52px Arial'), roughness: 0.7 }), 0, 0.85, 0, { parent: cart });
      for (const sx of [-0.7, 0.7]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), stdMat('#222', 0.7)); w.rotation.x = Math.PI / 2; w.position.set(sx, 0.22, 0.46); cart.add(w); }
      const pole = this.box(0.04, 2.2, 0.04, stdMat('#ddd', 0.4, 0.7), 0.5, 1.6, 0, { parent: cart });
      const umb = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 10, 1, true), new THREE.MeshStandardMaterial({ map: TX.fabricTexture(color, '#ffffff'), side: THREE.DoubleSide, roughness: 0.8 }));
      umb.position.set(0.5, 2.8, 0); umb.castShadow = true; cart.add(umb);
      this.col.addCentered(x, z, 1.9, 1.0, 1.3);
      this.vendorSpots.push({ pos: new THREE.Vector3(x, 0, z - 1.0), name, rot: 0 });
    });
    this.spots.plazaCenter = new THREE.Vector3(0, 0, (gz + P) / 2);
  }
  // Parqueo de prensa con aguja (barrera) y caseta del guarda. Adentro se recoge la acreditación.
  buildParking() {
    const gz = this.gz, P = this.P, x0 = 21, x1 = 61.5, z0 = gz + 8.6, z1 = P - 0.6;
    const asphalt = new THREE.MeshStandardMaterial({ map: TX.asphaltTexture([8, 5]), roughness: 0.85 });
    this.plane(x1 - x0, z1 - z0, asphalt, (x0 + x1) / 2, 0.008, (z0 + z1) / 2);
    const paint = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), yellow = new THREE.MeshBasicMaterial({ color: 0xf2c500 });
    // Cajones (dos filas) con "PRENSA" pintado
    const stalls = [];
    for (const [rz, dir] of [[z0 + 2.6, 1], [z1 - 2.8, -1]]) for (let x = 32; x <= (dir < 0 ? 49.5 : 58); x += 2.9) { // la fila de la calle deja libre la entrada
      this.plane(0.1, 5, paint, x - 1.45, 0.012, rz); stalls.push({ x, z: rz, dir });
      const t = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: TX.signTexture('PRENSA', '#00000000', '#f2c500', 256, 64, 'bold 44px Arial'), transparent: true }));
      t.rotation.x = -Math.PI / 2; t.rotation.z = dir > 0 ? 0 : Math.PI; t.position.set(x, 0.014, rz + dir * 1.6); this.group.add(t);
    }
    // Carros de otros fotógrafos parqueados
    this.parkStalls = stalls;
    stalls.forEach((s, i) => { if (i % 3 === 1 || i % 5 === 0) return; const c = this.makeCar(CAR_COLORS[(i * 3) % CAR_COLORS.length]); c.position.set(s.x, 0, s.z); c.rotation.y = s.dir > 0 ? -Math.PI / 2 : Math.PI / 2; this.col.addCentered(s.x, s.z, 1.9, 4.3, 1.5); s.taken = true; });
    // Malla perimetral del lado de la calle, con la entrada de carros (x 52..58) y portón peatonal (x 48..50.5)
    const fenceM = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.55 });
    for (const [a, b] of [[x0, 48], [50.5, 52], [58.6, x1]]) { const f = this.box(b - a, 1.6, 0.05, fenceM, (a + b) / 2, 0.8, z1, { cast: false }); f.renderOrder = 2; this.col.add(a, 0, z1 - 0.1, b, 1.6, z1 + 0.1); }
    for (let x = x0; x <= x1; x += 3) if (x < 48 || x > 58.6) this.box(0.06, 1.7, 0.06, stdMat('#555', 0.4, 0.7), x, 0.85, z1, { cast: false });
    // Rampa de entrada sobre la acera
    this.plane(6.4, 4.6, new THREE.MeshStandardMaterial({ map: TX.asphaltTexture([2, 2]), roughness: 0.85 }), 55.2, 0.16, P + 2);
    // Caseta del guarda y aguja
    const booth = this.box(1.8, 2.5, 1.8, stdMat('#e9ecef', 0.6), 60, 1.25, z1 - 2.2); this.col.addCentered(60, z1 - 2.2, 1.9, 1.9, 2.6);
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.1, metalness: 0.3 })); bw.position.set(59.09, 1.6, z1 - 2.2); bw.rotation.y = -Math.PI / 2; this.group.add(bw);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.6), new THREE.MeshBasicMaterial({ map: TX.signTexture('🅿 PARQUEO DE PRENSA · ACREDITACIONES', '#0b3d91', '#ffffff', 1024, 140, 'bold 52px Arial') }));
    sign.position.set(55.2, 3.3, z1 + 0.2); this.group.add(sign);
    for (const sx of [53, 57.4]) this.box(0.12, 3.6, 0.12, stdMat('#333', 0.4, 0.7), sx, 1.8, z1 + 0.2, { cast: false });
    const post = this.box(0.35, 1.1, 0.35, stdMat('#f2c500', 0.5), 58.4, 0.55, z1 - 0.5); this.col.addCentered(58.4, z1 - 0.5, 0.4, 0.4, 1.1);
    const pivot = new THREE.Group(); pivot.position.set(58.4, 1.0, z1 - 0.5); this.group.add(pivot); pivot.userData.noMerge = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 0.1), new THREE.MeshStandardMaterial({ map: TX.signTexture('■ ■ ■ ■ ■ ■ ■ ■', '#ffffff', '#d00000', 512, 32, 'bold 30px Arial') }));
    arm.position.x = -2.9; pivot.add(arm);
    const barCol = this.col.add(52.4, 0, z1 - 0.7, 58.2, 1.2, z1 - 0.3); barCol.tag = 'curb';
    this.parking = { x0, x1, z0, z1, entrance: { x0: 52.2, x1: 58.2 }, pivot, angle: 0, target: 0, col: barCol, guardPos: new THREE.Vector3(60, 0, z1 - 3.6), greeted: false };
    this.spots.parking = new THREE.Vector3(45, 0, (z0 + z1) / 2);
    this.spots.boothGuard = this.parking.guardPos;
  }
  tree(x, z, s = 1, palm = false) {
    if (palm) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 7 * s, 8), stdMat('#7a5c3a', 0.9)); trunk.position.set(x, 3.5 * s, z); trunk.castShadow = true; this.group.add(trunk);
      const leafM = stdMat('#2f6b2a', 0.8);
      for (let i = 0; i < 8; i++) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.05, 3 * s), leafM);
        const a = (i / 8) * Math.PI * 2; l.position.set(x + Math.cos(a) * 1.3 * s, 7 * s, z + Math.sin(a) * 1.3 * s); l.rotation.y = -a + Math.PI / 2; l.rotation.x = 0.35; l.castShadow = true; this.group.add(l);
      }
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 3.5 * s, 8), stdMat('#5b4330', 0.95)); trunk.position.set(x, 1.75 * s, z); trunk.castShadow = true; this.group.add(trunk);
      const leafM = stdMat(['#3b6e2a', '#4a7c32', '#2e5e22'][Math.floor(this.rnd() * 3)], 0.85);
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.6 + this.rnd()) * s, 1), leafM);
        c.position.set(x + (this.rnd() - 0.5) * 2.4 * s, (3.8 + this.rnd() * 1.4) * s, z + (this.rnd() - 0.5) * 2.4 * s); c.scale.y = 0.6; c.castShadow = true; this.group.add(c);
      }
    }
    this.col.addCentered(x, z, 0.6 * s, 0.6 * s, 4);
  }
  buildProps() {
    const P = this.P;
    // Postes de electricidad con cables (muy característicos)
    const poleM = stdMat('#8f8a80', 0.9);
    const wireM = new THREE.LineBasicMaterial({ color: 0x111111 });
    const poles = [];
    for (let x = -160; x <= 160; x += 32) {
      const z = P + 17.2;
      const p = this.box(0.3, 9, 0.3, poleM, x, 4.5, z); this.box(2.2, 0.15, 0.15, poleM, x, 8.4, z);
      this.col.addCentered(x, z, 0.35, 0.35, 9);
      poles.push(new THREE.Vector3(x, 8.5, z));
      // Transformador
      if ((x / 32) % 3 === 0) this.box(0.6, 0.9, 0.6, stdMat('#6c757d', 0.5, 0.6), x, 7.2, z - 0.4);
    }
    for (let i = 0; i < poles.length - 1; i++) for (const off of [-0.9, 0, 0.9]) {
      const a = poles[i].clone().add(new THREE.Vector3(0, 0, off * 0.0)), b = poles[i + 1].clone();
      a.x += 0; const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y - Math.sin(t * Math.PI) * 0.9, a.z + off)); }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    }
    // Faroles
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0 }); this.game.env.register(lampM, 'emissiveIntensity', 0, 2.5);
    for (let x = -150; x <= 150; x += 25) {
      const z = P + 3.6;
      this.box(0.15, 6, 0.15, stdMat('#3a3f44', 0.5, 0.7), x, 3, z); this.box(0.15, 0.1, 1.5, stdMat('#3a3f44', 0.5, 0.7), x, 6, z + 0.7);
      this.box(0.4, 0.15, 0.6, lampM, x, 5.9, z + 1.3);
      this.col.addCentered(x, z, 0.25, 0.25, 6);
      if (Math.abs(x) < 30) { const l = new THREE.PointLight(0xffc98a, 0, 22, 1.6); l.position.set(x, 5.6, z + 1.3); this.group.add(l); this.game.env.register(l, 'intensity', 0, 30); }
    }
    // Árboles y palmeras
    for (let x = -150; x <= 150; x += 20) { if (Math.abs(x) < 60) continue; this.tree(x + 6, P + 1.6, 0.8); }
    for (const [x, z] of [[-55, this.gz + 5], [55, this.gz + 5], [-55, this.gz + 20], [-30, this.gz + 4], [14, this.gz + 30]]) this.tree(x, z, 1.1, true);
    // Bancas de plaza y basureros
    const benchM = new THREE.MeshStandardMaterial({ map: TX.woodTexture(), roughness: 0.7 });
    for (const [x, z] of [[-12, this.gz + 25], [12, this.gz + 25], [-50, this.gz + 28], [16, this.gz + 8]]) {
      this.box(2, 0.08, 0.5, benchM, x, 0.45, z); this.box(2, 0.45, 0.06, benchM, x, 0.7, z + 0.25);
      this.col.addCentered(x, z, 2, 0.6, 0.5);
    }
    // Parada de bus
    const bx = 90, bz = P + 1.8;
    this.box(4, 0.08, 1.8, stdMat('#2b2d42', 0.5, 0.5), bx, 2.6, bz); this.box(4, 2.5, 0.05, new THREE.MeshStandardMaterial({ map: TX.adTexture('CAFÉ ALTURA', '#3b2416', '#f5d7a1', 'Grano de altura'), roughness: 0.4 }), bx, 1.3, bz - 0.85);
    this.col.addCentered(bx, bz - 0.85, 4, 0.2, 2.6);
  }
  // Materiales compartidos por color: los carros parqueados se fusionan entre sí y los que se mueven
  // quedan en ~5 mallas en lugar de ~12.
  carMat(key, make) { this.carMats ||= new Map(); if (!this.carMats.has(key)) this.carMats.set(key, make()); return this.carMats.get(key); }
  makeCar(color, bus = false) {
    const g = this.makeCarRaw(color, bus);
    // Fusionar piezas por material dentro del carro
    const byMat = new Map();
    g.updateMatrixWorld(true);
    for (const ch of [...g.children]) { if (!ch.isMesh) continue; if (!byMat.has(ch.material)) byMat.set(ch.material, []); byMat.get(ch.material).push(ch); }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map((m) => { const gg = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k); gg.applyMatrix4(m.matrix); return gg; });
      const merged = new THREE.Mesh(mergeGeometries(geos, false), mat); merged.castShadow = list[0].castShadow; g.add(merged); for (const m of list) g.remove(m);
    }
    return g;
  }
  makeCarRaw(color, bus = false) {
    const g = new THREE.Group();
    const L = bus ? 11 : 4.2, W = bus ? 2.5 : 1.8, H = bus ? 3 : 1.4;
    const bodyM = this.carMat('body' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.6 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, H * 0.5, W), bodyM); body.position.y = 0.35 + H * 0.25; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(bus ? L * 0.98 : L * 0.55, H * 0.45, W * 0.92), bus ? bodyM : this.carMat('glass', () => new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.05, metalness: 0.8 })));
    cab.position.set(bus ? 0 : -L * 0.05, 0.35 + H * 0.72, 0); cab.castShadow = true; g.add(cab);
    if (bus) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.4), new THREE.MeshBasicMaterial({ map: TX.signTexture('ESTADIO', '#000', '#ffb000', 256, 48, 'bold 36px Arial') }));
      sign.position.set(L / 2 + 0.01, H * 0.9, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
      const winM = this.carMat('glass', () => new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.05, metalness: 0.8 }));
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.85, H * 0.3), winM); w.position.set(0, H * 0.7, s * (W / 2 + 0.01)); w.rotation.y = s > 0 ? 0 : Math.PI; g.add(w); }
    }
    const wheelM = stdMat('#151515', 0.8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), wheelM); w.rotation.x = Math.PI / 2; w.position.set(sx * L * 0.33, 0.34, sz * W / 2); g.add(w);
    }
    const lightM = this.carMat('head', () => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.3 }); this.game.env.register(m, 'emissiveIntensity', 0.3, 3); return m; });
    const tailM = this.carMat('tail', () => { const m = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2020, emissiveIntensity: 0.2 }); this.game.env.register(m, 'emissiveIntensity', 0.2, 2); return m; });
    for (const sz of [-1, 1]) { this.box(0.05, 0.15, 0.3, lightM, L / 2, 0.6, sz * W * 0.35, { parent: g, cast: false }); this.box(0.05, 0.15, 0.3, tailM, -L / 2, 0.65, sz * W * 0.35, { parent: g, cast: false }); }
    g.userData.L = L;
    this.group.add(g); return g;
  }
  buildCars() {
    const P = this.P;
    // Carros estacionados en el cordón norte
    for (let x = -150; x < 150; x += 14 + this.rnd() * 10) {
      if (Math.abs(x) < 12) continue;
      const c = this.makeCar(CAR_COLORS[Math.floor(this.rnd() * CAR_COLORS.length)]);
      c.position.set(x, 0, P + 14.8); c.rotation.y = Math.PI;
      this.col.addCentered(x, P + 14.8, 4.3, 1.9, 1.5);
    }
    // Tráfico en movimiento (dos carriles) por toda la avenida, desde el barrio hasta el estadio
    for (let i = 0; i < 16; i++) {
      const dir = i % 2 ? 1 : -1, bus = false;
      const c = this.makeCar(CAR_COLORS[i % CAR_COLORS.length], bus);
      c.position.set(AVE_X1 + 20 + i * 60, 0, P + 10 + (dir > 0 ? -2.8 : 2.8) * 1);
      c.rotation.y = dir > 0 ? 0 : Math.PI;
      this.cars.push({ obj: c, dir, speed: bus ? 8 : 10 + this.rnd() * 5, v: 0, lane: P + 10 - dir * 2.8, honk: 0 });
      c.position.z = P + 10 - dir * 2.8;
    }
  }
  bounds() {
    const P = this.P;
    this.col.add(-175, 0, this.gz, -168, 10, P - 0.6); this.col.add(168, 0, this.gz, 175, 10, P + 40);
    this.col.add(-175, 0, P + 20.4, 175, 10, P + 22);
  }
  update(dt, playerPos, audio) {
    // Aguja del parqueo: sube cuando se acerca tu carro (o un taxi/Uber) a la entrada
    const pk = this.parking;
    if (pk) {
      const tr = this.game.travel, cars = [tr?.mode === 'drive' ? tr.car : null, tr?.ride].filter(Boolean);
      const near = cars.some((c) => c.pos.x > pk.entrance.x0 - 4 && c.pos.x < pk.entrance.x1 + 4 && c.pos.z > pk.z1 - 9 && c.pos.z < this.P + 12);
      if (near && pk.target === 0 && !pk.greeted && tr?.mode === 'drive') { pk.greeted = true; this.game.ui.toast('💂 Guarda: «Buenas, prensa. Pase adelante; las acreditaciones están en el toldo azul, al fondo.»', 'info', 4500); }
      pk.target = near ? 1 : 0;
      pk.angle += (pk.target - pk.angle) * Math.min(1, dt * 2.5);
      pk.pivot.rotation.z = -pk.angle * 1.45;
      pk.col.enabled = pk.angle < 0.6;
    }
    // Una sola luz para los interiores: se coloca en el local donde está (o al que se acerca) el jugador
    if (this.shops.length) {
      if (!this.shopLight) { this.shopLight = new THREE.PointLight(0xfff0d8, 0, 13, 1.4); this.group.add(this.shopLight); }
      let best = null, bd = 14;
      for (const s of this.shops) { const b = s.bounds, dx = Math.max(b.x0 - playerPos.x, 0, playerPos.x - b.x1), dz = Math.max(b.z0 - playerPos.z, 0, playerPos.z - b.z1), dd = Math.hypot(dx, dz); if (dd < bd) { bd = dd; best = s; } }
      const L = this.shopLight;
      if (best) { L.position.copy(best.lightPos); L.color.set(best.warm ? 0xffc489 : 0xfff0d8); }
      L.intensity = best ? (best.warm ? 22 : 30) * Math.min(1, (14 - bd) / 6) : 0;
      this.playerShop = best && bd === 0 ? best : null;
    }
    for (const c of this.cars) {
      let target = c.speed;
      // Detenerse si el jugador está en la calzada delante del carro (o en el paso peatonal)
      const ahead = (playerPos.x - c.obj.position.x) * c.dir;
      const onRoad = !this.game.travel?.mode && playerPos.z > this.P + 4 && playerPos.z < this.P + 16;
      const inLane = Math.abs(playerPos.z - c.lane) < 2.4;
      if (onRoad && inLane && ahead > 0 && ahead < 16) { target = 0; if (ahead < 9 && c.honk <= 0 && audio) { audio.honk(c.obj.position); c.honk = 6; } }
      // El carro del fotógrafo (o un taxi/Uber/bus) también es un obstáculo para el tráfico
      for (const o of [this.game.travel?.car, this.game.travel?.bus, this.game.travel?.ride]) if (o) { const d = (o.pos.x - c.obj.position.x) * c.dir; if (Math.abs(o.pos.z - c.lane) < 1.8 && d > 0 && d < 12 + (o.L || 4)) target = Math.min(target, Math.max(0, (o.v || 0) * 0.8)); }
      // Respetar distancia con el carro de adelante
      for (const o of this.cars) if (o !== c && o.dir === c.dir) { const d = (o.obj.position.x - c.obj.position.x) * c.dir; if (d > 0 && d < 10 + (o.obj.userData.L || 4)) target = Math.min(target, o.v * 0.8); }
      c.honk -= dt;
      c.v += Math.max(-12 * dt, Math.min(4 * dt, target - c.v));
      c.obj.position.x += c.v * c.dir * dt;
      if (c.obj.position.x > 185) c.obj.position.x = AVE_X1 + 5; if (c.obj.position.x < AVE_X1 + 5) c.obj.position.x = 185;
      c.obj.visible = Math.abs(c.obj.position.x - playerPos.x) < 260;
    }
  }
}
