import * as THREE from 'three';
import { Ball, BALL_R } from './Ball.js';
import { Footballer } from './Footballer.js';
import { Humanoid, SKIN_TONES, HAIR_COLORS } from '../characters/Humanoid.js';
import { squad } from './Teams.js';
import { Interview } from './Interview.js';
import { clamp, rand, pick, dampAngle } from '../core/MathUtil.js';

const L = 105, W = 68, HL = L / 2, HW = W / 2, GOAL_HW = 3.66, BAR = 2.44;

// Catálogo de eventos deportivos: peso fotográfico y ventana temporal (segundos) del "momento".
export const EVENT_INFO = {
  gol: { label: 'Gol', weight: 100, sigma: 0.55, window: 2.2 },
  celebracion: { label: 'Celebración', weight: 90, sigma: 3.5, window: 9 },
  penal: { label: 'Penal', weight: 92, sigma: 0.5, window: 1.6 },
  atajada: { label: 'Atajada', weight: 90, sigma: 0.35, window: 1.2 },
  remate: { label: 'Remate', weight: 80, sigma: 0.3, window: 1.0 },
  disputa: { label: 'Disputa aérea', weight: 78, sigma: 0.3, window: 0.9 },
  expulsion: { label: 'Expulsión', weight: 76, sigma: 1.5, window: 4 },
  amarilla: { label: 'Tarjeta amarilla', weight: 60, sigma: 1.2, window: 3 },
  entrada: { label: 'Entrada', weight: 70, sigma: 0.35, window: 1.0 },
  regate: { label: 'Regate', weight: 66, sigma: 0.35, window: 1.0 },
  lesion: { label: 'Lesión simulada', weight: 52, sigma: 2.5, window: 6 },
  falta: { label: 'Falta', weight: 55, sigma: 0.5, window: 1.6 },
  corner: { label: 'Saque de esquina', weight: 50, sigma: 0.4, window: 1.2 },
  pase: { label: 'Pase', weight: 38, sigma: 0.25, window: 0.6 },
  calentamiento: { label: 'Calentamiento', weight: 34, sigma: 99, window: 999 },
  final: { label: 'Final del partido', weight: 70, sigma: 6, window: 14 },
  saque: { label: 'Saque inicial', weight: 40, sigma: 0.6, window: 1.5 },
  salida: { label: 'Salida de los equipos', weight: 58, sigma: 6, window: 16 },
  formacion: { label: 'Foto oficial del equipo', weight: 64, sigma: 5, window: 12 },
  sorteo: { label: 'Sorteo de la moneda', weight: 70, sigma: 0.9, window: 3 },
  trifulca: { label: 'Trifulca entre jugadores', weight: 82, sigma: 1.6, window: 5 },
  entrevista: { label: 'Entrevista al jugador del partido', weight: 72, sigma: 6, window: 14 },
};
// Formación 4-4-2 en marco de ataque: x de -1 (propia portería) a 1 (rival); z de -1 a 1.
const FORM = [
  ['GK', -0.96, 0], ['DEF', -0.66, -0.62], ['DEF', -0.72, -0.2], ['DEF', -0.72, 0.2], ['DEF', -0.66, 0.62],
  ['MID', -0.22, -0.66], ['MID', -0.32, -0.2], ['MID', -0.3, 0.2], ['MID', -0.22, 0.66], ['FWD', 0.12, -0.18], ['FWD', 0.08, 0.2],
];

