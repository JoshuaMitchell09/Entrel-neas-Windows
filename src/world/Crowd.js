import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_TONES } from '../characters/Humanoid.js';

/*
 * Público instanciado: miles de aficionados en un solo draw call.
 * Toda la animación ocurre en el vertex shader:
 *  - llenado progresivo del estadio (uFill) según la hora de llegada,
 *  - levantarse, saltar, aplaudir, alzar los brazos (uExcite, ola, gol),
 *  - la barra salta y canta al ritmo (uChant),
 *  - las cabezas siguen el balón (uBall),
 *  - los aficionados cercanos se giran hacia el fotógrafo y lo saludan (uPlayer),
 *  - quienes están en el encuadre posan con los brazos arriba (uAim).
 * Partes: 0 torso · 1 brazo izq · 2 brazo der · 3 cabeza · 4 piernas · 5 pelo/gorra
 */
function personGeometry() {
  const parts = [];
  const add = (g, part) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.setAttribute('part', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count).fill(part), 1));
    parts.push(ng);
  };
  const torso = new THREE.CylinderGeometry(0.2, 0.16, 0.5, 7); torso.scale(1, 1, 0.62); torso.translate(0, 0.55, 0); add(torso, 0);
  const head = new THREE.SphereGeometry(0.105, 8, 5); head.scale(0.92, 1.05, 1); head.translate(0, 0.95, 0.01); add(head, 3);
  const hair = new THREE.SphereGeometry(0.113, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.5); hair.translate(0, 0.965, -0.004); add(hair, 5);
  const armL = new THREE.CylinderGeometry(0.052, 0.044, 0.48, 5); armL.translate(-0.25, 0.53, 0); add(armL, 1);
  const armR = new THREE.CylinderGeometry(0.052, 0.044, 0.48, 5); armR.translate(0.25, 0.53, 0); add(armR, 2);
  const legs = new THREE.BoxGeometry(0.34, 0.42, 0.18); legs.translate(0, 0.1, 0.03); add(legs, 4);
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'part'].includes(k)) p.deleteAttribute(k);
  return mergeGeometries(parts);
}
const HAIR = ['#120c08', '#2b1c12', '#3a2817', '#5a3b22', '#7a5230', '#9e9e9e', '#1a1a1a', '#c9a15a'];

