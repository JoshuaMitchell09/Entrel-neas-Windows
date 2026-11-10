import * as THREE from 'three';
import { Humanoid, SKIN_TONES, HAIR_COLORS } from '../characters/Humanoid.js';
import { pick, rand } from '../core/MathUtil.js';
import * as TX from '../gfx/Textures.js';

/*
 * Entrevista al jugador del partido (zona mixta junto al túnel): backing con patrocinadores,
 * periodistas con micrófono, camarógrafo de TV con trípode y luz. Subtítulos de preguntas y respuestas.
 */
const SCORE = { gol: 4, atajada: 2.5, remate: 0.8, regate: 0.6, entrada: 0.5, disputa: 0.4, pase: 0.08, falta: -0.7, amarilla: -1.5, expulsion: -6, trifulca: -1 };

export function pickMVP(m) {
  const pts = new Map();
  for (const e of m.events) { const s = SCORE[e.type]; const a = e.actors?.[0]; if (s && a && a.teamData) pts.set(a, (pts.get(a) || 0) + s); }
  const win = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1;
  for (const p of m.all) { if (p.sentOff) { pts.delete(p); continue; } if (p.team === win) pts.set(p, (pts.get(p) || 0) + 1.5); }
  let best = null, bs = -99; for (const [p, s] of pts) if (s > bs) { bs = s; best = p; }
  return best || m.players[win >= 0 ? win : 0].find((p) => p.role === 'FWD') || m.players[0][9];
}

function backingTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const x = c.getContext('2d');
  x.fillStyle = '#0b1f4d'; x.fillRect(0, 0, 1024, 640);
  const logos = [['ASCENSO TOTAL', '#f2c500'], ['LIGA TICA', '#ffffff'], ['CAFÉ ALTURA', '#f5d7a1'], ['TELECOM TUANIS', '#7fe3ee'], ['BANCO CEIBA', '#9bd17a'], ['REFRESCOS LA MONA', '#ff8a8a']];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) {
    const [t, col] = logos[(r * 2 + k) % logos.length]; x.fillStyle = col; x.font = `900 ${t.length > 12 ? 34 : 44}px Arial Black, Arial`;
    x.fillText(t, 128 + k * 256 + (r % 2) * 64 - 32, 55 + r * 106);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Interview {
  constructor(match) {
    const m = (this.m = match), g = (this.game = match.game);
    this.mvp = pickMVP(m); this.t = 0; this.line = -1; this.done = false;
    const P = m.stadium?.P, HW = P ? P.W / 2 : 34;
    this.spot = P && P.L < 100 ? new THREE.Vector3(4, 0, HW + (P.apron ?? 3) + 2.5) : new THREE.Vector3(6.5, 0, HW + 5.6);
    this.group = new THREE.Group(); m.scene.add(this.group);
    // Backing de patrocinadores
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.5), new THREE.MeshStandardMaterial({ map: backingTexture(), roughness: 0.6, side: THREE.DoubleSide }));
    back.position.set(this.spot.x, 1.35, this.spot.z + 1.1); back.rotation.y = Math.PI; this.group.add(back);
    const leg = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.7, 0.06), leg); p.position.set(this.spot.x + s * 2.2, 1.35, this.spot.z + 1.12); this.group.add(p); }
    // Periodistas con micrófono y camarógrafo de TV
    this.press = [];
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }));
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), new THREE.MeshStandardMaterial({ map: TX.signTexture('AT', '#0b3d91', '#f2c500', 64, 64, 'bold 40px Arial') }));
    const spots = [[-1.0, -1.5], [0.15, -1.75], [1.1, -1.45]];
    spots.forEach(([dx, dz], i) => {
      const h = new Humanoid({ skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS), shirt: pick(['#2b2b38', '#6d597a', '#f2f2f2', '#1d3557']), pants: '#2b2b38', boots: '#222', height: rand(1.6, 1.8), female: i === 1, lanyard: true });
      h.root.position.set(this.spot.x + dx, 0, this.spot.z + dz); h.root.rotation.y = Math.atan2(-dx * 0.3, 1.5);
      const mm = mic.clone(); mm.add(head.clone()).position.y = 0.11; mm.add(flag.clone()).position.y = 0.05; mm.position.set(0, -0.3, 0.06); mm.rotation.x = -1.2; h.arms[1].el.add(mm);
      h.play('mic'); this.group.add(h.root); this.press.push(h);
    });
    const op = new Humanoid({ skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS), shirt: '#111111', pants: '#2b2b2b', boots: '#222', height: 1.78, cap: '#111111' });
    op.root.position.set(this.spot.x - 0.3, 0, this.spot.z - 3.4); op.play('loco'); this.group.add(op.root); this.press.push(op);
    const cam = new THREE.Group(); cam.position.set(this.spot.x - 0.3, 0, this.spot.z - 3.0); this.group.add(cam);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })); body.position.y = 1.5; cam.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 14), new THREE.MeshStandardMaterial({ color: 0x0d0d0d })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.5, 0.36); cam.add(lens);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.45, 6), leg); l.position.set(Math.cos(a) * 0.22, 0.7, Math.sin(a) * 0.22); l.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18); cam.add(l); }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.6 })); panel.position.set(0.3, 1.85, 0.2); cam.add(panel);
    // Líneas de la entrevista
    const sc = `${m.teams[0].short} ${m.score[0]}-${m.score[1]} ${m.teams[1].short}`, my = m.teams[this.mvp.team], won = m.score[this.mvp.team] > m.score[1 - this.mvp.team], draw = m.score[0] === m.score[1];
    const goals = m.events.filter((e) => e.type === 'gol' && e.actors?.[0] === this.mvp).length, saves = m.events.filter((e) => e.type === 'atajada' && e.actors?.[0] === this.mvp).length;
    this.lines = [
      ['Periodista', `${this.mvp.name}, sos el jugador del partido. ${sc}. ¿Qué sensación te queda?`],
      [this.mvp.name, won ? 'Muy contento. El grupo trabajó toda la semana para esto y hoy se vio en la cancha.' : draw ? 'Sabor agridulce. Tuvimos para ganarlo, pero hay que valorar el punto.' : 'Duele perder, pero el equipo dejó todo. Hay que levantar la cabeza.'],
      ['Periodista', goals ? `Anotaste ${goals === 1 ? 'un gol' : goals + ' goles'}. ¿Cómo lo viviste?` : saves ? `Hiciste ${saves} atajadas clave. ¿Cómo te sentiste bajo los tres palos?` : '¿Qué te pidió el técnico para este partido?'],
      [this.mvp.name, goals ? 'Se lo dedico a mi familia y a la afición, que nunca deja de apoyar.' : saves ? 'Me tocó trabajar, pero para eso entreno. La defensa me ayudó mucho.' : 'Orden, intensidad y no perder la cabeza. Creo que cumplimos.'],
      ['Periodista', `Un mensaje para la afición de ${my.name}.`],
      [this.mvp.name, '¡Gracias por venir! Esto es por ustedes. ¡Pura vida y a seguir!'],
    ];
    m.logEvent('entrevista', [this.mvp], this.spot, { team: this.mvp.team, peak: m.time + 18 });
    m.addFeed(`Jugador del partido: ${this.mvp.name} (#${this.mvp.number}). Lo entrevistan en la zona mixta, junto al túnel.`);
    g.events.emit('match:interview', this);
  }
  update(dt) {
    const m = this.m, p = this.mvp, g = this.game; this.t += dt;
    // El jugador del partido camina a la zona mixta y se ubica frente al backing
    const d = p.moveToward(this.spot.x, this.spot.z, 4.2, dt, 6);
    if (d < 0.5) { p.vel.set(0, 0, 0); p.faceToward(this.spot.x, this.spot.z - 4, dt, 6); if (p.lock <= 0) p.playAnim('talk', 2); }
    for (const h of this.press) h.update(dt, 0);
    // Subtítulos (solo si el fotógrafo está cerca)
    if (d < 0.8) {
      this.lt = (this.lt || 0) + dt;
      if (this.lt > 5 || this.line < 0) {
        this.lt = 0; this.line++;
        if (this.line < this.lines.length) {
          const near = g.player.pos.distanceTo(this.spot) < 26 || g.drone?.active;
          const [who, text] = this.lines[this.line];
          if (near) g.ui.subtitle?.(who, text, 4.8);
          if (this.line % 2 === 1) m.logEvent('entrevista', [p], this.spot, { team: p.team });
        } else if (!this.done) { this.done = true; g.events.emit('match:interviewDone', this); }
      }
    }
  }
}