export class Match {
  constructor(game, stadium, home, away, opts = {}) {
    this.game = game; this.stadium = stadium; this.teams = [home, away];
    this.group = new THREE.Group(); stadium.group.add(this.group); this.scene = this.group; this.halfSeconds = opts.halfSeconds || 240; this.events = [];
    this.score = [0, 0]; this.half = 1; this.minute = 0; this.time = 0; this.phase = 'warmup'; this.phaseT = 0;
    this.excite = 0.15; this.stats = { shots: [0, 0], saves: [0, 0], fouls: [0, 0], possession: [0, 0], corners: [0, 0], cards: [0, 0] };
    this.ball = new Ball(this.scene); this.players = [[], []]; this.restart = null; this.addedTime = Math.floor(rand(1, 4));
    this.feed = []; this.goalScorers = [];
    for (let t = 0; t < 2; t++) {
      const sq = squad(this.teams[t].id);
      FORM.forEach(([role, fx, fz], i) => { const p = new Footballer(this.scene, this.teams[t], t, sq[i], role, { fx, fz }, i === 6); p.noTouch = 0; this.players[t].push(p); });
    }
    this.all = [...this.players[0], ...this.players[1]];
    this.captains = [this.players[0][6], this.players[1][6]]; this.sideSign = 1;
    this.buildOfficials(); this.buildBench(); this.setupWarmup();
  }
  // ---------- Construcción ----------
  buildOfficials() {
    const mk = (shirt) => new Humanoid({ skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS), shirt, shorts: '#111111', socks: '#111111', boots: '#111111', height: 1.78 });
    this.ref = { h: mk('#f2e600'), pos: new THREE.Vector3(0, 0, -6), vel: new THREE.Vector3(), yaw: 0, kind: 'referee', name: 'Árbitro central' };
    this.ars = [{ h: mk('#f2e600'), pos: new THREE.Vector3(20, 0, -HW - 0.8), vel: new THREE.Vector3(), yaw: 0, kind: 'referee', side: 1, name: 'Asistente' },
      { h: mk('#f2e600'), pos: new THREE.Vector3(-20, 0, HW + 0.8), vel: new THREE.Vector3(), yaw: Math.PI, kind: 'referee', side: -1, name: 'Asistente' }];
    for (const o of [this.ref, ...this.ars]) { this.scene.add(o.h.root); o.h.root.position.copy(o.pos); }
    this.ref.card = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.105), new THREE.MeshStandardMaterial({ color: 0xffd400, side: THREE.DoubleSide, roughness: 0.4 }));
    this.ref.card.position.set(0, -0.33, 0.035); this.ref.card.visible = false; this.ref.h.arms[1].el.add(this.ref.card);
    this.coin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 24), [new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.9, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0xe6c35c, metalness: 1, roughness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 1, roughness: 0.25 })]);
    this.coin.visible = false; this.coin.castShadow = true; this.scene.add(this.coin);
  }
  buildBench() {
    this.bench = [];
    const seats = this.stadium.benchSeats || [];
    for (let t = 0; t < 2; t++) {
      const team = this.teams[t], side = t === 0 ? -1 : 1;
      const mySeats = seats.filter((s) => Math.sign(s.x) === side).slice(1, 7);
      for (const s of mySeats) {
        const h = new Humanoid({ skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS), shirt: team.colors.primary, shorts: team.colors.shorts, vest: t === 0 ? '#c6ff00' : '#ff7a00', longSleeves: true, sleeveMat: null, height: rand(1.7, 1.88) });
        h.root.position.copy(s); h.root.rotation.y = Math.PI; h.play('sit'); this.scene.add(h.root);
        this.bench.push({ h, pos: s.clone(), kind: 'bench', team: t, yaw: Math.PI, vel: new THREE.Vector3() });
      }
      const coach = new Humanoid({ skin: pick(SKIN_TONES), hair: '#2b2b2b', shirt: '#1d1d1d', pants: '#2a2a2a', boots: '#111', longSleeves: true, height: 1.75 });
      const cp = new THREE.Vector3(side * 9, 0, HW + 2.5);
      coach.root.position.copy(cp); coach.root.rotation.y = Math.PI; this.scene.add(coach.root);
      this.bench.push({ h: coach, pos: cp, kind: 'coach', team: t, yaw: Math.PI, vel: new THREE.Vector3(), name: t === 0 ? 'Técnico local' : 'Técnico visitante', home: cp.clone() });
    }
  }
  setupWarmup() {
    // Cada equipo calienta en su mitad: parejas pasándose balones, estiramientos y trote.
    this.warmBalls = [];
    for (let t = 0; t < 2; t++) {
      const side = t === 0 ? -1 : 1;
      this.players[t].forEach((p, i) => {
        p.warm = { kind: i === 0 ? 'gk' : i < 7 ? 'pair' : i < 9 ? 'stretch' : 'jog', t: rand(0, 5), base: new THREE.Vector3(side * rand(10, 40), 0, rand(-25, 25)) };
        p.place(p.warm.base.x, p.warm.base.z, rand(-3, 3));
      });
      // Parejas (jugadores 1-6)
      for (let k = 1; k < 7; k += 2) {
        const a = this.players[t][k], b = this.players[t][k + 1];
        const cx = side * (12 + k * 4.5), cz = -18 + k * 5;
        a.warm.base.set(cx, 0, cz - 6); b.warm.base.set(cx, 0, cz + 6); a.warm.partner = b; b.warm.partner = a;
        a.place(cx, cz - 6, 0); b.place(cx, cz + 6, Math.PI);
        const wb = new Ball(this.scene); wb.place(cx, cz - 5.4); wb.holder = a; this.warmBalls.push(wb); a.warm.ball = wb; b.warm.ball = wb;
      }
      const gk = this.players[t][0]; gk.warm.base.set(side * (HL - 1.5), 0, 0); gk.place(side * (HL - 1.5), 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.players[t][7].warm.base.set(side * 30, 0, 0); this.players[t][8].warm.base.set(side * 30, 0, 3);
    }
    this.ball.place(0, 0); this.ball.mesh.visible = true;
    this.logEvent('calentamiento', [], new THREE.Vector3(), { persistent: true });
  }
  // ---------- Utilidades ----------
  dir(team) { return ((team === 0) === (this.half === 1) ? 1 : -1) * (this.sideSign || 1); }
  goalX(team) { return this.dir(team) * HL; }
  opp(t) { return 1 - t; }
  active(t) { return this.players[t].filter((p) => !p.sentOff); }
  nearest(team, point, exclude, allowGK = true) {
    let best = null, bd = Infinity;
    for (const p of this.active(team)) { if (p === exclude || (!allowGK && p.role === 'GK') || p.mode === 'fallen') continue; const d = p.pos.distanceTo(point); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  minOppDist(p, point = p.pos) { let m = Infinity; for (const o of this.active(this.opp(p.team))) m = Math.min(m, o.pos.distanceTo(point)); return m; }
  logEvent(type, actors, pos, extra = {}) {
    const info = EVENT_INFO[type];
    const ev = { id: this.events.length + 1, type, label: info.label, peak: extra.peak ?? this.time, t: this.time, window: info.window, sigma: info.sigma, weight: info.weight,
      actors: actors.filter(Boolean), team: extra.team ?? actors[0]?.team, pos: pos.clone(), minute: Math.floor(this.minute), half: this.half, ...extra };
    this.events.push(ev);
    if (this.events.length > 400) this.events.splice(0, 100);
    this.game.events.emit('match:event', ev);
    return ev;
  }
  addFeed(text) { this.feed.unshift({ text, minute: Math.floor(this.minute), t: this.time }); if (this.feed.length > 6) this.feed.pop(); this.game.events.emit('match:feed', text); }
  // ---------- Fases ----------
  startMatch(skipCeremony = false) {
    if (this.phase !== 'warmup') return;
    for (const wb of this.warmBalls) { this.scene.remove(wb.mesh); }
    this.warmBalls = [];
    for (const p of this.all) { p.warm = null; p.h.play(p.role === 'GK' ? 'gkReady' : 'loco'); p.anim = 'loco'; p.lock = 0; }
    this.events = this.events.filter((e) => e.type !== 'calentamiento');
    this.kickoffTeam = Math.random() < 0.5 ? 0 : 1;
    if (skipCeremony) {
      this.phase = 'walkout'; this.phaseT = 0;
      this.addFeed('Los equipos se acomodan para el saque inicial.');
      this.game.events.emit('match:phase', 'walkout'); return;
    }
    // Ceremonia: túnel -> alineación -> foto oficial -> sorteo -> posiciones
    this.phase = 'tunnel'; this.phaseT = 0;
    const offs = [[0, 0], [-0.9, 0], [0.9, 0]];
    [this.ref, ...this.ars].forEach((o, i) => { o.pos.set(offs[i][0], 0, HW + 12.5); o.cer = { delay: 0.5, target: new THREE.Vector3(offs[i][0] * 1.4, 0, 3.2) }; });
    for (let t = 0; t < 2; t++) this.players[t].forEach((p, i) => {
      const order = (i + 1) % 11; // el capitán al frente después del portero
      p.pos.set(t ? 0.85 : -0.85, 0, HW + 14 + order * 1.25); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.mode = 'ceremony';
      p.cer = { delay: 1.2 + order * 0.55, target: new THREE.Vector3((t ? 1 : -1) * (2.4 + order * 1.15), 0, 3.2) };
    });
    this.addFeed('¡Salen los equipos al terreno de juego!'); this.excite = 0.7; this.game.audio?.goalRoar(0.6);
    this.logEvent('salida', this.all.slice(0, 6), new THREE.Vector3(0, 0, HW), { team: 0 });
    this.game.events.emit('match:phase', 'ceremony');
  }
  cerMove(o, dt, speed = 1.55) {
    const t = o.cer.target, dx = t.x - o.pos.x, dz = t.z - o.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.08) { const v = Math.min(speed, d * 1.5); o.vel.set(dx / d * v, 0, dz / d * v); o.yaw = dampAngle(o.yaw, Math.atan2(dx, dz), 6, dt); }
    else { o.vel.set(0, 0, 0); o.yaw = dampAngle(o.yaw, o.cer.face ?? 0, 4, dt); }
    return d;
  }
  updateCeremony(dt) {
    const T = this.phaseT, players = this.all, refs = [this.ref, ...this.ars];
    let allIn = true;
    if (this.phase === 'tunnel' || this.phase === 'lineup') {
      for (const o of [...refs, ...players]) {
        if (T < o.cer.delay) { o.vel.set(0, 0, 0); allIn = false; continue; }
        o.cer.face = 0; if (this.cerMove(o, dt) > 0.6) allIn = false;
      }
      if (this.phase === 'tunnel' && (allIn || T > 30)) { this.phase = 'lineup'; this.phaseT = 0; this.addFeed('Formados frente a la tribuna principal.'); }
      else if (this.phase === 'lineup' && T > 6.5) {
        // Foto oficial: cada equipo en su mitad, fila de atrás de pie y fila de adelante agachada
        this.phase = 'teamphoto'; this.phaseT = 0; this.photoPosed = false;
        for (let t = 0; t < 2; t++) {
          const cx = (t ? 1 : -1) * 20, cz = 9, team = this.players[t];
          team.forEach((p, i) => { const back = i < 6, k = back ? i : i - 6; p.cer = { delay: 0, face: 0, kneel: !back, target: new THREE.Vector3(cx + (k - (back ? 2.5 : 2)) * 0.8, 0, back ? cz : cz + 0.95) }; });
        }
        refs.forEach((o, i) => { o.cer = { delay: 0, face: 0, target: new THREE.Vector3((i - 1) * 1.1, 0, 2) }; });
        this.addFeed('Foto oficial: los fotógrafos pueden ingresar al campo.'); this.game.events.emit('match:phase', 'teamphoto');
      }
    } else if (this.phase === 'teamphoto') {
      let posed = true;
      for (const o of [...refs, ...players]) {
        const d = this.cerMove(o, dt, 2.2);
        if (o.cer.kneel && d < 0.15 && o.h.state !== 'kneel') o.h.play('kneel');
        if (d > 0.2) posed = false;
      }
      if (posed && !this.photoPosed) { this.photoPosed = true; this.posedAt = T; for (let t = 0; t < 2; t++) this.logEvent('formacion', this.players[t].slice(), new THREE.Vector3((t ? 1 : -1) * 20, 0, 9), { team: t, peak: this.time + 3 }); }
      if ((this.photoPosed && T - this.posedAt > 11) || T > 28) {
        // Sorteo: el árbitro llama a los capitanes al círculo central; el resto va a su mitad
        this.phase = 'toss'; this.phaseT = 0; this.coinState = null;
        for (const p of players) { p.h.play(p.role === 'GK' ? 'gkReady' : 'loco'); p.cer = { delay: 0, face: 0, target: new THREE.Vector3((p.team ? 1 : -1) * (12 + (p.number % 4) * 3), 0, -8 + (p.number % 6) * 3.2) }; }
        this.captains[0].cer = { delay: 0, face: Math.PI / 2, target: new THREE.Vector3(-1.05, 0, 0) }; this.captains.forEach((c) => c.h.play('loco'));
        this.captains[1].cer = { delay: 0, face: -Math.PI / 2, target: new THREE.Vector3(1.05, 0, 0) };
        this.ref.cer = { delay: 0, face: Math.PI, target: new THREE.Vector3(0, 0, 0.9) };
        this.ars[0].cer = { delay: 0, face: Math.PI, target: new THREE.Vector3(-3, 0, 1.6) }; this.ars[1].cer = { delay: 0, face: Math.PI, target: new THREE.Vector3(3, 0, 1.6) };
        this.addFeed('El árbitro llama a los capitanes para el sorteo.'); this.whistle(1); this.game.events.emit('match:phase', 'toss');
      }
    } else if (this.phase === 'toss') {
      for (const o of [...refs, ...players]) this.cerMove(o, dt, 2.4);
      const c = this.coin, r = this.ref;
      const capsReady = this.captains.every((c) => c.pos.distanceTo(c.cer.target) < 0.5) && this.ref.pos.distanceTo(this.ref.cer.target) < 0.5;
      if (!this.coinState && ((capsReady && T > 2.5) || T > 16)) {
        this.coinState = { t: 0, from: r.pos.clone().add(new THREE.Vector3(0.25, 1.25, -0.2)), result: Math.random() < 0.5 ? 0 : 1 };
        r.h.play('point', 1.2, 1); c.visible = true;
        this.logEvent('sorteo', [this.ref, ...this.captains], new THREE.Vector3(0, 1.5, 0), { team: 0, peak: this.time + 0.45 });
      }
      if (this.coinState) {
        const cs = this.coinState; cs.t += dt;
        const ft = Math.min(cs.t, 0.95), vy = 4.6, y = cs.from.y + vy * ft - 4.9 * ft * ft;
        c.position.set(cs.from.x + ft * 0.15, Math.max(0.006, y), cs.from.z + ft * 0.25);
        if (cs.t < 0.95) { c.rotation.x += dt * 34; }
        else { c.rotation.x = cs.result ? 0 : Math.PI; c.rotation.z = 0; }
        if (cs.t > 1.0 && !cs.announced) {
          cs.announced = true;
          const winner = cs.result; this.captains[winner].playAnim('celebrate', 1.6);
          // El ganador elige hacia dónde atacar en el primer tiempo; el otro equipo saca
          const attackEast = Math.random() < 0.5; const homeEast = winner === 0 ? attackEast : !attackEast;
          this.sideSign = homeEast ? 1 : -1; this.kickoffTeam = 1 - winner;
          const side = (team) => (this.dir(team) > 0 ? 'este' : 'oeste');
          this.addFeed(`Sorteo: gana ${this.teams[winner].short} (${cs.result ? 'escudo' : 'número'}). ${this.teams[0].short} ataca hacia el ${side(0)}; saca ${this.teams[1 - winner].short}.`);
          this.game.events.emit('match:toss', { winner, homeAttacksEast: this.dir(0) > 0, kickoffTeam: this.kickoffTeam });
        }
        if (cs.t > 4.2) { c.visible = false; this.coinState = null; this.phase = 'walkout'; this.phaseT = 0; for (const p of players) p.mode = 'play'; this.addFeed('Los equipos se acomodan para el saque inicial.'); this.game.events.emit('match:phase', 'walkout'); }
      }
    }
    for (const o of refs) { o.pos.addScaledVector(o.vel, dt); o.h.root.position.copy(o.pos); o.h.root.rotation.y = o.yaw; if (o.h.state !== 'point' || o.h.stateT > 1.2) { if (o.h.state !== 'loco') o.h.play('loco'); } o.h.update(dt, o.vel.length()); }
  }
  setRestart(type, team, spot, delay = 2.2) {
    this.ball.owner = null; this.ball.vel.set(0, 0, 0); this.ball.shot = null;
    this.ball.pos.set(spot.x, BALL_R, spot.z); this.ball.dead = true;
    let taker;
    if (type === 'goalkick') taker = this.players[team][0];
    else if (type === 'kickoff') taker = this.active(team).filter((p) => p.role === 'FWD')[0] || this.nearest(team, spot);
    else if (type === 'penalty') taker = this.active(team).filter((p) => p.role === 'FWD')[0] || this.nearest(team, spot);
    else taker = this.nearest(team, spot, null, false);
    this.restart = { type, team, spot: spot.clone(), taker, wait: delay, t: 0 };
    this.phase = 'restart';
  }
  // ---------- Bucle principal ----------
  update(dt) {
    this.time += dt; this.phaseT += dt;
    for (const p of this.all) { p.noTouch = Math.max(0, (p.noTouch || 0) - dt); p.tackleCD = Math.max(0, p.tackleCD - dt); }
    switch (this.phase) {
      case 'warmup': this.updateWarmup(dt); break;
      case 'walkout': this.updateWalkout(dt); break;
      case 'tunnel': case 'lineup': case 'teamphoto': case 'toss': this.updateCeremony(dt); break;
      case 'play': this.updatePlay(dt); this.advanceClock(dt); break;
      case 'restart': this.updateRestart(dt); this.advanceClock(dt * 0.5); break;
      case 'goal': this.updateGoal(dt); break;
      case 'halftime': this.updateBreak(dt); break;
      case 'fulltime': this.updateFulltime(dt); break;
    }
    // Física y sincronización
    this.ball.update(dt);
    if (this.phase === 'play' || this.phase === 'goal') this.checkBall();
    for (const p of this.all) {
      if (p.sentOff && p.mode !== 'leaving') continue;
      if (p.mode === 'fallen') { p.vel.multiplyScalar(Math.pow(0.04, dt)); p.fallenT -= dt; if (p.fallenT <= 0) { p.mode = 'play'; p.playAnim('getup', 0.9); } }
      p.integrate(dt);
      p.sync(dt, this.ball.pos);
    }
    this.separate(dt);
    if (this.ball.owner) this.carryBall(dt);
    this.ball.syncMesh(dt);
    for (const wb of this.warmBalls) wb.syncMesh(dt);
    this.updateOfficials(dt); this.updateBench(dt);
    // Excitación del público
    const bx = this.ball.pos.x, att = Math.abs(bx) > HL - 25 ? 0.12 : 0;
    const base = this.phase === 'warmup' ? 0.08 : this.phase === 'play' ? 0.18 + att : 0.15;
    this.excite += (base - this.excite) * Math.min(1, dt * 0.25);
    this.excite = clamp(this.excite, 0, 1.2);
  }
  separate() {
    const ps = this.all;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j]; if (a.sentOff || b.sentOff) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.36 && d2 > 1e-6) { const d = Math.sqrt(d2), push = (0.6 - d) * 0.5; a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push; b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push; }
    }
  }
  advanceClock(dt) {
    this.minute += dt * (45 / this.halfSeconds);
    const end = 45 + this.addedTime;
    const m = this.minute - (this.half === 2 ? 45 : 0);
    if (m >= end && this.phase === 'play') {
      this.whistle(3);
      if (this.half === 1) { this.phase = 'halftime'; this.phaseT = 0; this.addFeed(`Final del primer tiempo: ${this.score[0]}-${this.score[1]}.`); this.game.events.emit('match:phase', 'halftime'); }
      else {
        this.phase = 'fulltime'; this.phaseT = 0; this.addFeed(`¡Final del partido! ${this.teams[0].short} ${this.score[0]}-${this.score[1]} ${this.teams[1].short}`);
        this.logEvent('final', this.all.slice(), new THREE.Vector3(0, 0, 0), { team: this.score[0] >= this.score[1] ? 0 : 1 });
        this.game.events.emit('match:phase', 'fulltime');
        const winner = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
        for (const p of this.all) { if (winner === -1) p.h.play('loco'); else if (p.team === winner) p.playAnim('celebrate', 9); else if (Math.random() < 0.5) { p.mode = 'fallen'; p.fallenT = 6; p.playAnim('kneel', 6); } }
        this.excite = winner === 0 ? 1 : 0.5;
      }
      this.ball.owner = null;
    }
  }
  whistle(n = 1) { this.game.audio?.whistle(n); this.ref.h.play('whistle', 0.8); }
  updateWarmup(dt) {
    for (const p of this.all) {
      const w = p.warm; if (!w) continue; w.t += dt;
      if (w.kind === 'pair') {
        const b = w.ball, partner = w.partner;
        p.moveToward(w.base.x, w.base.z, 2, dt);
        p.faceToward(partner.pos.x, partner.pos.z, dt);
        if (b.holder === p && !b.inFlight) {
          b.pos.set(p.pos.x + Math.sin(p.yaw) * 0.5, BALL_R, p.pos.z + Math.cos(p.yaw) * 0.5);
          if (w.t > 1.6 + Math.random()) {
            w.t = 0; p.playAnim('kick', 0.5, Math.random() < 0.5 ? 1 : -1);
            const d = new THREE.Vector3().subVectors(partner.pos, b.pos); const dist = d.length(); d.normalize();
            const lob = Math.random() < 0.25;
            b.vel.set(d.x * (lob ? dist / 1.1 : Math.sqrt(16 + 2 * 3 * dist)), lob ? 5.2 : 0, d.z * (lob ? dist / 1.1 : Math.sqrt(16 + 2 * 3 * dist)));
            b.holder = partner; b.inFlight = true; b.flightT = 0;
          }
        } else if (b.inFlight && b.holder === p) {
          b.update(dt); b.flightT += dt;
          if (b.pos.distanceTo(p.pos) < 1.1 || b.flightT > 3) { b.inFlight = false; b.vel.set(0, 0, 0); w.t = 0; if (b.pos.y > 1) p.playAnim('header', 0.6); }
        }
      } else if (w.kind === 'stretch') {
        p.moveToward(w.base.x, w.base.z, 1.5, dt);
        if (p.h.state !== 'stretch' && p.h.state !== 'jumpjack') p.h.play(Math.random() < 0.5 ? 'stretch' : 'jumpjack');
        if (w.t > 8) { w.t = 0; p.h.play(p.h.state === 'stretch' ? 'jumpjack' : 'stretch'); }
      } else if (w.kind === 'jog') {
        const side = Math.sign(w.base.x);
        const a = w.t * 0.25 + p.number;
        p.moveToward(side * (28 + Math.cos(a) * 14), Math.sin(a) * 22, 3.2, dt);
        if (p.h.state !== 'loco') p.h.play('loco');
      } else if (w.kind === 'gk') {
        const tz = Math.sin(w.t * 0.8) * 2.5;
        p.moveToward(w.base.x, tz, 3, dt);
        p.faceToward(0, 0, dt);
        if (w.t % 7 < dt) { p.playAnim('dive', 1.1, Math.random() < 0.5 ? 1 : -1); }
      }
    }
    this.ball.place(0, 0);
    this.minute = 0;
  }
  updateWalkout(dt) {
    let ready = true;
    for (const p of this.all) {
      const t = this.formationTarget(p, true);
      const d = p.moveToward(t.x, t.z, 4.2, dt);
      if (d > 1.2) ready = false; else p.faceToward(0, 0, dt);
      if (p.h.state !== 'loco' && p.h.state !== 'gkReady' && p.lock <= 0) p.h.play('loco');
    }
    if ((ready && this.phaseT > 4) || this.phaseT > 14) {
      this.setRestart('kickoff', this.kickoffTeam, new THREE.Vector3(0, 0, 0), 1.6);
    }
  }
  formationTarget(p, kickoff = false) {
    const d = this.dir(p.team);
    let fx = p.slot.fx, fz = p.slot.fz;
    if (kickoff) { fx = Math.min(fx * 0.9, -0.03); return new THREE.Vector3(fx * HL * d, 0, fz * HW * 0.85); }
    const b = this.ball.pos;
    const bxf = (b.x / HL) * d; // posición del balón en el marco de ataque del equipo
    const poss = this.ball.owner ? this.ball.owner.team === p.team : this.lastPoss === p.team;
    let shift = clamp(bxf * 0.55, -0.35, 0.55);
    if (poss) shift += p.role === 'DEF' ? 0.12 : p.role === 'MID' ? 0.22 : 0.3;
    else shift -= 0.08;
    if (p.role === 'GK') { fx = -0.97; shift = 0; }
    let x = clamp(fx + shift, -0.97, p.role === 'DEF' ? 0.45 : 0.92);
    let z = fz * 0.88 + (b.z / HW) * (p.role === 'GK' ? 0.0 : 0.28);
    // Desmarques al área cuando el equipo ataca en el último tercio
    if (poss && bxf > 0.45 && p.role === 'FWD') { x = 0.82 + (p.number % 3) * 0.03; z = (fz > 0 ? 0.1 : -0.12) + Math.sin(this.time * 0.7 + p.number) * 0.08; }
    if (poss && bxf > 0.55 && p.role === 'MID' && Math.abs(fz) < 0.3) { x = 0.62; }
    if (poss && bxf > 0.3 && p.role === 'MID' && Math.abs(fz) > 0.5) { x = 0.78; z = Math.sign(fz) * 0.82; }
    return new THREE.Vector3(x * HL * d, 0, clamp(z, -0.95, 0.95) * HW);
  }
  // ---------- Juego en curso ----------
  updatePlay(dt) {
    const ball = this.ball, owner = ball.owner;
    if (owner) { this.stats.possession[owner.team] += dt; this.lastPoss = owner.team; }
    // Chasers: quien llega antes al balón suelto
    const chasers = new Set();
    if (!owner) {
      for (let t = 0; t < 2; t++) {
        let best = null, bt = Infinity;
        for (const p of this.active(t)) {
          if (p.mode === 'fallen' || p.lock > 0.2) continue;
          if (p.role === 'GK' && !(Math.abs(ball.pos.x - this.goalX(this.opp(t))) < 17 && Math.abs(ball.pos.z) < 21)) continue;
          const tt = p.pos.distanceTo(ball.pos) / p.maxSpeed;
          if (tt < bt) { bt = tt; best = p; }
        }
        if (best) chasers.add(best);
      }
    }
    const pressers = new Set();
    if (owner) {
      const defT = this.opp(owner.team);
      const near = this.active(defT).filter((p) => p.role !== 'GK' && p.mode !== 'fallen').sort((a, b) => a.pos.distanceTo(owner.pos) - b.pos.distanceTo(owner.pos));
      pressers.add(near[0]); if (Math.abs(owner.pos.x - this.goalX(owner.team)) < 30 && near[1]) pressers.add(near[1]);
    }
    for (const p of this.all) {
      if (p.sentOff) { if (p.mode === 'leaving') { const d = p.moveToward(0, HW + 9, 2.2, dt); if (d < 1.5) { p.mode = 'gone'; p.root.visible = false; p.pos.set(0, -50, 60); } } continue; }
      if (p.mode === 'fallen' || p.lock > 0) { p.vel.multiplyScalar(Math.pow(0.05, dt)); this.processPendingKick(p, dt); continue; }
      if (p.role === 'GK') { this.updateGK(p, dt, chasers.has(p)); continue; }
      if (p === owner) { this.updateOwner(p, dt); continue; }
      if (chasers.has(p)) {
        // Interceptar: apuntar adonde estará el balón
        let tLead = clamp(p.pos.distanceTo(ball.pos) / p.maxSpeed, 0, 1.2) * 0.7;
        if (ball.pos.y > 1 || ball.vel.y > 1) { // balón aéreo: punto donde baja a altura de cabeza
          const vy = ball.vel.y, y0 = ball.pos.y - 1.9, disc = vy * vy + 2 * 9.81 * y0;
          tLead = disc > 0 ? (vy + Math.sqrt(disc)) / 9.81 : tLead;
        }
        const tx = ball.pos.x + ball.vel.x * tLead, tz = ball.pos.z + ball.vel.z * tLead;
        p.moveToward(tx, tz, p.maxSpeed, dt, 10);
      } else if (pressers.has(p) && owner) {
        const gx = this.goalX(owner.team) * -1; // portería que defiendo
        const dirToGoal = new THREE.Vector3(-this.dir(owner.team), 0, 0);
        const tx = owner.pos.x + dirToGoal.x * 1.1, tz = owner.pos.z;
        const d = p.moveToward(tx, tz, p.maxSpeed * 0.92, dt, 9);
        if (p.pos.distanceTo(owner.pos) < 1.45 && p.tackleCD <= 0 && owner.lock <= 0) this.tryTackle(p, owner);
      } else {
        const t = this.formationTarget(p);
        const d = p.moveToward(t.x, t.z, d2speed(p, t), dt, 5);
        if (d < 1.5) p.faceToward(ball.pos.x, ball.pos.z, dt, 4);
      }
      this.tryControl(p);
    }
    for (const p of chasers) if (p.role === 'GK') this.tryControl(p);
    this.handleAerial(dt);
    this.handleShotOnGoal(dt);
    function d2speed(p, t) { const d = p.pos.distanceTo(t); return d > 12 ? p.maxSpeed * 0.85 : d > 4 ? p.maxSpeed * 0.55 : 2.2; }
  }
  tryControl(p) {
    const b = this.ball;
    if (b.owner || p.noTouch > 0 || p.lock > 0.1 || p.mode === 'fallen' || b.dead) return;
    const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, hd = Math.hypot(dx, dz);
    const sp = b.vel.length();
    if (hd < 0.95 && b.pos.y < 1.1 && (sp < 19 || p.role === 'GK')) {
      // Disputa: si un rival también está encima, posible rebote
      b.owner = p; b.lastTouch = p.team; b.shot = null; p.decisionT = rand(0.15, 0.5);
      b.vel.set(0, 0, 0);
      if (p.role === 'GK' && sp > 8) { p.playAnim('catch', 1.1); p.decisionT = 1.8; this.addFeed(`${p.name} (#${p.number}) controla con seguridad.`); }
    }
  }
  carryBall(dt) {
    const p = this.ball.owner, b = this.ball;
    if (!p || p.sentOff) { b.owner = null; return; }
    const sp = Math.hypot(p.vel.x, p.vel.z);
    // Toques de conducción: el balón se adelanta y se vuelve a tocar en cada zancada
    p.touch = ((p.touch || 0) + dt * (0.8 + sp * 0.28)) % 1;
    const lead = p.role === 'GK' && p.anim === 'catch' ? 0.25 : 0.4 + sp * 0.05 + (sp > 2 ? Math.sin(p.touch * Math.PI) * (0.35 + sp * 0.06) : 0);
    const tx = p.pos.x + Math.sin(p.yaw) * lead, tz = p.pos.z + Math.cos(p.yaw) * lead;
    const ty = p.role === 'GK' && p.anim === 'catch' ? 1.0 : BALL_R + Math.abs(Math.sin(this.time * 9)) * 0.04 * Math.min(1, sp / 3);
    b.vel.set((tx - b.pos.x) / Math.max(dt, 1e-3) * 0.5 + p.vel.x * 0.5, 0, (tz - b.pos.z) / Math.max(dt, 1e-3) * 0.5 + p.vel.z * 0.5);
    b.pos.set(tx, ty, tz);
  }
  updateOwner(p, dt) {
    const d = this.dir(p.team), gx = this.goalX(p.team);
    const distGoal = Math.hypot(gx - p.pos.x, p.pos.z);
    const pressure = this.minOppDist(p);
    p.decisionT -= dt;
    // Conducción: hacia la portería rival evitando al rival más cercano
    let tx = gx - d * 6, tz = p.pos.z * 0.8;
    let avoid = null, ad = 6;
    for (const o of this.active(this.opp(p.team))) { const od = o.pos.distanceTo(p.pos); const ahead = (o.pos.x - p.pos.x) * d; if (od < ad && ahead > -0.5) { ad = od; avoid = o; } }
    if (avoid) tz += (p.pos.z > avoid.pos.z ? 1 : -1) * 8;
    if (p.role === 'DEF' && pressure > 8) tx = p.pos.x + d * 10;
    const dribSpeed = p.maxSpeed * (pressure < 3 ? 0.78 : 0.68);
    p.moveToward(clamp(tx, -HL + 1, HL - 1), clamp(tz, -HW + 2, HW - 2), dribSpeed, dt, 6);
    if (p.decisionT > 0) return;
    p.decisionT = rand(0.35, 0.85);
    // ¿Rematar?
    const angleOk = Math.abs(p.pos.z) < 22;
    let shootP = distGoal < 33 && angleOk ? Math.pow(clamp((35 - distGoal) / 30, 0, 1), 1.3) * 1.1 * (p.teamData.style?.shoot || 1) : 0;
    if (distGoal < 18) shootP += 0.25;
    if (p.role === 'DEF') shootP *= 0.25;
    if (Math.random() < shootP) return this.shoot(p, false);
    // ¿Centro desde la banda?
    if ((gx - p.pos.x) * d < 24 && Math.abs(p.pos.z) > 15 && Math.random() < 0.7) return this.cross(p);
    // ¿Regate ante presión?
    if (pressure < 2.6 && avoid && Math.random() < 0.32 + p.skill * 0.2) return this.dribble(p, avoid);
    // Pase
    const passP = pressure < 4 ? 0.85 : pressure < 8 ? 0.45 : 0.18;
    if (Math.random() < passP || p.role === 'DEF' && pressure < 6) this.pass(p);
  }
  scheduleKick(p, vel, kind, delay = 0.2, extra = {}) {
    p.playAnim(kind === 'header' ? 'header' : kind === 'throw' ? 'throw' : 'kick', kind === 'throw' ? 0.9 : 0.55, Math.random() < 0.8 ? 1 : -1);
    p.pendingKick = { vel, kind, t: delay, extra };
    p.vel.multiplyScalar(0.4);
  }
  processPendingKick(p, dt) {
    const k = p.pendingKick; if (!k) return;
    k.t -= dt; if (k.t > 0) return;
    p.pendingKick = null;
    const b = this.ball;
    if (b.owner && b.owner !== p) return; // le quitaron el balón
    b.owner = null; b.dead = false; b.vel.copy(k.vel); b.lastTouch = p.team; p.noTouch = 0.45;
    if (k.kind === 'throw') b.pos.y = 2.0;
    this.game.audio?.kick(b.pos, k.vel.length());
    if (k.kind === 'shot' || k.kind === 'headShot' || k.kind === 'penalty') {
      b.shot = { team: p.team, shooter: p, t: this.time, gkDecided: false };
      this.stats.shots[p.team]++;
      this.logEvent(k.kind === 'penalty' ? 'penal' : 'remate', [p], p.pos, { team: p.team, header: k.kind === 'headShot' });
      this.excite = Math.max(this.excite, 0.65);
      this.game.events.emit('match:shot', { team: p.team });
    } else if (k.kind === 'pass' || k.kind === 'cross' || k.kind === 'clear') {
      if (k.kind !== 'clear' && Math.random() < 0.5) this.logEvent('pase', [p, k.extra.target].filter(Boolean), p.pos, { team: p.team });
      if (k.kind === 'cross') { this.excite = Math.max(this.excite, 0.45); b.cross = true; }
    } else if (k.kind === 'corner') { this.logEvent('corner', [p], p.pos, { team: p.team }); b.cross = true; }
  }
  passVelocity(from, to, lofted) {
    const d = new THREE.Vector3(to.x - from.x, 0, to.z - from.z); const dist = d.length(); d.normalize();
    if (lofted) { const t = dist / 19 + 0.5; return new THREE.Vector3(d.x * dist / t, 9.81 * t / 2 * 0.95, d.z * dist / t); }
    const s = clamp(Math.sqrt(5 * 5 + 2 * 3.4 * dist), 7, 27);
    return new THREE.Vector3(d.x * s, 0, d.z * s);
  }
  pass(p) {
    const d = this.dir(p.team); let best = null, bs = -Infinity, lofted = false;
    for (const t of this.active(p.team)) {
      if (t === p || t.mode === 'fallen') continue;
      const dist = t.pos.distanceTo(p.pos); if (dist < 5 || dist > 45) continue;
      const fwd = (t.pos.x - p.pos.x) * d, open = Math.min(9, this.minOppDist(t));
      let lane = Infinity;
      for (const o of this.active(this.opp(p.team))) lane = Math.min(lane, segDist(o.pos, p.pos, t.pos));
      let s = fwd * 0.75 + open * 1.3 - dist * 0.1 + Math.random() * 5 - (t.role === 'GK' ? 12 : 0) + (t.role === 'FWD' ? 2 : 0);
      if (lane < 1.6) s -= dist > 16 ? 3 : 9;
      if (s > bs) { bs = s; best = t; lofted = lane < 1.6 && dist > 16 || dist > 32; }
    }
    if (!best) { this.dribbleForward(p); return; }
    const lead = new THREE.Vector3().copy(best.pos).addScaledVector(best.vel, 0.6);
    // Precisión según habilidad
    lead.x += rand(-1.5, 1.5) * (1.2 - p.skill); lead.z += rand(-1.5, 1.5) * (1.2 - p.skill);
    this.scheduleKick(p, this.passVelocity(this.ball.pos, lead, lofted), 'pass', 0.2, { target: best });
  }
  dribbleForward(p) { p.decisionT = 0.5; }
  cross(p) {
    const gx = this.goalX(p.team), d = this.dir(p.team);
    const target = new THREE.Vector3(gx - d * rand(6, 13), 0, rand(-6, 6));
    const v = this.passVelocity(this.ball.pos, target, true); v.y *= 1.05;
    this.scheduleKick(p, v, 'cross', 0.22);
  }
  dribble(p, def) {
    // Regate: cambio de dirección brusco. Éxito depende de la habilidad.
    const d = this.dir(p.team);
    const success = Math.random() < 0.45 + p.skill * 0.35 - def.skill * 0.2;
    const lateral = p.pos.z > def.pos.z ? 1 : -1;
    p.vel.set(d * p.maxSpeed * 0.7, 0, lateral * p.maxSpeed * 0.6);
    p.decisionT = 0.6;
    this.logEvent('regate', [p, def], p.pos, { team: p.team, success });
    if (success) { def.tackleCD = 1.6; def.vel.multiplyScalar(0.2); if (Math.random() < 0.3) { const dx = def.pos.x - p.pos.x, dz = def.pos.z - p.pos.z, l = Math.hypot(dx, dz) || 1; def.ragdoll(dx / l, dz / l, 1.6); } }
    else this.tryTackle(def, p, true);
  }
  tryTackle(def, owner, forced = false) {
    def.tackleCD = rand(1.2, 2.2);
    const roll = Math.random();
    const success = forced ? 0.75 : 0.36 + def.skill * 0.2 - owner.skill * 0.12;
    const foulP = 0.13 + (def.role === 'DEF' ? 0.04 : 0);
    const slide = Math.random() < 0.38;
    if (slide) def.playAnim('slide', 0.9); else def.playAnim('kick', 0.4, 1);
    if (roll < foulP) return this.foul(def, owner);
    if (roll < foulP + success) {
      const b = this.ball; b.owner = null; b.lastTouch = def.team; owner.noTouch = 0.6;
      const away = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(rand(3, 7));
      b.vel.copy(away); b.pos.y = BALL_R;
      this.logEvent('entrada', [def, owner], def.pos, { team: def.team, slide });
      if (slide ? Math.random() < 0.75 : Math.random() < 0.2) { const dx = owner.pos.x - def.pos.x, dz = owner.pos.z - def.pos.z, l = Math.hypot(dx, dz) || 1; owner.ragdoll(dx / l * 0.6 + owner.vel.x * 0.08, dz / l * 0.6 + owner.vel.z * 0.08, 1.8); }
    }
  }
  foul(def, victim) {
    this.whistle(1); this.stats.fouls[def.team]++;
    const fdx = victim.pos.x - def.pos.x, fdz = victim.pos.z - def.pos.z, fl = Math.hypot(fdx, fdz) || 1;
    const sim = Math.random() < 0.25;
    victim.ragdoll(fdx / fl + victim.vel.x * 0.1, fdz / fl + victim.vel.z * 0.1, sim ? rand(5, 8) : rand(1.6, 3));
    this.logEvent('falta', [def, victim], victim.pos, { team: def.team });
    if (sim) this.logEvent('lesion', [victim], victim.pos, { team: victim.team, peak: this.time + 1.5 });
    this.addFeed(`Falta de ${def.name} (#${def.number}) sobre ${victim.name}.`);
    // Tarjetas
    const r = Math.random();
    const hard = r < 0.2 || Math.random() < 0.25;
    if (r < 0.025 || (def.yellow && r < 0.18)) this.card(def, true);
    else if (r < 0.2) this.card(def, false);
    // Falta fuerte: a veces se calientan los ánimos y se arma una trifulca
    if (hard && !def.sentOff && Math.random() < (this.game.career?.event?.clasico ? 0.55 : 0.32) && this.time - (this.lastScuffle || -999) > 60) this.startScuffle(def, victim);
    // ¿Penal? Falta dentro del área del equipo que defiende.
    const defGoal = -this.goalX(def.team);
    const inBox = Math.abs(victim.pos.x - defGoal) < 16.5 && Math.abs(victim.pos.z) < 20.16 && Math.sign(victim.pos.x) === Math.sign(defGoal);
    const b = this.ball; b.owner = null;
    if (inBox) {
      this.addFeed('¡PENAL! El árbitro señala el punto penal.');
      this.excite = 0.9;
      this.setRestart('penalty', victim.team, new THREE.Vector3(defGoal - Math.sign(defGoal) * 11, 0, 0), 4.5);
    } else this.setRestart('free', victim.team, victim.pos.clone(), sim ? 6 : 3);
  }
  // ---------- Trifulca: un compañero de la víctima encara al infractor, empujones, se meten a separar y el árbitro saca tarjetas ----------
  startScuffle(def, victim) {
    const mates = this.active(victim.team).filter((p) => p !== victim && p.role !== 'GK').sort((a, b) => a.pos.distanceTo(def.pos) - b.pos.distanceTo(def.pos));
    const agg = mates[0]; if (!agg) return;
    const near = (team, n, excl) => this.active(team).filter((p) => !excl.includes(p) && p.role !== 'GK').sort((a, b) => a.pos.distanceTo(def.pos) - b.pos.distanceTo(def.pos)).slice(0, n);
    const helpersA = near(victim.team, 2, [victim, agg]), helpersB = near(def.team, 2, [def]);
    this.scuffle = { def, agg, victim, helpersA, helpersB, t: 0, stage: 0, center: def.pos.clone(), carded: false };
    this.lastScuffle = this.time; this.excite = Math.max(this.excite, 0.75);
  }
  updateScuffle(dt) {
    const S = this.scuffle; if (!S) return false;
    S.t += dt; const { def, agg } = S, c = S.center;
    const face = (p, q) => p.faceToward(q.pos.x, q.pos.z, dt, 10);
    // 1) El agresor corre hacia el infractor
    if (S.stage === 0) {
      const d = agg.moveToward(def.pos.x, def.pos.z, agg.maxSpeed * 0.95, dt, 9); face(def, agg);
      if (d < 1.0 || S.t > 4) { S.stage = 1; S.t = 0; agg.vel.set(0, 0, 0); agg.playAnim('confront', 1.4); def.playAnim('confront', 1.4); this.addFeed(`¡Se calientan los ánimos! ${agg.name} encara a ${def.name}.`); this.game.audio?.groan?.(); }
      return true;
    }
    // 2) Encarón cara a cara y empujón
    if (S.stage === 1) {
      face(agg, def); face(def, agg); agg.vel.set(0, 0, 0); def.vel.set(0, 0, 0);
      if (S.t > 1.2 && !S.shoved) {
        S.shoved = true; agg.playAnim('shove', 0.7);
        const dx = def.pos.x - agg.pos.x, dz = def.pos.z - agg.pos.z, l = Math.hypot(dx, dz) || 1;
        setTimeout(() => { if (Math.random() < 0.35) def.ragdoll(dx / l * 0.7, dz / l * 0.7, 1.4); else { def.vel.set(dx / l * 3, 0, dz / l * 3); def.playAnim('confront', 1.2); } }, 250);
        this.logEvent('trifulca', [agg, def], def.pos, { team: agg.team, peak: this.time + 0.4 }); this.excite = 0.9;
        this.addFeed(`¡Empujón de ${agg.name}! Se arma la trifulca.`);
        this.game.events.emit('match:scuffle', S);
      }
      if (S.t > 2.4) { S.stage = 2; S.t = 0; }
      return true;
    }
    // 3) Llegan los demás: unos separan, otros reclaman; el árbitro entra y saca tarjetas
    if (S.stage === 2) {
      const all = [...S.helpersA, ...S.helpersB];
      all.forEach((p, i) => {
        const target = i % 2 === 0 ? (p.team === agg.team ? agg : def) : this.ref;
        const off = (i % 2 ? 1.2 : 0.8);
        const d = p.moveToward(target.pos.x + Math.sin(i * 2.1) * off, target.pos.z + Math.cos(i * 2.1) * off, p.maxSpeed * 0.8, dt, 8);
        if (d < 1.6) { p.vel.multiplyScalar(0.5); face(p, target); if (p.lock <= 0) p.playAnim(i % 2 === 0 ? 'restrain' : 'protest', 1.0); }
      });
      // Separan al agresor
      if (S.t > 1) { const away = agg.pos.clone().sub(def.pos).setY(0).normalize(); agg.moveToward(agg.pos.x + away.x * 2, agg.pos.z + away.z * 2, 1.2, dt, 4); face(agg, def); if (agg.lock <= 0) agg.playAnim('confront', 0.8); }
      const ref = this.ref, rd = Math.hypot(ref.pos.x - c.x, ref.pos.z - c.z);
      if (rd < 3.2 && !S.carded && S.t > 1.2) {
        S.carded = true; this.whistle(2);
        const red = Math.random() < 0.18;
        this.card(agg, red);
        if (!def.sentOff && Math.random() < 0.45) setTimeout(() => this.card(def, false), 1500);
      }
      if (S.t > 6.5 || (S.carded && S.t > 4.5)) { this.scuffle = null; if (this.restart) this.restart.wait = Math.max(this.restart.wait, this.restart.t + 2); }
      return true;
    }
    return false;
  }
  card(p, red) {
    this.stats.cards[p.team]++;
    this.ref.h.play('card', 2.4); this.ref.card.material.color.set(red || p.yellow ? 0xd71920 : 0xffd400); this.ref.card.visible = true; this.ref.cardT = 2.6;
    if (red || p.yellow) {
      p.sentOff = true; p.mode = 'leaving'; p.vel.set(0, 0, 0); p.playAnim('loco', 0);
      this.logEvent('expulsion', [p, this.ref], p.pos, { team: p.team, peak: this.time + 0.8 });
      this.addFeed(`¡TARJETA ROJA! ${p.name} (#${p.number}) se va expulsado.`);
      this.excite = 0.8;
    } else {
      p.yellow = 1;
      this.logEvent('amarilla', [p, this.ref], p.pos, { team: p.team, peak: this.time + 0.8 });
      this.addFeed(`Tarjeta amarilla para ${p.name} (#${p.number}).`);
    }
  }
  shoot(p, header) {
    const gx = this.goalX(p.team);
    const dist = Math.hypot(gx - p.pos.x, p.pos.z);
    const pressure = this.minOppDist(p);
    // Apuntar a una esquina con error que crece con distancia y presión
    const err = (0.7 + dist * 0.075 + (pressure < 2 ? 0.9 : 0)) * (1.2 - p.skill * 0.5);
    const tz = clamp((Math.random() < 0.5 ? -1 : 1) * rand(1.2, 3.4) + rand(-err, err) * 1.4, -6, 6);
    const ty = clamp(rand(0.25, 2.1) + rand(-err, err) * 0.4, 0.15, 3.4);
    const target = new THREE.Vector3(gx + Math.sign(gx) * 0.4, ty, tz);
    const speed = header ? rand(11, 15) : rand(19, 29) * (p.teamData.style?.shoot || 1);
    const from = this.ball.pos.clone();
    const hd = Math.hypot(target.x - from.x, target.z - from.z), t = hd / speed;
    const v = new THREE.Vector3((target.x - from.x) / t, (ty - from.y) / t + 0.5 * 9.81 * t, (target.z - from.z) / t);
    this.scheduleKick(p, v, header ? 'headShot' : 'shot', header ? 0.12 : 0.24);
    this.addFeed(`¡Remate de ${p.name} (#${p.number})!`);
  }
  handleAerial(dt) {
    const b = this.ball;
    if (b.owner || b.dead || b.vel.y > 0 || b.pos.y < 1.2 || b.pos.y > 3.0 || this.time < (b.headerCD || 0)) return;
    const cands = [[], []];
    for (const p of this.all) { if (p.sentOff || p.mode === 'fallen' || p.lock > 0 || p.role === 'GK') continue; const hd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z); if (hd < 2.0) cands[p.team].push([hd, p]); }
    if (!cands[0].length && !cands[1].length) return;
    const a = cands[0].sort((x, y) => x[0] - y[0])[0]?.[1], c = cands[1].sort((x, y) => x[0] - y[0])[0]?.[1];
    const duel = a && c;
    let winner = duel ? (Math.random() < 0.5 + (a.info.height - c.info.height) * 1.5 ? a : c) : (a || c);
    if (duel) { (winner === a ? c : a).playAnim('header', 0.7); this.logEvent('disputa', [a, c], b.pos, { team: winner.team }); this.excite = Math.max(this.excite, 0.5); }
    const gx = this.goalX(winner.team), dist = Math.hypot(gx - winner.pos.x, winner.pos.z);
    b.lastTouch = winner.team; winner.noTouch = 0.4; b.cross = false; b.headerCD = this.time + 1.6;
    if (dist < 15 && Math.abs(winner.pos.z) < 12) { b.owner = winner; this.shoot(winner, true); winner.pendingKick.t = 0.05; }
    else {
      winner.playAnim('header', 0.7);
      const d = this.dir(winner.team);
      const tgt = this.nearest(winner.team, new THREE.Vector3(winner.pos.x + d * 15, 0, winner.pos.z), winner, false);
      const to = tgt ? tgt.pos : new THREE.Vector3(winner.pos.x + d * 20, 0, winner.pos.z);
      const v = this.passVelocity(b.pos, to, true); v.x *= 0.85; v.z *= 0.85; v.y *= 0.6;
      b.vel.copy(v); this.game.audio?.kick(b.pos, 10);
    }
  }
  updateGK(p, dt, chasing) {
    const ownGoal = -this.goalX(p.team), s = Math.sign(ownGoal), b = this.ball;
    if (b.owner === p) {
      p.vel.multiplyScalar(0.8); p.decisionT -= dt;
      if (p.decisionT <= 0 && p.lock <= 0) {
        // Saque largo o corto
        const d = this.dir(p.team);
        const targets = this.active(p.team).filter((t) => t !== p).sort((a, c) => (c.pos.x - a.pos.x) * d - this.minOppDist(c) * 0.5 + this.minOppDist(a) * 0.5);
        const tgt = Math.random() < 0.6 ? targets[0] : targets[Math.floor(Math.random() * Math.min(4, targets.length))];
        const lofted = tgt.pos.distanceTo(p.pos) > 22;
        p.h.play('loco');
        this.scheduleKick(p, this.passVelocity(b.pos, tgt.pos, lofted), 'pass', 0.25, { target: tgt });
      }
      return;
    }
    if (chasing && !b.shot) { p.moveToward(b.pos.x, b.pos.z, p.maxSpeed, dt, 10); this.tryControl(p); return; }
    // Posicionamiento: en la bisectriz entre balón y centro de portería
    const toBall = new THREE.Vector3(b.pos.x - ownGoal, 0, b.pos.z);
    const dist = toBall.length(); toBall.normalize();
    const off = clamp(dist * 0.08, 0.6, 5.5);
    const tx = ownGoal + toBall.x * off, tz = clamp(toBall.z * off, -GOAL_HW + 0.3, GOAL_HW - 0.3);
    if (!p.diving) p.moveToward(tx, tz, 4.5, dt, 8);
    p.faceToward(b.pos.x, b.pos.z, dt, 10);
  }
  handleShotOnGoal(dt) {
    const b = this.ball, sh = b.shot; if (!sh || b.owner) return;
    const defT = this.opp(sh.team), gk = this.players[defT][0], gx = this.goalX(sh.team);
    if (gk.sentOff) return;
    if (Math.sign(b.vel.x) !== Math.sign(gx) || Math.abs(b.vel.x) < 2) { b.shot = null; return; }
    const tcross = (gx - b.pos.x) / b.vel.x;
    if (tcross < 0 || tcross > 1.6) return;
    const zc = b.pos.z + b.vel.z * tcross, yc = b.pos.y + b.vel.y * tcross - 0.5 * 9.81 * tcross * tcross;
    const onTarget = Math.abs(zc) < GOAL_HW + 0.1 && yc < BAR + 0.1 && yc > -0.5;
    if (!sh.gkDecided) {
      sh.gkDecided = true;
      const reachZ = Math.abs(zc - gk.pos.z), speed = b.vel.length();
      let pSave = 0.93 - reachZ * 0.085 - Math.max(0, speed - 20) * 0.015 + (yc > 1.9 ? -0.06 : 0) + gk.skill * 0.12;
      if (sh.header) pSave += 0.12;
      if (this.restart?.type === 'penalty' || (this.lastRestartType === 'penalty' && this.time - sh.t < 2)) pSave -= 0.35;
      sh.save = onTarget && Math.random() < clamp(pSave, 0.08, 0.92);
      sh.zc = zc; sh.yc = yc; sh.onTarget = onTarget;
      if (onTarget || reachZ < 3) {
        const side = Math.sign(zc - gk.pos.z) * -Math.sign(gx) || 1;
        // Lado de la estirada en el sistema local del portero (mirando hacia el campo)
        const localSide = Math.sign((zc - gk.pos.z) * (gx > 0 ? -1 : 1)) || 1;
        if (reachZ > 0.9) { gk.playAnim('dive', 1.4, -localSide); gk.diving = true; gk.diveTarget = new THREE.Vector3(gk.pos.x, 0, clamp(zc, -GOAL_HW, GOAL_HW)); }
        else gk.playAnim('catch', 1.0);
      }
    }
    if (gk.diving && gk.diveTarget) { gk.vel.set(0, 0, (gk.diveTarget.z - gk.pos.z) * 3.5); }
    // Resolver contacto cuando el balón llega al portero
    const dxg = Math.abs(b.pos.x - gk.pos.x);
    if (sh.save && dxg < 0.8 && !sh.resolved) {
      sh.resolved = true; gk.diving = false;
      this.stats.saves[defT]++;
      this.logEvent('atajada', [gk, sh.shooter], b.pos, { team: defT });
      this.addFeed(`¡ATAJADA de ${gk.name}!`);
      this.excite = Math.max(this.excite, 0.75);
      this.game.events.emit('match:save', { team: defT });
      const speed = b.vel.length();
      if (speed < 21 && Math.abs(sh.zc - gk.pos.z) < 1.2) { b.owner = gk; b.shot = null; gk.decisionT = 2.2; gk.playAnim('catch', 1.4); b.lastTouch = defT; }
      else {
        // Desvío: al córner o rebote al frente
        const toCorner = Math.random() < 0.55;
        b.vel.set(-Math.sign(gx) * (toCorner ? -rand(2, 5) : rand(5, 10)), toCorner ? rand(5.5, 8) : rand(2, 6), Math.sign(b.pos.z || 1) * rand(3, 9)); if (toCorner) b.pos.y = Math.max(b.pos.y, 1.4);
        b.shot = null; b.lastTouch = defT; this.game.audio?.kick(b.pos, 14);
      }
      gk.noTouch = 0.5;
    }
    if (dxg > 3 && Math.sign(b.pos.x - gk.pos.x) === Math.sign(gx)) gk.diving = false;
  }
  // ---------- Balón fuera / gol ----------
  checkBall() {
    const b = this.ball;
    if (b.owner) { b.pos.x = clamp(b.pos.x, -HL - 0.05, HL + 0.05); b.pos.z = clamp(b.pos.z, -HW - 0.05, HW + 0.05); return; }
    if (b.inNet) { // Dentro de la red: frena
      b.vel.multiplyScalar(0.9); b.pos.x = clamp(b.pos.x, -HL - 1.9, HL + 1.9); b.pos.z = clamp(b.pos.z, -GOAL_HW + 0.2, GOAL_HW - 0.2); b.pos.y = Math.min(b.pos.y, 2.2); return;
    }
    if (this.phase !== 'play') return;
    if (Math.abs(b.pos.x) > HL) {
      const s = Math.sign(b.pos.x);
      if (Math.abs(b.pos.z) < GOAL_HW && b.pos.y < BAR) return this.goal(s);
      // Poste: rebote
      if (Math.abs(Math.abs(b.pos.z) - GOAL_HW) < 0.2 && b.pos.y < BAR) { b.vel.x *= -0.6; b.pos.x = s * (HL - 0.1); this.addFeed('¡Al poste!'); this.excite = 0.8; this.game.audio?.post(); return; }
      const attacking = this.dir(0) === s ? 0 : 1; // equipo que ataca esa portería
      if (b.lastTouch === attacking) this.setRestart('goalkick', 1 - attacking, new THREE.Vector3(s * (HL - 5.5), 0, Math.sign(b.pos.z || 1) * 5), 2.5);
      else { this.stats.corners[attacking]++; this.setRestart('corner', attacking, new THREE.Vector3(s * (HL - 0.3), 0, Math.sign(b.pos.z || 1) * (HW - 0.3)), 3); this.addFeed(`Tiro de esquina para ${this.teams[attacking].short}.`); }
      return;
    }
    if (Math.abs(b.pos.z) > HW) {
      const team = b.lastTouch === 0 ? 1 : 0;
      this.setRestart('throw', team, new THREE.Vector3(clamp(b.pos.x, -HL + 1, HL - 1), 0, Math.sign(b.pos.z) * (HW + 0.3)), 2);
    }
  }
  goal(side) {
    const b = this.ball; const team = this.dir(0) === side ? 0 : 1;
    this.score[team]++; b.inNet = true; b.shot = null;
    const scorer = this.all.filter((p) => p.team === team && !p.sentOff).sort((a, c) => (c.lock > 0 ? 1 : 0) - (a.lock > 0 ? 1 : 0) || a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos))[0];
    const shooter = this.events.slice().reverse().find((e) => e.type === 'remate' || e.type === 'penal')?.actors[0];
    const who = shooter && shooter.team === team ? shooter : scorer;
    this.goalScorers.push({ team, name: who.name, number: who.number, minute: Math.floor(this.minute) });
    this.logEvent('gol', [who, this.players[1 - team][0]], b.pos, { team });
    this.logEvent('celebracion', [who], who.pos, { team, peak: this.time + 3.5 });
    this.addFeed(`¡¡GOOOL de ${this.teams[team].short}!! ${who.name} (#${who.number}) · ${this.score[0]}-${this.score[1]}`);
    this.excite = 1.15; this.phase = 'goal'; this.phaseT = 0; this.celebrator = who; this.goalTeam = team;
    // Celebración hacia la esquina más cercana (donde están los fotógrafos)
    this.celebTarget = new THREE.Vector3(side * (HL - 2), 0, Math.sign(who.pos.z || 1) * (HW - 3));
    who.playAnim('celebrate', 6); who.mode = 'celebrating';
    this.game.events.emit('match:goal', { team, scorer: who, score: this.score.slice() });
    this.game.audio?.whistle(1);
  }
  updateGoal(dt) {
    const who = this.celebrator, side = Math.sign(this.celebTarget.x);
    for (const p of this.all) {
      if (p.sentOff) continue;
      if (p === who) {
        const d = p.moveToward(this.celebTarget.x, this.celebTarget.z, 6.5, dt, 6);
        if (d < 2 && p.anim !== 'kneeSlide' && p.h.idleVariant < 0.5) { p.playAnim('kneeSlide', 4); }
        if (d < 2) p.faceToward(this.celebTarget.x * 1.3, this.celebTarget.z * 1.3, dt);
        if (p.lock <= 0 && p.anim !== 'kneeSlide') { p.h.play('celebrate'); p.lock = 1; p.anim = 'celebrate'; }
      } else if (p.team === this.goalTeam && p.role !== 'GK') {
        const tgt = who.pos.clone().add(new THREE.Vector3(Math.cos(p.number) * 1.6, 0, Math.sin(p.number) * 1.6));
        const d = p.moveToward(tgt.x, tgt.z, 6, dt, 5);
        if (d < 3 && p.lock <= 0) { p.playAnim('celebrate', 2); }
      } else {
        const t = this.formationTarget(p, true); p.moveToward(t.x, t.z, 1.6, dt, 3);
        if (p.role === 'GK' && this.phaseT < 3 && p.lock <= 0 && p.mode !== 'fallen') { p.ragdoll(Math.random() - 0.5, -Math.sign(p.pos.x) * 0.5, 2.4); }
      }
    }
    this.excite = Math.max(this.excite, 0.9 - this.phaseT * 0.04);
    if (this.phaseT > 10) {
      for (const p of this.all) { if (p.mode === 'celebrating') p.mode = 'play'; p.lock = 0; p.h.play(p.role === 'GK' ? 'gkReady' : 'loco'); }
      this.ball.inNet = false; this.phase = 'walkout'; this.phaseT = 4; this.kickoffTeam = 1 - this.goalTeam;
    }
  }
  updateRestart(dt) {
    const r = this.restart, b = this.ball;
    r.t += dt;
    const sc = this.scuffle && this.updateScuffle(dt);
    if (sc) r.t = Math.min(r.t, 0.5);
    const busy = sc ? new Set([this.scuffle?.def, this.scuffle?.agg, ...(this.scuffle?.helpersA || []), ...(this.scuffle?.helpersB || [])]) : null;
    const tk = r.taker && !r.taker.sentOff ? r.taker : (r.taker = this.nearest(r.team, r.spot, null, r.type === 'goalkick'));
    const d = this.dir(r.team);
    // Posición del ejecutor detrás del balón
    let behind = new THREE.Vector3(-d, 0, 0);
    if (r.type === 'throw') behind.set(0, 0, Math.sign(r.spot.z) * 0.5);
    if (r.type === 'corner') behind.set(Math.sign(r.spot.x) * 0.6, 0, Math.sign(r.spot.z) * 0.6);
    const sp = r.spot.clone().addScaledVector(behind, r.type === 'throw' ? 0.1 : 0.7);
    for (const p of this.all) {
      if (p.sentOff) { if (p.mode === 'leaving') { const dd = p.moveToward(0, HW + 9, 2.2, dt); if (dd < 1.5) { p.mode = 'gone'; p.root.visible = false; p.pos.set(0, -50, 60); } } continue; }
      if (p.mode === 'fallen' || busy?.has(p)) continue;
      if (p === tk) { p.moveToward(sp.x, sp.z, 5, dt, 8); p.faceToward(r.type === 'throw' ? p.pos.x + d * 6 : r.type === 'corner' ? this.goalX(r.team) - d * 8 : this.goalX(r.team), 0, dt); continue; }
      let t;
      if (r.type === 'kickoff') t = this.formationTarget(p, true);
      else if (r.type === 'penalty') {
        if (p.role === 'GK' && p.team !== r.team) t = new THREE.Vector3(-this.goalX(r.team) * -1, 0, 0);
        else t = new THREE.Vector3(this.goalX(r.team) - d * rand(18, 22), 0, (p.number - 6) * 2.4);
        if (p.role === 'GK' && p.team !== r.team) t.set(this.goalX(r.team) - d * 0.3, 0, 0);
      } else if (r.type === 'corner' && p.role !== 'GK') {
        const inBox = p.team === r.team ? p.role !== 'DEF' || p.slot.fz < -0.3 : true;
        t = inBox ? new THREE.Vector3(this.goalX(r.team) - d * rand(4, 12), 0, ((p.number * 7) % 13 - 6) * 1.3) : this.formationTarget(p);
        if (!p.cornerSpot) p.cornerSpot = t; t = p.cornerSpot;
      } else t = this.formationTarget(p);
      p.moveToward(t.x, t.z, p.maxSpeed * 0.6, dt, 5);
      if (p.pos.distanceTo(t) < 1.5) p.faceToward(b.pos.x, b.pos.z, dt, 5);
      if (r.type === 'kickoff' || r.type === 'penalty') { // nadie dentro del círculo / área
        if (r.type === 'kickoff' && p.pos.length() < 9.2) { const n = p.pos.clone().normalize(); p.pos.copy(n.multiplyScalar(9.2)); }
      }
    }
    if (r.t < r.wait || tk.pos.distanceTo(sp) > 1.0) { if (r.t > r.wait + 8) tk.pos.copy(sp); return; }
    // Ejecutar
    for (const p of this.all) p.cornerSpot = null;
    this.phase = 'play'; this.lastRestartType = r.type; this.restart = null; b.dead = false; b.owner = tk; b.lastTouch = r.team;
    if (r.type === 'kickoff') {
      this.whistle(1);
      if (this.minute < 1 && this.half === 1) this.logEvent('saque', [tk], tk.pos, { team: r.team });
      const mate = this.active(r.team).filter((p) => p.role === 'MID').sort((a, c) => a.pos.length() - c.pos.length())[0];
      this.scheduleKick(tk, this.passVelocity(b.pos, mate.pos, false), 'pass', 0.2, { target: mate });
    } else if (r.type === 'corner') {
      this.whistle(1);
      const v = this.passVelocity(b.pos, new THREE.Vector3(this.goalX(r.team) - d * rand(5, 11), 0, rand(-5, 5)), true); v.y *= 1.1;
      this.scheduleKick(tk, v, 'corner', 0.25);
    } else if (r.type === 'penalty') {
      this.whistle(1); this.shoot(tk, false); tk.pendingKick.kind = 'penalty'; tk.pendingKick.t = 0.35;
    } else if (r.type === 'throw') {
      const mate = this.nearest(r.team, new THREE.Vector3(tk.pos.x + d * 6, 0, tk.pos.z * 0.8), tk, false);
      const v = this.passVelocity(new THREE.Vector3(b.pos.x, 2, b.pos.z), mate.pos, false).multiplyScalar(0.55); v.y = 3;
      b.pos.y = 2; this.scheduleKick(tk, v, 'throw', 0.45, { target: mate });
    } else if (r.type === 'goalkick') {
      const tgt = this.active(r.team).filter((p) => p.role !== 'GK').sort(() => Math.random() - 0.5)[0];
      this.scheduleKick(tk, this.passVelocity(b.pos, tgt.pos, true), 'pass', 0.3, { target: tgt });
    } else if (r.type === 'free') {
      const dist = Math.hypot(this.goalX(r.team) - b.pos.x, b.pos.z);
      if (dist < 28 && Math.random() < 0.55) this.shoot(tk, false); else this.pass(tk);
    }
  }
  updateBreak(dt) {
    // Medio tiempo: los jugadores caminan hacia el túnel y regresan
    const toTunnel = this.phaseT < 22;
    for (const p of this.all) {
      if (p.sentOff) continue;
      if (toTunnel) { p.moveToward(rand(-6, 6) * 0 + (p.team ? 4 : -4), HW + 6, 2.6, dt, 3); if (p.pos.z > HW + 4) p.root.visible = false; }
      else { p.root.visible = true; }
    }
    this.ball.place(0, 0);
    if (this.phaseT > 30) {
      this.half = 2; this.minute = 45; this.addedTime = Math.floor(rand(2, 6));
      for (const p of this.all) { if (!p.sentOff) { p.root.visible = true; p.pos.set(p.team ? 6 : -6, 0, HW + 1); } }
      this.phase = 'walkout'; this.phaseT = 0; this.kickoffTeam = 1 - (this.kickoffTeam ?? 0);
      this.addFeed('¡Arranca el segundo tiempo!'); this.game.events.emit('match:phase', 'second');
    }
  }
  updateFulltime(dt) {
    for (const p of this.all) { if (p.sentOff || p === this.interview?.mvp) continue; p.vel.multiplyScalar(0.92); if (p.lock <= 0 && p.anim === 'celebrate') p.playAnim('celebrate', 3); }
    if (this.phaseT > 4 && !this.interview) this.interview = new Interview(this);
    this.interview?.update(dt);
    if (this.phaseT > 12 && !this.ended) { this.ended = true; this.game.events.emit('match:end', { score: this.score.slice() }); }
  }
  updateOfficials(dt) {
    if (this.ref.cardT > 0) { this.ref.cardT -= dt; if (this.ref.cardT <= 0) this.ref.card.visible = false; }
    if (['tunnel', 'lineup', 'teamphoto', 'toss'].includes(this.phase)) return;
    const b = this.ball.pos;
    const r = this.ref;
    const sc = this.scuffle && this.scuffle.stage >= 1 ? this.scuffle.center : null;
    const tx = sc ? sc.x + 1.6 : clamp(b.x - Math.sign(b.x || 1) * 10, -HL + 10, HL - 10), tz = sc ? sc.z - 1.2 : clamp(b.z - 12, -HW + 4, HW - 4);
    const dx = tx - r.pos.x, dz = tz - r.pos.z, d = Math.hypot(dx, dz);
    const sp = this.phase === 'warmup' ? 0 : Math.min(sc ? 7 : 6, d * (sc ? 1.5 : 0.8));
    if (d > 0.3) { r.vel.set(dx / d * sp, 0, dz / d * sp); } else r.vel.set(0, 0, 0);
    r.pos.addScaledVector(r.vel, dt); r.yaw = dampAngle(r.yaw, Math.atan2(b.x - r.pos.x, b.z - r.pos.z), 5, dt);
    if (this.phase === 'warmup') { r.pos.set(0, 0, -HW - 2); }
    r.h.root.position.copy(r.pos); r.h.root.rotation.y = r.yaw; r.h.update(dt, r.vel.length());
    for (const a of this.ars) {
      const ax = clamp(b.x, a.side > 0 ? 0 : -HL, a.side > 0 ? HL : 0);
      const dd = ax - a.pos.x; a.vel.set(Math.sign(dd) * Math.min(5, Math.abs(dd)), 0, 0);
      a.pos.addScaledVector(a.vel, dt);
      a.yaw = dampAngle(a.yaw, a.side > 0 ? 0 : Math.PI, 5, dt);
      a.h.root.position.copy(a.pos); a.h.root.rotation.y = a.yaw; a.h.update(dt, a.vel.length());
    }
  }
  updateBench(dt) {
    for (const n of this.bench) {
      if (n.kind === 'coach') {
        const att = this.ball.owner && this.ball.owner.team === n.team;
        const st = this.phase === 'goal' && this.goalTeam === n.team ? 'cheer' : att && Math.abs(this.ball.pos.x) > 25 ? 'point' : 'talk';
        if (n.h.state !== st) n.h.play(st, 1, n.team ? -1 : 1);
        const tx = clamp(n.home.x + this.ball.pos.x * 0.06, n.home.x - 4, n.home.x + 4);
        n.pos.x += (tx - n.pos.x) * dt * 0.8; n.h.root.position.copy(n.pos);
        n.yaw = dampAngle(n.yaw, Math.atan2(this.ball.pos.x - n.pos.x, this.ball.pos.z - n.pos.z), 3, dt); n.h.root.rotation.y = n.yaw;
        n.h.update(dt, Math.abs(tx - n.pos.x));
      } else {
        const st = this.phase === 'goal' && this.goalTeam === n.team && this.phaseT < 6 ? 'cheer' : 'sit';
        if (n.h.state !== st) n.h.play(st);
        n.h.update(dt, 0);
      }
    }
  }
  // Sujetos fotografiables (para enfoque y evaluación).
  subjects() {
    const out = [];
    for (const p of this.all) if (!p.sentOff || p.mode === 'leaving') if (p.root.visible) out.push({ kind: 'player', ref: p, h: p.h, pos: p.pos, vel: p.vel, team: p.team, number: p.number, name: p.name, role: p.role, anim: p.anim, hasBall: this.ball.owner === p, teamName: p.teamData.name });
    for (const o of [this.ref, ...this.ars]) out.push({ kind: 'referee', ref: o, h: o.h, pos: o.pos, vel: o.vel, name: o.name, anim: o.h.state });
    for (const n of this.bench) if (n.kind === 'coach') out.push({ kind: 'coach', ref: n, h: n.h, pos: n.pos, vel: n.vel, team: n.team, name: n.name, anim: n.h.state });
    return out;
  }
  dynamicObjects() {
    // Objetos con velocidad (para el desenfoque de movimiento durante la exposición)
    const list = [];
    for (const p of this.all) if (p.root.visible) list.push({ obj: p.root, vel: p.vel });
    list.push({ obj: this.ball.mesh, vel: this.ball.vel });
    for (const o of [this.ref, ...this.ars]) list.push({ obj: o.h.root, vel: o.vel });
    return list;
  }
  dispose() {
    this.group.parent?.remove(this.group);
  }
}
function segDist(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}
