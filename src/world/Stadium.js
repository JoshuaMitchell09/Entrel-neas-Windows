import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from '../gfx/Textures.js';
import { Crowd } from './Crowd.js';
import { Door, GlassSlidingDoor } from '../interaction/Interaction.js';
import { stdMat } from '../characters/Humanoid.js';
import { mergeStatic } from '../gfx/Merge.js';

export const PITCH = { L: 105, W: 68, apron: 8 };
export const APRON_X = 63.5, APRON_Z = 43.5; // borde frontal de las graderías
const ADS = [
  ['ASCENSO TOTAL', '#0b3d91', '#ffffff', 'Todo el fútbol tico, de la Liga al Ascenso', '#f2c500'],
  ['CAFÉ ALTURA', '#3b2416', '#f5d7a1', 'Grano de altura · 1.400 m', '#c48a3a'],
  ['TELECOM TUANIS', '#00a0b0', '#ffffff', 'Señal en todo el país', '#ffffff'],
  ['BANCO CEIBA', '#0f5132', '#ffffff', 'Crecemos con vos', '#9bd17a'],
  ['REFRESCOS LA MONA', '#e63946', '#ffffff', 'Sabor de siempre', '#ffd166'],
  ['SODA LA BENDICIÓN', '#ffd166', '#5a2a00', 'Casados y gallos pintos', '#e76f51'],
  ['LLANTAS EL VOLCÁN', '#1a1a1a', '#ff8c00', 'Agarre en cualquier camino', '#ff8c00'],
  ['SUPER LA ESQUINA', '#2a9d8f', '#ffffff', 'Todo cerquita', '#ffffff'],
];

