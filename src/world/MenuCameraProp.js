import * as THREE from 'three';

// Cámara réflex profesional (cuerpo + teleobjetivo blanco 70-200) que descansa sobre el césped
// en el menú principal. Marca ficticia. Escala real (metros).
function labelTexture(text, w = 256, h = 64, color = '#e8e8e8', bg = '#121212', font = 'bold 40px Arial') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function gripTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#161616'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) { const v = 14 + Math.random() * 22; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ribTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 64; i++) { const v = i % 4 < 2 ? 20 : 48; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, i, 8, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.8, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - r * 2) / 2); return g;
}

export function buildMenuCamera() {
  const root = new THREE.Group(); root.name = 'menuCamera';
  const body = new THREE.MeshStandardMaterial({ color: 0x1a1a1b, roughness: 0.55, metalness: 0.15 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.95, map: gripTexture() });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.3, metalness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.42, metalness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.6 });
  const ribs = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, map: ribTexture() });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4, emissive: 0x300006 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1a2a, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x05101e, iridescence: 0.6 });
  const lcd = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.1, emissive: 0x0a1726, emissiveIntensity: 1 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // ---- Cuerpo (lente apunta a +Z). Base del cuerpo en y=0 ----
  const cam = new THREE.Group(); root.add(cam);
  add(roundedBox(0.152, 0.098, 0.074, 0.012), body, 0, 0.064, 0, 0, 0, 0, cam);
  // Empuñadura (lado derecho visto desde atrás = -X con lente a +Z)
  add(roundedBox(0.046, 0.112, 0.088, 0.016), rubber, -0.058, 0.064, 0.012, 0, 0, 0, cam);
  // Agarre vertical integrado (cuerpo profesional)
  add(roundedBox(0.152, 0.042, 0.072, 0.01), body, 0, 0.012, -0.002, 0, 0, 0, cam);
  add(roundedBox(0.044, 0.044, 0.08, 0.012), rubber, -0.058, 0.012, 0.01, 0, 0, 0, cam);
  // Prisma
  const prism = new THREE.CylinderGeometry(0.018, 0.04, 0.034, 4, 1); prism.rotateY(Math.PI / 4); prism.scale(1.1, 1, 0.9);
  add(prism, body, 0, 0.13, -0.004, 0, 0, 0, cam);
  add(new THREE.BoxGeometry(0.03, 0.006, 0.02), metal, 0, 0.15, -0.006, 0, 0, 0, cam); // zapata
  // Placa con la marca ficticia sobre el prisma
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshStandardMaterial({ map: labelTexture('JM PRO', 256, 64, '#e9e9e9', '#151515'), roughness: 0.5 }));
  brand.position.set(0, 0.128, 0.0255); brand.rotation.x = -0.42; cam.add(brand);
  // Diales y botones
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 24), ribs, 0.05, 0.118, -0.006, 0, 0, 0, cam);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 24), ribs, -0.045, 0.118, -0.01, 0, 0, 0, cam);
  add(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 20), metal, -0.06, 0.124, 0.028, 0.25, 0, 0, cam); // disparador
  add(new THREE.BoxGeometry(0.03, 0.002, 0.018), lcd, -0.044, 0.1145, -0.012, 0, 0, 0, cam); // pantalla superior
  // Pantalla trasera y visor
  add(new THREE.BoxGeometry(0.09, 0.062, 0.004), lcd, 0.012, 0.064, -0.0385, 0, 0, 0, cam);
  add(new THREE.CylinderGeometry(0.014, 0.016, 0.022, 20), black, 0, 0.128, -0.04, Math.PI / 2, 0, 0, cam);
  for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 12), black, 0.058, 0.09 - i * 0.014, -0.038, Math.PI / 2, 0, 0, cam);
  // Montura y anillo rojo del cuerpo
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 40), metal, 0.008, 0.066, 0.04, Math.PI / 2, 0, 0, cam);
  // Correa saliendo de los ojales
  add(new THREE.TorusGeometry(0.006, 0.0018, 6, 12), metal, 0.078, 0.1, 0.0, 0, Math.PI / 2, 0, cam);
  add(new THREE.TorusGeometry(0.006, 0.0018, 6, 12), metal, -0.082, 0.1, 0.0, 0, Math.PI / 2, 0, cam);

  // ---- Teleobjetivo blanco 70-200 f/2.8 ----
  const lens = new THREE.Group(); lens.position.set(0.008, 0.066, 0.044); lens.rotation.x = Math.PI / 2; cam.add(lens);
  const seg = (r1, r2, len, mat, y, s = 48) => add(new THREE.CylinderGeometry(r2, r1, len, s, 1, false), mat, 0, y + len / 2, 0, 0, 0, 0, lens);
  seg(0.032, 0.033, 0.012, black, 0);
  seg(0.036, 0.036, 0.03, white, 0.012);
  seg(0.0372, 0.0372, 0.028, ribs, 0.042); // anillo de zoom
  seg(0.036, 0.036, 0.016, white, 0.07);
  // Collar del trípode con pie que toca el césped
  seg(0.0385, 0.0385, 0.016, white, 0.086);
  add(new THREE.BoxGeometry(0.016, 0.008, 0.022), white, 0, 0.094, 0.042, 0, 0, 0, lens);
  seg(0.037, 0.039, 0.05, white, 0.102);
  seg(0.0395, 0.0395, 0.024, ribs, 0.152); // anillo de enfoque
  seg(0.0395, 0.041, 0.016, white, 0.176);
  seg(0.0412, 0.0412, 0.004, red, 0.192); // anillo rojo distintivo
  seg(0.0412, 0.0412, 0.01, white, 0.196);
  // Parasol (negro, ensanchado) y lente frontal
  const hoodMat = black.clone(); hoodMat.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(0.049, 0.043, 0.06, 48, 1, true), hoodMat, 0, 0.236, 0, 0, 0, 0, lens);
  add(new THREE.TorusGeometry(0.048, 0.0016, 6, 48), black, 0, 0.266, 0, Math.PI / 2, 0, 0, lens);
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.002, 48), glass, 0, 0.2065, 0, 0, 0, 0, lens);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(0.037, 32, 12, 0, Math.PI * 2, 0, 0.5), glass); gl.position.y = 0.19; lens.add(gl);
  // Etiqueta de la lente
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.0362, 0.0362, 0.012, 48, 1, true, -0.7, 1.4), new THREE.MeshStandardMaterial({ map: labelTexture('70-200 mm  1:2.8  IS', 512, 64, '#1a1a1a', '#eeeeea', 'bold 34px Arial'), roughness: 0.45 }));
  lbl.position.y = 0.122; lbl.rotation.y = Math.PI; lens.add(lbl);
  // Botones laterales de la lente
  add(new THREE.BoxGeometry(0.012, 0.03, 0.006), black, -0.038, 0.11, 0, 0, 0, 0, lens);

  // Apoyo: el parasol toca el césped, la cámara queda levemente inclinada hacia adelante
  cam.rotation.x = 0.08; cam.position.y = 0.0;
  // Correa sobre el césped
  const pts = [[0.078, 0.1, 0], [0.13, 0.05, -0.02], [0.16, 0.004, -0.1], [0.08, 0.004, -0.2], [-0.06, 0.004, -0.18], [-0.13, 0.004, -0.08], [-0.082, 0.1, 0]].map((p) => new THREE.Vector3(...p));
  const strap = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.006, 6, false); strap.scale(1, 0.4, 1);
  const sm = new THREE.Mesh(strap, new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 })); sm.castShadow = true; sm.position.y = 0.002; root.add(sm);
  // Sombra de contacto suave
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sx = sc.getContext('2d'); const gr = sx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.003, 0.08); root.add(shadow);
  root.userData.cam = cam;
  return root;
}
