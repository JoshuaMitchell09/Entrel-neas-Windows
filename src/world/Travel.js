import * as THREE from 'three';
import * as TX from '../gfx/Textures.js';
import { clamp, damp, dampAngle, rand, pick, formatMoney } from '../core/MathUtil.js';
import { AVE_X1, BUS_STOPS, HOME_X } from './Avenue.js';

/*
 * Transporte desde la casa hasta el estadio (sin pantallas de carga):
 *  - Tu carro: lo manejás vos (W/S o R2/L2, A/D o stick; Espacio pita; E para bajarte).
 *  - Bus: pasa por las paradas de la avenida; subís en la parada (₡350) y te bajás donde querás.
 *  - Taxi y Uber: se piden desde el teléfono; llegan a donde estás y te llevan al estadio (o a tu casa).
 * Mientras viajás, T adelanta el viaje y C cambia entre cámara exterior e interior.
 */
const FARE_BUS = 350;
const DRIVER_LINES = {
  uber: ['¡Buenas! ¿Va para el estadio? Póngase cómodo.', 'Hoy hay un presa terrible por el partido…', '¿Usted es fotógrafo? ¡Qué chiva de trabajo!', 'Yo soy morado de corazón, pero no le diga a nadie 😄', 'Ya casi llegamos. ¡Suerte con las fotos!'],
  taxi: ['¡Pura vida! ¿Para dónde lo llevo?', 'Ese estadio se llena desde temprano, ¿verdad?', 'Yo fui al último clásico… qué ambientazo.', 'Agárrese que aquí cogemos por la de atrás 😂', 'Listo, ya llegamos. ¡Que le vaya bien!'],
};