export class Stadium {
  constructor(game, cfg, homeTeam, awayTeam) {
    this.game = game; this.cfg = cfg; this.home = homeTeam; this.away = awayTeam;
    this.group = new THREE.Group(); game.scene.add(this.group);
    this.col = game.collision;
    this.doors = []; this.lightPositions = []; this.zones = { restricted: [], press: [] };
    this.spots = {}; this.flags = []; this.smoke = [];
    this.D = { near: cfg.nearRows * cfg.rowDepth, end: cfg.endRows * cfg.rowDepth, far: cfg.farRows * cfg.rowDepth };
    this.frontY = 1.25;
    this.gateZ = APRON_Z + this.D.near + 0.6;
    this.mats();
    this.buildGround();
    this.buildPitch();
    this.buildBoards();
    this.buildGoals();
    this.buildBenches();
    this.buildStands();
    this.buildRoofAndLights();
    this.buildScoreboard();
    this.buildInterior();
    this.buildSecurity();
    this.defineZones();
    for (const d of this.doors) d.pivot.userData.noMerge = true;
    for (const f of this.flags) f.userData.noMerge = true;
    this.crowd.mesh.userData.noMerge = true;
    this.merged = mergeStatic(this.group);
  }
  mats() {
    const cn = (rep) => { const t = TX.noiseNormalMap('concrete', 256, 10, 2.5, 11).clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return t; };
    this.m = {
      concrete: new THREE.MeshStandardMaterial({ map: TX.concreteTexture('#a39e93', 3, [8, 8]), normalMap: cn(8), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92 }),
      concreteDark: new THREE.MeshStandardMaterial({ map: TX.concreteTexture('#77736b', 5, [6, 6]), normalMap: cn(6), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95 }),
      facade: new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture(this.cfg.facade, 12, { band: this.cfg.facadeBand }), roughness: 0.9 }),
      steel: stdMat('#9aa1a8', 0.4, 0.8), darkSteel: stdMat('#2c3036', 0.45, 0.7), white: stdMat('#f4f4f4', 0.5),
      tile: new THREE.MeshStandardMaterial({ map: TX.tileTexture('#cfd2d4', '#bfc3c6', [10, 10]), roughness: 0.5 }),
      wallInt: new THREE.MeshStandardMaterial({ map: TX.paintedWallTexture('#e6e2d8', 31, { band: this.cfg.facadeBand }), roughness: 0.85 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 }),
      track: new THREE.MeshStandardMaterial({ color: 0x2f5d32, roughness: 0.95, normalMap: (() => { const t = TX.noiseNormalMap('grass', 256, 24, 4, 5, true).clone(); t.needsUpdate = true; t.repeat.set(60, 45); return t; })(), normalScale: new THREE.Vector2(0.5, 0.5) }),
    };
  }
  box(w, h, d, mat, x, y, z, { cast = true, receive = true, parent = this.group, ry = 0 } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
  }
  buildGround() {
    // Superficie exterior y plataforma perimetral (alrededor de la cancha)
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(2 * APRON_X + 2, 2 * APRON_Z + 2), this.m.track);
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; this.group.add(outer);
  }
  buildPitch() {
    const { L, W, apron } = PITCH;
    const wet = this.game.env.wet;
    const gn = TX.noiseNormalMap('grass', 256, 24, 4, 5, true).clone(); gn.needsUpdate = true; gn.repeat.set((L + 2 * apron) / 1.6, (W + 2 * apron) / 1.6);
    this.pitchMat = new THREE.MeshStandardMaterial({ map: TX.pitchTexture(L, W, apron, wet), normalMap: gn, normalScale: new THREE.Vector2(0.55, 0.55), roughness: wet ? 0.42 : 0.93, metalness: 0 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * apron, W + 2 * apron), this.pitchMat);
    p.rotation.x = -Math.PI / 2; p.receiveShadow = true; this.group.add(p); this.pitch = p;
    // Banderines de esquina
    const flagTex = TX.fabricTexture(this.home.colors.primary, null);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = this.box(0.03, 1.5, 0.03, this.m.white, sx * L / 2, 0.75, sz * W / 2, { cast: true });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25, 4, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide }));
      flag.position.set(sx * L / 2 + 0.18, 1.35, sz * W / 2); this.group.add(flag); this.flags.push(flag);
    }
  }
  buildBoards() {
    const { L } = PITCH;
    const boardH = 0.9, mkBoard = (len, x, z, ry, ad) => {
      const tex = TX.adTexture(...ad);
      const front = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.6 }); this.game.env.register(front, 'emissiveIntensity', 0.12, 0.55);
      const mats = [this.m.darkSteel, this.m.darkSteel, this.m.darkSteel, this.m.darkSteel, front, this.m.darkSteel];
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, boardH, 0.25), mats);
      b.position.set(x, boardH / 2, z); b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true; this.group.add(b);
      this.col.addRotated(x, z, len, 0.3, ry, boardH);
    };
    let k = 0;
    // Laterales: lado lejano completo; lado cercano con hueco en el área técnica.
    for (let x = -50; x < 50; x += 10) { mkBoard(9.9, x + 5, -38.5, 0, ADS[k++ % ADS.length]); }
    for (let x = -50; x < 50; x += 10) { if (x >= -20 && x < 20) continue; mkBoard(9.9, x + 5, 38.5, Math.PI, ADS[k++ % ADS.length]); }
    // Detrás de las porterías (dejan pasillos en las esquinas)
    for (const s of [-1, 1]) for (let z = -28; z < 28; z += 8) mkBoard(7.9, s * 59.6, z + 4, s > 0 ? -Math.PI / 2 : Math.PI / 2, ADS[k++ % ADS.length]);
  }
  buildGoals() {
    const { L } = PITCH;
    const postM = stdMat('#ffffff', 0.35, 0.1);
    const netCanvas = TX.makeCanvas(128, 128), ctx = netCanvas.getContext('2d');
    ctx.strokeStyle = 'rgba(240,240,240,0.9)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 128; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke(); }
    const netTex = TX.toTex(netCanvas, { repeat: [8, 3], srgb: true });
    const netM = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 });
    this.goals = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * L / 2, 0, 0); this.group.add(g);
      const r = 0.06, H = 2.44, Wg = 7.32, depth = 2.0;
      const cyl = (len) => new THREE.CylinderGeometry(r, r, len, 10);
      for (const z of [-Wg / 2, Wg / 2]) { const p = new THREE.Mesh(cyl(H), postM); p.position.set(0, H / 2, z); p.castShadow = true; g.add(p); this.col.addCentered(s * L / 2, z, 0.15, 0.15, H); }
      const bar = new THREE.Mesh(cyl(Wg), postM); bar.rotation.x = Math.PI / 2; bar.position.set(0, H, 0); bar.castShadow = true; g.add(bar);
      // Red: techo inclinado, fondo y laterales
      const back = new THREE.Mesh(new THREE.PlaneGeometry(Wg, H * 0.75), netM); back.position.set(s * depth, H * 0.375, 0); back.rotation.y = Math.PI / 2; g.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(depth, H * 0.25), Wg), netM); top.rotation.set(-Math.PI / 2, 0, 0);
      top.rotation.order = 'YXZ'; top.rotation.y = 0; top.position.set(s * depth / 2, H * 0.875, 0); top.rotateY(-s * Math.atan2(H * 0.25, depth)); g.add(top);
      for (const z of [-Wg / 2, Wg / 2]) {
        const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(s * depth, 0); shp.lineTo(s * depth, H * 0.75); shp.lineTo(0, H); shp.lineTo(0, 0);
        const side = new THREE.Mesh(new THREE.ShapeGeometry(shp), netM); side.position.set(0, 0, z); g.add(side);
      }
      this.col.addCentered(s * (L / 2 + depth / 2), 0, depth, Wg, 2.0, 0, 'goal');
      this.goals.push(g);
    }
  }
  buildBenches() {
    const shell = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.1, transparent: true, opacity: 0.45 });
    const seatM = stdMat(this.cfg.seatColors[0], 0.6);
    this.benchSeats = [];
    for (const s of [-1, 1]) {
      const cx = s * 9, cz = 40.2, len = 9;
      this.box(len, 0.08, 1.6, this.m.darkSteel, cx, 2.15, cz + 0.1);
      const back = this.box(len, 2.1, 0.06, shell, cx, 1.05, cz + 0.85, { cast: false });
      for (const e of [-1, 1]) this.box(0.06, 2.1, 1.6, shell, cx + e * len / 2, 1.05, cz + 0.1, { cast: false });
      for (let i = 0; i < 10; i++) {
        const x = cx - len / 2 + 0.5 + i * 0.88;
        this.box(0.5, 0.08, 0.45, seatM, x, 0.48, cz + 0.45); this.box(0.5, 0.5, 0.06, seatM, x, 0.75, cz + 0.68);
        this.benchSeats.push(new THREE.Vector3(x, 0, cz + 0.38));
      }
      this.col.addCentered(cx, cz + 0.1, len + 0.1, 1.7, 2.2);
    }
    // Línea del área técnica (pintada)
    const tm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (const s of [-1, 1]) {
      const l1 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 4), tm); l1.rotation.x = -Math.PI / 2; l1.position.set(s * 14, 0.012, 37); this.group.add(l1);
      const l2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.1), tm); l2.rotation.x = -Math.PI / 2; l2.position.set(s * 9, 0.012, 35); this.group.add(l2);
    }
  }
  // Construye una gradería en coordenadas locales: frente en z=0, sube hacia +z.
  stand(rows, len, rd, rh, { cutout = null, crowdSeats, rotY, origin, tier = null, banner = null }) {
    const geos = [], seatPos = [], aisleGeos = [];
    const fy = this.frontY, cfg = this.cfg;
    const topOf = (i) => fy + i * rh + (tier && i >= tier.row ? tier.rise : 0);
    const A = cfg.aisleEvery || 0;
    const inAisle = (x) => A && ((x + len / 2) % A) < 1.0;
    for (let i = 0; i < rows; i++) {
      const top = topOf(i), z0 = i * rd, segs = [];
      if (A) for (let ax = -len / 2 + A; ax < len / 2 - 1; ax += A) {
        const g = new THREE.BoxGeometry(0.95, 0.06, rd); g.translate(ax + 0.5, top + 0.03, z0 + rd / 2); aisleGeos.push(g);
      }
      if (cutout && top < cutout.maxTop) { segs.push([-len / 2, cutout.x0]); segs.push([cutout.x1, len / 2]); }
      else segs.push([-len / 2, len / 2]);
      for (const [a, b] of segs) {
        const g = new THREE.BoxGeometry(b - a, 0.45, rd + 0.02); g.translate((a + b) / 2, top - 0.225, z0 + rd / 2); geos.push(g);
      }
      for (let x = -len / 2 + 0.6; x < len / 2 - 0.4; x += 0.56) {
        if (cutout && top < cutout.maxTop && x > cutout.x0 - 0.3 && x < cutout.x1 + 0.3) continue;
        if (inAisle(x)) continue;
        seatPos.push([x, top, z0 + rd * 0.55, i]);
      }
    }
    const D = rows * rd, topY = topOf(rows);
    // Fascia del segundo nivel (frente del anillo superior)
    if (tier) {
      const yb = topOf(tier.row - 1), yt = topOf(tier.row) - 0.45, z = tier.row * rd;
      const f = new THREE.BoxGeometry(len, yt - yb + 0.2, 0.3); f.translate(0, (yb + yt) / 2, z - 0.1); geos.push(f);
    }
    // Pared frontal y trasera, laterales macizos
    const fw = new THREE.BoxGeometry(len, fy, 0.3); fw.translate(0, fy / 2, -0.15);
    if (!cutout) geos.push(fw);
    else {
      const a = new THREE.BoxGeometry(len / 2 + cutout.x0, fy, 0.3); a.translate((-len / 2 + cutout.x0) / 2, fy / 2, -0.15); geos.push(a);
      const b = new THREE.BoxGeometry(len / 2 - cutout.x1, fy, 0.3); b.translate((cutout.x1 + len / 2) / 2, fy / 2, -0.15); geos.push(b);
    }
    const BH = topY + 1.6;
    if (!cutout) { const bw = new THREE.BoxGeometry(len, BH, 0.4); bw.translate(0, BH / 2, D + 0.2); geos.push(bw); }
    else {
      // Pared trasera con el vano del acceso de prensa (x −2.1..2.1, 3.25 m de alto): la puerta de vidrio da directo al pasillo
      const hx = 2.1, hh = 3.25;
      const l = new THREE.BoxGeometry(len / 2 - hx, BH, 0.4); l.translate((-len / 2 - hx) / 2, BH / 2, D + 0.2); geos.push(l);
      const r = new THREE.BoxGeometry(len / 2 - hx, BH, 0.4); r.translate((len / 2 + hx) / 2, BH / 2, D + 0.2); geos.push(r);
      const t = new THREE.BoxGeometry(2 * hx, BH - hh, 0.4); t.translate(0, hh + (BH - hh) / 2, D + 0.2); geos.push(t);
    }
    for (const e of [-1, 1]) {
      const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(0, fy); shp.lineTo(D, topY + 1.2); shp.lineTo(D, 0); shp.lineTo(0, 0);
      const sg = new THREE.ExtrudeGeometry(shp, { depth: 0.4, bevelEnabled: false }); sg.rotateY(-Math.PI / 2); sg.translate(e * len / 2 + (e > 0 ? 0.4 : 0), 0, 0);
      geos.push(sg.toNonIndexed ? sg : sg);
    }
    const norm = geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; });
    const merged = mergeGeometries(norm);
    const mesh = new THREE.Mesh(merged, this.m.concrete); mesh.castShadow = true; mesh.receiveShadow = true;
    const grp = new THREE.Group(); grp.add(mesh); grp.rotation.y = rotY; grp.position.copy(origin); this.group.add(grp);
    if (aisleGeos.length) {
      const ag = mergeGeometries(aisleGeos.map((g) => g.toNonIndexed()));
      const am = new THREE.Mesh(ag, stdMat(cfg.aisleColor || '#f2b705', 0.7)); am.receiveShadow = true; grp.add(am);
    }
    if (tier && banner) {
      const yb = topOf(tier.row - 1), yt = topOf(tier.row) - 0.45;
      for (let k = 0; k < banner.length; k++) {
        const w = Math.min(34, len / banner.length - 4), bx = -len / 2 + (k + 0.5) * (len / banner.length);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(w, Math.max(0.8, yt - yb - 0.2)), new THREE.MeshStandardMaterial({ map: TX.signTexture(banner[k], '#14141c', '#ffffff', 1024, 64, 'bold 40px Arial'), roughness: 0.8 }));
        b.position.set(bx, (yb + yt) / 2 + 0.1, tier.row * rd - 0.27); b.rotation.y = Math.PI; grp.add(b);
      }
    }
    // Asientos instanciados
    const seatG = new THREE.BoxGeometry(0.46, 0.34, 0.38); seatG.translate(0, 0.17, 0);
    const seatMesh = new THREE.InstancedMesh(seatG, new THREE.MeshStandardMaterial({ roughness: 0.6 }), seatPos.length);
    const d = new THREE.Object3D(), c = new THREE.Color();
    seatPos.forEach(([x, y, z, row], i) => {
      d.position.set(x, y, z); d.updateMatrix(); seatMesh.setMatrixAt(i, d.matrix);
      const pat = this.cfg.seatPattern === 'blocks' ? Math.floor((x + len / 2) / (this.cfg.aisleEvery || 9)) % 2 === 0 : this.cfg.seatPattern === 'solid' ? true : (row % 6 < 3) !== (Math.floor((x + 200) / 12) % 2 === 0);
      c.set(this.cfg.seatColors[pat ? 0 : 1]); seatMesh.setColorAt(i, c);
    });
    seatMesh.receiveShadow = true; grp.add(seatMesh);
    // Público en coordenadas mundo
    grp.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const [x, y, z, row] of seatPos) {
      if (Math.random() > crowdSeats.density) continue;
      v.set(x, y + 0.02, z - 0.05).applyMatrix4(grp.matrixWorld);
      crowdSeats.list.push({ x: v.x, y: v.y + 0.02, z: v.z, rot: rotY + Math.PI, row, lx: x });
    }
    return { grp, D, topY };
  }
  buildStands() {
    const cfg = this.cfg, q = this.game.settings.q;
    const density = cfg.crowdDensity * q.crowd;
    const seats = { list: [], density };
    const endLen = 2 * APRON_Z;
    const nearLen = 2 * APRON_X + (cfg.corners ? 2 * this.D.end : 0);
    this.stands = {
      near: this.stand(cfg.nearRows, nearLen, cfg.rowDepth, cfg.rowHeight, { cutout: { x0: -3.35, x1: 3.35, maxTop: 4.4 }, crowdSeats: seats, rotY: 0, origin: new THREE.Vector3(0, 0, APRON_Z), tier: cfg.tiers?.near, banner: cfg.banners?.near }),
      far: this.stand(cfg.farRows, 2 * APRON_X + (cfg.corners ? 2 * this.D.end : 0), cfg.rowDepth, cfg.rowHeight, { crowdSeats: seats, rotY: Math.PI, origin: new THREE.Vector3(0, 0, -APRON_Z), tier: cfg.tiers?.far, banner: cfg.banners?.far }),
      east: this.stand(cfg.eastRows || cfg.endRows, endLen, cfg.rowDepth, cfg.rowHeight, { crowdSeats: seats, rotY: Math.PI / 2, origin: new THREE.Vector3(APRON_X, 0, 0), tier: cfg.tiers?.east, banner: cfg.banners?.east }),
      west: this.stand(cfg.westRows || cfg.endRows, endLen, cfg.rowDepth, cfg.rowHeight, { crowdSeats: seats, rotY: -Math.PI / 2, origin: new THREE.Vector3(-APRON_X, 0, 0), tier: cfg.tiers?.west, banner: cfg.banners?.west }),
    };
    // Colisiones: frentes de gradería (el jugador no puede subir) — lado cercano con hueco del túnel
    const wall = 0.6;
    this.col.add(-APRON_X - 40, 0, APRON_Z - 0.3, -3, 30, APRON_Z + wall);
    this.col.add(3, 0, APRON_Z - 0.3, APRON_X + 40, 30, APRON_Z + wall);
    this.col.add(-APRON_X - 40, 0, -APRON_Z - this.D.far - 1, APRON_X + 40, 30, -APRON_Z + 0.3);
    this.col.add(APRON_X - 0.3, 0, -APRON_Z - 1, APRON_X + this.D.end + 1, 30, APRON_Z + 1);
    this.col.add(-APRON_X - this.D.end - 1, 0, -APRON_Z - 1, -APRON_X + 0.3, 30, APRON_Z + 1);
    // Público: colores de las aficiones (local mayoritario; barra visitante detrás de una portería)
    const total = seats.list.length;
    this.crowd = new Crowd(total + 10);
    const H = this.home.colors, A = this.away.colors;
    const neutral = ['#f2f2f2', '#222222', '#4a6fa5', '#7a7a7a', '#c9b38a', '#2e7d32', '#8e44ad', '#e0e0e0'];
    for (const s of seats.list) {
      let col;
      const awayEnd = s.x < -APRON_X + 1; // barra visitante en la cabecera oeste
      const r = Math.random();
      if (awayEnd) col = r < 0.75 ? (r < 0.5 ? A.primary : A.secondary) : neutral[Math.floor(Math.random() * neutral.length)];
      else col = r < 0.62 ? (r < 0.45 ? H.primary : H.secondary) : neutral[Math.floor(Math.random() * neutral.length)];
      const barra = s.x > APRON_X && Math.abs(s.z) < 18;
      // La barra llega temprano; las filas de abajo se llenan antes que las de arriba
      const arrival = barra ? Math.random() * 0.55 : Math.min(1, Math.random() * 0.85 + Math.min(0.15, (s.row || 0) * 0.008));
      this.crowd.addPerson(s.x, s.y, s.z, s.rot, col, barra ? Math.random() * 0.15 : 0.15 + Math.random() * 0.85, { barra: barra && this.cfg.hasBarra !== false, cap: awayEnd ? A.primary : H.primary, row: s.row, arrival });
    }
    this.crowd.finalize(); this.group.add(this.crowd.mesh);
    this.crowdCount = this.crowd.count;
    // Banderas de la barra (cabecera este) y humo de colores en el clásico
    if (this.cfg.hasBarra) {
      const D = this.D.end;
      for (let i = 0; i < (this.cfg.clasico ? 7 : 4); i++) {
        const tex = TX.fabricTexture(i % 2 ? H.primary : H.secondary, i % 3 === 0 ? (i % 2 ? H.secondary : H.primary) : null);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6, 10, 4), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
        const row = 4 + (i % 3) * 3; const z = -14 + i * (28 / Math.max(1, (this.cfg.clasico ? 6 : 3)));
        f.position.set(APRON_X + row * this.cfg.rowDepth + 0.5, this.frontY + row * this.cfg.rowHeight + 2.6, z);
        f.rotation.y = -Math.PI / 2; f.userData.base = f.geometry.attributes.position.array.slice(); f.userData.phase = Math.random() * 6;
        this.group.add(f); this.flags.push(f);
      }
      // Gran bandera "tifo" (telón) sobre la barra
      const tifo = new THREE.Mesh(new THREE.PlaneGeometry(26, 5), new THREE.MeshStandardMaterial({ map: TX.signTexture((cfg.tifo || this.home.name).toUpperCase(), H.primary, H.secondary, 1024, 200, '900 120px Arial Black, Arial'), side: THREE.DoubleSide }));
      tifo.position.set(APRON_X + 0.35, this.frontY + 0.3, 0); tifo.rotation.y = -Math.PI / 2; tifo.position.y = this.frontY - 0.1; tifo.scale.set(1, 0.24, 1);
      this.group.add(tifo);
    }
  }
  buildRoofAndLights() {
    const cfg = this.cfg; const st = this.stands;
    const roofM = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
    const trussM = stdMat('#eef1f4', 0.45, 0.6);
    const addRoof = (len, D, topY, rotY, origin, truss = false, o = {}) => {
      const grp = new THREE.Group(); grp.rotation.y = rotY; grp.position.copy(origin); this.group.add(grp);
      const y = topY + 4.5;
      const rm = o.color ? new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }) : roofM;
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, D + 4), rm); r.position.set(0, y, D / 2 - 1.5); r.rotation.x = -0.08; r.castShadow = true; r.receiveShadow = true; grp.add(r);
      if (truss) {
        // Cerchas blancas sobre el techo (estructura triangulada visible)
        const H = 3.2, depth = D + 4, z0 = D / 2 - 1.5;
        for (let x = -len / 2 + 2; x <= len / 2 - 2; x += 8) {
          const top = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, depth), trussM); top.position.set(x, y + H, z0); grp.add(top);
          for (let k = 0; k < 6; k++) {
            const za = z0 - depth / 2 + (k / 6) * depth, zb = z0 - depth / 2 + ((k + 1) / 6) * depth;
            const ya = k % 2 ? y + H : y + 0.2, yb = k % 2 ? y + 0.2 : y + H;
            const len2 = Math.hypot(zb - za, yb - ya);
            const d = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, len2), trussM); d.position.set(x, (ya + yb) / 2, (za + zb) / 2); d.rotation.x = -Math.atan2(yb - ya, zb - za); grp.add(d);
          }
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, 0.2), trussM); post.position.set(x, y + H / 2, z0 + depth / 2 - 0.2); grp.add(post);
        }
        for (const zz of [z0 - depth / 2 + 0.2, z0 + depth / 2 - 0.2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 0.25), trussM); rail.position.set(0, y + H, zz); grp.add(rail); }
      }
      if (o.solar) { // paneles solares sobre el techo
        const pm = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.25, metalness: 0.6 });
        for (let x = -len / 2 + 3; x < len / 2 - 3; x += 2.1) for (let zz = -D / 2; zz < D / 2 - 1; zz += 1.25) {
          if (Math.floor((x + len / 2) / 26) % 3 === 2) continue;
          const pn = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 1.1), pm); pn.position.set(x, 0.19, zz); r.add(pn);
        }
      }
      if (o.fascia) { // banda frontal y trasera con letreros
        const fm = stdMat(o.fasciaColor || '#1a1a1a', 0.6);
        for (const [zz, txt, face] of [[-3.5, o.fascia, Math.PI], [D + 0.55, o.backText || o.fascia, 0]]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 0.25), fm); b.position.set(0, y - 0.45, zz); grp.add(b);
          const t = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(len * 0.6, 60), 1.4), new THREE.MeshStandardMaterial({ map: TX.signTexture(txt, o.fasciaColor || '#1a1a1a', '#ffffff', 2048, 96, 'bold 64px Arial'), roughness: 0.7 }));
          t.position.set(0, y - 0.45, zz + (face ? -0.14 : 0.14)); t.rotation.y = face; grp.add(t);
        }
      }
      const beamM = o.beam ? stdMat(o.beam, 0.5, 0.5) : this.m.steel;
      for (let x = -len / 2 + 4; x <= len / 2 - 4; x += o.beamStep || 16) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, y + 0.5, 0.5), beamM); col.position.set(x, (y + 0.5) / 2, D + 0.6); col.castShadow = true; grp.add(col);
        const truss = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, D + 4), beamM); truss.position.set(x, y - 0.35, D / 2 - 1.5); truss.rotation.x = -0.08; grp.add(truss);
        if (o.beam) { // diagonales visibles bajo el techo (estructura metálica)
          for (const k of [0.25, 0.6]) { const zz = -3.5 + (D + 4) * k, dg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, Math.hypot(4, D * 0.35)), beamM); dg.position.set(x, y - 2.2, zz); dg.rotation.x = Math.atan2(4, D * 0.35); grp.add(dg); }
        }
      }
      if (o.edge) { const e = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.35), stdMat(o.edge, 0.5, 0.4)); e.position.set(0, y + 0.25, -3.5); grp.add(e); }
      return { grp, y };
    };
    const nearLen = 2 * APRON_X + (cfg.corners ? 2 * this.D.end : 0);
    const truss = cfg.roof === 'sides' && !cfg.roofSpec;
    const RS = cfg.roofSpec || {};
    const nr = addRoof(nearLen, this.D.near, st.near.topY, 0, new THREE.Vector3(0, 0, APRON_Z), truss, RS.near || {});
    this.roofY = { near: nr.y };
    if (truss || RS.far) this.roofY.far = addRoof(2 * APRON_X, this.D.far, st.far.topY, Math.PI, new THREE.Vector3(0, 0, -APRON_Z), truss, RS.far || {}).y;
    // Cabinas de prensa (arriba de la gradería principal)
    const cab = new THREE.Group(); nr.grp.add(cab);
    for (let i = -4; i <= 4; i++) {
      const x = i * 4.2, z = this.D.near - 1.6, y = st.near.topY + 0.2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3), this.m.concreteDark); b.position.set(x, y + 1.2, z + 0.3); cab.add(b);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0xffe6b0, emissiveIntensity: 0.15, roughness: 0.1, metalness: 0.5 })); this.game.env.register(gl.material, 'emissiveIntensity', 0.15, 0.8);
      gl.position.set(x, y + 1.4, z - 1.21); gl.rotation.y = Math.PI; cab.add(gl);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.2), new THREE.MeshBasicMaterial({ map: TX.signTexture('PRENSA · TRIBUNA', '#0b3d91', '#ffffff', 1024, 90, 'bold 60px Arial') }));
    sign.position.set(0, st.near.topY + 3.1, this.D.near - 3.25); sign.rotation.y = Math.PI; nr.grp.add(sign);
    if (cfg.roof === 'full') {
      addRoof(nearLen, this.D.far, st.far.topY, Math.PI, new THREE.Vector3(0, 0, -APRON_Z));
      addRoof(2 * APRON_Z, this.D.end, st.east.topY, Math.PI / 2, new THREE.Vector3(APRON_X, 0, 0));
      addRoof(2 * APRON_Z, this.D.end, st.west.topY, -Math.PI / 2, new THREE.Vector3(-APRON_X, 0, 0));
    }
    // Iluminación de estadio
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 0.1 }); this.game.env.register(lampM, 'emissiveIntensity', 0.1, 3, 'flood');
    const glow = new THREE.SpriteMaterial({ map: TX.glowSprite('#fff2d8'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }); this.game.env.register(glow, 'opacity', 0, 0.9, 'flood');
    if (cfg.lights === 'towers') {
      const ox = APRON_X + this.D.end * 0.6 + 4, oz = APRON_Z + this.D.near * 0.5 + 4, H = Math.max(36, st.near.topY + 22);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * ox, z = sz * (sz > 0 ? oz : APRON_Z + this.D.far * 0.5 + 4);
        if (cfg.towerStyle === 'lattice') { // torre de celosía (cuatro patas + arriostramiento)
          const lm = stdMat('#8a8f95', 0.5, 0.7), b0 = 2.6, b1 = 0.9;
          const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          for (const [a, c] of legs) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.22, H, 0.22), lm); lg.position.set(x + a * (b0 + b1) / 2, H / 2, z + c * (b0 + b1) / 2); lg.rotation.set(-c * Math.atan((b0 - b1) / H), 0, a * Math.atan((b0 - b1) / H)); this.group.add(lg); }
          for (let yy = 3; yy < H - 1; yy += 3.2) { const w = b0 - (b0 - b1) * (yy / H); for (const [ox2, oz2, ry] of [[0, -w, 0], [0, w, 0], [-w, 0, Math.PI / 2], [w, 0, Math.PI / 2]]) { const br = new THREE.Mesh(new THREE.BoxGeometry(2 * w * 1.15, 0.1, 0.1), lm); br.position.set(x + ox2, yy, z + oz2); br.rotation.set(0, ry, ((yy / 3.2) % 2 ? 0.55 : -0.55)); this.group.add(br); } }
        } else {
          const poleM = cfg.towerStyle === 'striped' ? new THREE.MeshStandardMaterial({ map: (() => { const t = TX.fabricTexture('#c8102e', null).clone(); const c = TX.makeCanvas(32, 256), g2 = c.getContext('2d'); for (let i = 0; i < 8; i++) { g2.fillStyle = i % 2 ? '#f4f4f4' : '#c8102e'; g2.fillRect(0, i * 32, 32, 32); } return TX.toTex(c, { repeat: [1, 1] }); })(), roughness: 0.5, metalness: 0.3 }) : this.m.steel;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, H, 10), poleM); pole.position.set(x, H / 2, z); pole.castShadow = true; this.group.add(pole);
        }
        const head = new THREE.Group(); head.position.set(x, H + 2, z); head.lookAt(0, 0, 0); this.group.add(head);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.4), cfg.towerStyle === 'lattice' ? stdMat('#8a8f95', 0.5, 0.7) : this.m.darkSteel); head.add(frame);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const l = new THREE.Mesh(cfg.towerStyle === 'lattice' ? new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.CircleGeometry(0.55, 12), lampM);
          if (cfg.towerStyle === 'lattice') l.rotation.x = Math.PI / 2;
          l.position.set(-2.9 + i * 1.95, -1.6 + j * 1.6, 0.21); head.add(l);
        }
        const sp = new THREE.Sprite(glow); sp.scale.set(26, 26, 1); sp.position.copy(head.position); this.group.add(sp);
        this.lightPositions.push(new THREE.Vector3(x, H + 2, z));
      }
    } else {
      // Anillo LED bajo el techo
      const ring = [];
      const sides = cfg.roof === 'sides';
      for (let x = -48; x <= 48; x += sides ? 12 : 24) { ring.push([x, APRON_Z + 3, sides ? this.roofY.near - 0.8 : null]); ring.push([x, -APRON_Z - 3, sides ? this.roofY.far - 0.8 : null]); }
      if (!sides) for (const z of [-20, 20]) { ring.push([APRON_X + 3, z]); ring.push([-APRON_X - 3, z]); }
      const yy0 = Math.max(st.near.topY, st.far.topY) + 3.5;
      for (const [x, z, yr] of ring) {
        const yy = yr ?? yy0;
        const l = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 1.2), lampM); l.position.set(x, yy, z); this.group.add(l);
        const sp = new THREE.Sprite(glow); sp.scale.set(14, 14, 1); sp.position.set(x, yy - 0.5, z); this.group.add(sp);
        this.lightPositions.push(new THREE.Vector3(x, yy, z));
      }
    }
  }
  buildScoreboard() {
    const c = TX.makeCanvas(1024, 384); this.sbCanvas = c; this.sbCtx = c.getContext('2d');
    this.sbTex = TX.toTex(c, { wrap: false });
    const m = new THREE.MeshBasicMaterial({ map: this.sbTex, toneMapped: false });
    const W = 16, H = 6, st = this.stands.west;
    const x = -APRON_X - this.D.end - 1.2, y = st.topY + 4.5;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m); scr.position.set(x + 0.3, y + H / 2, 0); scr.rotation.y = Math.PI / 2; this.group.add(scr);
    const frame = this.box(0.5, H + 0.8, W + 0.8, this.m.darkSteel, x, y + H / 2, 0);
    for (const z of [-5, 5]) this.box(0.6, y, 0.6, this.m.steel, x - 0.2, y / 2, z);
    this.updateScoreboard({ home: 0, away: 0, minute: 0, phase: 'PREVIA' });
  }
  updateScoreboard({ home, away, minute, phase, message }) {
    const ctx = this.sbCtx, W = 1024, H = 384;
    ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0b1220'; ctx.fillRect(12, 12, W - 24, H - 24);
    const crestH = TX.crestCanvas(this.home, 150), crestA = TX.crestCanvas(this.away, 150);
    ctx.drawImage(crestH, 40, 40); ctx.drawImage(crestA, W - 190, 40);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center';
    ctx.fillText(this.home.short, 115, 240); ctx.fillText(this.away.short, W - 115, 240);
    ctx.font = '900 170px "Courier New", monospace'; ctx.fillStyle = '#ffcc33';
    ctx.fillText(`${home}-${away}`, W / 2, 190);
    ctx.font = 'bold 54px "Courier New", monospace'; ctx.fillStyle = '#7CFC00';
    ctx.fillText(message || `${phase}  ${String(Math.floor(minute)).padStart(2, '0')}'`, W / 2, 300);
    ctx.font = 'bold 26px Arial'; ctx.fillStyle = '#8899aa'; ctx.fillText(this.cfg.name.toUpperCase(), W / 2, 355);
    this.sbTex.needsUpdate = true;
  }
  // Pasillos interiores bajo la tribuna principal: túnel, vestuarios, sala de prensa.
  buildInterior() {
    const z0 = 50, z1 = this.gateZ - 0.3, x0 = -12, x1 = 12, H = 3.6;
    this.interior = { x0: -24, x1: x1, z0: APRON_Z, z1 };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 12, z1 - APRON_Z), this.m.tile);
    floor.rotation.x = -Math.PI / 2; floor.position.set((x0 - 12 + x1) / 2, 0.01, (APRON_Z + z1) / 2); floor.receiveShadow = true; this.group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 12, z1 - z0), this.m.concreteDark);
    ceil.rotation.x = Math.PI / 2; ceil.position.set((x0 - 12 + x1) / 2, H, (z0 + z1) / 2); this.group.add(ceil);
    this.col.add(x0 - 12, H, z0, x1, H + 0.4, z1, 'nostand'); this.col.add(-3.3, 3.0, APRON_Z, 3.3, 3.4, z0, 'nostand');
    const W = (x, z, w, d, h = H, mat = this.m.wallInt) => { this.box(w, h, d, mat, x, h / 2, z, { cast: false }); this.col.addCentered(x, z, w, d, h + 0.5); };
    // Paredes del pasillo principal. La pared oeste tiene el hueco de la sala de prensa.
    const pz0 = z0 + 1, pz1 = Math.min(z1 - 0.5, z0 + 12), px0 = -24, doorZ = (pz0 + pz1) / 2;
    const segA = doorZ - 0.65 - z0, segB = z1 - (doorZ + 0.65);
    W(x0, z0 + segA / 2, 0.3, segA); W(x0, z1 - segB / 2, 0.3, segB);
    W(x1, (z0 + z1) / 2, 0.3, z1 - z0);
    // Pared frontal: túnel (x -3..3) y puertas de vestuarios (huecos de 1.2 m centrados en x=±4.6)
    W(-8.6, z0, 6.8, 0.3); W(-3.5, z0, 1.0, 0.3); W(3.5, z0, 1.0, 0.3); W(8.6, z0, 6.8, 0.3);
    this.box(6, H - 3.0, 0.3, this.m.wallInt, 0, 3.0 + (H - 3.0) / 2, z0, { cast: false });
    // Puertas de vestuarios (en huecos de 1.2 m en x=-4.6 y x=4.6)
    const doorM = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.5 });
    const doorM2 = new THREE.MeshStandardMaterial({ color: 0x1a3a8a, roughness: 0.5 });
    this.lockerDoors = [];
    for (const [x, m, lbl] of [[-4.6, doorM, 'VESTUARIO LOCAL'], [4.6, doorM2, 'VESTUARIO VISITA']]) {
      const d = new Door({ scene: this.group, collision: this.col, x, z: z0, width: 1.2, mat: m, label: lbl }); this.doors.push(d); this.lockerDoors.push(d);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTexture(lbl, '#111111', '#ffffff', 512, 100, 'bold 44px Arial') }));
      s.position.set(x, 2.6, z0 + 0.17); this.group.add(s);
    }
    // Túnel hacia la cancha
    for (const s of [-1, 1]) W(s * 3.15, (APRON_Z + z0) / 2, 0.3, z0 - APRON_Z, 3.0);
    const tr = this.box(6.6, 0.3, z0 - APRON_Z, this.m.concreteDark, 0, 3.15, (APRON_Z + z0) / 2, { cast: true });
    const stripM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 2 });
    for (let z = APRON_Z + 1; z < z0; z += 2) this.box(3, 0.05, 0.25, stripM, 0, 2.98, z, { cast: false });
    const tunnelSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), new THREE.MeshBasicMaterial({ map: TX.signTexture('CANCHA', '#0a7a3a', '#ffffff', 512, 80, 'bold 56px Arial') }));
    tunnelSign.position.set(0, 2.5, z0 + 0.17); this.group.add(tunnelSign);
    // Luces del pasillo
    for (const [x, z] of [[-6, (z0 + z1) / 2], [6, (z0 + z1) / 2], [0, APRON_Z + 3]]) {
      const pl = new THREE.PointLight(0xfff1dc, 18, 16, 1.6); pl.position.set(x, H - 0.3, z); this.group.add(pl);
      this.box(1.4, 0.06, 0.4, stripM, x, H - 0.04, z, { cast: false });
    }
    // Sala de prensa (puerta en la pared oeste)
    W(px0, (pz0 + pz1) / 2, 0.3, pz1 - pz0); W((px0 + x0) / 2, pz0, x0 - px0, 0.3); W((px0 + x0) / 2, pz1, x0 - px0, 0.3);
    const pc = new THREE.Mesh(new THREE.PlaneGeometry(x0 - px0, pz1 - pz0), this.m.concreteDark); pc.rotation.x = Math.PI / 2; pc.position.set((px0 + x0) / 2, H, (pz0 + pz1) / 2); this.group.add(pc);
    const pressDoor = new Door({ scene: this.group, collision: this.col, x: x0, z: doorZ, width: 1.3, axis: 'z', mat: new THREE.MeshStandardMaterial({ color: 0x0b3d91, roughness: 0.5 }), label: 'SALA DE PRENSA' });
    this.doors.push(pressDoor); this.pressDoor = pressDoor;
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTexture('SALA DE PRENSA', '#0b3d91', '#ffffff', 512, 100, 'bold 44px Arial') }));
    ps.position.set(x0 + 0.17, 2.6, doorZ); ps.rotation.y = Math.PI / 2; this.group.add(ps);
    // Mobiliario de la sala de prensa: mesas, laptops, pantalla
    const deskM = TX.woodTexture(), desk = new THREE.MeshStandardMaterial({ map: deskM, roughness: 0.6 });
    this.pressLaptops = [];
    for (let i = 0; i < 3; i++) {
      const dz = pz0 + 2 + i * 3.2;
      this.box(5, 0.08, 1.2, desk, -18, 0.76, dz); this.col.addCentered(-18, dz, 5, 1.2, 0.8);
      for (const lx of [-20, -18, -16]) {
        const lap = this.box(0.36, 0.02, 0.25, this.m.darkSteel, lx, 0.81, dz - 0.15);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x4a8ad4, emissiveIntensity: 0.9 }));
        scr.position.set(lx, 0.94, dz + 0.0); scr.rotation.x = -0.25; scr.rotation.y = Math.PI; this.group.add(scr);
        this.pressLaptops.push(new THREE.Vector3(lx, 0.9, dz - 0.15));
      }
    }
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: TX.signTexture('ASCENSO TOTAL\nEN VIVO', '#0b3d91', '#ffffff', 512, 288, 'bold 40px Arial') }));
    tv.position.set(px0 + 0.2, 2, (pz0 + pz1) / 2); tv.rotation.y = Math.PI / 2; this.group.add(tv);
    const pl = new THREE.PointLight(0xfff1dc, 16, 16, 1.6); pl.position.set(-18, H - 0.3, (pz0 + pz1) / 2); this.group.add(pl);
    // Zona de preparación de prensa (pared este del pasillo): banca, casilleros y letrero
    {
      const bz = (z0 + z1) / 2, lockerM = stdMat('#3d5a80', 0.45, 0.5), benchM = new THREE.MeshStandardMaterial({ map: TX.woodTexture(), roughness: 0.6 });
      for (let k = -3; k <= 3; k++) { const lk = this.box(0.5, 2.0, 0.95, lockerM, x1 - 0.45, 1.0, bz + k * 1.0); const hd = this.box(0.04, 0.18, 0.05, this.m.steel, x1 - 0.72, 1.1, bz + k * 1.0 + 0.3, { cast: false }); }
      this.col.addCentered(x1 - 0.45, bz, 0.6, 7, 2.0);
      this.box(0.8, 0.07, 3.6, benchM, x1 - 2.1, 0.48, bz); for (const zz of [-1.5, 1.5]) this.box(0.6, 0.45, 0.08, this.m.darkSteel, x1 - 2.1, 0.23, bz + zz);
      this.col.addCentered(x1 - 2.1, bz, 0.8, 3.6, 0.52, 0, 'nostand');
      const ps2 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.45), new THREE.MeshBasicMaterial({ map: TX.signTexture('PREPARACIÓN · PRENSA', '#0b3d91', '#ffffff', 512, 72, 'bold 40px Arial') }));
      ps2.position.set(x1 - 0.17, 2.45, bz); ps2.rotation.y = -Math.PI / 2; this.group.add(ps2);
      this.spots.prepBench = new THREE.Vector3(x1 - 2.1, 0.52, bz); this.spots.prepStand = new THREE.Vector3(x1 - 3.3, 0, bz);
    }
    this.spots.laptop = new THREE.Vector3(-18, 0, pz0 + 2 - 0.9);
    this.spots.pressRoom = new THREE.Vector3(-14, 0, doorZ);
    this.spots.tunnelMouth = new THREE.Vector3(0, 0, APRON_Z - 1.5);
    this.spots.hall = new THREE.Vector3(0, 0, (z0 + z1) / 2 + 2);
    // Señales de dirección
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), new THREE.MeshBasicMaterial({ map: TX.signTexture('← PRENSA   |   CANCHA ↑', '#222', '#fff', 768, 128, 'bold 52px Arial') }));
    s2.position.set(0, 3.0, z1 - 0.2); s2.rotation.y = Math.PI; this.group.add(s2);
  }
  buildSecurity() {
    const gz = this.gateZ, cfg = this.cfg;
    // Fachada exterior con hueco del acceso de prensa (x -2..2)
    const facH = Math.max(10, this.stands.near.topY + 2);
    const facLen = 2 * APRON_X + 2 * this.D.end + 6;
    const left = this.box(facLen / 2 - 2, facH, 0.6, this.m.facade, -(facLen / 4 + 1), facH / 2, gz, { cast: true });
    const right = this.box(facLen / 2 - 2, facH, 0.6, this.m.facade, (facLen / 4 + 1), facH / 2, gz, { cast: true });
    this.col.addCentered(-(facLen / 4 + 1), gz, facLen / 2 - 2, 0.6, facH); this.col.addCentered(facLen / 4 + 1, gz, facLen / 2 - 2, 0.6, facH);
    this.box(4, facH - 3, 0.6, this.m.facade, 0, 3 + (facH - 3) / 2, gz); this.col.add(-2.1, 3, gz - 0.3, 2.1, facH, gz + 0.3, 'nostand');
    // Laterales de la fachada que cierran el recinto
    for (const s of [-1, 1]) { this.box(0.6, facH, gz + 10, this.m.facade, s * facLen / 2, facH / 2, gz / 2 - 5); this.col.addCentered(s * facLen / 2, gz / 2 - 5, 0.6, gz + 10, facH); }
    if (cfg.facadeText) {
      const w = Math.min(90, facLen * 0.6);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.2), new THREE.MeshStandardMaterial({ map: TX.signTexture(cfg.facadeText, cfg.facade, '#ffffff', 2048, 96, '900 66px Arial Black, Arial'), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.12 }));
      sg.material.emissiveMap = sg.material.map; sg.position.set(-6, facH - 3.2, gz + 0.34); this.group.add(sg);
      this.box(facLen, 3.2, 0.62, stdMat(cfg.facadeBand || '#c8102e', 0.7), 0, 1.6, gz + 0.02, { cast: false });
    }
    if (cfg.brickCorners) {
      const bm = new THREE.MeshStandardMaterial({ map: TX.brickTexture([6, 2]), roughness: 0.85 });
      for (const sx of [-1, 1]) {
        const cy = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 4.6, 24, 1, false, -Math.PI / 2, Math.PI), bm); cy.position.set(sx * 34, 2.3, gz + 0.3); cy.castShadow = true; this.group.add(cy);
        const roofC = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.3, 24, 1, false, -Math.PI / 2, Math.PI), stdMat(cfg.facadeBand || '#c8102e', 0.6)); roofC.position.set(sx * 34, 4.75, gz + 0.3); this.group.add(roofC);
        this.col.addCentered(sx * 34, gz + 3.2, 12, 6, 4.6);
      }
    }
    if (cfg.facadeLetters) {
      const letters = [...cfg.facadeLetters], pw = 7.4, gap = 1.1, total = letters.length * (pw + gap);
      for (let i = 0; i < letters.length; i++) {
        const x = -total / 2 + i * (pw + gap) + pw / 2;
        const ch = letters[i];
        const tex = TX.signTexture(ch, cfg.facadeBand || '#6d1f3a', '#ffffff', 512, 512, ch.length > 1 ? 'bold 64px Georgia' : '900 360px Arial Black, Arial');
        const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, 7.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
        p.position.set(x, 8.2, gz + 0.33); this.group.add(p);
        this.box(0.45, facH, 0.5, this.m.steel, x + pw / 2 + gap / 2, facH / 2, gz + 0.45);
      }
      this.box(total + 2, 0.5, 0.6, this.m.steel, 0, 4.4, gz + 0.45);
    }
    const name = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.4), new THREE.MeshStandardMaterial({ map: TX.signTexture(cfg.name.toUpperCase(), '#00000000', '#1a1a1a', 2048, 160, 'bold 110px Georgia'), transparent: true }));
    name.position.set(0, cfg.facadeLetters ? 2.4 : facH - 2, cfg.facadeLetters ? gz + 0.36 : gz + 0.32); if (cfg.facadeLetters) { name.scale.set(0.5, 0.5, 1); name.position.x = 20; } this.group.add(name);
    const pr = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), new THREE.MeshBasicMaterial({ map: TX.signTexture('ACCESO DE PRENSA', '#0b3d91', '#ffffff', 512, 90, 'bold 52px Arial') }));
    pr.position.set(0, 3.5, gz + 0.32); this.group.add(pr);
    // Puerta corrediza del control de seguridad
    // Puerta automática de vidrio (transparente y corrediza) sobre la cara interior de la fachada
    this.gate = new GlassSlidingDoor({ scene: this.group, collision: this.col, x: 0, z: gz - 0.7, width: 4, height: 3, label: 'ACCESO',
      signTexture: TX.signTexture('ACCESO DE PRENSA · SOLO ACREDITADOS', '#00000000', '#0b3d91', 1024, 160, 'bold 64px Arial') });
    this.doors.push(this.gate);
    // Arco detector de metales y escáner de equipaje
    const det = new THREE.Group(); det.position.set(0, 0, gz + 2.4); this.group.add(det);
    for (const s of [-1, 1]) { const p = this.box(0.25, 2.3, 0.5, this.m.darkSteel, s * 0.55, 1.15, 0, { parent: det }); this.col.addCentered(s * 0.55, gz + 2.4, 0.25, 0.5, 2.3); }
    this.box(1.35, 0.25, 0.5, this.m.darkSteel, 0, 2.38, 0, { parent: det });
    this.detectorLight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x33ff55 }));
    this.detectorLight.position.set(0, 2.55, 0.26); det.add(this.detectorLight);
    // Escáner de rayos X con banda
    const xr = new THREE.Group(); xr.position.set(-3.2, 0, gz + 3.2); this.group.add(xr);
    this.box(1.1, 1.3, 1.6, this.m.white, 0, 0.95, 0, { parent: xr });
    this.box(0.9, 0.08, 4.2, this.m.darkSteel, 0, 0.78, 0, { parent: xr });
    const curtain = this.box(0.8, 0.5, 0.02, new THREE.MeshStandardMaterial({ color: 0x222222 }), 0, 1.0, 0.81, { parent: xr });
    this.col.addCentered(-3.2, gz + 3.2, 1.2, 4.2, 1.4);
    this.xray = xr; this.spots.xrayIn = new THREE.Vector3(-3.2, 0.85, gz + 5.1); this.spots.xrayOut = new THREE.Vector3(-3.2, 0.85, gz + 1.3);
    // Monitor del escáner
    this.xrayScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ color: 0x0a1a10 }));
    this.xrayScreen.position.set(-2.2, 1.5, gz + 3.2); this.xrayScreen.rotation.y = Math.PI / 2 + 0.6; this.group.add(this.xrayScreen);
    this.box(0.1, 1.4, 0.1, this.m.darkSteel, -2.3, 0.7, gz + 3.2);
    // Vallas de fila (conducen al control)
    for (const s of [-1, 1]) {
      for (let z = gz + 1; z < gz + 9; z += 2) {
        this.box(0.05, 1.0, 2, this.m.steel, s * 1.9, 0.5, z + 1, { cast: false });
      }
      this.col.addCentered(s * 1.9, gz + 5, 0.15, 8, 1.1);
    }
    // Torniquetes del ingreso general (cerrados para el jugador)
    [-20, -14, 14, 20].forEach((x, ai) => {
      this.box(3, 3, 0.4, this.m.darkSteel, x, 1.5, gz + 0.1);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.5), new THREE.MeshBasicMaterial({ map: TX.signTexture(`ACCESO ${ai + 1}`, cfg.facadeBand || '#c8102e', '#fff', 512, 90, 'bold 46px Arial') }));
      t.position.set(x, 3.3, gz + 0.32); this.group.add(t);
    });
    this.spots.guard = new THREE.Vector3(1.4, 0, gz + 3.4);
    this.spots.gateOutside = new THREE.Vector3(0, 0, gz + 9);
    this.spots.gateInside = new THREE.Vector3(0, 0, gz - 2);
  }
  defineZones() {
    const { L, W } = PITCH;
    // Zonas prohibidas: la cancha siempre, el área técnica durante el juego, la boca del área.
    this.zones.restricted.push({ id: 'pitch', name: 'la cancha', x0: -L / 2 - 0.6, x1: L / 2 + 0.6, z0: -W / 2 - 0.6, z1: W / 2 + 0.6, when: 'always' });
    this.zones.restricted.push({ id: 'tech', name: 'el área técnica', x0: -16, x1: 16, z0: W / 2 + 0.6, z1: 41.0, when: 'play' });
    for (const s of [-1, 1]) this.zones.restricted.push({ id: 'goalLine' + s, name: 'la zona de la portería', x0: s > 0 ? L / 2 + 0.6 : -L / 2 - 2.2, x1: s > 0 ? L / 2 + 2.2 : -L / 2 - 0.6, z0: -6, z1: 6, when: 'play' });
    for (const s of [-1, 1]) this.zones.press.push({ id: 'press' + s, name: s > 0 ? 'Zona de prensa Este' : 'Zona de prensa Oeste', x0: s > 0 ? L / 2 + 2.2 : -L / 2 - 6.5, x1: s > 0 ? L / 2 + 6.5 : -L / 2 - 2.2, z0: -28, z1: 28 });
    this.zones.press.push({ id: 'farSide', name: 'Banda lateral opuesta', x0: -52, x1: 52, z0: -43.5, z1: -38.7 });
    this.zones.press.push({ id: 'nearSide', name: 'Banda lateral principal', x0: 16, x1: 52, z0: 38.7, z1: 43.5 });
    this.zones.press.push({ id: 'nearSideW', name: 'Banda lateral principal', x0: -52, x1: -16, z0: 38.7, z1: 43.5 });
    // Lugares de fotógrafos NPC (sentados detrás de las porterías)
    this.spots.photographers = [];
    for (const s of [-1, 1]) for (const z of [-22, -15, -9, 9, 15, 22]) this.spots.photographers.push(new THREE.Vector3(s * (L / 2 + 4.6), 0, z + (Math.random() - 0.5)));
    this.spots.alvaro = new THREE.Vector3(L / 2 + 4.2, 0, 11.5);
    this.spots.stewards = [];
    for (let x = -50; x <= 50; x += 20) { this.spots.stewards.push(new THREE.Vector3(x, 0, -APRON_Z + 1.2)); if (Math.abs(x) > 18) this.spots.stewards.push(new THREE.Vector3(x, 0, APRON_Z - 1.2)); }
    for (const s of [-1, 1]) for (const z of [-30, 30]) this.spots.stewards.push(new THREE.Vector3(s * (APRON_X - 1.2), 0, z));
  }
  zoneAt(x, z, list) { for (const r of list) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r; return null; }
  update(dt, t, excite) {
    this.crowd.uniforms.uTime.value = t;
    for (const d of this.doors) d.update(dt);
    // Banderas ondeando
    for (const f of this.flags) {
      const pos = f.geometry.attributes.position, base = f.userData.base;
      if (!base) { f.rotation.y = Math.sin(t * 2 + f.position.x) * 0.3; continue; }
      const ph = f.userData.phase, k = 0.25 + excite * 0.6;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 1.3 + t * 4 + ph) * 0.25 * k * ((x + 2) / 4) + Math.sin(y * 2 + t * 3) * 0.05;
        pos.array[i * 3 + 1] = y + Math.sin(t * 2.2 + ph) * 0.25 * k;
      }
      pos.needsUpdate = true;
    }
  }
}