export class Crowd {
  constructor(maxCount) {
    this.geo = personGeometry();
    this.max = maxCount; this.count = 0;
    this.aPhase = new Float32Array(maxCount * 2);
    this.aColor = new Float32Array(maxCount * 3);
    this.aSkin = new Float32Array(maxCount * 3);
    this.aHair = new Float32Array(maxCount * 3);
    this.aMisc = new Float32Array(maxCount * 4); // x: umbral de llegada · y: barra · z: tono de pantalón · w: estilo
    this.uniforms = {
      uTime: { value: 0 }, uExcite: { value: 0.1 }, uStand: { value: 0.15 }, uWave: { value: -100 }, uFocus: { value: new THREE.Vector3(0, 0, 0) }, uFocusAmt: { value: 0 },
      uFill: { value: 1 }, uChant: { value: 0 }, uBall: { value: new THREE.Vector3(0, 0, 0) }, uPlayer: { value: new THREE.Vector3(0, -99, 0) }, uNear: { value: 0 },
      uAim: { value: new THREE.Vector3(0, -99, 0) }, uAimAmt: { value: 0 },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float part; attribute vec2 aPhase; attribute vec3 aColor; attribute vec3 aSkin; attribute vec3 aHair; attribute vec4 aMisc;
          uniform float uTime, uExcite, uStand, uWave, uFocusAmt, uFill, uChant, uNear, uAimAmt; uniform vec3 uFocus, uBall, uPlayer, uAim; varying vec3 vCrowdCol;
          vec3 rotY(vec3 p, float a) { float s = sin(a), c = cos(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
          // Ángulo (en el espacio local de la persona) hacia un punto del mundo
          float yawTo(vec3 wpos, vec3 target) {
            vec3 f = normalize((instanceMatrix * vec4(0., 0., 1., 0.)).xyz); vec3 r = normalize((instanceMatrix * vec4(1., 0., 0., 0.)).xyz);
            vec3 d = target - wpos; return atan(dot(d, r), dot(d, f));
          }`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vec3 wpos0 = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
          float dP0 = distance(wpos0.xz, uPlayer.xz);
          float near0 = uNear * smoothstep(17.0, 5.0, dP0) * step(abs(uPlayer.y - wpos0.y), 9.0);
          float turn0 = clamp(yawTo(wpos0, uPlayer), -1.1, 1.1) * near0 * 0.55;
          objectNormal = rotY(objectNormal, turn0);`)
        .replace('#include <begin_vertex>', `
          vec3 transformed = position;
          vec3 wpos = wpos0;
          float ph = aPhase.x * 6.2831;
          float sel = fract(aPhase.x * 13.17), sel2 = fract(aPhase.x * 7.31);
          float barra = aMisc.y;
          // Excitación local: la ola y la zona cercana a un gol se encienden más.
          float wave = smoothstep(14.0, 0.0, abs(atan(wpos.z, wpos.x) * 60.0 - uWave));
          float local = uFocusAmt * smoothstep(70.0, 10.0, distance(wpos.xz, uFocus.xz));
          float ex = clamp(uExcite + local + wave * 0.9, 0.0, 1.2);
          // Interacción con el fotógrafo
          float near = near0;
          float aimed = uAimAmt * smoothstep(10.0, 2.5, distance(wpos, uAim));
          float waveHi = near * step(sel, 0.5);
          float chant = barra * uChant;
          float standing = max(step(aPhase.y, max(uStand, ex * 0.95)), max(chant, max(aimed, waveHi * 0.6)));
          if (part != 4.0) transformed.y += standing * 0.36;
          else transformed.y += standing * 0.18;
          float bounce = max(0.0, sin(uTime * (6.0 + aPhase.x * 4.0) + ph)) * ex * 0.2 * standing * (1.0 - aimed);
          bounce = max(bounce, abs(sin(uTime * 3.3 + aPhase.x * 0.6)) * 0.2 * chant);
          transformed.y += bounce;
          transformed.x += sin(uTime * 1.1 + ph) * 0.025 + sin(uTime * 0.37 + ph * 2.0) * 0.015;
          // Brazos: alzar (lateral), aplaudir (adelante) y saludar al fotógrafo
          if (part == 1.0 || part == 2.0) {
            float side = part < 1.5 ? -1.0 : 1.0;
            float sy = 0.77 + standing * 0.36 + bounce;
            vec3 piv = vec3(side * 0.25, sy, 0.0);
            vec3 rel = transformed - piv;
            float raise = smoothstep(0.35, 0.55, ex * 1.3 - aPhase.y * 0.55);
            raise = max(raise, max(aimed, chant * (0.75 + 0.25 * sin(uTime * 3.3))));
            float clap = smoothstep(0.22, 0.42, ex) * (1.0 - raise) * step(0.45, sel2);
            float hello = waveHi * (1.0 - aimed) * step(0.0, side);
            raise = max(raise, hello);
            float ang = side * (raise * 2.6 + sin(uTime * 8.0 + ph) * 0.3 * raise) + side * hello * sin(uTime * 9.0 + ph) * 0.45;
            float s = sin(ang), c = cos(ang);
            rel = vec3(c * rel.x - s * rel.y, s * rel.x + c * rel.y, rel.z);
            // Aplauso: brazos hacia adelante y hacia el centro
            float fa = -clap * 1.2; float sf = sin(fa), cf = cos(fa);
            rel = vec3(rel.x, cf * rel.y - sf * rel.z, sf * rel.y + cf * rel.z);
            rel.x -= side * clap * (0.12 + 0.06 * sin(uTime * 15.0 + ph));
            transformed = piv + rel;
          }
          // Cabeza: sigue el balón; si el fotógrafo está cerca, lo mira
          if (part == 3.0 || part == 5.0) {
            float look = clamp(yawTo(wpos, uBall), -0.9, 0.9) * 0.8 + sin(uTime * 0.4 + ph * 3.0) * 0.2;
            float lookP = clamp(yawTo(wpos, uPlayer), -1.2, 1.2) - turn0;
            float hy = mix(look, lookP, max(near, aimed));
            vec3 hp = vec3(0.0, 0.84 + standing * 0.36 + bounce, 0.0);
            transformed = hp + rotY(transformed - hp, hy);
          }
          // Cuerpo girado hacia el fotógrafo cercano
          transformed = rotY(transformed, turn0);
          // Llegada progresiva del público: quien aún no llegó no se dibuja
          if (aMisc.x > uFill) transformed = vec3(0.0, -60.0, 0.0);
          float arm = (part == 1.0 || part == 2.0) ? step(position.y, 0.4) : 0.0;
          vec3 pants = mix(vec3(0.10, 0.13, 0.22), vec3(0.30, 0.27, 0.22), aMisc.z);
          vCrowdCol = part == 3.0 ? aSkin : part == 4.0 ? pants : part == 5.0 ? aHair : mix(aColor, aSkin, arm * step(0.3, aMisc.w));
          vCrowdCol *= 0.9 + 0.2 * fract(aPhase.x * 31.7);
        `);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCrowdCol;')
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= vCrowdCol;');
    };
    this.mesh = new THREE.InstancedMesh(this.geo, mat, maxCount);
    this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.dummy = new THREE.Object3D();
    this.positions = []; this.seats = [];
  }
  addPerson(x, y, z, rotY, color, standBias = Math.random(), opts = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const kid = Math.random() < 0.07, build = 0.9 + Math.random() * 0.26, s = kid ? 0.72 : 0.94 + Math.random() * 0.12;
    this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, rotY, 0);
    this.dummy.scale.set(s * build, s, s * (0.95 + Math.random() * 0.1)); this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.aPhase[i * 2] = Math.random(); this.aPhase[i * 2 + 1] = standBias;
    const c = new THREE.Color(color); this.aColor.set([c.r, c.g, c.b], i * 3);
    const sk = new THREE.Color(SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)]); this.aSkin.set([sk.r, sk.g, sk.b], i * 3);
    // Pelo o gorra (a veces del color del equipo)
    const hc = new THREE.Color(opts.cap && Math.random() < 0.22 ? opts.cap : HAIR[Math.floor(Math.random() * HAIR.length)]); this.aHair.set([hc.r, hc.g, hc.b], i * 3);
    this.aMisc.set([opts.arrival ?? Math.random(), opts.barra ? 1 : 0, Math.random(), Math.random()], i * 4);
    this.positions.push(x, y, z); this.seats.push({ x, y, z, rot: rotY, row: opts.row ?? 0 });
  }
  finalize() {
    const g = this.geo;
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.aPhase, 2));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.aColor, 3));
    g.setAttribute('aSkin', new THREE.InstancedBufferAttribute(this.aSkin, 3));
    g.setAttribute('aHair', new THREE.InstancedBufferAttribute(this.aHair, 3));
    g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(this.aMisc, 4));
    this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true;
  }
  arrival(i) { return this.aMisc[i * 4]; }
  // Quita a una persona (p. ej. para sentar en su lugar a la familia del fotógrafo)
  hidePerson(i) { this.aMisc[i * 4] = 9; this.geo.attributes.aMisc.needsUpdate = true; }
  update(dt, time) { this.uniforms.uTime.value = time; }
}