export class Travel {
  constructor(game) { this.game = game; this.mode = null; this.view = 'out'; this.ff = 1; }
  get P() { return this.game.city.P; }
  laneE() { return this.P + 7.2; }
  // ---------- Preparación del nivel ----------
  setup(withHome) {
    const g = this.game, city = g.city, I = g.interaction;
    this.mode = null; this.ride = null; this.ff = 1; this.vehicle = null;
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    if (!city) return;
    // Tu carro (parqueado frente a la casa)
    if (!this.car || this.car.obj.parent !== city.group) {
      const obj = city.makeCar('#1d3557'); obj.userData.noMerge = true;
      this.car = { obj, kind: 'car', v: 0, yaw: 0, L: 4.2, pos: new THREE.Vector3() };
    }
    const hc = city.spots.homeCar; this.car.pos.set(hc.x, 0, hc.z); this.car.yaw = 0; this.car.v = 0; this.syncObj(this.car);
    // Bus de la ruta Barrio – Estadio
    if (!this.bus || this.bus.obj.parent !== city.group) {
      const obj = city.makeCar('#f2c500', true); obj.userData.noMerge = true;
      const route = TX.signTexture('BARRIO – ESTADIO', '#000', '#ffb000', 256, 48, 'bold 30px Arial');
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.4), new THREE.MeshBasicMaterial({ map: route })); sg.position.set(-5.51, 2.7, 0); sg.rotation.y = -Math.PI / 2; obj.add(sg);
      this.bus = { obj, kind: 'bus', v: 0, yaw: 0, L: 11, pos: new THREE.Vector3(), stopIdx: 0, wait: 0, stopped: false };
    }
    this.bus.pos.set(withHome ? AVE_X1 + 8 : -260, 0, this.laneE()); this.bus.stopIdx = withHome ? 0 : 4; this.bus.wait = 0; this.bus.stopped = false; this.bus.v = 0; this.syncObj(this.bus);
    // Interacciones
    I.add({ getPosition: () => this.car.pos.clone().setY(1), position: this.car.pos, radius: 3.4, prompt: () => (this.mode ? null : `<kbd>${g.ui.key('interact')}</kbd>Manejar tu carro`), onInteract: () => this.enter('drive', this.car) });
    I.add({ getPosition: () => this.busDoor(), position: this.bus.pos, radius: 4.2, prompt: () => (!this.mode && this.bus.stopped ? `<kbd>${g.ui.key('interact')}</kbd>Subir al bus (₡${FARE_BUS})` : null), onInteract: () => this.boardBus() });
    I.add({ getPosition: () => (this.ride ? this.ride.pos.clone().setY(1) : new THREE.Vector3(0, -99, 0)), position: new THREE.Vector3(), radius: 4.2, prompt: () => (!this.mode && this.ride?.state === 'waiting' ? `<kbd>${g.ui.key('interact')}</kbd>Subir al ${this.ride.service === 'uber' ? 'Uber' : 'taxi'}` : null), onInteract: () => this.boardRide() });
  }
  busDoor() { return this.bus.pos.clone().add(new THREE.Vector3(3.5, 1, -1.5)); }
  syncObj(v) { v.obj.position.copy(v.pos); v.obj.rotation.y = v.yaw; }
  // ---------- Subir / bajar ----------
  enter(mode, vehicle) {
    const g = this.game; if (g.photoMode.active) g.photoMode.exit();
    this.mode = mode; this.vehicle = vehicle; this.view = 'out'; this.ff = 1;
    // La misma pulsación que te subió no debe bajarte: se consume y hay un margen antes de poder bajarse
    g.input.pressed.clear(); g.input.consumePad(); this.grace = 0.6;
    g.player.setCameraEquipped(false); g.audio?.ui('door');
    this.camPos.copy(g.camera.position); this.camLook.copy(vehicle.pos);
    const k = g.ui.key('interact');
    const help = mode === 'drive' ? `W/S acelerar y frenar · A/D girar · Espacio pitar · ${k} bajarte · C cámara` : `T adelantar el viaje · C cámara · ${k} bajarte en la parada`;
    g.ui.toast(help, 'info', 5000);
  }
  exit() {
    const g = this.game, v = this.vehicle; if (!v) return;
    const P = this.P, side = v.pos.z < P + 10 ? P + 2.2 : P + 17.8;
    g.player.place(v.pos.x + (v.kind === 'bus' ? 3 : 0), side, Math.PI / 2); g.follow.yaw = Math.PI / 2; g.follow.snap(g.player);
    this.mode = null; this.vehicle = null; this.ff = 1; g.audio?.ui('door');
    g.input.pressed.clear(); g.input.consumePad(); // que la misma tecla no te vuelva a subir
    if (g.camera.fov !== g.settings.data.fov) { g.camera.fov = g.settings.data.fov; g.camera.updateProjectionMatrix(); }
  }
  boardBus() {
    const g = this.game; if (!this.bus.stopped) return;
    if (g.career.money < FARE_BUS) { g.ui.toast('No te alcanza para el pasaje.', 'warn'); return; }
    g.career.money -= FARE_BUS; g.audio?.ui('cash');
    this.enter('bus', this.bus); this.bus.wait = Math.min(this.bus.wait, 1.5);
    g.ui.toast(`🚌 Pagaste ₡${FARE_BUS}. Ruta Barrio – Estadio. Bajate en la parada que querás con ${g.ui.key('interact')}.`, 'good', 4500);
  }
  // ---------- Taxi y Uber (desde el teléfono) ----------
  rideQuote(service) {
    const g = this.game, x = g.player.pos.x, toStadium = x < -100, dest = toStadium ? -14 : HOME_X + 2, dist = Math.abs(dest - x);
    return { dest, toStadium, dist, price: Math.round((service === 'uber' ? 900 + dist * 2.6 : 1100 + dist * 3.3) / 50) * 50 };
  }
  requestRide(service) {
    const g = this.game, city = g.city; if (!city || this.ride || this.mode) return false;
    const q = this.rideQuote(service);
    if (g.career.money < q.price) { g.ui.toast('No te alcanza para ese viaje.', 'warn'); return false; }
    const px = g.player.pos.x, lane = this.laneE();
    const color = service === 'taxi' ? '#c8102e' : pick(['#8d99ae', '#2a2a2a', '#f1faee', '#457b9d']);
    const obj = city.makeCar(color); obj.userData.noMerge = true;
    if (service === 'taxi') { const tri = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0xffaa00, emissiveIntensity: 0.6 })); tri.position.set(0, 1.65, 0); obj.add(tri); }
    const ride = { obj, kind: service, service, v: 0, yaw: 0, L: 4.2, pos: new THREE.Vector3(Math.max(AVE_X1 + 5, px - rand(90, 140)), 0, lane), state: 'coming', quote: q, line: 0, lineT: 3 };
    this.syncObj(ride); this.ride = ride;
    const eta = Math.round((px - ride.pos.x) / 11 + 2);
    g.ui.toast(`${service === 'uber' ? '📱 Uber' : '🚕 Taxi'} en camino: llega en ~${eta} s. Esperá en la acera de este lado. Viaje a ${q.toStadium ? 'el estadio' : 'tu casa'}: ${formatMoney(q.price)}.`, 'mission', 6000);
    return true;
  }
  boardRide() {
    const g = this.game, r = this.ride; if (!r || r.state !== 'waiting') return;
    g.career.money -= r.quote.price; g.audio?.ui('cash');
    r.state = 'driving'; this.enter('ride', r);
    g.ui.subtitle?.(r.service === 'uber' ? 'Conductor de Uber' : 'Taxista', DRIVER_LINES[r.service][0], 4);
  }
  // ---------- Bucle ----------
  update(dt) {
    const g = this.game, city = g.city; if (!city || !this.car) return;
    const inp = g.input, P = this.P, k = this.ff;
    // Bus: recorre la avenida hacia el este y se detiene en cada parada
    const b = this.bus, nextStop = BUS_STOPS[b.stopIdx];
    if (b.stopped) {
      b.wait -= dt * k;
      if (b.wait <= 0 && !(this.mode === 'bus' && g.ui.screen)) { b.stopped = false; b.stopIdx++; }
    } else {
      let target = 9;
      if (nextStop) { const dx = nextStop.x - 2 - b.pos.x; if (dx < 26) target = Math.max(0, dx * 0.45); if (dx < 0.4) { b.stopped = true; b.v = 0; b.wait = this.mode === 'bus' ? 4 : 7; if (this.mode === 'bus') g.ui.toast(`🚏 Parada ${nextStop.name}. ${g.ui.key('interact')} para bajarte.`, 'info', 3500); } }
      for (const c of city.cars) if (c.dir > 0) { const d = c.obj.position.x - b.pos.x; if (d > 0 && d < 14) target = Math.min(target, c.v * 0.8); }
      b.v += clamp(target - b.v, -6 * dt * k, 2.2 * dt * k); b.pos.x += b.v * dt * k;
      if (b.pos.x > 185) { b.pos.x = AVE_X1 + 6; b.stopIdx = 0; if (this.mode === 'bus') this.exit(); }
    }
    this.syncObj(b);
    // Taxi / Uber
    const r = this.ride;
    if (r) {
      if (r.state === 'coming') {
        const tx = g.player.pos.x - 1.5, dx = tx - r.pos.x;
        const target = dx > 25 ? 12 : dx > 1 ? Math.max(2.5, dx * 0.8) : 0;
        r.v += clamp(target - r.v, -8 * dt, 3 * dt); r.pos.x += r.v * dt;
        if (Math.abs(dx) < 1.2 || (dx < 0 && r.v < 0.5)) { r.state = 'waiting'; r.v = 0; g.audio?.honk?.(r.pos); g.ui.toast(`${r.service === 'uber' ? 'Tu Uber' : 'El taxi'} llegó. Acercate y presioná ${g.ui.key('interact')}.`, 'good', 3500); }
      } else if (r.state === 'driving') {
        const dir = Math.sign(r.quote.dest - r.pos.x) || 1, dx = (r.quote.dest - r.pos.x) * dir;
        if (dir < 0 && r.yaw === 0) { r.yaw = Math.PI; r.pos.z = P + 12.8; }
        const target = dx > 30 ? 13 : dx > 1 ? Math.max(2.5, dx * 0.7) : 0;
        for (const c of this.game.city.cars) if (c.dir === dir) { const d = (c.obj.position.x - r.pos.x) * dir; if (d > 0 && d < 12) r.v = Math.min(r.v, c.v + 1); }
        r.v += clamp(target - r.v, -7 * dt * k, 3 * dt * k); r.pos.x += r.v * dir * dt * k;
        r.lineT -= dt * k; if (r.lineT <= 0 && r.line < 4) { r.line++; r.lineT = 9; g.ui.subtitle?.(r.service === 'uber' ? 'Conductor de Uber' : 'Taxista', DRIVER_LINES[r.service][r.line], 4.5); }
        if (dx < 1.2) { r.state = 'done'; g.ui.toast(r.quote.toStadium ? '📍 Llegaste al estadio. ¡Buena cobertura!' : '🏠 Llegaste a tu casa.', 'good', 3000); this.exit(); }
      } else if (r.state === 'done') {
        r.v = Math.min(13, r.v + 3 * dt); r.pos.x += r.v * dt * (r.yaw ? -1 : 1);
        if (Math.abs(r.pos.x - g.player.pos.x) > 160) { r.obj.parent?.remove(r.obj); this.ride = null; }
      }
      if (this.ride) this.syncObj(r);
    }
    // Manejar tu carro
    if (this.mode === 'drive') {
      const c = this.car, pad = inp.pad;
      const thr = (inp.isDown('forward') ? 1 : 0) + (pad ? inp.padTrigger(7) : 0), brk = (inp.isDown('back') ? 1 : 0) + (pad ? inp.padTrigger(6) : 0);
      const steer = clamp((inp.isDown('left') ? 1 : 0) - (inp.isDown('right') ? 1 : 0) - (inp.padAxes?.[0] || 0), -1, 1);
      if (thr > 0.05) c.v += 6.5 * Math.min(1, thr) * dt * (c.v < 0 ? 2 : 1);
      if (brk > 0.05) c.v -= (c.v > 0.3 ? 13 : 4) * Math.min(1, brk) * dt;
      c.v *= 1 - 0.12 * dt; if (!thr && !brk) c.v *= 1 - 0.5 * dt;
      c.v = clamp(c.v, -5, 19);
      c.yaw += steer * c.v / 2.6 * Math.tan(0.5) * dt;
      c.pos.x += Math.cos(c.yaw) * c.v * dt; c.pos.z -= Math.sin(c.yaw) * c.v * dt;
      // Mantenerse en la calle; chocar con el tráfico
      const zl = P + 4.6, zh = P + 15.4;
      if (c.pos.z < zl || c.pos.z > zh || c.pos.x < AVE_X1 + 3 || c.pos.x > 165) { c.pos.z = clamp(c.pos.z, zl, zh); c.pos.x = clamp(c.pos.x, AVE_X1 + 3, 165); c.v *= 0.6; }
      for (const o of [...city.cars.map((x) => x.obj), b.obj, r?.obj].filter(Boolean)) {
        const dx = c.pos.x - o.position.x, dz = c.pos.z - o.position.z, lim = (o.userData.L || 4.2) / 2 + 2.1;
        if (Math.abs(dx) < lim && Math.abs(dz) < 1.9) {
          c.pos.x += Math.sign(dx || 1) * (lim - Math.abs(dx)) * 0.6;
          const hard = Math.abs(c.v) > 6; if (hard) { g.audio?.ui('error'); g.input.rumble(0.8, 0.5, 200); }
          c.v = hard ? c.v * -0.2 : Math.min(c.v, 1);
        }
      }
      const fixed = c.pos.clone(); city.col.resolveCircle(fixed, 1.1, 1.4, 0.35); if (fixed.distanceTo(c.pos) > 0.01) { c.pos.copy(fixed); c.v *= 0.7; }
      if (inp.keyPressed('Space') || inp.padTriggerPressed(1)) g.audio?.honk?.(c.pos);
      this.syncObj(c);
    }
    if (!this.mode) return;
    // Bajarse
    const v = this.vehicle;
    this.grace = Math.max(0, (this.grace || 0) - dt);
    if (this.grace <= 0 && (inp.keyPressed(inp.bind('interact')) || inp.padTriggerPressed(0)) && !g.ui.screen) {
      if (this.mode === 'drive' && Math.abs(v.v) < 2) return this.exit();
      if (this.mode === 'bus' && b.stopped) return this.exit();
      if (this.mode === 'ride' && Math.abs(v.v) < 1) return this.exit();
    }
    if (inp.keyPressed('KeyC') || inp.padTriggerPressed(11)) this.view = this.view === 'out' ? 'in' : 'out';
    this.ff = this.mode !== 'drive' && (inp.down.has('KeyT') || inp.padHeld(3)) ? 3 : 1;
    // El fotógrafo viaja con el vehículo
    const p = g.player; p.pos.copy(v.pos); p.root.position.copy(v.pos); p.root.visible = false;
    // Cámara de persecución o interior
    const fwd = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)), right = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    let want, look;
    if (this.view === 'in') {
      const seat = v.kind === 'bus' ? new THREE.Vector3(1.5, 2.0, -0.6) : new THREE.Vector3(-0.2, 1.25, v.kind === 'car' ? -0.38 : 0.38);
      want = v.pos.clone().addScaledVector(fwd, seat.x).addScaledVector(right, seat.z).setY(seat.y);
      look = want.clone().addScaledVector(fwd, 10).add(new THREE.Vector3(0, -0.3, 0));
      g.camera.position.copy(want); g.camera.lookAt(look);
    } else {
      const back = v.kind === 'bus' ? 14 : 7.5, up = v.kind === 'bus' ? 5 : 2.8;
      want = v.pos.clone().addScaledVector(fwd, -back).add(new THREE.Vector3(0, up, 0));
      look = v.pos.clone().addScaledVector(fwd, 6).add(new THREE.Vector3(0, 1.2, 0));
      for (const a of ['x', 'y', 'z']) { this.camPos[a] = damp(this.camPos[a], want[a], 5, dt); this.camLook[a] = damp(this.camLook[a], look[a], 7, dt); }
      g.camera.position.copy(this.camPos); g.camera.lookAt(this.camLook);
    }
    const fov = 62 + Math.min(10, Math.abs(v.v) * 0.5);
    if (Math.abs(g.camera.fov - fov) > 0.2) { g.camera.fov = fov; g.camera.updateProjectionMatrix(); }
  }
  // Para el teléfono
  status() {
    const g = this.game, b = this.bus, st = BUS_STOPS[b?.stopIdx ?? 0];
    const eta = st ? Math.max(0, Math.round((st.x - 2 - b.pos.x) / 8.5 + (b.stopped ? b.wait : 0))) : null;
    return { bus: st ? `Próximo bus a parada ${st.name}: ~${eta} s` : 'El bus terminó la ruta; vuelve a pasar en unos minutos.', ride: this.ride ? (this.ride.state === 'coming' ? 'Tu viaje viene en camino…' : this.ride.state === 'waiting' ? 'Tu viaje te está esperando.' : 'En viaje.') : null };
  }
}
