import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * Fusiona mallas estáticas que comparten material (y celda espacial) en una sola malla.
 * Reduce drásticamente los draw calls de escenarios con cientos de piezas.
 */
export function mergeStatic(root, cell = 70) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  const skip = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.noMerge) return true; return false; };
  const center = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || skip(o)) return;
    if (o.material.transparent && o.material.opacity < 1 && !o.material.alphaTest) return; // vidrio: mantener orden
    o.getWorldPosition(center);
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${Math.floor(center.x / cell)},${Math.floor(center.z / cell)}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
    buckets.get(key).list.push(o);
  });
  let merged = 0;
  for (const b of buckets.values()) {
    if (b.list.length < 2) continue;
    const geos = [];
    for (const o of b.list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      g.morphAttributes = {};
      geos.push(g);
    }
    const mg = mergeGeometries(geos, false);
    if (!mg) continue;
    const m = new THREE.Mesh(mg, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv; m.name = 'merged';
    root.add(m); victims.push(...b.list); merged += b.list.length;
  }
  for (const o of victims) o.parent?.remove(o);
  return merged;
}
