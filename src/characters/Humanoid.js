import * as THREE from 'three';
import { damp, clamp, smooth } from '../core/MathUtil.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Geometrías compartidas (una sola vez para todos los personajes => menos memoria).
const G = {};
function geos() {
  if (G.ready) return G;
  // Torso torneado (más ancho en el pecho y los hombros, angosto en la cintura)
  const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  G.torso = lathe([[0.001, -0.02], [0.125, 0.0], [0.13, 0.08], [0.15, 0.2], [0.168, 0.3], [0.17, 0.37], [0.15, 0.43], [0.09, 0.48], [0.001, 0.5]]);
  G.pelvis = lathe([[0.001, -0.1], [0.11, -0.09], [0.14, -0.02], [0.135, 0.08], [0.125, 0.12], [0.001, 0.13]]);
  G.head = new THREE.SphereGeometry(0.108, 18, 14);
  G.hair = new THREE.SphereGeometry(0.114, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  G.neck = new THREE.CylinderGeometry(0.05, 0.058, 0.12, 10);
  G.upperArm = new THREE.CapsuleGeometry(0.05, 0.2, 4, 10); G.upperArm.translate(0, -0.14, 0);
  G.foreArm = new THREE.CapsuleGeometry(0.042, 0.2, 4, 10); G.foreArm.translate(0, -0.13, 0);
  G.hand = new THREE.SphereGeometry(0.05, 10, 8); G.hand.scale(0.85, 1.25, 0.6);
  G.thigh = new THREE.CapsuleGeometry(0.078, 0.3, 4, 10); G.thigh.translate(0, -0.21, 0);
  G.shin = new THREE.CapsuleGeometry(0.056, 0.3, 4, 10); G.shin.translate(0, -0.21, 0);
  G.calf = new THREE.SphereGeometry(0.062, 10, 8); G.calf.scale(1, 1.8, 1.05);
  G.foot = new THREE.CapsuleGeometry(0.048, 0.16, 4, 8); G.foot.rotateX(Math.PI / 2); G.foot.scale(1.05, 0.75, 1); G.foot.translate(0, -0.035, 0.055);
  G.joint = new THREE.SphereGeometry(1, 10, 8);
  G.band = new THREE.CylinderGeometry(0.06, 0.06, 0.075, 14);
  G.ear = new THREE.SphereGeometry(0.022, 8, 6); G.ear.scale(0.6, 1.3, 1);
  G.eye = new THREE.SphereGeometry(0.014, 6, 4);
  G.nose = new THREE.ConeGeometry(0.018, 0.04, 5); G.nose.rotateX(Math.PI / 2);
  G.back = new THREE.PlaneGeometry(0.3, 0.3);
  G.cap = new THREE.CylinderGeometry(0.115, 0.118, 0.07, 14);
  G.visor = new THREE.BoxGeometry(0.2, 0.012, 0.11);
  G.backpack = new THREE.BoxGeometry(0.3, 0.38, 0.16);
  G.vest = new THREE.CapsuleGeometry(0.168, 0.26, 3, 10);
  G.camBody = new THREE.BoxGeometry(0.14, 0.1, 0.08);
  G.lens = new THREE.CylinderGeometry(0.04, 0.045, 1, 14); G.lens.rotateX(Math.PI / 2); G.lens.translate(0, 0, 0.5);
  G.lanyard = new THREE.BoxGeometry(0.06, 0.085, 0.006);
  G.shortsLeg = new THREE.CylinderGeometry(0.09, 0.097, 0.22, 12); G.shortsLeg.translate(0, -0.1, 0);
  G.sleeve = new THREE.CylinderGeometry(0.064, 0.059, 0.13, 12); G.sleeve.translate(0, -0.06, 0);
  G.ready = true;
  return G;
}
const matCache = new Map();
export function stdMat(color, rough = 0.8, metal = 0, extra = {}) {
  const key = color + '|' + rough + '|' + metal + JSON.stringify(Object.keys(extra));
  if (!extra.map && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  if (!extra.map) matCache.set(key, m);
  return m;
}
export const SKIN_TONES = ['#f1c9a5', '#e0ac85', '#c68d63', '#a86f48', '#8d5a3b', '#6b4330', '#d9a07a', '#b97c55'];
export const HAIR_COLORS = ['#1b130e', '#2b1c12', '#3a2817', '#120c08', '#5a3b22', '#0a0a0a'];

/*
 * Personaje articulado con jerarquía de pivotes. Mira hacia +Z.
 * Las animaciones son procedurales: cada frame se calcula una pose objetivo
 * según el estado y se interpola suavemente (transiciones).
 */
export const HUMAN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
const _c = new THREE.Color();
export class Humanoid {
  constructor(o = {}) {
    const g = geos();
    this.opts = o;
    const col = (hex) => _c.set(hex).clone();
    const skin = col(o.skin || '#c68d63'), shirtC = col(o.shirt || '#2a5caa'), shortsC = col(o.shorts || '#1c1c1c');
    const socksC = col(o.socks || o.shorts || '#eeeeee'), bootsC = col(o.boots || '#111111'), hairC = col(o.hair || '#1b130e');
    const legsC = o.pants ? col(o.pants) : null, sleeveC = o.sleeveColor ? col(o.sleeveColor) : shirtC;
    const root = (this.root = new THREE.Group());
    const scale = o.height ? o.height / 1.78 : 1;
    this.scale = scale;
    const body = (this.body = new THREE.Group()); body.scale.setScalar(scale); root.add(body);
    // Personaje = una sola SkinnedMesh (1 draw call). Cada pieza se asigna a su hueso.
    const parts = [];
    const mk = (geo, color, bone, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { parts.push({ geo, color, bone, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)) }); };
    const bones = [];
    const P = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); bones.push(b); return b; };
    this.hips = P(body, 0, 0.94, 0);
    mk(g.pelvis, legsC || shortsC, this.hips, 0, 0.02, 0, 1.18, 1, 0.82);
    this.spine = P(this.hips, 0, 0.1, 0);
    mk(g.torso, shirtC, this.spine, 0, -0.02, 0, 1.3, 1, 0.74);
    if (o.vest) mk(g.vest, col(o.vest), this.spine, 0, 0.23, 0, 1.33, 1, 0.82);
    if (o.lanyard) mk(g.lanyard, col('#f4f4f4'), this.spine, 0, 0.16, 0.122);
    this.neck = P(this.spine, 0, 0.5, 0);
    mk(g.neck, skin, this.neck, 0, 0.03, 0);
    this.head = P(this.neck, 0, 0.13, 0.01);
    mk(g.head, skin, this.head, 0, 0, 0, 0.93, 1.08, 1);
    if (!o.bald) mk(g.hair, hairC, this.head, 0, 0.018, -0.008, 0.97, 1.05, 1.03);
    const eyeC = col('#151010');
    mk(g.eye, eyeC, this.head, -0.037, 0.018, 0.096); mk(g.eye, eyeC, this.head, 0.037, 0.018, 0.096);
    mk(g.nose, skin, this.head, 0, -0.005, 0.11);
    mk(g.ear, skin, this.head, -0.1, 0.0, 0.0); mk(g.ear, skin, this.head, 0.1, 0.0, 0.0);
    if (o.cap) { const cc = col(o.cap); mk(g.cap, cc, this.head, 0, 0.07, 0); mk(g.visor, cc, this.head, 0, 0.045, 0.1); }
    this.arms = [];
    for (const sd of [-1, 1]) {
      const sh = P(this.spine, sd * 0.205, 0.42, 0);
      mk(g.joint, sleeveC, sh, 0, 0, 0, 0.068, 0.068, 0.068);
      if (o.armband && sd > 0) mk(g.band, col('#f2c500'), sh, 0, -0.17, 0);
      mk(g.upperArm, o.longSleeves ? sleeveC : skin, sh);
      if (!o.longSleeves) mk(g.sleeve, sleeveC, sh, 0, -0.01, 0);
      const el = P(sh, 0, -0.285, 0);
      mk(g.joint, o.longSleeves ? sleeveC : skin, el, 0, 0, 0, 0.046, 0.046, 0.046);
      mk(g.foreArm, o.longSleeves ? sleeveC : skin, el);
      mk(g.hand, o.gloves ? col(o.gloves) : skin, el, 0, -0.27, 0);
      this.arms.push({ sh, el, side: sd });
    }
    this.legs = [];
    for (const sd of [-1, 1]) {
      const th = P(this.hips, sd * 0.095, -0.03, 0);
      mk(g.thigh, legsC || skin, th);
      if (!legsC) mk(g.shortsLeg, shortsC, th);
      const kn = P(th, 0, -0.43, 0);
      mk(g.joint, legsC || skin, kn, 0, 0, 0, 0.066, 0.066, 0.066);
      mk(g.shin, legsC || socksC, kn);
      mk(g.calf, legsC || socksC, kn, 0, -0.14, -0.012);
      const ft = P(kn, 0, -0.42, 0);
      mk(g.foot, bootsC, ft);
      this.legs.push({ th, kn, ft, side: sd });
    }
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const geosOut = parts.map((pt) => {
      const gg = (pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone());
      for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
      gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, pt.bone.matrixWorld).multiply(pt.m));
      const n = gg.attributes.position.count, bi = bones.indexOf(pt.bone);
      const ci = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { ci[i * 3] = pt.color.r; ci[i * 3 + 1] = pt.color.g; ci[i * 3 + 2] = pt.color.b; si[i * 4] = bi; sw[i * 4] = 1; }
      gg.setAttribute('color', new THREE.BufferAttribute(ci, 3)); gg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); gg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      return gg;
    });
    const merged = mergeGeometries(geosOut);
    const mesh = (this.mesh = new THREE.SkinnedMesh(merged, HUMAN_MAT));
    mesh.castShadow = true; mesh.receiveShadow = false;
    body.add(mesh);
    const skel = new THREE.Skeleton(bones);
    mesh.bind(skel);
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.8);
    // Piezas con textura o que se ocultan: mallas separadas unidas a huesos
    if (o.numberTex) {
      const back = new THREE.Mesh(g.back, new THREE.MeshStandardMaterial({ map: o.numberTex, roughness: 0.85 }));
      back.position.set(0, 0.27, -0.13); back.rotation.y = Math.PI; back.scale.set(0.95, 1, 1); this.spine.add(back);
    }
    if (o.backpack) { this.backpack = new THREE.Mesh(g.backpack, stdMat(o.backpack, 0.8)); this.backpack.position.set(0, 0.24, -0.2); this.backpack.castShadow = true; this.spine.add(this.backpack); }
    this.cameraRig = new THREE.Group(); this.cameraRig.visible = false;
    const camBody = new THREE.Mesh(g.camBody, stdMat('#141414', 0.45, 0.2)); camBody.castShadow = true; this.cameraRig.add(camBody);
    this.lensMesh = new THREE.Mesh(g.lens, stdMat('#1d1d1d', 0.4, 0.3)); this.lensMesh.position.set(0, -0.01, 0.04); this.lensMesh.scale.set(1, 1, 0.12); this.cameraRig.add(this.lensMesh);
    this.spine.add(this.cameraRig);
    this.cameraRig.position.set(0, 0.3, 0.3);

    // Estado de animación
    this.phase = Math.random() * 10; this.speed = 0; this.state = 'idle'; this.stateT = 0; this.stateDur = 1;
    this.side = 1; this.excite = 0; this.lookYaw = 0; this.turnLean = 0; this.accelLean = 0; this.lookPitch = 0; this.rootYOffset = 0;
    this.pose = this.blankPose(); this.lambda = 14; this.breath = Math.random() * 6;
    this.idleVariant = Math.random();
  }
  setLensLength(mm) {
    // Longitud visual del lente según distancia focal (aprox.).
    const L = clamp(0.07 + mm / 1400, 0.08, 0.5); const r = clamp(0.035 + mm / 9000, 0.04, 0.085);
    this.lensMesh.scale.set(r / 0.04, r / 0.04, L);
  }
  showCamera(v) { this.cameraRig.visible = v; }
  blankPose() {
    return { hipY: 0, hipRX: 0, hipRZ: 0, rootRX: 0, rootRZ: 0, spineRX: 0, spineRY: 0, spineRZ: 0, headRX: 0, headRY: 0,
      shL: [0, 0, 0], shR: [0, 0, 0], elL: 0, elR: 0, thL: [0, 0], thR: [0, 0], knL: 0, knR: 0, ftL: 0, ftR: 0 };
  }
  play(state, dur = 1, side = 1) {
    if (state === 'getup') this.getupFrom = { rx: this.pose.rootRX, rz: this.pose.rootRZ, hip: this.pose.hipY };
    if (state === 'ragdoll') { const d = this.fallDir || { x: 0, z: 1 }; const l = Math.hypot(d.x, d.z) || 1; this.rag = { th: 0.05, w: 1.6 + Math.random() * 1.6, dx: d.x / l, dz: d.z / l, ground: false, impact: 0, seed: Math.random() * 10 }; }
    this.state = state; this.stateT = 0; this.stateDur = dur; this.side = side;
  }
  get stateProgress() { return clamp(this.stateT / this.stateDur, 0, 1); }

  // Calcula pose objetivo según estado.
  target(dt) {
    const p = this.blankPose();
    const sp = this.speed;
    const t = this.stateProgress, s = this.side;
    this.breath += dt * 1.6;
    const loco = () => {
      const run = clamp((sp - 2) / 4, 0, 1), walk = clamp(sp / 1.6, 0, 1);
      const amp = 0.38 * walk + 0.5 * run, ph = this.phase;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      p.thL[0] = -sn * amp; p.thR[0] = sn * amp;
      p.knL = Math.max(0, cs) * (0.5 * walk + 0.9 * run) + 0.08; p.knR = Math.max(0, -cs) * (0.5 * walk + 0.9 * run) + 0.08;
      p.ftL = -p.thL[0] * 0.3; p.ftR = -p.thR[0] * 0.3;
      p.shL[0] = sn * (0.3 * walk + 0.6 * run); p.shR[0] = -sn * (0.3 * walk + 0.6 * run);
      p.elL = -(0.25 + 0.9 * run); p.elR = -(0.25 + 0.9 * run);
      p.shL[2] = -0.08; p.shR[2] = 0.08;
      p.hipY = Math.abs(Math.sin(ph)) * (0.025 * walk + 0.05 * run) - 0.03 * run;
      p.spineRX = 0.05 * walk + 0.22 * run; p.spineRY = sn * 0.08 * (walk + run);
      p.headRX = -p.spineRX * 0.6;
      const tl = Math.max(-0.35, Math.min(0.35, this.turnLean || 0)), al = Math.max(-0.12, Math.min(0.22, this.accelLean || 0));
      p.rootRZ = tl; p.spineRX += al; p.spineRZ = -tl * 0.3;
      if (sp < 0.15) { // idle con respiración
        const b = Math.sin(this.breath) * 0.02;
        p.spineRX = 0.02 + b; p.shL[2] = -0.12 - b; p.shR[2] = 0.12 + b; p.elL = -0.15; p.elR = -0.15;
        p.thL[1] = -0.05; p.thR[1] = 0.05; p.knL = p.knR = 0.04;
      }
    };
    switch (this.state) {
      case 'kick': { // Remate / pase: carga y golpeo con la pierna derecha (side)
        loco();
        const L = s > 0 ? 'R' : 'L';
        const wind = t < 0.45 ? smooth(t / 0.45) : 1 - smooth((t - 0.45) / 0.55);
        const strike = t < 0.45 ? 0 : Math.sin(clamp((t - 0.45) / 0.35, 0, 1) * Math.PI);
        p['th' + L][0] = wind * 0.9 - strike * 1.5; p['kn' + L] = wind * 1.6 + 0.1;
        p.spineRX = -0.25 * strike + 0.1 * wind; p.spineRZ = -s * 0.15 * strike;
        p.shL = [0.3, 0, -0.7 - strike * 0.4]; p.shR = [0.3, 0, 0.7 + strike * 0.4]; p.elL = p.elR = -0.3;
        p.hipY = -0.03 * wind;
        break;
      }
      case 'header': { // Salto y cabezazo
        const jump = Math.sin(t * Math.PI);
        p.hipY = jump * 0.55; p.thL = [-0.4 * jump, 0]; p.thR = [-0.2 * jump, 0]; p.knL = 0.9 * jump; p.knR = 0.5 * jump;
        p.shL = [-1.2 * jump, 0, -0.6]; p.shR = [-1.2 * jump, 0, 0.6]; p.elL = p.elR = -0.6;
        p.spineRX = t < 0.5 ? -0.35 * jump : 0.35 * jump; p.headRX = t < 0.5 ? -0.4 : 0.5;
        break;
      }
      case 'dive': { // Estirada del portero: carga, vuelo horizontal, caída y rebote
        const prep = clamp(t / 0.12, 0, 1), fly = clamp((t - 0.1) / 0.42, 0, 1), land = clamp((t - 0.5) / 0.2, 0, 1);
        const a = smooth(fly) * 1.42;
        p.rootRZ = -s * a;
        p.hipY = -0.2 * prep * (1 - fly) + Math.sin(fly * Math.PI) * 0.5 * (1 - land) - 0.6 * smooth(land) + Math.sin(land * Math.PI) * 0.07;
        const reach = 1 - land * 0.35;
        p.shL = [-0.4 * prep - 2.55 * fly * reach, 0, -0.2 - 0.2 * fly]; p.shR = [-0.4 * prep - 2.55 * fly * reach, 0, 0.2 + 0.2 * fly];
        p.elL = p.elR = -0.5 * (1 - fly) - 0.05 - land * 0.4;
        p.thL = [-0.5 * prep + 0.35 * fly, -0.35 * fly]; p.thR = [-0.5 * prep - 0.1 * fly, 0.35 * fly]; p.knL = 0.9 * prep * (1 - fly) + 0.7 * fly; p.knR = 0.9 * prep * (1 - fly) + 0.25 * fly;
        p.spineRX = 0.3 * prep * (1 - fly) - 0.1 * fly; p.spineRZ = -s * 0.15 * fly; p.headRY = s * 0.35 * fly; p.headRX = -0.2 * fly;
        break;
      }
      case 'ragdoll': { // Caída física tipo muñeco de trapo (péndulo invertido + extremidades flojas)
        const R = this.rag;
        if (R) {
          if (!R.ground) { R.w += 11 * Math.sin(Math.max(R.th, 0.06)) * dt; R.th += R.w * dt; if (R.th >= 1.47) { R.th = 1.47; R.w = -R.w * 0.25; R.ground = true; R.impact = 1; } }
          else { R.th = Math.min(1.5, R.th + R.w * dt); R.w += (1.47 - R.th) * 40 * dt; R.w *= Math.pow(0.01, dt); }
          R.impact = Math.max(0, R.impact - dt * 1.4);
          const th = R.th, k = th / 1.47, j = (i) => Math.sin(this.stateT * (19 + i * 3) + R.seed + i) * R.impact * 0.55;
          p.rootRX = -th * R.dz; p.rootRZ = -th * R.dx;
          p.hipY = -0.74 * k * k + (R.ground ? Math.abs(Math.sin(this.stateT * 9)) * 0.05 * R.impact : 0);
          p.shL = [-0.6 - 1.2 * k * R.dz + j(1), 0.2, -0.5 - 0.8 * k + j(2)]; p.shR = [-0.4 - 1.4 * k * R.dz + j(3), -0.2, 0.6 + 0.7 * k + j(4)];
          p.elL = -0.3 - 0.6 * k + j(5); p.elR = -0.5 - 0.4 * k + j(6);
          p.thL = [-0.2 - 0.5 * k + j(7) * 0.6, -0.15]; p.thR = [0.15 - 0.3 * k + j(8) * 0.6, 0.2]; p.knL = 0.3 + 0.5 * k + j(9) * 0.5; p.knR = 0.6 + 0.4 * k + j(10) * 0.5;
          p.spineRX = 0.15 * k + j(11) * 0.3; p.headRX = 0.35 * k + j(12) * 0.4; p.headRY = R.dx * 0.5 * k;
          this.lambdaNow = R.ground ? 8 : 16;
        }
        break;
      }
      case 'slide': { // Barrida
        const k = smooth(clamp(t / 0.25, 0, 1)) * (1 - smooth(clamp((t - 0.75) / 0.25, 0, 1)));
        p.rootRX = 0.9 * k; p.hipY = -0.55 * k;
        p.thR = [-1.2 * k, 0]; p.knR = 0.1; p.thL = [-0.2 * k, 0]; p.knL = 1.4 * k;
        p.shL = [0.6 * k, 0, -1.0 * k]; p.shR = [0.3 * k, 0, 1.2 * k]; p.elL = p.elR = -0.2;
        p.spineRX = 0.5 * k; p.headRX = 0.4 * k;
        break;
      }
      case 'fallen': { // En el suelo (falta, lesión simulada)
        const k = smooth(clamp(t / 0.15, 0, 1));
        p.rootRX = -1.45 * k; p.hipY = -0.78 * k;
        p.thL = [-0.4 * k, -0.1]; p.thR = [-1.0 * k, 0.1]; p.knL = 0.4 + 1.2 * k * (0.5 + 0.5 * Math.sin(this.breath * 3)); p.knR = 1.2 * k;
        p.shL = [-0.8 * k, 0, -0.5]; p.shR = [-1.4 * k, 0, 0.3]; p.elL = -1.6 * k; p.elR = -1.4 * k;
        p.headRX = 0.3; p.spineRX = 0.2;
        break;
      }
      case 'getup': { // Levantarse desde la postura en que quedó (de frente, de espaldas o de costado)
        const f = this.getupFrom || { rx: -1.4, rz: 0, hip: -0.75 }, k = 1 - smooth(t), push = Math.sin(t * Math.PI);
        p.rootRX = f.rx * k; p.rootRZ = f.rz * k; p.hipY = f.hip * k - push * 0.12;
        p.knL = p.knR = 1.5 * push + 0.1; p.thL = p.thR = [-1.1 * push, 0];
        p.shL = [-0.9 * push, 0, -0.5]; p.shR = [-0.9 * push, 0, 0.5]; p.elL = p.elR = -0.3; p.spineRX = 0.55 * push;
        break;
      }
      case 'celebrate': { // Carrera con brazos abiertos / puño al aire
        loco();
        const v = this.idleVariant;
        if (v < 0.4) { p.shL = [-0.2, 0, -1.45]; p.shR = [-0.2, 0, 1.45]; p.elL = p.elR = -0.05; p.spineRX = -0.2; p.headRX = -0.35; }
        else if (v < 0.75) { p.shR = [-2.9, 0, 0.2]; p.elR = -0.2; p.shL = [0.2, 0, -0.5]; p.elL = -1.5; p.headRX = -0.3; }
        else { const k = clamp(t * 3, 0, 1); p.shL = [-2.7, 0, -0.4]; p.shR = [-2.7, 0, 0.4]; p.elL = p.elR = -0.2; p.headRX = -0.5; p.spineRX = -0.3 * k; }
        break;
      }
      case 'kneeSlide': { // Rodillas en el césped
        const k = smooth(clamp(t / 0.2, 0, 1));
        p.hipY = -0.45 * k; p.thL = p.thR = [0.1, 0]; p.knL = p.knR = 1.55 * k; p.ftL = p.ftR = 0.6 * k;
        p.spineRX = -0.45 * k; p.headRX = -0.6 * k; p.shL = [-2.4, 0, -0.9]; p.shR = [-2.4, 0, 0.9]; p.elL = p.elR = -0.1;
        break;
      }
      case 'throw': { // Saque de banda
        const k = Math.sin(t * Math.PI);
        p.shL = [-2.9 + k * 0.7, 0, -0.15]; p.shR = [-2.9 + k * 0.7, 0, 0.15]; p.elL = p.elR = -1.2 + k;
        p.spineRX = -0.35 + 0.6 * k; p.thL = [0.15, 0]; p.thR = [-0.2, 0]; p.knR = 0.2;
        break;
      }
      case 'card': { // Árbitro mostrando tarjeta
        loco();
        p.shR = [-2.95, 0, 0.1]; p.elR = 0; p.headRX = -0.15;
        break;
      }
      case 'whistle': { loco(); p.shR = [-1.2, 0, 0.3]; p.elR = -1.9; break; }
      case 'point': { loco(); p.shR = [-1.55, s * 0.6, 0.2]; p.elR = 0; break; }
      case 'camera': { // Cámara al ojo
        loco();
        p.shL = [-1.25, 0.35, 0.05]; p.elL = -1.65; p.shR = [-1.15, -0.45, 0.1]; p.elR = -1.75;
        p.spineRX += this.lookPitch * 0.25; p.headRX = this.lookPitch * 0.5;
        break;
      }
      case 'cameraLow': { // Cámara en mano, sin visor
        loco();
        p.shL = [-0.55, 0.3, 0]; p.elL = -1.1; p.shR = [-0.5, -0.3, 0.1]; p.elR = -1.2;
        break;
      }
      case 'kneel': { // Fotógrafo arrodillado
        p.hipY = -0.42; p.thL = [-1.45, 0]; p.knL = 1.5; p.thR = [0.05, 0]; p.knR = 1.55; p.ftR = 0.5; p.ftL = 0;
        p.spineRX = 0.12 + this.lookPitch * 0.25; p.headRX = this.lookPitch * 0.5;
        if (this.cameraRig.visible) { p.shL = [-1.25, 0.35, 0.05]; p.elL = -1.65; p.shR = [-1.15, -0.45, 0.1]; p.elR = -1.75; }
        else { p.shL = [-0.3, 0, -0.1]; p.shR = [-0.3, 0, 0.1]; p.elL = p.elR = -0.6; }
        break;
      }
      case 'sit': {
        p.hipY = -0.48; p.thL = [-1.5, -0.08]; p.thR = [-1.5, 0.08]; p.knL = p.knR = 1.5;
        p.shL = [-0.3, 0, -0.15]; p.shR = [-0.3, 0, 0.15]; p.elL = p.elR = -0.9; p.spineRX = 0.1 + Math.sin(this.breath) * 0.02;
        if (this.cameraRig.visible) { p.shL = [-1.25, 0.35, 0.05]; p.elL = -1.65; p.shR = [-1.15, -0.45, 0.1]; p.elR = -1.75; }
        break;
      }
      case 'cheer': { // Aficionado celebrando / saltando
        const j = Math.abs(Math.sin(this.phase * 2));
        p.hipY = j * 0.15; p.shL = [-2.7, 0, -0.4]; p.shR = [-2.7, 0, 0.4]; p.elL = p.elR = -0.2 - j * 0.3; p.knL = p.knR = 0.2 * (1 - j);
        break;
      }
      case 'talk': {
        loco();
        const w = Math.sin(this.breath * 2.3);
        p.shR = [-0.5 + w * 0.15, 0, 0.25]; p.elR = -1.2 + w * 0.2; p.shL = [-0.2, 0, -0.15]; p.elL = -0.4;
        p.headRY = Math.sin(this.breath * 0.7) * 0.15; p.headRX = Math.sin(this.breath * 1.3) * 0.05;
        break;
      }
      case 'wave': { loco(); const w = Math.sin(this.breath * 6); p.shR = [-2.6, 0, 0.5 + w * 0.3]; p.elR = -0.4; break; }
      case 'clipboard': { loco(); p.shL = [-0.8, 0.2, 0]; p.elL = -1.3; p.shR = [-0.6, -0.2, 0]; p.elR = -1.4; p.headRX = 0.35; break; }
      case 'gkReady': { // Portero en guardia: rebote sobre la punta de los pies, manos activas, desplazamiento lateral
        const b = Math.abs(Math.sin(this.breath * 3.6)), sw = Math.sin(this.breath * 1.7);
        p.hipY = -0.14 + b * 0.035; p.thL = [-0.38, -0.17]; p.thR = [-0.38, 0.17]; p.knL = p.knR = 0.72 - b * 0.08; p.ftL = p.ftR = 0.12 * b;
        p.spineRX = 0.33 + sw * 0.03; p.headRX = -0.3; p.headRY = sw * 0.08;
        p.shL = [-0.65 + sw * 0.1, 0, -0.55]; p.shR = [-0.65 - sw * 0.1, 0, 0.55]; p.elL = p.elR = -0.55;
        if (sp > 0.3) { const sn = Math.sin(this.phase * 1.4); p.thL[1] = -0.17 - Math.max(0, sn) * 0.3; p.thR[1] = 0.17 + Math.max(0, -sn) * 0.3; p.hipY += Math.abs(sn) * 0.03; }
        break;
      }
      case 'catch': { const k = smooth(clamp(t / 0.2, 0, 1)); p.shL = [-1.6 + 0.3 * k, 0.35 * k, 0]; p.shR = [-1.6 + 0.3 * k, -0.35 * k, 0]; p.elL = p.elR = -0.6 - 0.9 * k; p.spineRX = 0.15 + 0.3 * k; p.knL = p.knR = 0.2 + 0.25 * k; p.hipY = -0.08 * k; break; }
      case 'stretch': { // Calentamiento: estiramiento de cuádriceps alternado
        const sw = Math.sin(this.breath * 0.8) > 0;
        if (sw) { p.knL = 2.4; p.thL = [0.25, 0]; p.shL = [0.4, 0, -0.2]; p.elL = -1.0; p.shR = [-0.2, 0, 0.4]; }
        else { p.knR = 2.4; p.thR = [0.25, 0]; p.shR = [0.4, 0, 0.2]; p.elR = -1.0; p.shL = [-0.2, 0, -0.4]; }
        p.spineRX = 0.05;
        break;
      }
      case 'jumpjack': { // Saltos de calentamiento
        const j = Math.abs(Math.sin(this.breath * 3.2));
        p.hipY = j * 0.18; p.shL = [0, 0, -0.3 - j * 2.4]; p.shR = [0, 0, 0.3 + j * 2.4]; p.thL = [0, -0.25 * j]; p.thR = [0, 0.25 * j];
        p.knL = p.knR = 0.2 * (1 - j);
        break;
      }
      default: loco();
    }
    return p;
  }

  update(dt, speed = 0) {
    this.speed = speed;
    this.stateT += dt;
    const stepFreq = speed < 2.2 ? 1.8 + speed * 0.9 : 2.8 + speed * 0.42;
    this.phase += dt * stepFreq * Math.PI * (speed > 0.05 ? 1 : 0);
    this.lambdaNow = null;
    const tp = this.target(dt);
    const P = this.pose, L = this.lambdaNow ?? ({ dive: 24, kick: 20, header: 20, slide: 18, getup: 9, catch: 18 }[this.state] || this.lambda);
    for (const k in tp) {
      if (Array.isArray(tp[k])) { for (let i = 0; i < tp[k].length; i++) P[k][i] = damp(P[k][i], tp[k][i], L, dt); }
      else P[k] = damp(P[k], tp[k], L, dt);
    }
    this.apply();
  }
  apply() {
    const P = this.pose;
    this.hips.position.y = 0.94 + P.hipY;
    this.body.rotation.x = -P.rootRX; this.body.rotation.z = P.rootRZ;
    this.body.position.y = this.rootYOffset;
    this.spine.rotation.set(P.spineRX, P.spineRY, P.spineRZ);
    this.neck.rotation.x = P.headRX * 0.4; this.head.rotation.set(P.headRX * 0.6 + this.lookPitch * 0.2, P.headRY + this.lookYaw, 0);
    const [aL, aR] = this.arms;
    // Convención: 'L' = lado x<0 (índice 0), 'R' = lado x>0. Abducción hacia afuera: L negativa, R positiva.
    aL.sh.rotation.set(P.shL[0], P.shL[1], P.shL[2]); aR.sh.rotation.set(P.shR[0], P.shR[1], P.shR[2]);
    const raised = this.cameraRig.visible && (this.state === 'camera' || this.state === 'kneel' || this.state === 'sit');
    this.cameraRig.position.set(0, raised ? 0.6 : 0.3, raised ? 0.19 : 0.3);
    aL.el.rotation.x = P.elL; aR.el.rotation.x = P.elR;
    const [lL, lR] = this.legs;
    lL.th.rotation.set(P.thL[0], 0, P.thL[1]); lR.th.rotation.set(P.thR[0], 0, P.thR[1]);
    lL.kn.rotation.x = P.knL; lR.kn.rotation.x = P.knR;
    lL.ft.rotation.x = P.ftL; lR.ft.rotation.x = P.ftR;
  }
  // Puntos clave en coordenadas mundo (para evaluación fotográfica).
  keyPoints(out = []) {
    const v = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));
    this.root.updateMatrixWorld(true);
    out.length = 0;
    out.push(v(this.head, 0, 0.12, 0), v(this.head), v(this.spine, 0, 0.3, 0), v(this.hips),
      v(this.arms[0].el, 0, -0.27, 0), v(this.arms[1].el, 0, -0.27, 0),
      v(this.legs[0].kn), v(this.legs[1].kn), v(this.legs[0].ft, 0, -0.05, 0.1), v(this.legs[1].ft, 0, -0.05, 0.1));
    return out;
  }
}
