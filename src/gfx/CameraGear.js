import * as THREE from 'three';

// Equipo fotográfico detallado (lentes y cuerpos) para el personaje, los fotógrafos NPC y la vista en primera persona.
// Medidas en metros. El lente crece hacia +Z desde la montura.
const M = {};
const mat = (k, f) => (M[k] ||= f());
const ribTex = () => mat('ribTex', () => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 64; i++) { const v = i % 4 < 2 ? 18 : 52; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, i, 8, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 28); t.colorSpace = THREE.SRGBColorSpace; return t;
});
const labelTex = (txt, fg, bg) => mat('lbl' + txt + fg + bg, () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 48; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 48); x.fillStyle = fg; x.font = 'bold 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 256, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
});
export const GEAR = {
  white: () => mat('white', () => new THREE.MeshStandardMaterial({ color: 0xeeede6, roughness: 0.42, metalness: 0.05 })),
  black: () => mat('black', () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.2 })),
  matte: () => mat('matte', () => new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 })),
  rib: () => mat('rib', () => new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, map: ribTex() })),
  metal: () => mat('metal', () => new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.3, metalness: 0.9 })),
  red: () => mat('red', () => new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4, emissive: 0x2a0006 })),
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0d1d2e, roughness: 0.03, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x06111d, iridescence: 0.7, iridescenceIOR: 1.6 })),
};
// Lentes blancos: teleobjetivos profesionales (no los económicos)
export function lensIsWhite(L) { return !!L && L.max >= 200 && L.fMin <= 5.6 && !/económico/i.test(L.name || ''); }

// Lente detallado: montura, barril, anillos de zoom y enfoque estriados, collar de trípode, anillo rojo, cristal y parasol.
export function buildLens(L) {
  const g = new THREE.Group(); g.name = 'lens';
  const white = lensIsWhite(L), body = white ? GEAR.white() : GEAR.black();
  const len = 0.055 + L.max / 1500, front = Math.max(0.03, (L.max / L.fMin) / 2000 + 0.012), rear = Math.min(front, 0.034 + (white ? 0.004 : 0));
  const zoom = L.min !== L.max, prime = !zoom && L.max >= 300;
  const seg = (z0, z1, r0, r1, m, open = false) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, (z1 - z0) * len, 32, 1, open), m); c.rotation.x = Math.PI / 2; c.position.z = ((z0 + z1) / 2) * len; c.castShadow = true; g.add(c); return c; };
  const rAt = (t) => rear + (front - rear) * (prime ? Math.pow(t, 2.2) : Math.min(1, t * 1.6));
  seg(0, 0.05, 0.03, 0.03, GEAR.metal());
  seg(0.05, 0.22, rAt(0.05), rAt(0.22), body);
  if (zoom) seg(0.22, 0.4, rAt(0.22) + 0.002, rAt(0.4) + 0.002, GEAR.rib()); else seg(0.22, 0.4, rAt(0.22), rAt(0.4), body);
  seg(0.4, 0.58, rAt(0.4), rAt(0.58), body);
  if (L.max >= 200) { // collar y pie de trípode
    seg(0.42, 0.48, rAt(0.45) + 0.004, rAt(0.45) + 0.004, body);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.018, front * 0.6, 0.03), body); foot.position.set(0, -(rAt(0.45) + front * 0.3), 0.45 * len); g.add(foot);
  }
  seg(0.58, 0.74, rAt(0.58) + 0.002, rAt(0.74) + 0.002, GEAR.rib());
  if (white) seg(0.76, 0.78, rAt(0.77) + 0.001, rAt(0.77) + 0.001, GEAR.red()); else seg(0.76, 0.775, rAt(0.77) + 0.0008, rAt(0.77) + 0.0008, GEAR.red());
  seg(0.74, 0.9, rAt(0.74), front * 1.02, body);
  // Etiqueta con la focal y la apertura
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(rAt(0.3) + 0.0006, rAt(0.3) + 0.0006, 0.06 * len + 0.004, 32, 1, true, -0.8, 1.6),
    new THREE.MeshStandardMaterial({ map: labelTex(`${L.short || L.max} · 1:${L.fMin}`, white ? '#1a1a1a' : '#e8e8e8', white ? '#eeede6' : '#151515'), roughness: 0.5 }));
  lbl.rotation.x = Math.PI / 2; lbl.rotation.y = Math.PI; lbl.position.z = 0.15 * len; g.add(lbl);
  // Cristal frontal (con reflejo) y parasol negro
  const glass = new THREE.Mesh(new THREE.SphereGeometry(front * 0.98, 24, 10, 0, Math.PI * 2, 0, 0.45), GEAR.glass()); glass.rotation.x = Math.PI / 2; glass.position.z = 0.9 * len - front * 0.86; g.add(glass);
  const hoodL = 0.05 + front * 0.6, hood = new THREE.Mesh(new THREE.CylinderGeometry(front * 1.22, front * 1.04, hoodL, 32, 1, true), mat('hood', () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.75, side: THREE.DoubleSide })));
  hood.rotation.x = Math.PI / 2; hood.position.z = 0.9 * len + hoodL / 2; g.add(hood);
  g.userData.length = 0.9 * len + hoodL; g.userData.front = front;
  return g;
}

