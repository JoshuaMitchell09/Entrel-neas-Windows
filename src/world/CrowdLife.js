import * as THREE from 'three';
import { NPC, LOOKS, randomFan } from '../npc/NPC.js';
import { rand, pick, clamp, damp } from '../core/MathUtil.js';
import { APRON_X, APRON_Z } from './Stadium.js';
import * as TX from '../gfx/Textures.js';
import { CONTACTS } from '../phone/Phone.js';
import { genderize } from '../player/Look.js';

/*
 * Vida del público: el estadio se llena según cuánto falte para el saque,
 * la gente grita y le pide fotos al fotógrafo, la barra canta y,
 * si regalaste entradas, tu familia o tus amigos te esperan en primera fila.
 */
const FILL = [[200, 0.02], [180, 0.03], [120, 0.08], [90, 0.17], [60, 0.36], [45, 0.5], [30, 0.68], [15, 0.86], [5, 0.96], [0, 1]];
export function fillAt(mtk) {
  if (mtk <= 0) return 1;
  if (mtk >= FILL[0][0]) return FILL[0][1];
  for (let i = 0; i < FILL.length - 1; i++) { const [a, fa] = FILL[i], [b, fb] = FILL[i + 1]; if (mtk <= a && mtk >= b) return fb + (fa - fb) * (mtk - b) / (a - b); }
  return 1;
}
const SHOUTS = ['¡Fotógrafo! ¡Una foto, mae!', '¡Ey, Ascenso Total! ¡Sacame en la portada!', '¡Pura vida, compa! ¡Aquí, aquí!', '¡Tomale una foto a la barra!', '¿Para qué medio trabajás?', '¡Esa cámara está brutal!', '¡Saludos a mi mamá! 👋', '¡Mae, ¿me pasás la foto por Lente?!', '¡Fotógrafo, por aquí!', '¡Hoy ganamos, fijo!', '¡Qué lente más grande, diay!'];
const REQUESTS = ['¿Me tomás una foto con mi hijo? ¡Es su primer partido!', '¡Una foto de la barra, porfa!', '¡Sacanos a mí y a mi novia!', '¡Una foto con la bandera, compa!', '¡Tomale una foto a mi abuela, vino desde Limón!', '¡Una foto de la gradería, que estamos todos!'];
const FAN_NAMES = ['@carlitos_cr', '@la_vero_futbol', '@mae_de_la_barra', '@fer_tico', '@abuela_futbolera', '@joseph506', '@dani.cr', '@pura_afición'];

