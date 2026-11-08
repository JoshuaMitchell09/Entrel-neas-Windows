import * as THREE from 'three';
import { h, clear } from './dom.js';
import { Humanoid } from '../characters/Humanoid.js';
import { SKINS, HAIRS, STYLES, SHIRTS, PANTS, CAPS, humanoidOpts, saveGlobalLook } from '../player/Look.js';

/*
 * Personalización del fotógrafo: género, tono de piel, peinado, color de pelo, barba, camisa, pantalón y gorra.
 * Vista previa 3D en un lienzo propio que gira (arrastrá con el ratón para girarlo vos).
 */
export function openCustomizer(game, { title = 'Tu fotógrafo', confirm = 'Listo', onDone, onBack } = {}) {
  const g = game, ui = g.ui;
  const look = { ...g.player.look };
  // ---------- Vista previa ----------
  const W = 320, H = Math.max(300, Math.min(440, window.innerHeight - 220));
  const canvas = h('canvas', { class: 'cz-canvas', width: W * 2, height: H * 2, style: { width: W + 'px', height: H + 'px' } });
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { /* sin WebGL extra: se muestra solo el panel */ }
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  cam.position.set(0, 1.25, 4.4); cam.lookAt(0, 0.95, 0);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec5ff, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshStandardMaterial({ color: 0x1e2636, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  if (renderer) { renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; }
  let model = null, yaw = 0.5, drag = null, alive = true, last = performance.now(), auto = true;
  const rebuild = () => {
    if (model) scene.remove(model.root);
    model = new Humanoid(humanoidOpts(look)); model.showCamera(true); model.setLensLength(g.inventory.lens.max); model.setCameraBody(g.inventory.camera?.look);
    model.play?.('loco'); scene.add(model.root);
  };
  const loop = (now) => {
    if (!alive) return; requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (auto && !drag) yaw += dt * 0.5;
    if (model) { model.root.rotation.y = yaw; model.update(dt, 0); }
    renderer?.render(scene, cam);
  };
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; auto = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag !== null) { yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  // ---------- Panel de opciones ----------
  const panel = h('div', { class: 'cz-opts' });
  const sw = (key, colors, labelFor) => h('div', { class: 'cz-sw' }, colors.map((c) => h('button', {
    class: 'cz-dot' + (look[key] === c ? ' on' : '') + (c ? '' : ' none'), title: labelFor ? labelFor(c) : c || 'Ninguna', style: c ? { background: c } : {},
    onclick: () => { look[key] = c; render(); rebuild(); } }, c ? '' : '✕')));
  const choice = (key, entries) => h('div', { class: 'cz-ch' }, entries.map(([v, l]) => h('button', { class: 'btn small' + (look[key] === v ? ' primary' : ''), onclick: () => {
    look[key] = v;
    if (key === 'gender') { if (v === 'mujer') { look.beard = false; if (look.hairStyle === 'buzz' || look.hairStyle === 'fade') look.hairStyle = 'long'; } else if (look.hairStyle === 'long') look.hairStyle = 'short'; }
    render(); rebuild(); } }, l)));
  const row = (label, ctrl) => h('div', { class: 'cz-row' }, h('div', { class: 'cz-l' }, label), ctrl);
  const render = () => {
    clear(panel);
    panel.append(...[
      row('Género', choice('gender', [['hombre', '👨 Hombre'], ['mujer', '👩 Mujer']])),
      row('Tono de piel', sw('skin', SKINS)),
      row('Peinado', choice('hairStyle', Object.entries(STYLES))),
      look.hairStyle !== 'bald' ? row('Color de pelo', sw('hair', HAIRS)) : null,
      look.gender === 'hombre' ? row('Barba', choice('beard', [[false, 'Sin barba'], [true, 'Con barba']])) : null,
      row('Camisa', sw('shirt', SHIRTS)),
      row('Pantalón', sw('pants', PANTS)),
      row('Gorra', sw('cap', CAPS, (c) => (c ? 'Gorra' : 'Sin gorra'))),
    ].filter(Boolean));
  };
  render(); rebuild();
  const close = () => { alive = false; try { renderer?.dispose(); renderer?.forceContextLoss(); } catch (e) { /* */ } };
  const el = h('div', { class: 'screen' }, h('div', { class: 'panel cz-wrap' },
    h('div', { class: 'cz-head' }, h('div', { class: 'h2' }, title), h('div', { class: 'muted' }, 'Elegí cómo se ve tu fotógrafo. Arrastrá la figura para girarla.')),
    h('div', { class: 'cz-body' }, h('div', { class: 'cz-prev' }, renderer ? canvas : h('div', { class: 'muted' }, 'Vista previa no disponible')), panel),
    h('div', { class: 'acts cz-acts' },
      onBack ? h('button', { class: 'btn', onclick: () => { close(); onBack(); } }, 'Volver') : null,
      h('button', { class: 'btn primary', onclick: () => { close(); saveGlobalLook(look); onDone?.({ ...look }); } }, confirm))));
  ui.openScreen('customize', el);
  ui.screenCleanup = close;
  requestAnimationFrame(loop);
}
