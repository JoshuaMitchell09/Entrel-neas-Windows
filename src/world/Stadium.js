import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from '../gfx/Textures.js';
import { Crowd } from './Crowd.js';
import { Door, GlassSlidingDoor } from '../interaction/Interaction.js';
import { stdMat, Humanoid } from '../characters/Humanoid.js';
import { mergeStatic } from '../gfx/Merge.js';
import { squad } from '../football/Teams.js';

export const PITCH = { L: 105, W: 68, apron: 8 };
export const APRON_X = 63.5, APRON_Z = 43.5; // borde frontal de las graderías
// Zona de comidas del público: bajo la tribuna principal, al oeste, con entrada propia desde la calle (lejos del acceso de prensa)
export const FOOD = { xa: -48, xb: -27.5, door: -44, doorW: 3.4 };
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
    // Cancha: 105×68 en estadios; fut 5 / fut 7 usan una cancha chica en el centro del recinto
    this.mini = !!cfg.pitch; this.P = cfg.pitch ? { L: cfg.pitch.L, W: cfg.pitch.W, apron: cfg.pitch.apron ?? 3, goalW: cfg.pitch.goalW, goalH: cfg.pitch.goalH } : PITCH;
    this.D = { near: cfg.nearRows * cfg.rowDepth, end: Math.max(cfg.endRows, cfg.eastRows ?? 0) * cfg.rowDepth, far: cfg.farRows * cfg.rowDepth };
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
    this.buildExtraFields();
    this.buildInterior();
    this.buildSecurity();
    this.defineZones();
    for (const t of this.trainees || []) t.h.root.traverse((o) => { o.userData.noMerge = true; });
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
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(2 * APRON_X + 2, 2 * APRON_Z + 2), this.cfg.ground ? new THREE.MeshStandardMaterial({ map: TX.concreteTexture(this.cfg.ground, 9, [30, 22]), roughness: 0.95 }) : this.m.track);
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; this.group.add(outer);
  }
  buildPitch() {
    const { L, W, apron } = this.P;
    const wet = this.game.env.wet;
    const gn = TX.noiseNormalMap('grass', 256, 24, 4, 5, true).clone(); gn.needsUpdate = true; gn.repeat.set((L + 2 * apron) / 1.6, (W + 2 * apron) / 1.6);
    this.pitchMat = new THREE.MeshStandardMaterial({ map: TX.pitchTexture(L, W, apron, wet, !!this.cfg.turf, !!this.cfg.track), normalMap: gn, normalScale: new THREE.Vector2(0.55, 0.55), roughness: wet ? 0.42 : 0.93, metalness: 0 });
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
    if (this.mini) return this.buildMiniFence();
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
    // Vallas LED en las bandas: un solo atlas con todas las marcas que rota como en los estadios reales
    const LIST = this.cfg.cup ? [['COPA CENTROAMERICANA', '#b0205c', '#ffffff', 'El torneo de clubes de la región', '#ffd400'], ...ADS.slice(0, 3), ['COPA CENTROAMERICANA', '#f2542d', '#ffffff', 'Noche internacional', '#ffd400'], ...ADS.slice(3, 6)] : ADS;
    const N = LIST.length, atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 128 * N;
    const actx = atlas.getContext('2d'); LIST.forEach((ad, i) => actx.drawImage(TX.adTexture(...ad).image, 0, 128 * (N - 1 - i)));
    // Rejilla de píxeles LED
    actx.globalAlpha = 0.16; actx.fillStyle = '#000'; for (let y = 0; y < atlas.height; y += 4) actx.fillRect(0, y, 1024, 1); for (let x = 0; x < 1024; x += 4) actx.fillRect(x, 0, 1, atlas.height); actx.globalAlpha = 1;
    const led = new THREE.CanvasTexture(atlas); led.colorSpace = THREE.SRGBColorSpace; led.anisotropy = 8; led.wrapT = THREE.RepeatWrapping; led.repeat.set(1, 1 / N);
    this.led = { tex: led, n: N, idx: 0, t: 0 };
    const ledM = new THREE.MeshStandardMaterial({ map: led, emissive: 0xffffff, emissiveMap: led, emissiveIntensity: 0.45, roughness: 0.35 }); this.game.env.register(ledM, 'emissiveIntensity', 0.45, 0.95);
    const mkLed = (len, x, z, ry) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, boardH, 0.25), [this.m.darkSteel, this.m.darkSteel, this.m.darkSteel, this.m.darkSteel, ledM, this.m.darkSteel]);
      b.position.set(x, boardH / 2, z); b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true; this.group.add(b);
      this.col.addRotated(x, z, len, 0.3, ry, boardH);
    };
    // Laterales: lado lejano completo; lado cercano con hueco en el área técnica.
    for (let x = -50; x < 50; x += 10) mkLed(9.9, x + 5, -38.5, 0);
    for (let x = -50; x < 50; x += 10) { if (x >= -20 && x < 20) continue; mkLed(9.9, x + 5, 38.5, Math.PI); }
    // Detrás de las porterías (dejan pasillos en las esquinas)
    for (const s of [-1, 1]) for (let z = -28; z < 28; z += 8) mkBoard(7.9, s * 59.6, z + 4, s > 0 ? -Math.PI / 2 : Math.PI / 2, ADS[k++ % ADS.length]);
  }
  buildGoals() {
    const { L } = this.P;
    const postM = stdMat('#ffffff', 0.35, 0.1);
    const netCanvas = TX.makeCanvas(128, 128), ctx = netCanvas.getContext('2d');
    ctx.strokeStyle = 'rgba(240,240,240,0.9)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 128; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke(); }
    const netTex = TX.toTex(netCanvas, { repeat: [8, 3], srgb: true });
    const netM = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 });
    this.goals = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * L / 2, 0, 0); this.group.add(g);
      const r = 0.06, H = this.P.goalH || 2.44, Wg = this.P.goalW || 7.32, depth = this.mini ? 1.2 : 2.0;
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
      this.col.addCentered(s * (L / 2 + depth / 2), 0, depth, Wg, H, 0, 'goal');
      this.goals.push(g);
    }
  }
  buildBenches() {
    if (this.mini) return this.buildMiniBenches();
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
  // Lado sin gradería: muro bajo con malla ciclón (se ven las otras canchas o las casas del barrio)
  fenceSide(len, rotY, origin) {
    const grp = new THREE.Group(); grp.rotation.y = rotY; grp.position.copy(origin); this.group.add(grp);
    const H = this.cfg.fenceH || 4.2;
    const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.3), this.m.concrete); curb.position.set(0, 0.45, 0.15); curb.castShadow = true; grp.add(curb);
    if (!this.fenceMat) {
      const c = TX.makeCanvas(64, 64), x = c.getContext('2d'); x.strokeStyle = 'rgba(200,205,210,0.95)'; x.lineWidth = 2.2;
      for (let i = -64; i < 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
      const t = TX.toTex(c, { repeat: [1, 1] }); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.fenceMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
    }
    const m = this.fenceMat.clone(); m.map = this.fenceMat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.2, (H - 0.9) / 1.2);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 0.9), m); f.position.set(0, 0.9 + (H - 0.9) / 2, 0.3); grp.add(f);
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H, 6), this.m.steel); p.position.set(x, H / 2, 0.3); grp.add(p); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), this.m.steel); top.rotation.z = Math.PI / 2; top.position.set(0, H, 0.3); grp.add(top);
    return { grp, D: 0.4, topY: H };
  }
  stand(rows, len, rd, rh, { cutout = null, crowdSeats, rotY, origin, tier = null, banner = null }) {
    if (rows === 0 && this.cfg.openSides) return this.fenceSide(len, rotY, origin);
    const geos = [], seatPos = [], aisleGeos = [];
    const fy = this.frontY, cfg = this.cfg;
    const topOf = (i) => fy + i * rh + (tier && i >= tier.row ? tier.rise : 0);
    const A = cfg.aisleEvery || 0;
    const inAisle = (x) => A && ((x + len / 2) % A) < 1.0;
    for (let i = 0; i < rows; i++) {
      const top = topOf(i), z0 = i * rd, segs = [];
      if (A) for (let ax = -len / 2 + A; ax < len / 2 - 1; ax += A) {
        // Sin pasillo donde la gradería está recortada (túnel, vestuarios y palco): quedaría flotando
        if (cutout && top < cutout.maxTop && ax + 1 > cutout.x0 - 0.3 && ax < cutout.x1 + 0.3) continue;
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
      const pat = this.cfg.seatPattern === 'tiers' ? row < (tier ? tier.row : rows / 2) : this.cfg.seatPattern === 'blocks' ? Math.floor((x + len / 2) / (this.cfg.aisleEvery || 9)) % 2 === 0 : this.cfg.seatPattern === 'solid' ? true : (row % 6 < 3) !== (Math.floor((x + 200) / 12) % 2 === 0);
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
      near: this.stand(cfg.nearRows, nearLen, cfg.rowDepth, cfg.rowHeight, { cutout: { x0: -12.3, x1: 12.3, maxTop: 4.7 }, crowdSeats: seats, rotY: 0, origin: new THREE.Vector3(0, 0, APRON_Z), tier: cfg.tiers?.near, banner: cfg.banners?.near }),
      far: this.stand(cfg.farRows, 2 * APRON_X + (cfg.corners ? 2 * this.D.end : 0), cfg.rowDepth, cfg.rowHeight, { crowdSeats: seats, rotY: Math.PI, origin: new THREE.Vector3(0, 0, -APRON_Z), tier: cfg.tiers?.far, banner: cfg.banners?.far }),
      east: this.stand(cfg.eastRows ?? cfg.endRows, endLen, cfg.rowDepth, cfg.rowHeight, { crowdSeats: seats, rotY: Math.PI / 2, origin: new THREE.Vector3(APRON_X, 0, 0), tier: cfg.tiers?.east, banner: cfg.banners?.east }),
      west: this.stand(cfg.westRows ?? cfg.endRows, endLen, cfg.rowDepth, cfg.rowHeight, { crowdSeats: seats, rotY: -Math.PI / 2, origin: new THREE.Vector3(-APRON_X, 0, 0), tier: cfg.tiers?.west, banner: cfg.banners?.west }),
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
    if (cfg.roof === 'arcs') return this.buildArcRoofs();
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
    if (cfg.lights === 'poles') this.buildPoleLights(lampM, glow);
    else if (cfg.lights === 'towers') {
      // Torres en las esquinas, fuera de la huella de los techos, y más altas que ellos (si no, el techo las tapa)
      const ox = cfg.corners ? APRON_X + this.D.end + 7 : APRON_X + this.D.end * 0.6 + 5, oz = APRON_Z + this.D.near * 0.5 + 4;
      const H = Math.max(38, Math.max(st.near.topY, st.far.topY, st.east?.topY || 0) + 26);
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
      // Focos en el borde frontal del techo (el techo baja hacia adelante: si quedan atrás, el borde los tapa)
      const edgeY = (side) => (this.roofY[side] ?? (Math.max(st.near.topY, st.far.topY) + 4.5)) - 0.08 * ((this.D[side] + 4) / 2) - 0.6;
      for (let x = -48; x <= 48; x += sides ? 12 : 24) { ring.push([x, APRON_Z - 2.4, edgeY('near')]); ring.push([x, -APRON_Z + 2.4, edgeY('far')]); }
      if (!sides) { const ey = st.east.topY + 4.5 - 0.08 * ((this.D.end + 4) / 2) - 0.6; for (const z of [-20, 20]) { ring.push([APRON_X - 2.4, z, ey]); ring.push([-APRON_X + 2.4, z, ey]); } }
      const yy0 = Math.max(st.near.topY, st.far.topY) + 3.5;
      for (const [x, z, yr] of ring) {
        const yy = yr ?? yy0;
        const l = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 1.2), lampM); l.position.set(x, yy, z); this.group.add(l);
        const sp = new THREE.Sprite(glow); sp.scale.set(14, 14, 1); sp.position.set(x, yy - 0.5, z); this.group.add(sp);
        this.lightPositions.push(new THREE.Vector3(x, yy, z));
      }
    }
  }
  // Techos en forma de ala sobre las tribunas laterales (Estadio Nacional): bajan hasta el suelo en las esquinas,
  // con paneles plegados en diente de sierra, cerchas de acero a la vista y focos bajo el borde frontal.
  buildArcRoofs() {
    const cfg = this.cfg, st = this.stands;
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 0.1 }); this.game.env.register(lampM, 'emissiveIntensity', 0.1, 3, 'flood');
    const glow = new THREE.SpriteMaterial({ map: TX.glowSprite('#fff2d8'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }); this.game.env.register(glow, 'opacity', 0, 0.9, 'flood');
    const roofM = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.45, metalness: 0.15, flatShading: true, side: THREE.DoubleSide });
    const steel = stdMat('#e3e7eb', 0.4, 0.7), steel2 = stdMat('#b9c1c9', 0.45, 0.7);
    const half = APRON_X + this.D.end + 16, nu = 160, nv = 16, N = 16;
    this.roofY = {};
    for (const s of [1, -1]) {
      const side = s > 0 ? 'near' : 'far', D = this.D[side], top = st[side].topY, Hc = top + 13;
      const zF = (u) => s * (APRON_Z - 4.5 + 4 * u * u), zB = (u) => s * (APRON_Z + D + 2.5 - 2 * u * u);
      const h = (u) => Hc * Math.pow(Math.max(0, 1 - u * u), 0.5);
      const Y = (u, v) => { const w = Math.abs(((u + 1) * N / 2) % 1 - 0.5) * 2; return Math.max(0.2, h(u) * (1 - 0.4 * v * v) + (0.5 - w) * 9 * Math.pow(v, 1.15) * Math.min(1, h(u) / 10)); };
      const pos = [], idx = [];
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = -1 + 2 * i / nu, v = j / nv; pos.push(u * half, Y(u, v), zF(u) + (zB(u) - zF(u)) * v); }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g = g.toNonIndexed(); g.computeVertexNormals();
      const roof = new THREE.Mesh(g, roofM); roof.castShadow = true; roof.receiveShadow = true; this.group.add(roof);
      this.roofY[side] = Hc;
      // Cerchas: borde frontal (bajo el techo) y borde trasero (arco sobre la fachada)
      const chord = (fz, dy, r, mat, u0 = -0.97, u1 = 0.97) => {
        const pts = []; for (let k = 0; k <= 60; k++) { const u = u0 + (u1 - u0) * k / 60; pts.push(new THREE.Vector3(u * half, Math.max(0.2, Y(u, fz === 'f' ? 0 : 1) - dy), fz === 'f' ? zF(u) : zB(u))); }
        const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, r, 8, false), mat); t.castShadow = true; this.group.add(t); return pts;
      };
      for (const [fz, deep] of [['f', 3.2], ['b', 2.6]]) {
        const a = chord(fz, 0.35, 0.32, steel), b = chord(fz, deep, 0.24, steel2);
        for (let k = 1; k < a.length - 1; k++) {
          const p0 = a[k], p1 = b[k + (k % 2 ? 1 : -1)]; if (!p1 || p0.y < 1.2) continue;
          const d = new THREE.Vector3().subVectors(p1, p0), L = d.length();
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, L, 6), steel2); m.position.copy(p0).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); this.group.add(m);
        }
      }
      // Focos bajo el borde frontal del techo
      for (let u = -0.56; u <= 0.57; u += 0.08) {
        const x = u * half, y = Y(u, 0) - 3.8, z = zF(u) + s * 1.2;
        const l = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 1), lampM); l.position.set(x, y, z); this.group.add(l);
        const sp = new THREE.Sprite(glow); sp.scale.set(12, 12, 1); sp.position.set(x, y - 0.5, z); this.group.add(sp);
        this.lightPositions.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  // Postes de concreto con racimos de focos redondos (canchas de barrio y complejos de entrenamiento)
  buildPoleLights(lampM, glow) {
    const cfg = this.cfg, st = this.stands, H = cfg.poleH || 24;
    const poleM = stdMat('#c9c6bd', 0.85), frameM = this.m.darkSteel;
    const spots = [];
    for (const x of [-44, 0, 44]) spots.push([x, -(APRON_Z + this.D.far + 1.6)]);
    for (const sx of [-1, 1]) spots.push([sx * 54, APRON_Z - 1.1]);
    for (const p of cfg.extraPoles || []) spots.push(p);
    const lampG = new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); lampG.rotateX(Math.PI / 2);
    if (cfg.poles) spots.splice(0, spots.length, ...cfg.poles);
    for (const [x, z] of spots) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, H, 10), poleM); pole.position.set(x, H / 2, z); pole.castShadow = true; this.group.add(pole);
      this.col.addCentered(x, z, 0.9, 0.9, H);
      const head = new THREE.Group(); head.position.set(x, H + 1.2, z); head.lookAt(this.mini ? 0 : x * 0.3, 0, this.mini ? 0 : z * 0.2); this.group.add(head);
      // Racimo: dos crucetas con focos redondos alrededor (como en las canchas de barrio)
      for (const [w, y] of [[4.6, 1.1], [5.4, -0.1], [3.6, -1.2]]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.18), frameM); bar.position.y = y; head.add(bar); }
      const vbar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), frameM); head.add(vbar);
      const pts = [[-1.8, 1.1], [-0.6, 1.1], [0.6, 1.1], [1.8, 1.1], [-2.4, -0.1], [-1.2, -0.1], [1.2, -0.1], [2.4, -0.1], [-1.2, -1.2], [0, -1.2], [1.2, -1.2], [0, 0.5]];
      for (const [lx, ly] of pts) { const l = new THREE.Mesh(lampG, lampM); l.position.set(lx, ly - 0.1, 0.25); head.add(l); }
      const sp = new THREE.Sprite(glow); sp.scale.set(18, 18, 1); sp.position.copy(head.position); this.group.add(sp);
      this.lightPositions.push(new THREE.Vector3(x, H + 1.2, z));
    }
    // Focos bajo el borde del techo principal (si lo hay)
    if (this.roofY?.near && !this.mini) {
      const ey = this.roofY.near - 0.08 * ((this.D.near + 4) / 2) - 0.6;
      for (const x of [-30, 0, 30]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 1), lampM); l.position.set(x, ey, APRON_Z - 2.4); this.group.add(l);
        const sp = new THREE.Sprite(glow); sp.scale.set(12, 12, 1); sp.position.set(x, ey - 0.5, APRON_Z - 2.4); this.group.add(sp);
        this.lightPositions.push(new THREE.Vector3(x, ey, APRON_Z - 2.4));
      }
    }
  }
  // Canchas de entrenamiento alrededor (complejos de ligas menores): césped, marcos, malla y juveniles entrenando
  buildExtraFields() {
    const list = this.cfg.extraFields; if (!list) return;
    this.trainees = [];
    const goalM = this.m.white, netM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
    const coneM = stdMat('#ff7a00', 0.6);
    const H = this.home.colors;
    list.forEach((F, idx) => {
      const L = F.l, W = F.w, m = 3;
      const grp = new THREE.Group(); grp.position.set(F.x, 0, F.z); grp.rotation.y = F.rot || 0; this.group.add(grp);
      const mat = new THREE.MeshStandardMaterial({ map: TX.pitchTexture(L, W, m, false, !!F.turf), roughness: 0.92 });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * m, W + 2 * m), mat); p.rotation.x = -Math.PI / 2; p.position.y = 0.005; p.receiveShadow = true; grp.add(p);
      for (const sx of [-1, 1]) {
        const gx = sx * L / 2, gw = F.goalW || 7.32, gh = F.goalH || 2.44;
        for (const gz of [-gw / 2, gw / 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, gh, 0.12), goalM); post.position.set(gx, gh / 2, gz); post.castShadow = true; grp.add(post); }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, gw), goalM); bar.position.set(gx, gh, 0); grp.add(bar);
        const net = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), netM); net.position.set(gx + sx * 1.6, gh / 2, 0); net.rotation.y = Math.PI / 2; grp.add(net);
      }
      // Malla perimetral
      for (const [len, rot, ox, oz] of [[L + 2 * m, 0, 0, W / 2 + m], [L + 2 * m, Math.PI, 0, -(W / 2 + m)], [W + 2 * m, -Math.PI / 2, L / 2 + m, 0], [W + 2 * m, Math.PI / 2, -(L / 2 + m), 0]]) {
        const f = this.fenceSide(len, rot, new THREE.Vector3(ox, 0, oz)); this.group.remove(f.grp); grp.add(f.grp);
      }
      // Banquitas metálicas y conos
      for (let k = 0; k < 8; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), coneM); c.position.set(-L / 4 + (k % 4) * 4, 0.15, -6 + Math.floor(k / 4) * 12); grp.add(c); }
      const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.5), stdMat('#b0b5ba', 0.4, 0.7)); bench.position.set(0, 0.45, W / 2 + m - 1); grp.add(bench);
      // Juveniles trotando en círculo alrededor de los conos
      const n = F.players ?? 6;
      for (let i = 0; i < n; i++) {
        const h = new Humanoid({ skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'][i % 5], hair: '#2b2b2b', shirt: i % 3 ? H.primary : '#f2c500', shorts: H.shorts, socks: H.socks, boots: '#111', height: 1.55 + Math.random() * 0.15 });
        grp.add(h.root);
        this.trainees.push({ h, grp, r: 7 + (i % 3) * 2.2, a: (i / n) * Math.PI * 2, cx: idx % 2 ? 12 : -12, sp: 2.6 + Math.random() * 0.6 });
      }
    });
  }
  // ---------- Canchas de fut 5 / fut 7 ----------
  // Malla alta detrás de los arcos, malla lateral con entrada al centro del lado cercano y (opcional) techo de zinc sobre la cancha
  buildMiniFence() {
    const { L, W, apron: m } = this.P, ex = L / 2 + m, ez = W / 2 + m;
    const hi = this.cfg.fenceHigh || 6, lo = this.cfg.fenceH || 4;
    const fence = (len, rot, x, z, h) => { const old = this.cfg.fenceH; this.cfg.fenceH = h; const f = this.fenceSide(len, rot, new THREE.Vector3(x, 0, z)); this.cfg.fenceH = old; return f; };
    for (const sx of [-1, 1]) { fence(2 * ez, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx * ex, 0, hi); this.col.add(sx > 0 ? ex : -ex - 0.4, 0, -ez, sx > 0 ? ex + 0.4 : -ex, hi, ez); }
    fence(2 * ex, Math.PI, 0, -ez, lo); this.col.add(-ex, 0, -ez - 0.4, ex, lo, -ez);
    // Lado cercano: dos tramos con la entrada (2,6 m) en el centro para entrar a la orilla de la cancha
    const g = 1.3, segL = ex - g;
    for (const sx of [-1, 1]) { fence(segL, 0, sx * (g + segL / 2), ez, lo); this.col.add(sx > 0 ? g : -ex, 0, ez, sx > 0 ? ex : -g, lo, ez + 0.4); }
    // Techo sobre la cancha (fut 5 techado)
    if (this.cfg.pitchRoof) {
      const H = this.cfg.pitchRoof, colM = stdMat('#d9dde2', 0.5, 0.6), roofM = new THREE.MeshStandardMaterial({ color: 0x8d969e, roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide });
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) { const c = this.box(0.35, H, 0.35, colM, sx * (ex + 0.6), H / 2, sz * (ez + 0.6)); this.col.addCentered(sx * (ex + 0.6), sz * (ez + 0.6), 0.4, 0.4, H); }
      for (const sz of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(2 * ex + 2.4, 0.12, ez + 1.6), roofM); r.position.set(0, H + 1.1, sz * (ez + 1.6) / 2); r.rotation.x = sz * 0.14; r.castShadow = true; this.group.add(r); }
      for (const sx of [-1, -0.5, 0, 0.5, 1]) { const t = this.box(0.18, 0.5, 2 * ez + 2.4, colM, sx * (ex + 0.6), H + 0.4, 0, { cast: false }); }
      this.roofY = { near: H + 1.2 };
    }
  }
  buildMiniBenches() {
    const { W, apron: m } = this.P, seatM = stdMat('#b0b5ba', 0.4, 0.7);
    this.benchSeats = [];
    for (const s of [-1, 1]) {
      const cx = s * 7, cz = W / 2 + m - 0.7, len = 5;
      this.box(len, 0.07, 0.42, seatM, cx, 0.46, cz); for (const e of [-1, 1]) this.box(0.06, 0.46, 0.4, this.m.darkSteel, cx + e * (len / 2 - 0.2), 0.23, cz, { cast: false });
      this.col.addCentered(cx, cz, len, 0.45, 0.5, 0, 'nostand');
      for (let i = 0; i < 6; i++) this.benchSeats.push(new THREE.Vector3(cx - len / 2 + 0.45 + i * 0.82, 0, cz));
    }
    this.spots.gateInside = new THREE.Vector3(0, 0, this.gateZ - 2);
  }
  defineMiniZones() {
    const { L, W, apron: m } = this.P;
    this.zones.restricted.push({ id: 'pitch', name: 'la cancha', x0: -L / 2 - 0.3, x1: L / 2 + 0.3, z0: -W / 2 - 0.3, z1: W / 2 + 0.3, when: 'always' });
    for (const s of [-1, 1]) this.zones.press.push({ id: 'press' + s, name: s > 0 ? 'Orilla Este (detrás del arco)' : 'Orilla Oeste (detrás del arco)', x0: s > 0 ? L / 2 + 0.3 : -L / 2 - m, x1: s > 0 ? L / 2 + m : -L / 2 - 0.3, z0: -W / 2 - m, z1: W / 2 + m });
    this.zones.press.push({ id: 'nearSide', name: 'Orilla de la cancha', x0: -L / 2, x1: L / 2, z0: W / 2 + 0.3, z1: W / 2 + m });
    this.spots.photographers = [];
    this.spots.alvaro = new THREE.Vector3(L / 2 + Math.min(1.8, m - 0.6), 0, W / 2 - 1.5);
    this.spots.stewards = [];
  }
  buildScoreboard() {
    const c = TX.makeCanvas(1024, 384); this.sbCanvas = c; this.sbCtx = c.getContext('2d');
    this.sbTex = TX.toTex(c, { wrap: false });
    const m = new THREE.MeshBasicMaterial({ map: this.sbTex, toneMapped: false });
    const small = !!this.cfg.smallBoard, W = small ? 9 : 16, H = small ? 3.4 : 6, st = this.stands.west;
    const x = -APRON_X - this.D.end - 1.2, y = st.topY + (small ? 1.2 : 4.5);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m); scr.position.set(x + 0.3, y + H / 2, 0); scr.rotation.y = Math.PI / 2; this.group.add(scr);
    const frame = this.box(0.5, H + 0.8, W + 0.8, this.m.darkSteel, x, y + H / 2, 0);
    for (const z of small ? [-3, 3] : [-5, 5]) this.box(0.6, y, 0.6, this.m.steel, x - 0.2, y / 2, z);
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
    // Pared este del pasillo (cerrada: la zona de comidas del público queda en otra parte del estadio)
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
    this.buildFoodCourt(FOOD.xa, z0, z1, H, W);
    this.buildLockersAndPalco(z0, W);
    this.spots.laptop = new THREE.Vector3(-18, 0, pz0 + 2 - 0.9);
    this.spots.pressRoom = new THREE.Vector3(-14, 0, doorZ);
    this.spots.tunnelMouth = new THREE.Vector3(0, 0, APRON_Z - 1.5);
    this.spots.hall = new THREE.Vector3(0, 0, (z0 + z1) / 2 + 2);
    // Señales de dirección
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), new THREE.MeshBasicMaterial({ map: TX.signTexture('← PRENSA   |   CANCHA ↑', '#222', '#fff', 768, 128, 'bold 52px Arial') }));
    s2.position.set(0, 3.0, z1 - 0.2); s2.rotation.y = Math.PI; this.group.add(s2);
  }
  // Vestuarios (local y visita) junto al túnel y, encima, el palco VIP con baranda de vidrio.
  buildLockersAndPalco(z0, W) {
    const za = APRON_Z, Hc = 3.6, deckTop = 3.85, xr = 12.3;
    const wallM = this.m.concrete, inner = this.m.wallInt;
    // Frente de la tribuna (hacia la cancha) a ambos lados del túnel y sobre él
    for (const s of [-1, 1]) { this.box(xr - 3.3, deckTop, 0.3, wallM, s * (3.3 + (xr - 3.3) / 2), deckTop / 2, za - 0.15); }
    this.box(6.6, deckTop - 3.0, 0.3, wallM, 0, 3.0 + (deckTop - 3.0) / 2, za - 0.15);
    // Losa del palco (techo de los vestuarios) y su borde trasero
    this.box(2 * xr, deckTop - Hc, z0 - za + 0.3, this.m.concreteDark, 0, (Hc + deckTop) / 2, (za + z0) / 2 - 0.15);
    this.col.add(-xr, Hc, za - 0.3, xr, deckTop, z0); // se puede pisar (piso del palco)
    const back = 48.8; this.box(2 * xr, 1.6, 0.3, wallM, 0, deckTop + 0.8, back); this.col.add(-xr, deckTop, back - 0.15, xr, deckTop + 1.6, back + 0.15);
    for (const s of [-1, 1]) { this.box(0.3, 1.6, back - za, wallM, s * xr, deckTop + 0.8, (za + back) / 2); this.col.add(s * xr - 0.15, deckTop, za, s * xr + 0.15, deckTop + 1.6, back); }
    for (const s of [-1, 1]) W(s * 3.3, (za + z0) / 2, 0.3, z0 - za, Hc); // tabiques entre túnel y vestuarios (hasta la losa)
    // Baranda de vidrio del palco
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfd9e6, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(2 * xr, 1.05), glass); gp.position.set(0, deckTop + 0.55, za - 0.05); gp.renderOrder = 2; this.group.add(gp);
    this.box(2 * xr, 0.06, 0.08, this.m.steel, 0, deckTop + 1.08, za - 0.05, { cast: false });
    this.col.add(-xr, deckTop, za - 0.5, xr, deckTop + 1.1, za + 0.1);
    // Asientos acolchados del palco y letrero
    const seatM = stdMat('#1d1d1d', 0.6), padM = stdMat(this.home.colors.primary, 0.7);
    this.palco = { deck: deckTop, seats: [], spot: new THREE.Vector3(0, deckTop, 47.6), stairs: new THREE.Vector3(-9.6, 0, z0 + 0.9) };
    for (const [rz, k] of [[45.2, 0], [46.8, 1]]) for (let x = -11; x <= 11; x += 1.1) {
      if (Math.abs(x) < 1.2) continue;
      this.box(0.6, 0.12, 0.55, padM, x, deckTop + 0.45 + k * 0.0, rz, { cast: false }); this.box(0.6, 0.55, 0.1, seatM, x, deckTop + 0.75, rz + 0.3, { cast: false });
      if (k === 0 && Math.abs(x) % 3.3 < 0.6) this.palco.seats.push(new THREE.Vector3(x, deckTop, rz));
    }
    const vip = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), new THREE.MeshBasicMaterial({ map: TX.signTexture('★ PALCO VIP ★', '#111111', '#f2c500', 512, 80, 'bold 50px Arial') })); vip.position.set(0, deckTop + 1.25, back - 0.17); vip.rotation.y = Math.PI; this.group.add(vip);
    // Puerta de escaleras al palco (en el pasillo)
    const sd = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), stdMat('#2b2f36', 0.5, 0.4)); sd.position.set(-9.6, 1.1, z0 + 0.17); this.group.add(sd);
    const ss = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTexture('ESCALERAS · PALCO VIP', '#111111', '#f2c500', 512, 90, 'bold 40px Arial') })); ss.position.set(-9.6, 2.5, z0 + 0.18); this.group.add(ss);
    // Vestuarios
    this.lockerRooms = [];
    const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.8 });
    const wood = new THREE.MeshStandardMaterial({ map: TX.woodTexture(), roughness: 0.6 });
    [[-1, this.home], [1, this.away]].forEach(([s, team], idx) => {
      const x0 = s < 0 ? -xr + 0.15 : 3.45, x1 = s < 0 ? -3.45 : xr - 0.15, cx = (x0 + x1) / 2, cz = (za + z0) / 2, w = x1 - x0;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, z0 - za - 0.3), new THREE.MeshStandardMaterial({ map: TX.tileTexture('#3b3f46', '#34383e', [w / 1, 6]), roughness: 0.8 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.012, cz); floor.receiveShadow = true; this.group.add(floor);
      // Paredes con el color del club y escudo
      const tm = stdMat(team.colors.primary, 0.8);
      const side = s < 0 ? x0 : x1; this.box(0.06, Hc, z0 - za - 0.4, tm, side + (s < 0 ? 0.03 : -0.03), Hc / 2, cz, { cast: false });
      const crest = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: TX.crestTexture(team), transparent: true })); crest.position.set(side + (s < 0 ? 0.08 : -0.08), 2.2, cz); crest.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; this.group.add(crest);
      // Casilleros de madera con las camisetas colgadas (espalda con nombre y número)
      const sq = squad(team.id);
      let k = 0;
      for (let x = x0 + 0.55; x < x1 - 0.4; x += 0.95) {
        this.box(0.9, 2.3, 0.5, wood, x, 1.15, za + 0.45);
        this.box(0.06, 2.3, 0.55, stdMat('#5a3b22', 0.7), x - 0.45, 1.15, za + 0.45, { cast: false });
        const pl = sq[k % sq.length]; k++;
        const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.72), new THREE.MeshStandardMaterial({ map: TX.numberTexture(pl.number, pl.surname, team.colors.primary, team.colors.ink), roughness: 0.85 }));
        shirt.position.set(x, 1.55, za + 0.71); this.group.add(shirt);
        this.box(0.3, 0.12, 0.2, stdMat(pl.number % 2 ? '#111' : '#eee', 0.6), x, 0.62, za + 0.6, { cast: false }); // tacos
      }
      this.col.add(x0, 0, za, x1, 2.3, za + 0.72);
      this.box(w - 0.6, 0.08, 0.45, wood, cx, 0.46, za + 1.2); this.col.add(x0 + 0.3, 0, za + 0.95, x1 - 0.3, 0.5, za + 1.45, 'nostand');
      // Pizarra táctica, camilla y lámparas
      const bc = document.createElement('canvas'); bc.width = 512; bc.height = 320; const bx = bc.getContext('2d'); bx.fillStyle = '#f4f6f8'; bx.fillRect(0, 0, 512, 320); bx.strokeStyle = '#2a9d4f'; bx.lineWidth = 4; bx.strokeRect(20, 20, 472, 280); bx.beginPath(); bx.moveTo(256, 20); bx.lineTo(256, 300); bx.stroke(); bx.beginPath(); bx.arc(256, 160, 40, 0, Math.PI * 2); bx.stroke();
      for (let i = 0; i < 10; i++) { bx.fillStyle = '#1d4ed8'; bx.beginPath(); bx.arc(70 + (i % 4) * 50, 60 + Math.floor(i / 4) * 90 + (i % 2) * 20, 9, 0, Math.PI * 2); bx.fill(); }
      bx.strokeStyle = '#d00000'; bx.lineWidth = 3; bx.beginPath(); bx.moveTo(150, 240); bx.quadraticCurveTo(300, 120, 420, 150); bx.stroke(); bx.fillStyle = '#111'; bx.font = 'bold 26px Arial'; bx.fillText('PRESIONAR ALTO · BANDAS', 120, 300);
      const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5 })); board.position.set(cx, 1.8, z0 - 0.2); board.rotation.y = Math.PI; this.group.add(board);
      this.box(1.9, 0.12, 0.7, stdMat('#20304a', 0.6), cx + s * 1.6, 0.8, cz + 0.6); this.box(0.1, 0.78, 0.6, stdMat('#888', 0.4, 0.7), cx + s * 1.6, 0.39, cz + 0.6, { cast: false });
      this.col.addCentered(cx + s * 1.6, cz + 0.6, 1.9, 0.7, 0.9);
      for (const lx of [cx - w / 4, cx + w / 4]) this.box(1.2, 0.05, 0.3, lamp, lx, Hc - 0.03, cz, { cast: false });
      this.lockerRooms.push({ idx, team, box: { x0, x1, z0: za, z1: z0 }, center: new THREE.Vector3(cx, 0, cz) });
    });
    this.lockerLight = new THREE.PointLight(0xf4f8ff, 0, 11, 1.4); this.group.add(this.lockerLight);
  }
  // Zona de comidas bajo la tribuna principal: puestos, mesas altas, pantallas con el partido
  buildFoodCourt(xa, z0, z1, H, W) {
    const xb = FOOD.xb, cx = (xa + xb) / 2, cz = (z0 + z1) / 2, d = z1 - z0, w = xb - xa, dx = FOOD.door, dw = FOOD.doorW;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: TX.tileTexture('#d9cfc1', '#c7baa6', [w / 1.2, d / 1.2]), roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.012, cz); floor.receiveShadow = true; this.group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.m.concreteDark); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); this.group.add(ceil);
    this.col.add(xa, H, z0, xb, H + 0.4, z1, 'nostand');
    W(cx, z0, w, 0.3); W(xa, cz, 0.3, d); W(xb, cz, 0.3, d);
    // Pared trasera (fachada) con la entrada general del público
    const la = dx - dw / 2 - xa, lb = xb - (dx + dw / 2);
    W(xa + la / 2, z1, la, 0.3); W(xb - lb / 2, z1, lb, 0.3); this.box(dw, H - 2.8, 0.3, this.m.wallInt, dx, 2.8 + (H - 2.8) / 2, z1, { cast: false });
    const team = this.home.colors;
    // Letreros: afuera (sobre la entrada) y adentro
    const sgT = TX.signTexture('🍔 ENTRADA GENERAL · COMIDAS', '#c8102e', '#ffffff', 768, 110, 'bold 50px Arial');
    const sgOut = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.66), new THREE.MeshBasicMaterial({ map: sgT })); sgOut.position.set(dx, 3.3, this.gateZ + 0.34); this.group.add(sgOut);
    const sgIn = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.46), new THREE.MeshBasicMaterial({ map: TX.signTexture('🍔 ZONA DE COMIDAS', '#c8102e', '#ffffff', 512, 90, 'bold 46px Arial') })); sgIn.position.set(dx, 3.15, z1 - 0.18); sgIn.rotation.y = Math.PI; this.group.add(sgIn);
    // Puerta corrediza de vidrio de la entrada general (se abre sola al acercarse) y boletería afuera
    this.foodDoor = new GlassSlidingDoor({ scene: this.group, collision: this.col, x: dx, z: z1 - 0.45, width: dw - 0.3, height: 2.7, label: 'ENTRADA GENERAL',
      signTexture: TX.signTexture('ENTRADA GENERAL · COMIDAS', '#00000000', '#c8102e', 1024, 160, 'bold 64px Arial') });
    this.doors.push(this.foodDoor); this.foodDoor.open();
    const bx0 = dx + dw / 2 + 1.6, gz = this.gateZ;
    this.box(2.2, 2.6, 1.4, stdMat('#e9e2d0', 0.7), bx0, 1.3, gz + 1.1); this.col.addCentered(bx0, gz + 1.1, 2.2, 1.4, 2.6);
    this.box(2.5, 0.12, 1.8, stdMat(this.home.colors.primary, 0.6), bx0, 2.66, gz + 1.15, { cast: false });
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.4, emissive: 0x1b2836 })); bw.position.set(bx0, 1.45, gz + 1.81); this.group.add(bw);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.34), new THREE.MeshBasicMaterial({ map: TX.signTexture('BOLETERÍA', '#111111', '#ffffff', 512, 90, 'bold 54px Arial') })); bs.position.set(bx0, 2.25, gz + 1.82); this.group.add(bs);
    this.spots.publicGate = new THREE.Vector3(dx, 0, gz + 3);
    // Puestos a lo largo de la pared del frente
    const STALLS = [
      { kind: 'chifrijo', name: 'Chifrijos El Morado', bg: '#6d1f3a', fg: '#ffffff' },
      { kind: 'perros', name: 'Perros Calientes La Barra', bg: '#e63946', fg: '#ffd166' },
      { kind: 'granizados', name: 'Granizados y Copos', bg: '#2a9d8f', fg: '#ffffff' },
      { kind: 'pizza', name: 'Pizza y Empanadas', bg: '#f4a261', fg: '#3a1a00' },
    ];
    this.foodStalls = [];
    const sw = Math.min(4.6, (w - 1.5) / STALLS.length), counterM = stdMat('#e9e9e9', 0.4, 0.1), steelM = this.m.steel;
    STALLS.forEach((S0, i) => {
      const sx = xa + 1.0 + sw * (i + 0.5), szc = z0 + 1.3;
      this.box(sw - 0.4, 1.05, 0.7, counterM, sx, 0.52, szc + 0.55); this.col.addCentered(sx, szc + 0.55, sw - 0.4, 0.7, 1.1, 0, 'nostand');
      this.box(sw - 0.3, 0.05, 0.85, steelM, sx, 1.07, szc + 0.55, { cast: false });
      // Panel trasero con menú iluminado y toldo
      const menu = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.5, 1.0), new THREE.MeshStandardMaterial({ map: TX.signTexture(S0.name.toUpperCase(), S0.bg, S0.fg, 768, 170, 'bold 58px Arial'), emissive: 0xffffff, emissiveIntensity: 0.5 }));
      menu.material.emissiveMap = menu.material.map; menu.position.set(sx, 2.55, z0 + 0.17); this.group.add(menu);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.3, 0.06, 1.0), new THREE.MeshStandardMaterial({ map: TX.fabricTexture(S0.bg, '#ffffff'), roughness: 0.8 }));
      awn.position.set(sx, 3.05, szc + 0.35); awn.rotation.x = -0.25; this.group.add(awn);
      // Productos en el mostrador y en la repisa trasera
      for (let k = 0; k < 5; k++) { const c = [S0.bg, '#ffd166', '#ffffff', '#8d5a3b', '#2a9d8f'][k]; this.box(0.18, 0.14, 0.18, stdMat(c, 0.5), sx - sw / 2 + 0.5 + k * (sw - 1) / 4, 1.17, szc + 0.5, { cast: false }); }
      this.box(sw - 0.5, 0.04, 0.35, steelM, sx, 1.55, z0 + 0.35, { cast: false });
      this.foodStalls.push({ ...S0, counter: new THREE.Vector3(sx, 1, szc + 1.3), vendor: new THREE.Vector3(sx, 0, szc - 0.15), vendorYaw: 0 });
    });
    // Mesas altas con banquitos
    const tM = stdMat('#3a3f45', 0.4, 0.5), topM = new THREE.MeshStandardMaterial({ map: TX.woodTexture(), roughness: 0.6 });
    this.foodTables = [];
    for (let i = 0; i < 3; i++) {
      const tx = xa + 3 + i * (w - 6) / 2, tz = z0 + d * 0.66;
      this.box(0.9, 0.05, 0.9, topM, tx, 1.05, tz); this.box(0.08, 1.03, 0.08, tM, tx, 0.52, tz, { cast: false });
      this.col.addCentered(tx, tz, 0.9, 0.9, 1.1, 0, 'nostand'); this.foodTables.push(new THREE.Vector3(tx, 0, tz));
    }
    // Pantallas con el partido y basureros
    for (const k of [0.62, 0.88]) { const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshStandardMaterial({ map: TX.signTexture('⚽ EN VIVO', '#0a7a3a', '#ffffff', 512, 288, 'bold 64px Arial'), emissive: 0xffffff, emissiveIntensity: 0.9 })); tv.material.emissiveMap = tv.material.map; tv.position.set(xa + w * k, 2.45, z1 - 0.17); tv.rotation.y = Math.PI; this.group.add(tv); }
    for (const k of [0.4, 0.96]) { this.box(0.45, 0.8, 0.45, stdMat(team.primary, 0.6), xa + w * k, 0.4, z1 - 0.5); this.col.addCentered(xa + w * k, z1 - 0.5, 0.45, 0.45, 0.8); }
    // Luz del salón (cálida) y lámparas
    const pl = new THREE.PointLight(0xffe7c4, 26, 22, 1.5); pl.position.set(cx, H - 0.4, cz); this.group.add(pl);
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 1.8 });
    for (let k = 0; k < 3; k++) this.box(1.6, 0.05, 0.3, lampM, xa + w * (k + 0.5) / 3, H - 0.03, cz, { cast: false });
    this.spots.foodCourt = new THREE.Vector3(cx, 0, cz);
  }
  buildSecurity() {
    const gz = this.gateZ, cfg = this.cfg;
    // Fachada exterior con hueco del acceso de prensa (x -2..2)
    const facH = this.cfg.facadeH || Math.max(10, this.stands.near.topY + 2);
    const facLen = 2 * APRON_X + 2 * this.D.end + 6;
    // Huecos: acceso de prensa (centro) y entrada general del público (zona de comidas, al oeste)
    const gaps = [[FOOD.door - FOOD.doorW / 2, FOOD.door + FOOD.doorW / 2, 2.8], [-2, 2, 3]];
    const segs = []; let cur = -facLen / 2;
    for (const [a, b] of gaps) { segs.push([cur, a]); cur = b; } segs.push([cur, facLen / 2]);
    for (const [a, b] of segs) { const w = b - a; this.box(w, facH, 0.6, this.m.facade, (a + b) / 2, facH / 2, gz, { cast: true }); this.col.addCentered((a + b) / 2, gz, w, 0.6, facH); }
    for (const [a, b, hy] of gaps) { this.box(b - a, facH - hy, 0.6, this.m.facade, (a + b) / 2, hy + (facH - hy) / 2, gz); this.col.add(a - 0.1, hy, gz - 0.3, b + 0.1, facH, gz + 0.3, 'nostand'); }
    // Laterales de la fachada que cierran el recinto
    for (const s of [-1, 1]) { this.box(0.6, facH, gz + 10, this.m.facade, s * facLen / 2, facH / 2, gz / 2 - 5); this.col.addCentered(s * facLen / 2, gz / 2 - 5, 0.6, gz + 10, facH); }
    if (cfg.facadeText) {
      const w = Math.min(90, facLen * 0.6);
      const sgH = Math.min(4.2, facH - 3.9);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(w, sgH), new THREE.MeshStandardMaterial({ map: TX.signTexture(cfg.facadeText, cfg.facade, '#ffffff', 2048, 96, '900 66px Arial Black, Arial'), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.12 }));
      sg.material.emissiveMap = sg.material.map; sg.position.set(-6, Math.max(facH - 3.2, 3.6 + sgH / 2), gz + 0.34); this.group.add(sg);
      // Franja inferior de la fachada, con hueco en el acceso de prensa (x −2.2..2.2)
      const bandM = stdMat(cfg.facadeBand || '#c8102e', 0.7);
      for (const [a, b] of segs) { const a2 = a + (a > -facLen / 2 ? 0.2 : 0), b2 = b - (b < facLen / 2 ? 0.2 : 0); this.box(b2 - a2, 3.2, 0.62, bandM, (a2 + b2) / 2, 1.6, gz + 0.02, { cast: false }); }
      for (const [a, b, hy] of gaps) this.box(b - a + 0.4, 3.2 - hy + 0.05, 0.62, bandM, (a + b) / 2, (hy + 3.2) / 2, gz + 0.02, { cast: false });
    }
    if (cfg.facadeGlass) {
      // Muro cortina de vidrio con montantes de aluminio (sin tapar los accesos)
      const gm = new THREE.MeshStandardMaterial({ color: 0x9fc0cf, roughness: 0.06, metalness: 0.6, envMapIntensity: 1.4, emissive: 0x0d1c26 });
      const mul = stdMat('#d9dde2', 0.35, 0.8), y0 = 3.6, y1 = Math.min(facH - 1.2, 15);
      for (const [a, b] of segs) {
        const a2 = Math.max(a, -facLen / 2 + 2) + 0.4, b2 = Math.min(b, facLen / 2 - 2) - 0.4; if (b2 - a2 < 2) continue;
        this.box(b2 - a2, y1 - y0, 0.1, gm, (a2 + b2) / 2, (y0 + y1) / 2, gz + 0.36, { cast: false });
        for (let x = a2; x <= b2 + 0.01; x += 3) this.box(0.12, y1 - y0, 0.16, mul, x, (y0 + y1) / 2, gz + 0.42, { cast: false });
        for (const yy of [y0, (y0 + y1) / 2, y1]) this.box(b2 - a2, 0.12, 0.16, mul, (a2 + b2) / 2, yy, gz + 0.42, { cast: false });
      }
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
        const px = x + pw / 2 + gap / 2; if (Math.abs(px) > 2.6 && Math.abs(px - FOOD.door) > FOOD.doorW / 2 + 0.5) this.box(0.45, facH, 0.5, this.m.steel, px, facH / 2, gz + 0.45); // sin postes frente a la puerta
      }
      this.box(total + 2, 0.5, 0.6, this.m.steel, 0, 4.4, gz + 0.45);
    }
    const name = (cfg.facadeText && facH < 12) ? null : new THREE.Mesh(new THREE.PlaneGeometry(30, 2.4), new THREE.MeshStandardMaterial({ map: TX.signTexture(cfg.name.toUpperCase(), '#00000000', '#1a1a1a', 2048, 160, 'bold 110px Georgia'), transparent: true }));
    if (name) { name.position.set(0, cfg.facadeLetters ? 2.4 : facH - 2, cfg.facadeLetters ? gz + 0.36 : gz + 0.32); if (cfg.facadeLetters) { name.scale.set(0.5, 0.5, 1); name.position.x = 20; } this.group.add(name); }
    const pr = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), new THREE.MeshBasicMaterial({ map: TX.signTexture(this.mini ? 'ENTRADA' : 'ACCESO DE PRENSA', '#0b3d91', '#ffffff', 512, 90, 'bold 52px Arial') }));
    pr.position.set(0, 3.5, gz + 0.32); this.group.add(pr);
    // Puerta corrediza del control de seguridad
    // Puerta automática de vidrio (transparente y corrediza) sobre la cara interior de la fachada
    this.gate = new GlassSlidingDoor({ scene: this.group, collision: this.col, x: 0, z: gz - 0.7, width: 4, height: 3, label: 'ACCESO',
      signTexture: TX.signTexture(this.mini ? 'BIENVENIDOS · ALQUILER DE CANCHAS' : 'ACCESO DE PRENSA · SOLO ACREDITADOS', '#00000000', '#0b3d91', 1024, 160, 'bold 64px Arial') });
    this.doors.push(this.gate);
    // En los complejos de fut 5 / fut 7 no hay control de seguridad: la puerta queda abierta para todos
    if (this.mini) { this.gate.open(); this.spots.guard = new THREE.Vector3(1.4, 0, gz + 3.4); this.spots.gateOutside = new THREE.Vector3(0, 0, gz + 9); this.spots.gateInside = new THREE.Vector3(0, 0, gz - 2); return; }
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
    if (this.mini) return this.defineMiniZones();
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
    if (this.trainees) for (const T of this.trainees) {
      T.a += (T.sp / T.r) * dt; const x = T.cx + Math.cos(T.a) * T.r, z = Math.sin(T.a) * T.r * 0.7;
      T.h.root.position.set(x, 0, z); T.h.root.rotation.y = Math.atan2(-Math.sin(T.a) * T.r, Math.cos(T.a) * T.r * 0.7); T.h.update(dt, T.sp);
    }
    // Luz de vestuario: se enciende en el vestuario donde está el fotógrafo
    if (this.lockerLight) {
      const p = this.game.player.pos, r = this.lockerRooms.find((L) => p.x > L.box.x0 - 1.5 && p.x < L.box.x1 + 1.5 && p.z > L.box.z0 && p.z < L.box.z1 + 2);
      this.lockerLight.intensity = r ? 20 : 0; if (r) this.lockerLight.position.set(r.center.x, 3.1, r.center.z);
    }
    // Rotación de las vallas LED: cada 8 s se desliza a la siguiente marca
    if (this.led) {
      const L = this.led; L.t += dt;
      if (L.t > 8) { L.t = 0; L.idx = (L.idx + 1) % L.n; }
      const target = L.idx / L.n, cur = L.tex.offset.y;
      let next = cur + Math.min(1, dt * 5) * (((target - cur + 1.5) % 1) - 0.5);
      L.tex.offset.y = ((next % 1) + 1) % 1;
    }
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
