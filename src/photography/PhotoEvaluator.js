import * as THREE from 'three';
import { clamp, gauss } from '../core/MathUtil.js';
import { SEE_THROUGH } from '../core/Collision.js';

/*
 * Evaluación de fotografías basada en parámetros reales del gameplay:
 *  - Nitidez: círculo de confusión en el sujeto + desenfoque de movimiento + trepidación (en píxeles).
 *  - Composición: encuadre del sujeto proyectado (tercios, aire, cortes, oclusión, balón, rival).
 *  - Momento: eventos del partido cercanos al instante de disparo con actores visibles.
 *  - Exposición: diferencia en pasos + luminancia medida en los píxeles del sujeto + ruido.
 *  - Distancia, originalidad y cumplimiento del encargo.
 */
const ACTION_ANIMS = { kick: 'Golpeo del balón', header: 'Cabezazo', dive: 'Estirada', slide: 'Barrida', celebrate: 'Celebración', kneeSlide: 'Celebración de rodillas', fallen: 'Jugador en el suelo', catch: 'Atajada en bloque', throw: 'Saque de banda', card: 'Tarjeta' };
export const WEIGHTS = { sharpness: 0.22, composition: 0.2, moment: 0.24, exposure: 0.12, distance: 0.08, originality: 0.06, assignment: 0.08 };
export const LABELS = { sharpness: 'Nitidez', composition: 'Composición', moment: 'Momento', exposure: 'Exposición', distance: 'Distancia', originality: 'Originalidad', assignment: 'Encargo' };