// Pantalla de la cámara: vista en vivo pixelada (render a muy baja resolución) con datos de exposición encima.
export class LiveView {
  constructor(game) {
    this.game = game; this.t = 0;
    this.rt = new THREE.WebGLRenderTarget(128, 86, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
    this.cam = new THREE.PerspectiveCamera(30, 128 / 86, 0.2, 1500);
    this.material = new THREE.MeshBasicMaterial({ map: this.rt.texture, toneMapped: true });
    const c = document.createElement('canvas'); c.width = 256; c.height = 172; this.hudCanvas = c;
    this.hudTex = new THREE.CanvasTexture(c); this.hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMat = new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, depthWrite: false, toneMapped: false });
    this.drawHud();
  }
  // Pantalla lista para pegar en la parte trasera de un cuerpo (w×h en metros)
  makeScreen(w, h) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.material));
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.hudMat); o.position.z = 0.0004; g.add(o);
    return g;
  }
  drawHud() {
    const g = this.game, x = this.hudCanvas.getContext('2d'), W = 256, H = 172, pm = g.photoMode, inv = g.inventory;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, W, 20); x.fillRect(0, H - 22, W, 22);
    x.font = 'bold 13px monospace'; x.fillStyle = '#fff'; x.textBaseline = 'middle';
    const s = pm?.s || {};
    x.fillText(`${s.af || 'AF-C'} ${s.drive === 'burst' ? '▣▣' : '▣'}`, 6, 10);
    x.textAlign = 'right'; x.fillText(`🔋${inv?.batteryPct ?? 100}%  [${Math.max(0, (inv?.cardCapacity || 999) - (inv?.cardUsed || 0))}]`, W - 6, 10);
    x.textAlign = 'left';
    const sh = pm?.shutter ? (pm.shutter >= 1 ? pm.shutter + '"' : '1/' + Math.round(1 / pm.shutter)) : '1/1000';
    x.fillText(`${sh}  F${pm?.aperture ?? 2.8}  ISO ${pm?.isoLabel ?? 'AUTO'}`, 6, H - 11);
    // Recuadros de enfoque
    x.strokeStyle = 'rgba(80,255,120,.9)'; x.lineWidth = 2;
    const bx = W / 2 - 22, by = H / 2 - 16; for (const [ax, ay, dx, dy] of [[bx, by, 1, 1], [bx + 44, by, -1, 1], [bx, by + 32, 1, -1], [bx + 44, by + 32, -1, -1]]) { x.beginPath(); x.moveTo(ax + dx * 9, ay); x.lineTo(ax, ay); x.lineTo(ax, ay + dy * 9); x.stroke(); }
    this.hudTex.needsUpdate = true;
  }
  // Renderiza la vista en vivo unas 8 veces por segundo, desde donde apunta la cámara del fotógrafo
  update(dt) {
    const g = this.game, p = g.player; if (!p || g.state !== 'play' || g.photoMode.active) return;
    const fp = g.viewModel?.root.visible, tp = !fp && p.cameraEquipped && p.root.visible;
    if (!fp && !tp) return;
    this.t -= dt; if (this.t > 0) return; const ql = g.settings?.data?.quality; this.t = ql === 'bajo' ? 0.3 : ql === 'medio' ? 0.16 : 0.1; this.hudN = (this.hudN || 0) + 1; if (this.hudN % 6 === 0) this.drawHud();
    const c = this.cam, v = new THREE.Vector3(), d = new THREE.Vector3();
    if (fp) { c.position.copy(g.camera.position); c.quaternion.copy(g.camera.quaternion); }
    else { p.avatar.cameraRig.getWorldPosition(v); d.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); c.position.copy(v).addScaledVector(d, 0.5); c.lookAt(v.x + d.x * 20, v.y - 0.4, v.z + d.z * 20); }
    c.fov = Math.min(60, Math.max(4, g.photoMode?.vfov || 30)); c.updateProjectionMatrix();
    const r = g.renderer, vm = g.viewModel?.root, vis = vm?.visible;
    if (vm) vm.visible = false;
    r.setRenderTarget(this.rt); r.render(g.scene, c); r.setRenderTarget(null);
    if (vm) vm.visible = vis;
  }
}
