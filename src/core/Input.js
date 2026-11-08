// Sistema de entrada: teclado, ratón (pointer lock) y mando. Acciones reasignables.
export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', walk: 'AltLeft', jump: 'Space', crouch: 'KeyC',
  interact: 'KeyE', equip: 'KeyG', inventory: 'KeyI', gallery: 'KeyP',
  map: 'KeyM', missions: 'KeyJ', pause: 'Escape',
  paramPrev: 'KeyQ', paramNext: 'KeyE', paramDec: 'KeyZ', paramInc: 'KeyX',
  autofocus: 'KeyF', driveMode: 'KeyR', view: 'KeyV', gear: 'Tab', swapBattery: 'KeyB', zoomIn: 'Equal', zoomOut: 'Minus', phone: 'KeyH',
};
export const ACTION_LABELS = {
  forward: 'Avanzar', back: 'Retroceder', left: 'Izquierda', right: 'Derecha', sprint: 'Correr / Sprint',
  walk: 'Caminar despacio', jump: 'Saltar', crouch: 'Agacharse / arrodillarse', interact: 'Interactuar',
  equip: 'Equipar / guardar cámara', inventory: 'Inventario', gallery: 'Galería', map: 'Mapa', missions: 'Misiones',
  pause: 'Pausa / salir del visor', paramPrev: 'Parámetro anterior (visor)', paramNext: 'Parámetro siguiente (visor)',
  paramDec: 'Disminuir valor', paramInc: 'Aumentar valor', autofocus: 'Autofoco', driveMode: 'Modo de disparo', view: 'Primera / tercera persona',
  gear: 'Revisar equipo', swapBattery: 'Cambiar batería', zoomIn: 'Zoom + (teclado)', zoomOut: 'Zoom − (teclado)', phone: 'Teléfono',
};

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas; this.settings = settings;
    this.down = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false, leftPressed: false, rightPressed: false, leftReleased: false };
    this.locked = false; this.wantLock = false; this.uiCapture = false;
    this.pad = null; this.padPrev = {};
    this.rebindHandler = null;
    this.lastDevice = 'kbm';
    window.addEventListener('keydown', (e) => {
      if (this.rebindHandler) { e.preventDefault(); const h = this.rebindHandler; this.rebindHandler = null; h(e.code); return; }
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) { if (!this.uiCapture || e.code === 'Tab') e.preventDefault(); }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.code !== 'Escape') return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code); this.lastDevice = 'kbm';
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); this.released.add(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
      if (this.wantLock && !this.locked) this.requestLock();
      this.lastDevice = 'kbm';
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouse.left = false; this.mouse.leftReleased = true; }
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }
  requestLock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* sin soporte */ } }
  releaseLock() { if (document.pointerLockElement) { this.expectingRelease = true; document.exitPointerLock(); } }
  bind(action) { return this.settings.data.bindings[action] || DEFAULT_BINDINGS[action]; }
  isDown(action) { return this.down.has(this.bind(action)) || this.padDown(action); }
  wasPressed(action) { return this.pressed.has(this.bind(action)) || this.padPressed(action); }
  keyPressed(code) { return this.pressed.has(code); }
  // Mapeo de mando estándar (Xbox).
  // Mapeo estándar (DualSense / DualShock / Xbox):
  // 0 ✕ · 1 ○ · 2 □ · 3 △ · 4 L1 · 5 R1 · 6 L2 · 7 R2 · 8 Create · 9 Options · 10 L3 · 11 R3 · 12-15 cruceta · 16 PS · 17 panel táctil
  static PAD_MAP = { interact: 0, crouch: 1, jump: 2, driveMode: 2, equip: 3, paramPrev: 4, paramNext: 5, gear: 8, pause: 9, sprint: 10, autofocus: 11, view: 11,
    inventory: 12, missions: 13, map: 14, gallery: 15, swapBattery: 17, phone: 17 }; // panel táctil: teléfono (fuera del visor) o batería (en el visor)
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    this.padNow = {};
    if (this.pad) {
      this.pad.buttons.forEach((b, i) => { this.padNow[i] = b.pressed; if (b.pressed) this.lastDevice = 'pad'; });
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      this.padAxes = this.pad.axes.map(dz);
      if (this.padAxes.some((a) => a !== 0)) this.lastDevice = 'pad';
    } else this.padAxes = [0, 0, 0, 0];
  }
  padDown(action) { const i = Input.PAD_MAP[action]; return i !== undefined && !!this.padNow?.[i]; }
  padPressed(action) { const i = Input.PAD_MAP[action]; return i !== undefined && !!this.padNow?.[i] && !this.padPrev[i]; }
  padTrigger(i) { return this.pad ? this.pad.buttons[i]?.value || 0 : 0; }
  padTriggerPressed(i) { return !!this.padNow?.[i] && !this.padPrev[i]; }
  padHeld(i) { return !!this.padNow?.[i]; }
  // Marca los botones actuales como ya procesados (evita que un mismo toque active dos cosas).
  consumePad() { this.padPrev = { ...(this.padNow || {}) }; }
  get padName() { return this.pad?.id || ''; }
  get isPlayStation() { return /054c|dualsense|dualshock|wireless controller|playstation/i.test(this.padName); }
  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    const a = this.pad?.vibrationActuator; if (!a) return;
    try { a.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { /* sin vibración */ }
  }
  moveVector() {
    let x = 0, y = 0;
    if (this.isDown('forward')) y += 1; if (this.isDown('back')) y -= 1;
    if (this.isDown('right')) x += 1; if (this.isDown('left')) x -= 1;
    if (this.padAxes) { x += this.padAxes[0]; y -= this.padAxes[1]; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  lookDelta(dt) {
    const s = this.settings.data.sensitivity;
    let dx = this.mouse.dx * 0.0022 * s, dy = this.mouse.dy * 0.0022 * s;
    if (this.padAxes) { dx += this.padAxes[2] * 2.6 * s * dt; dy += this.padAxes[3] * 2.0 * s * dt; }
    if (this.settings.data.invertY) dy = -dy;
    return { dx, dy };
  }
  endFrame() {
    this.pressed.clear(); this.released.clear();
    this.mouse.dx = this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.leftPressed = this.mouse.rightPressed = this.mouse.leftReleased = false;
    this.padPrev = { ...(this.padNow || {}) };
  }
}