export function grade(score) {
  if (score >= 90) return { letter: 'A+', label: 'Fotografía destacada' };
  if (score >= 80) return { letter: 'A', label: 'Excelente' };
  if (score >= 70) return { letter: 'B', label: 'Muy buena' };
  if (score >= 55) return { letter: 'C', label: 'Publicable' };
  if (score >= 40) return { letter: 'D', label: 'Aceptable' };
  return { letter: 'E', label: 'Descartable' };
}
function rayCapsule(o, d, a, b, r) {
  // Distancia mínima entre el rayo y el segmento a-b; devuelve t del rayo si < r.
  const u = d, v = new THREE.Vector3().subVectors(b, a), w = new THREE.Vector3().subVectors(o, a);
  const A = u.dot(u), B = u.dot(v), C = v.dot(v), D = u.dot(w), E = v.dot(w), den = A * C - B * B;
  let sc = den > 1e-6 ? (B * E - C * D) / den : 0, tc = den > 1e-6 ? (A * E - B * D) / den : 0;
  tc = clamp(tc, 0, 1); sc = Math.max(0, (B * tc - D) / A);
  const p1 = o.clone().addScaledVector(u, sc), p2 = a.clone().addScaledVector(v, tc);
  return p1.distanceTo(p2) < r ? sc : Infinity;
}
export class PhotoEvaluator {
  constructor(game) { this.game = game; this.cam = new THREE.PerspectiveCamera(); }
  project(p) { const v = p.clone().project(this.cam); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: v.z, front: v.z < 1 && v.z > -1 }; }
  analyzeSubjects(shot) {
    const cam = this.cam;
    cam.fov = shot.vfov; cam.aspect = shot.W / shot.H; cam.near = 0.1; cam.far = 2000; cam.updateProjectionMatrix();
    cam.position.copy(shot.camPos); cam.quaternion.copy(shot.camQuat); cam.updateMatrixWorld(true);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(shot.camQuat);
    const out = [];
    for (const s of shot.subjects) {
      const toS = new THREE.Vector3().subVectors(s.pos, shot.camPos); toS.y += 1;
      const dist = toS.length();
      if (toS.dot(fwd) <= 0.5) continue;
      const kp = s.keypoints;
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, inside = 0;
      const pts = kp.map((p) => this.project(p));
      for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) inside++; }
      // Ancho mínimo del cuerpo
      const padX = (0.25 / dist) / (2 * Math.tan(THREE.MathUtils.degToRad(shot.vfov) / 2)) / cam.aspect;
      minX -= padX; maxX += padX; minY -= (maxY - minY) * 0.05;
      if (maxX < 0 || minX > 1 || maxY < 0 || minY > 1) continue;
      const bw = maxX - minX, bh = maxY - minY;
      const ix = Math.max(0, Math.min(1, maxX) - Math.max(0, minX)), iy = Math.max(0, Math.min(1, maxY) - Math.max(0, minY));
      const inFrac = (ix * iy) / Math.max(1e-6, bw * bh);
      // Oclusión: rayos hacia cabeza, pecho y cadera (geometría estática + otros jugadores)
      let vis = 0;
      for (const k of [kp[1], kp[2], kp[3]]) {
        const dir = new THREE.Vector3().subVectors(k, shot.camPos); const L = dir.length(); dir.normalize();
        let blocked = this.game.collision.raycast(shot.camPos.x, shot.camPos.y, shot.camPos.z, dir.x, dir.y, dir.z, L - 0.3, SEE_THROUGH) < L - 0.4;
        if (!blocked) for (const o of shot.subjects) {
          if (o === s) continue;
          const a = o.pos.clone().setY(0.2), b = o.pos.clone().setY(1.7);
          const t = rayCapsule(shot.camPos, dir, a, b, 0.22);
          if (t < L - 0.6) { blocked = true; break; }
        }
        if (!blocked) vis++;
      }
      const facing = new THREE.Vector3(Math.sin(s.yaw || 0), 0, Math.cos(s.yaw || 0));
      const toCam = new THREE.Vector3().subVectors(shot.camPos, s.pos).setY(0).normalize();
      // Dirección de movimiento/mirada proyectada en pantalla
      const ahead = this.project(s.pos.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(s.vel.lengthSq() > 1 ? s.vel.clone().normalize() : facing, 1.5));
      const center = this.project(s.pos.clone().add(new THREE.Vector3(0, 1, 0)));
      out.push({ s, dist, box: { x0: minX, y0: minY, x1: maxX, y1: maxY }, bw, bh, inFrac, visibility: vis / 3, headIn: pts[0].x >= 0 && pts[0].x <= 1 && pts[0].y >= 0 && pts[0].y <= 1,
        facingDot: facing.dot(toCam), cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, leadX: ahead.x - center.x, kpIn: inside / kp.length });
    }
    return out;
  }
  pickMain(list, shot) {
    let best = null, bs = -1;
    const recentActors = new Set();
    for (const e of shot.events) if (Math.abs(shot.matchTime - e.peak) < e.window) for (const a of e.actors) recentActors.add(a);
    for (const it of list) {
      const centr = 1 - Math.min(1, Math.hypot(it.cx - 0.5, it.cy - 0.5) * 1.4);
      let sc = Math.min(it.bh, 0.8) * (0.4 + centr) * (0.3 + it.visibility) * it.inFrac;
      if (it.s.hasBall) sc *= 1.6; if (recentActors.has(it.s.ref)) sc *= 1.8; if (it.s.kind === 'referee') sc *= 0.7;
      if (shot.afTargetRef && it.s.ref === shot.afTargetRef) sc *= 2.2;
      if (sc > bs) { bs = sc; best = it; }
    }
    return best;
  }
  evaluate(shot) {
    const subjects = this.analyzeSubjects(shot);
    if (shot.ballPos) { const p = this.project(shot.ballPos); shot.ballNdc = { x: p.x, y: p.y, in: p.front && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 }; }
    const main = this.pickMain(subjects, shot);
    const notes = { good: [], bad: [] };
    const H = shot.H, pxPerRad = H / THREE.MathUtils.degToRad(shot.vfov);
    // ---------- Nitidez ----------
    let sharp = 0, focusErr = 0, cocPx = 0, motionPx = 0, shakePx = shot.shakeAmp * pxPerRad;
    const subjDist = main ? main.dist : shot.centerDist;
    {
      const f = shot.focal, N = shot.aperture, s = Math.max(shot.focusDist * 1000, f * 1.01), d = Math.max(subjDist * 1000, f * 1.01);
      cocPx = Math.abs((f / N) * f * (d - s) / (d * (s - f))) / (24 / shot.crop) * H;
      focusErr = shot.focusDist - subjDist;
      if (main) {
        // Desplazamiento en pantalla del sujeto durante la exposición, considerando el paneo
        const a = this.project(main.s.pos.clone().setY(1.1));
        const camQ2 = shot.camQuat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-shot.angVel.y * shot.shutter, -shot.angVel.x * shot.shutter, 0, 'XYZ')));
        const saveQ = this.cam.quaternion.clone(); this.cam.quaternion.copy(camQ2); this.cam.updateMatrixWorld(true);
        const b = this.project(main.s.pos.clone().setY(1.1).addScaledVector(main.s.vel, shot.shutter));
        this.cam.quaternion.copy(saveQ); this.cam.updateMatrixWorld(true);
        motionPx = Math.hypot((b.x - a.x) * shot.W, (b.y - a.y) * H);
      }
      const blur = Math.sqrt(cocPx * cocPx + motionPx * motionPx + shakePx * shakePx) * (1000 / H);
      sharp = main ? 100 * Math.exp(-Math.max(0, blur - 1.3) / 5.5) : 30 * Math.exp(-Math.max(0, cocPx * 1000 / H - 1.3) / 5.5);
      const bN = (v) => v * 1000 / H;
      if (main) {
        if (bN(cocPx) > 3) notes.bad.push(focusErr > 0 ? `El foco quedó ${focusErr.toFixed(1)} m detrás de ${main.s.name}.` : `El foco quedó ${(-focusErr).toFixed(1)} m delante de ${main.s.name}.`);
        if (bN(motionPx) > 3) notes.bad.push(`A ${fmtS(shot.shutter)} el movimiento de ${main.s.name} quedó barrido. Subí la velocidad de obturación.`);
        if (bN(shakePx) > 3) notes.bad.push('Hay trepidación: con ese lente necesitás más velocidad, estabilización o monopié.');
        if (sharp > 88) notes.good.push(`${main.s.name} está perfectamente enfocado.`);
      }
    }
    // ---------- Exposición ----------
    let exposure;
    {
      const delta = shot.exposureDelta;
      let base = 100 - 24 * Math.pow(Math.abs(delta), 1.25);
      // Medición en los píxeles: luminancia media del sujeto y recorte de altas luces
      const m = measure(shot.pixels, shot.W, shot.H, main ? main.box : { x0: 0.35, y0: 0.35, x1: 0.65, y1: 0.65 });
      if (m.mean < 0.11) base -= 26; else if (m.mean < 0.2) base -= 12; else if (m.mean > 0.88) base -= 22; else if (m.mean > 0.78) base -= 10;
      if (main && m.mean < 0.2 && Math.abs(delta) <= 0.7) notes.bad.push(`${main.s.name} quedó oscuro (sombra o contraluz): compensá la exposición hacia +1.`);
      if (main && m.mean > 0.78 && Math.abs(delta) <= 0.7) notes.bad.push('El sujeto quedó demasiado claro: compensá la exposición hacia −1.');
      if (m.clipHi > 0.08) base -= m.clipHi * 80; if (m.clipLo > 0.25) base -= (m.clipLo - 0.25) * 60;
      const noisePen = Math.max(0, shot.noiseAmp - 0.03) * 300;
      base -= noisePen;
      exposure = clamp(base, 0, 100);
      if (Math.abs(delta) > 0.7) notes.bad.push(delta > 0 ? `Sobreexpuesta ${delta.toFixed(1)} pasos.` : `Subexpuesta ${(-delta).toFixed(1)} pasos.`);
      if (noisePen > 8) notes.bad.push(`ISO ${shot.iso} metió mucho ruido en esta cámara.`);
      if (Math.abs(shot.wbErrorMired) > 40) notes.bad.push('El balance de blancos tiñó la imagen.');
      exposure = clamp(exposure - clamp(Math.abs(shot.wbErrorMired) / 6, 0, 18), 0, 100);
      if (exposure > 88) notes.good.push('Exposición impecable.');
      shot.measured = m;
    }
    // ---------- Composición ----------
    const compData = main ? {
      box: main.box, headIn: main.headIn, visibility: main.visibility, facingDot: main.facingDot, leadX: main.leadX, kpIn: main.kpIn,
      ball: shot.ballNdc, others: subjects.filter((o) => o !== main && o.s.kind === 'player' && o.bh > main.bh * 0.45 && o.inFrac > 0.5).map((o) => ({ box: o.box, team: o.s.team })),
      mainTeam: main.s.team,
    } : null;
    const comp = composition(compData, { x0: 0, y0: 0, x1: 1, y1: 1 }, notes);
    // ---------- Distancia ----------
    const fill = main ? Math.min(main.bh, 1) : 0;
    const distance = main ? clamp(Math.pow(fill / 0.42, 0.7) * 100, 0, 100) : 0;
    if (main && fill < 0.12) notes.bad.push('El sujeto quedó muy pequeño en el cuadro: acercate o usá más focal.');
    // ---------- Momento ----------
    let moment = 10, momentType = null, momentLabel = 'Sin acción relevante';
    const visibleRefs = new Set(subjects.filter((o) => o.inFrac > 0.5 && o.visibility > 0.3 && o.bh > 0.05).map((o) => o.s.ref));
    for (const e of shot.events) {
      const dt = shot.matchTime - e.peak; if (Math.abs(dt) > e.window) continue;
      const actorsIn = e.actors.filter((a) => visibleRefs.has(a));
      if (e.type === 'calentamiento') { if (visibleRefs.size && shot.matchPhase === 'warmup') { if (34 > moment) { moment = 34; momentType = 'calentamiento'; momentLabel = 'Calentamiento'; } } continue; }
      if (!actorsIn.length && e.type !== 'gol') continue;
      if (e.type === 'gol' && !actorsIn.length && !(shot.ballNdc && shot.ballNdc.in)) continue;
      const timing = e.sigma > 50 ? 1 : gauss(dt, e.sigma);
      const isMain = main && actorsIn.includes(main.s.ref);
      const v = e.weight * (0.35 + 0.65 * timing) * (isMain ? 1 : 0.8) * (actorsIn.length >= 2 ? 1.05 : 1);
      if (v > moment) { moment = Math.min(100, v); momentType = e.type; momentLabel = e.label; shot.momentTiming = timing; shot.momentEvent = e; }
    }
    if (main && ACTION_ANIMS[main.s.anim] && moment < 55) { moment = 55; momentType = 'accion'; momentLabel = ACTION_ANIMS[main.s.anim]; }
    if (main && main.s.hasBall && moment < 45) { moment = 45; momentType = 'conduccion'; momentLabel = 'Jugador con balón'; }
    if (main && main.s.kind === 'coach' && shot.excite > 0.6 && moment < 60) { moment = 60; momentType = 'tecnico'; momentLabel = 'Reacción del técnico'; }
    if (!main && shot.crowdShot && shot.excite > 0.65) { moment = 66; momentType = 'publico'; momentLabel = 'Reacción del público'; }
    if (momentType && moment >= 75) notes.good.push(shot.momentTiming > 0.85 ? `Excelente anticipación: capturaste ${momentLabel.toLowerCase()} en el instante exacto.` : `Buen momento: ${momentLabel.toLowerCase()}.`);
    else if (momentType && shot.momentTiming !== undefined && shot.momentTiming < 0.5 && moment > 40) notes.bad.push(`Llegaste tarde al momento clave (${momentLabel.toLowerCase()}).`);
    else if (moment < 30 && main) notes.bad.push('No hay una acción deportiva clara en la imagen.');
    // ---------- Originalidad ----------
    let orig = 40; const origNotes = [];
    if (shot.crouch) { orig += 14; origNotes.push('ángulo bajo'); }
    const panPx = Math.hypot(shot.angVel.x, shot.angVel.y) * shot.shutter * pxPerRad * (1000 / H);
    if (panPx > 7 && motionPx * 1000 / H < 3.5 && main) { orig += 22; origNotes.push('paneo logrado'); notes.good.push('¡Paneo logrado! El fondo barrido transmite velocidad.'); }
    if (shot.backlight) { orig += 12; origNotes.push('contraluz'); }
    if (shot.weather === 'rain') { orig += 10; origNotes.push('lluvia'); }
    if (shot.focalEff >= 500 && fill > 0.5) { orig += 10; origNotes.push('primer plano con teleobjetivo'); }
    if (shot.focalEff <= 40 && main && fill > 0.25) { orig += 12; origNotes.push('gran angular cercano'); }
    if (!shot.inPressZone && shot.inStadium) { orig += 6; origNotes.push('perspectiva poco común'); }
    if (momentType === 'publico' || momentType === 'tecnico') orig += 15;
    const similar = shot.prevMetas.filter((m) => m.momentType === momentType && m.eventId === shot.momentEvent?.id).length;
    if (similar > 2) orig -= Math.min(25, (similar - 2) * 6);
    orig = clamp(orig, 0, 100);
    // ---------- Encargo ----------
    const tags = [];
    if (momentType) tags.push(momentType);
    if (shot.matchPhase === 'warmup' && visibleRefs.size) tags.push('calentamiento');
    if (main?.s.role === 'GK') tags.push('portero');
    if (main?.s.kind === 'player') tags.push('jugador');
    let assignment = 50;
    if (shot.assignment) {
      const want = shot.assignment.tags || [];
      assignment = want.some((t) => tags.includes(t)) ? 100 : want.length ? 25 : 60;
    }
    // ---------- Total ----------
    const parts = { sharpness: sharp, composition: comp.score, moment, exposure, distance, originality: orig, assignment };
    let total = 0; for (const k in WEIGHTS) total += parts[k] * WEIGHTS[k];
    if (sharp < 40) total = Math.min(total, sharp + 25);
    if (!main && momentType !== 'publico') total = Math.min(total, 28);
    total = Math.round(clamp(total, 0, 100));
    if (total >= 85 && comp.score >= 72 && moment >= 75 && fill >= 0.3) tags.push('portada');
    const g = grade(total);
    const value = Math.round(total * total * 9 * (shot.eventMultiplier || 1) / 100) * 100;
    const comments = buildComments(total, parts, notes);
    return {
      score: total, grade: g.letter, label: g.label, parts, comments, tags, value,
      subject: main ? { name: main.s.name, number: main.s.number, team: main.s.teamName || '', kind: main.s.kind, role: main.s.role } : null,
      moment: { type: momentType, label: momentLabel },
      tech: { cocPx: +cocPx.toFixed(1), motionPx: +motionPx.toFixed(1), shakePx: +shakePx.toFixed(1), focusErr: +focusErr.toFixed(2), subjDist: +(subjDist || 0).toFixed(1), fill: +fill.toFixed(2), panPx: +panPx.toFixed(1), exposureDelta: +shot.exposureDelta.toFixed(2), measuredMean: +shot.measured.mean.toFixed(2) },
      compData, origNotes,
    };
  }
}
function fmtS(s) { return `1/${Math.round(1 / s)}`; }
function measure(px, W, H, box) {
  const x0 = Math.floor(clamp(box.x0, 0, 1) * W), x1 = Math.ceil(clamp(box.x1, 0, 1) * W), y0 = Math.floor(clamp(box.y0, 0, 1) * H), y1 = Math.ceil(clamp(box.y1, 0, 1) * H);
  let sum = 0, n = 0;
  const step = Math.max(1, Math.floor((x1 - x0) * (y1 - y0) / 6000));
  for (let y = y0; y < y1; y += Math.max(1, Math.floor(Math.sqrt(step)))) for (let x = x0; x < x1; x += Math.max(1, Math.floor(Math.sqrt(step)))) {
    const i = (y * W + x) * 4; sum += (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255; n++;
  }
  let hi = 0, lo = 0, m = 0;
  for (let i = 0; i < px.length; i += 4 * 37) { const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114); if (l > 250) hi++; if (l < 6) lo++; m++; }
  return { mean: n ? sum / n : 0.5, clipHi: hi / m, clipLo: lo / m };
}
// Composición evaluada sobre un marco (normalmente la imagen completa; con recorte, el rectángulo recortado).
export function composition(cd, frame, notes = { good: [], bad: [] }) {
  if (!cd) { notes.bad.push('No hay un sujeto principal claro.'); return { score: 20 }; }
  const fw = frame.x1 - frame.x0, fh = frame.y1 - frame.y0;
  const tr = (b) => ({ x0: (b.x0 - frame.x0) / fw, x1: (b.x1 - frame.x0) / fw, y0: (b.y0 - frame.y0) / fh, y1: (b.y1 - frame.y0) / fh });
  const b = tr(cd.box), bh = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  let s = 70;
  // Tamaño en el cuadro
  if (bh < 0.1) s -= 25; else if (bh < 0.22) s -= 10; else if (bh <= 0.85) s += 8; else s -= 5;
  // Cortes
  const cutL = Math.max(0, -b.x0), cutR = Math.max(0, b.x1 - 1), cutT = Math.max(0, -b.y0), cutB = Math.max(0, b.y1 - 1);
  const cut = (cutL + cutR) / Math.max(0.01, b.x1 - b.x0) + (cutT + cutB) / Math.max(0.01, bh);
  if (cutT > 0.02 * bh) { s -= 25; notes.bad.push('Le cortaste la cabeza al jugador.'); }
  else if (cut > 0.15) { s -= Math.min(25, cut * 40); notes.bad.push('El sujeto quedó cortado en el borde.'); }
  // Tercios
  const thirds = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
  const dT = Math.min(...thirds.map(([x, y]) => Math.hypot(cx - x, cy - y)));
  const dC = Math.hypot(cx - 0.5, cy - 0.5);
  if (dT < 0.08) s += 10; else if (dC < 0.1) s += 4; else if (dC > 0.38) s -= 15;
  // Aire en la dirección del movimiento
  if (Math.abs(cd.leadX) > 0.01) {
    const room = cd.leadX > 0 ? 1 - cx : cx;
    if (room > 0.55) s += 7; else if (room < 0.3) { s -= 8; notes.bad.push('Falta aire hacia donde se mueve el jugador.'); }
  }
  // Rostro
  if (cd.facingDot > 0.25) s += 6; else if (cd.facingDot < -0.55) { s -= 12; notes.bad.push('El jugador está de espaldas a la cámara.'); }
  // Oclusión
  if (cd.visibility < 0.67) { s -= 18; notes.bad.push('Otro jugador u objeto tapa al protagonista.'); }
  // Balón y duelo
  if (cd.ball && cd.ball.in) {
    const bx = (cd.ball.x - frame.x0) / fw, by = (cd.ball.y - frame.y0) / fh;
    if (bx > 0 && bx < 1 && by > 0 && by < 1) { const near = Math.hypot(bx - cx, by - cy) < Math.max(0.25, bh * 1.2); if (near) { s += 10; notes.good.push('El balón está en cuadro, cerca de la acción.'); } }
  }
  const rivals = cd.others.filter((o) => o.team !== cd.mainTeam).map((o) => tr(o.box)).filter((o) => o.x1 > 0 && o.x0 < 1 && o.y1 > 0 && o.y0 < 1);
  if (rivals.length) { s += 8; if (rivals.length === 1) notes.good.push('El duelo con el rival le da contexto a la imagen.'); }
  if (cd.others.length > 4) s -= 6;
  const score = clamp(s, 0, 100);
  if (score > 85) notes.good.push('Composición limpia y bien equilibrada.');
  return { score };
}
function buildComments(total, parts, notes) {
  const out = [];
  if (total >= 90) out.push('Fotografía destacada: candidata a portada.');
  else if (total >= 80) out.push('Imagen de nivel profesional.');
  else if (total >= 55) out.push('Imagen publicable, con aspectos a mejorar.');
  else if (total >= 40) out.push('Aceptable para la galería web, no para impresión.');
  else out.push('El editor no la usaría.');
  out.push(...notes.good.slice(0, 2));
  out.push(...notes.bad.slice(0, total >= 80 ? 1 : 3));
  return out;
}