export class CrowdLife {
  constructor(game) {
    this.game = game; this.reset();
    game.events.on('photo:taken', () => this.onPhoto());
  }
  reset() {
    this.marker?.parent?.remove(this.marker); this.marker = null;
    this.fill = 1; this.request = null; this.shoutT = rand(5, 10); this.reqT = rand(20, 35);
    this.family = []; this.familyInfo = null; this.keepers = []; this.pitchVisible = true; this.warmAnnounced = true; this.familyArrived = false; this.familyShot = false;
    this.active = false; this.aimAmt = 0; this.near = 0; this.chant = 0;
  }
  // Se llama al preparar un evento (después de que Story crea los NPC)
  setup(ev, guests = []) {
    const g = this.game, st = g.stadium; this.reset(); if (!st) return;
    this.ev = ev; this.active = true;
    this.warmAnnounced = ev.kickoff - g.clock <= 45;
    // Encargados de cancha: riegan y marcan la cancha cuando todavía no hay nadie
    for (const s of [-1, 1]) {
      const route = [new THREE.Vector3(-40 * s, 0, 25 * s), new THREE.Vector3(40 * s, 0, 25 * s), new THREE.Vector3(40 * s, 0, -25 * s), new THREE.Vector3(-40 * s, 0, -25 * s)];
      const n = new NPC(g, st.group, { name: 'Encargado de cancha', look: { ...LOOKS.steward, shirt: '#2f5d27', vest: '#3a7d2c', cap: '#2f5d27' }, pos: route[0], route, speed: 1.05, idle: 'loco' });
      n.isKeeper = true; g.story.npcs.push(n); this.keepers.push(n);
    }
    // Marcador flotante sobre el aficionado que pide foto
    const tex = TX.signTexture('📸 FOTO', '#f2c500', '#0a0f1c', 256, 96, 'bold 52px Arial');
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); this.marker.scale.set(1.3, 0.5, 1); this.marker.visible = false; this.marker.renderOrder = 10;
    st.group.add(this.marker);
    if (guests.length) this.seatFamily(guests);
  }
  // Sienta a los invitados en primera fila de la platea, cerca de la zona de prensa este
  seatFamily(guests) {
    const g = this.game, st = g.stadium, cr = st.crowd;
    const people = [];
    for (const gu of guests) { const c = CONTACTS.find((x) => x.id === gu.contactId); for (let k = 0; k < Math.min(2, gu.count); k++) people.push({ contact: c, companion: k > 0 }); }
    const N = Math.min(4, people.length);
    const cand = cr.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.z > APRON_Z - 1 && s.row <= 1 && s.x > 18 && s.x < 48)
      .sort((a, b) => (Math.abs(a.s.x - 36) + a.s.row * 4) - (Math.abs(b.s.x - 36) + b.s.row * 4));
    // Asientos contiguos de la misma fila
    const row = cand[0]?.s.row ?? 0;
    const chosen = cand.filter((c) => c.s.row === row).slice(0, N).sort((a, b) => a.s.x - b.s.x);
    if (!chosen.length) return;
    const home = g.team(this.ev.home);
    const looks = { mama: { female: true, hair: '#2b1c12' }, papa: { hair: '#3a2817' }, vale: { female: true, hair: '#120c08' }, abuela: { female: true, hair: '#d8d8d8', height: 1.55 }, diego: { hair: '#120c08' }, andy: { hair: '#5a3b22' } };
    chosen.forEach(({ s, i }, k) => {
      cr.hidePerson(i);
      const p = people[k], base = randomFan(home);
      const look = { ...base, ...(p.companion ? {} : looks[p.contact.id] || {}), shirt: home.colors.primary };
      const n = new NPC(g, st.group, { name: p.companion ? 'Acompañante' : p.contact.name, role: 'story', look, pos: new THREE.Vector3(s.x, s.y, s.z), yaw: s.rot, idle: 'loco' });
      n.contact = p.contact; n.isFamily = true; g.story.npcs.push(n); this.family.push(n);
    });
    // Rótulo hecho en casa
    const name = (g.playerName || 'FOTÓGRAFO').split(' ')[0].toUpperCase();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), new THREE.MeshStandardMaterial({ map: TX.signTexture(`¡VAMOS ${name}!`, '#ffffff', home.colors.primary, 512, 200, '900 70px Arial Black, Arial'), roughness: 0.8, side: THREE.DoubleSide }));
    sign.position.set(0.4, 2.1, 0.3); this.family[0].root.add(sign); this.sign = sign;
    const c0 = this.family[0].contact;
    this.familyInfo = { contact: c0, center: this.family.reduce((a, n) => a.add(n.pos), new THREE.Vector3()).multiplyScalar(1 / this.family.length) };
    g.interaction.add({ getPosition: () => this.familyInfo.center.clone().setY(1.2), position: this.familyInfo.center, radius: 6, prompt: () => (this.familyArrived ? `<kbd>${g.ui.key('interact')}</kbd>Saludar a ${c0.name}` : null), onInteract: () => this.greetFamily() });
  }
  async greetFamily() {
    const g = this.game, c = this.familyInfo.contact, n = this.family[0];
    n.playOnce('wave', 3); this.family.slice(1).forEach((m) => m.playOnce('cheer', 3));
    const S = { who: c.name, role: 'En la gradería · con tus entradas', color: c.color, initials: c.emoji, pitch: c.family && /Mamá|Valeria|Abuela/.test(c.name) ? 1.45 : 1, pos: n.pos.clone().setY(n.pos.y + 1.6) };
    const lines = {
      mama: ['¡¡Mi amor!! ¡Aquí estamos! ¿Viste el rótulo? Lo hice anoche 😭', 'Trabajá tranquilo/a, nosotros te vemos desde aquí. ¡Tomanos una foto!'],
      papa: ['¡Ey, campeón/a! ¡Qué puesto nos conseguiste!', 'Concentrate en el partido. Y si podés, una foto para la sala 😄'],
      vale: ['¡¡HOLAAA!! Todo el mundo me pregunta quién sos 😂', '¡Tomanos una foto para mi perfil, porfa!'],
      abuela: ['¡Ay, mi cielo! Qué bonito es el estadio por dentro.', 'Dios me lo bendiga. Tómeme una fotito, ¿sí?'],
      diego: ['¡Maeee! ¡Gracias por las entradas, sos lo máximo!', 'Si hay gol, te lo grito en la cara 😂 ¡Tomanos una foto!'],
      andy: ['¡Pura vida, mae! ¡Ya tengo la bandera lista!', 'Sacanos una foto pa la historia, compa.'],
    }[c.id] || ['¡Hola! Gracias por las entradas.'];
    await g.ui.dialogue(lines.map((text) => ({ ...S, text: genderize(text, g.female) })));
  }
  skipTo() { const st = this.game.stadium; if (st) st.crowd.uniforms.uFill.value = this.targetFill(); }
  minutesToKickoff() { const g = this.game, ev = this.ev; if (!ev || g.story.kickedOff) return 0; return ev.kickoff - g.clock; }
  targetFill() { return this.active ? fillAt(this.minutesToKickoff()) * (this.ev?.clasico ? 1 : 0.96) + (this.ev?.clasico ? 0 : 0.04) : 1; }
  update(dt) {
    const g = this.game, st = g.stadium, m = g.match, p = g.player; if (!st) return;
    const U = st.crowd.uniforms;
    if (!this.active) { U.uFill.value = 1; U.uNear.value = 0; U.uAimAmt.value = 0; return; }
    const mtk = this.minutesToKickoff();
    // Llenado progresivo
    U.uFill.value = damp(U.uFill.value, this.targetFill(), 1.5, dt);
    // Cancha: vacía antes del calentamiento
    this.pitchVisible = mtk <= 45;
    if (this.pitchVisible && !this.warmAnnounced) { this.warmAnnounced = true; g.ui.toast('⚽ Los equipos salen a la cancha para el calentamiento.', 'mission', 4000); g.audio?.goalRoar?.(0.25); }
    for (const k of this.keepers) k.root.visible = k.root.visible && !this.pitchVisible;
    // Familia: llega una hora antes del partido
    if (this.family.length) {
      const here = mtk <= 70;
      for (const n of this.family) n.root.visible = n.root.visible && here;
      if (here && !this.familyArrived) {
        this.familyArrived = true; const c = this.familyInfo.contact;
        g.phone?.receive(c.id, `¡Ya llegamos! 🎉 Estamos en la platea, primera fila, cerca de la portería este. ¡Buscanos! Llevamos un rótulo con tu nombre.`);
      }
      const nearP = p.pos.distanceTo(this.familyInfo.center) < 20;
      const ex = m ? m.excite : 0.2;
      for (const n of this.family) { n.idle = ex > 0.7 ? 'cheer' : nearP ? 'wave' : 'loco'; if (nearP) n.yaw = n.baseYaw; }
    }
    // Interacción del público con el fotógrafo
    const inBowl = Math.abs(p.pos.x) < APRON_X + 1 && Math.abs(p.pos.z) < APRON_Z + 0.5;
    const front = inBowl ? Math.min(APRON_X - Math.abs(p.pos.x), APRON_Z - Math.abs(p.pos.z)) : 99;
    const nearFront = front < 9 && U.uFill.value > 0.12;
    const still = p.vel ? Math.hypot(p.vel.x, p.vel.z) < 0.6 : true;
    this.near = damp(this.near, nearFront ? (still || g.photoMode.active ? 1 : 0.45) : 0, 1.6, dt);
    U.uNear.value = this.near; U.uPlayer.value.set(p.pos.x, p.pos.y + 1, p.pos.z);
    if (m && this.pitchVisible) U.uBall.value.copy(m.ball.pos);
    // Apuntar con la cámara a la gradería: la gente posa
    let aim = 0;
    if (g.photoMode.active) {
      const cam = g.camera, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const d = clamp(g.photoMode.s.focusDist || 20, 2, 140), pt = cam.position.clone().addScaledVector(fwd, d);
      if (Math.abs(pt.x) > APRON_X - 1 || Math.abs(pt.z) > APRON_Z - 1) { aim = 1; U.uAim.value.copy(pt); }
    }
    this.aimAmt = damp(this.aimAmt, aim, 3, dt); U.uAimAmt.value = this.aimAmt;
    // La barra canta durante el partido
    const ph = m?.phase;
    const chant = !m ? 0 : ph === 'halftime' || ph === 'fulltime' ? 0.15 : ph === 'warmup' ? (mtk < 40 ? 0.55 : 0) : 1;
    this.chant = damp(this.chant, chant * Math.min(1, U.uFill.value * 1.6), 1.2, dt); U.uChant.value = this.chant;
    // Gritos y pedidos de foto
    if (nearFront && !g.ui.dialogueActive && !g.cinematic) {
      this.shoutT -= dt;
      if (this.shoutT <= 0) {
        this.shoutT = rand(9, 20) / (0.5 + U.uFill.value);
        const seat = this.pickSeat(14);
        if (seat) { g.ui.toast(`🗣️ «${pick(SHOUTS)}»`, 'fan', 2600); g.audio?.talk?.(new THREE.Vector3(seat.x, seat.y + 1.4, seat.z), rand(0.7, 1.4), rand(0.9, 1.5)); }
      }
      if (!this.request) {
        this.reqT -= dt;
        if (this.reqT <= 0) {
          this.reqT = rand(45, 90);
          const seat = this.pickSeat(16, true);
          if (seat) {
            this.request = { seat, pos: new THREE.Vector3(seat.x, seat.y + 1, seat.z), text: pick(REQUESTS), name: pick(FAN_NAMES), until: g.time + 40 };
            this.marker.visible = true; this.marker.position.set(seat.x, seat.y + 2.3, seat.z);
            g.ui.toast(`📸 Un aficionado te pide: «${this.request.text}» — apuntale con la cámara y disparale.`, 'mission', 5000);
            g.audio?.talk?.(this.request.pos.clone().setY(seat.y + 1.5), 1.6, 1.2);
          }
        }
      }
    }
    if (this.request) {
      this.marker.position.y = this.request.seat.y + 2.3 + Math.sin(g.time * 3) * 0.12;
      if (g.time > this.request.until) { g.ui.toast('El aficionado ya no espera la foto.', 'info', 2200); this.clearRequest(); }
    }
  }
  clearRequest() { this.request = null; if (this.marker) this.marker.visible = false; }
  // Elige un asiento ocupado (ya llegó su dueño) cerca del jugador
  pickSeat(radius, lowRows = false) {
    const g = this.game, cr = g.stadium.crowd, p = g.player.pos, fill = cr.uniforms.uFill.value;
    let best = null, tries = 0;
    while (tries++ < 260) {
      const i = Math.floor(Math.random() * cr.count), s = cr.seats[i];
      if (cr.arrival(i) > fill || (lowRows && s.row > 4)) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < radius && d > 2.5) { best = s; break; }
    }
    return best;
  }
  aimedAt(target, tolM = 2.5) {
    const cam = this.game.camera, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const v = target.clone().sub(cam.position), d = v.length();
    if (d > 70) return false;
    return fwd.angleTo(v) < Math.max(Math.atan2(tolM, d), 0.035);
  }
  onPhoto() {
    const g = this.game; if (!this.active || !g.inEvent) return;
    if (this.request && this.aimedAt(this.request.pos, 3)) {
      const gain = g.phone?.fanThanked(this.request.name) || 0;
      g.ui.toast(`😃 «¡Gracias, mae! Te sigo en Lente.» · +${gain} seguidores`, 'good', 3500);
      g.career.reputation = Math.min(100, g.career.reputation + 0.3);
      this.clearRequest();
    }
    if (this.familyInfo && this.familyArrived && !this.familyShot && this.aimedAt(this.familyInfo.center.clone().setY(this.familyInfo.center.y + 1.2), 3)) {
      this.familyShot = true; const c = this.familyInfo.contact;
      for (const n of this.family) n.playOnce('cheer', 3);
      g.ui.toast(`❤️ Le tomaste una foto a ${c.name} en la gradería`, 'good', 3200);
      g.phone?.after(rand(4, 9), () => g.phone.receive(c.id, '¡¡Te vimos apuntándonos con la cámara!! 😍 Mandanos esa foto, porfa. ¡La vamos a imprimir!'));
    }
  }
}
