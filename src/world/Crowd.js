import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_TONES } from '../characters/Humanoid.js';

/*
 * Público instanciado: miles de aficionados en un solo draw call.
 * La animación (levantarse, saltar, alzar brazos) ocurre en el vertex shader
 * y depende de uExcite (intensidad del partido) y uTime.
 */
function personGeometry() {
  const parts = [];
  const add = (g, part) => {
    const n = g.attributes.position.count; g.setAttribute('part', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
    const ng = g.index ? g.toNonIndexed() : g; parts.push(ng);
  };
  const torso = new THREE.BoxGeometry(0.4, 0.5, 0.24); torso.translate(0, 0.55, 0); add(torso, 0);
  const head = new THREE.SphereGeometry(0.11, 7, 5); head.translate(0, 0.94, 0.01); add(head, 3);
  const armL = new THREE.BoxGeometry(0.1, 0.46, 0.1); armL.translate(-0.26, 0.52, 0); add(armL, 1);
  const armR = new THREE.BoxGeometry(0.1, 0.46, 0.1); armR.translate(0.26, 0.52, 0); add(armR, 2);
  const legs = new THREE.BoxGeometry(0.34, 0.42, 0.16); legs.translate(0, 0.1, 0.02); add(legs, 4);
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'part'].includes(k)) p.deleteAttribute(k);
  return mergeGeometries(parts);
}

export class Crowd {
  constructor(maxCount) {
    this.geo = personGeometry();
    this.max = maxCount; this.count = 0;
    this.aPhase = new Float32Array(maxCount * 2);
    this.aColor = new Float32Array(maxCount * 3);
    this.aSkin = new Float32Array(maxCount * 3);
    this.uniforms = { uTime: { value: 0 }, uExcite: { value: 0.1 }, uStand: { value: 0.15 }, uWave: { value: -100 }, uFocus: { value: new THREE.Vector3(0, 0, 0) }, uFocusAmt: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float part; attribute vec2 aPhase; attribute vec3 aColor; attribute vec3 aSkin;
          uniform float uTime, uExcite, uStand, uWave, uFocusAmt; uniform vec3 uFocus; varying vec3 vCrowdCol;`)
        .replace('#include <begin_vertex>', `
          vec3 transformed = position;
          vec4 wpos = instanceMatrix * vec4(0.,0.,0.,1.);
          float ph = aPhase.x * 6.2831;
          // Excitación local: la ola y la zona cercana a un gol se encienden más.
          float wave = smoothstep(14.0, 0.0, abs(atan(wpos.z, wpos.x) * 60.0 - uWave));
          float local = uFocusAmt * smoothstep(70.0, 10.0, distance(wpos.xz, uFocus.xz));
          float ex = clamp(uExcite + local + wave * 0.9, 0.0, 1.2);
          float standing = step(aPhase.y, max(uStand, ex * 0.95));
          if (part < 3.5) transformed.y += standing * 0.36;
          if (part > 3.5) transformed.y += standing * 0.18;
          float bounce = max(0.0, sin(uTime * (6.0 + aPhase.x * 4.0) + ph)) * ex * 0.2 * standing;
          transformed.y += bounce;
          transformed.x += sin(uTime * 1.1 + ph) * 0.025;
          if (part > 0.5 && part < 2.5) {
            float side = part < 1.5 ? -1.0 : 1.0;
            float sy = 0.75 + standing * 0.36 + bounce;
            vec3 piv = vec3(side * 0.26, sy, 0.0);
            vec3 rel = transformed - piv;
            float raise = smoothstep(0.35, 0.55, ex * 1.3 - aPhase.y * 0.55);
            float ang = side * (raise * 2.7 + sin(uTime * 8.0 + ph) * 0.3 * raise);
            float s = sin(ang), c = cos(ang);
            rel = vec3(c * rel.x - s * rel.y, s * rel.x + c * rel.y, rel.z);
            transformed = piv + rel;
          }
          vCrowdCol = part > 2.5 && part < 3.5 ? aSkin : (part > 3.5 ? aColor * 0.35 + vec3(0.08) : aColor);
        `);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCrowdCol;')
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= vCrowdCol;');
    };
    this.mesh = new THREE.InstancedMesh(this.geo, mat, maxCount);
    this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.dummy = new THREE.Object3D();
    this.positions = [];
  }
  addPerson(x, y, z, rotY, color, standBias = Math.random()) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, rotY, 0);
    const s = 0.92 + Math.random() * 0.16; this.dummy.scale.set(s, s, s); this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.aPhase[i * 2] = Math.random(); this.aPhase[i * 2 + 1] = standBias;
    const c = new THREE.Color(color); this.aColor.set([c.r, c.g, c.b], i * 3);
    const sk = new THREE.Color(SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)]); this.aSkin.set([sk.r, sk.g, sk.b], i * 3);
    this.positions.push(x, y, z);
  }
  finalize() {
    const g = this.geo;
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.aPhase, 2));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.aColor, 3));
    g.setAttribute('aSkin', new THREE.InstancedBufferAttribute(this.aSkin, 3));
    this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(dt, time) { this.uniforms.uTime.value = time; }
}
