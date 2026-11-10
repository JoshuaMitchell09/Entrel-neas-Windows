import { clamp } from '../core/MathUtil.js';
import { TIERS, tierOf, MAIL_CONTACTS, MAIL_BY_TIER, CHAPTERS } from './Tiers.js';

// Calendario de eventos de la carrera. Cada evento define estadio, clima, hora y el encargo del editor.
export const EVENTS = [
  { id: 'ev1', title: 'Jornada 3', home: 'tibas', away: 'cafetal', stadium: 'cueva', time: 'day', weather: 'clear', minRep: 0, mult: 1, intro: true, kickoff: 15 * 60,
    assignment: { title: 'Primera cobertura', desc: 'Fotos del calentamiento y de las acciones principales del partido.', tags: ['calentamiento', 'remate', 'gol', 'atajada', 'disputa', 'entrada', 'regate', 'celebracion'] },
    missions: ['m_calentamiento', 'm_entrega'] },
  { id: 'ev2', title: 'Jornada 4', home: 'tibas', away: 'pumas', stadium: 'cueva', time: 'sunset', weather: 'clear', minRep: 4, mult: 1.15, kickoff: 17 * 60 + 30,
    assignment: { title: 'El gol', desc: 'El editor necesita la foto del gol del partido.', tags: ['gol', 'celebracion'] }, missions: ['m_gol', 'm_celebracion'] },
  { id: 'ev7', title: 'Jornada 5', home: 'toros', away: 'caribe', stadium: 'alajuela', time: 'sunset', weather: 'clear', minRep: 10, mult: 1.25, kickoff: 17 * 60 + 30,
    assignment: { title: 'La pasión rojinegra', desc: 'El editor quiere ambiente: celebración y reacción del público.', tags: ['celebracion', 'publico', 'gol'] }, missions: ['m_celebracion'] },
  { id: 'ev8', title: 'Jornada 7', home: 'brumas', away: 'pumas', stadium: 'cartago', time: 'cycle', weather: 'cloudy', minRep: 22, mult: 1.4, kickoff: 17 * 60 + 5,
    assignment: { title: 'Bajo la neblina', desc: 'Remates y atajadas mientras cae la noche en la Vieja Metrópoli.', tags: ['remate', 'atajada', 'disputa'] }, missions: ['m_portero'] },
  { id: 'ev3', title: 'Jornada 6', home: 'montana', away: 'brumas', stadium: 'irazu', time: 'night', weather: 'clear', minRep: 18, mult: 1.35, kickoff: 20 * 60,
    assignment: { title: 'El guardameta', desc: 'Una galería de los porteros: atajadas y reflejos.', tags: ['atajada', 'portero'] }, missions: ['m_portero'] },
  { id: 'ev4', title: 'Jornada 8', home: 'cafetal', away: 'caribe', stadium: 'irazu', time: 'night', weather: 'rain', minRep: 32, mult: 1.5, kickoff: 19 * 60,
    assignment: { title: 'Fútbol bajo la lluvia', desc: 'Acción intensa con el agua como protagonista.', tags: ['entrada', 'disputa', 'remate', 'celebracion'] }, missions: ['m_celebracion', 'm_lluvia'] },
  { id: 'ev5', title: 'EL CLÁSICO', home: 'tibas', away: 'toros', stadium: 'cueva', time: 'night', weather: 'cloudy', minRep: 48, mult: 2, kickoff: 20 * 60, clasico: true,
    assignment: { title: 'El clásico', desc: 'Diez imágenes de calidad superior a 80.', tags: ['gol', 'celebracion', 'disputa', 'remate', 'atajada', 'expulsion', 'publico'] }, missions: ['m_clasico', 'm_portada'] },
  { id: 'ev6', title: 'GRAN FINAL', home: 'tibas', away: 'brumas', stadium: 'cueva', time: 'night', weather: 'clear', minRep: 68, mult: 2.6, kickoff: 20 * 60, final: true,
    assignment: { title: 'La portada de la final', desc: 'La imagen que abrirá la edición impresa.', tags: ['gol', 'celebracion', 'final', 'atajada'] }, missions: ['m_portada', 'm_final'] },
];
// Copa Centroamericana (competencia ficticia): acreditación especial de la organización
EVENTS.push(
  { id: 'cup1', title: 'COPA CENTROAMERICANA · Grupos', cup: true, home: 'tibas', away: 'lempira', stadium: 'cueva', time: 'night', weather: 'clear', minRep: 14, mult: 1.6, kickoff: 20 * 60,
    assignment: { title: 'Noche internacional', desc: 'Ambiente de copa: la afición, los goles y el rival visitante.', tags: ['gol', 'celebracion', 'publico', 'disputa'] }, missions: ['m_celebracion'] },
  { id: 'cup2', title: 'COPA CENTROAMERICANA · Cuartos', cup: true, home: 'toros', away: 'canal', stadium: 'alajuela', time: 'night', weather: 'cloudy', minRep: 28, mult: 1.9, kickoff: 20 * 60,
    assignment: { title: 'Eliminación directa', desc: 'Tensión de cuartos de final: duelos, atajadas y la reacción del banco.', tags: ['disputa', 'atajada', 'remate', 'celebracion'] }, missions: ['m_portero'] },
  { id: 'cup3', title: 'COPA CENTROAMERICANA · Semifinal', cup: true, home: 'brumas', away: 'quetzal', stadium: 'cartago', time: 'cycle', weather: 'cloudy', minRep: 42, mult: 2.2, kickoff: 17 * 60 + 5,
    assignment: { title: 'Semifinal bajo la neblina', desc: 'La semifinal en la Vieja Metrópoli: la historia del partido en diez fotos.', tags: ['gol', 'remate', 'atajada', 'celebracion', 'disputa'] }, missions: ['m_gol'] },
  { id: 'cup4', title: 'COPA CENTROAMERICANA · FINAL', cup: true, final: true, home: 'tibas', away: 'izalco', stadium: 'cueva', time: 'night', weather: 'clear', minRep: 60, mult: 3, kickoff: 20 * 60,
    assignment: { title: 'Campeones de Centroamérica', desc: 'La foto del campeón: el gol, la celebración y el trofeo.', tags: ['gol', 'celebracion', 'final', 'publico'] }, missions: ['m_final', 'm_portada'] },
);
// Segunda División: todos los partidos en el Estadio El Llano. Pagan menos pero no piden reputación.
EVENTS.push(
  { id: 'seg1', title: 'SEGUNDA DIVISIÓN · Fecha 1', league: 'segunda', home: 'llanero', away: 'moravia', stadium: 'llano', time: 'day', weather: 'clear', minRep: 0, mult: 0.55, kickoff: 11 * 60,
    assignment: { title: 'Fútbol de barrio', desc: 'El partido de la Segunda: goles, duelos y la gente en la gradería techada.', tags: ['gol', 'disputa', 'celebracion', 'publico'] }, missions: [] },
  { id: 'seg2', title: 'SEGUNDA DIVISIÓN · Fecha 4', league: 'segunda', home: 'llanero', away: 'cerro', stadium: 'llano', time: 'sunset', weather: 'cloudy', minRep: 3, mult: 0.65, kickoff: 16 * 60 + 30,
    assignment: { title: 'Duelo de vecinos', desc: 'Entradas fuertes y remates en la sintética.', tags: ['entrada', 'disputa', 'remate', 'gol'] }, missions: [] },
  { id: 'seg3', title: 'SEGUNDA DIVISIÓN · Fecha 9', league: 'segunda', home: 'aserri', away: 'puriscal', stadium: 'llano', time: 'night', weather: 'clear', minRep: 8, mult: 0.75, kickoff: 19 * 60 + 30,
    assignment: { title: 'Noche en El Llano', desc: 'Con los postes de luz: la acción y los porteros.', tags: ['atajada', 'remate', 'gol', 'celebracion'] }, missions: ['m_portero'] },
  { id: 'seg4', title: 'SEGUNDA DIVISIÓN · Final por el ascenso', league: 'segunda', final: true, home: 'llanero', away: 'aserri', stadium: 'llano', time: 'night', weather: 'cloudy', minRep: 15, mult: 1.1, kickoff: 20 * 60,
    assignment: { title: '¡Ascenso!', desc: 'La final por el ascenso a Primera: el gol, la celebración y la afición.', tags: ['gol', 'celebracion', 'publico', 'final'] }, missions: ['m_celebracion'] },
);
// Ligas menores: canchas de los complejos de entrenamiento
EVENTS.push(
  { id: 'men1', title: 'LIGAS MENORES · U-17', league: 'menores', youth: true, home: 'tibas_u17', away: 'toros_u17', stadium: 'cantera', time: 'day', weather: 'clear', minRep: 0, mult: 0.45, kickoff: 9 * 60 + 30,
    assignment: { title: 'Las futuras estrellas', desc: 'Retratá a los talentos de la U-17: regates, remates y la celebración.', tags: ['regate', 'remate', 'gol', 'celebracion'] }, missions: [] },
  { id: 'men2', title: 'LIGAS MENORES · U-17', league: 'menores', youth: true, home: 'toros_u17', away: 'brumas_u17', stadium: 'car', time: 'day', weather: 'cloudy', minRep: 2, mult: 0.5, kickoff: 10 * 60,
    assignment: { title: 'Semillero rojinegro', desc: 'El torneo juvenil en el centro de alto rendimiento: duelos y atajadas.', tags: ['disputa', 'atajada', 'remate', 'gol'] }, missions: [] },
  { id: 'men3', title: 'LIGAS MENORES · U-15', league: 'menores', youth: true, home: 'tibas_u15', away: 'cafetal_u15', stadium: 'cantera', time: 'sunset', weather: 'clear', minRep: 5, mult: 0.55, kickoff: 15 * 60 + 30,
    assignment: { title: 'La cantera', desc: 'Los más chicos: alegría, garra y el gol del partido.', tags: ['gol', 'celebracion', 'regate', 'entrada'] }, missions: [] },
  { id: 'men4', title: 'LIGAS MENORES · Final U-15', league: 'menores', youth: true, final: true, home: 'toros_u15', away: 'tibas_u15', stadium: 'car', time: 'night', weather: 'clear', minRep: 10, mult: 0.7, kickoff: 18 * 60 + 30,
    assignment: { title: 'Campeones juveniles', desc: 'La final del torneo juvenil: el gol y el festejo del campeón.', tags: ['gol', 'celebracion', 'final'] }, missions: [] },
);
// Mejengas con los amigos (capítulo 1): fut 7 y fut 5 del barrio
EVENTS.unshift(
  { id: 'am1', title: 'MEJENGA · Jueves de fut 7', league: 'amigos', intro: true, home: 'compas', away: 'esquina', stadium: 'fut7', time: 'night', weather: 'clear', minRep: 0, mult: 0.2, kickoff: 19 * 60 + 30,
    assignment: { title: 'Las fotos del equipo', desc: 'Diego quiere fotos de Los Compas: goles, jugadas y la celebración.', tags: ['gol', 'celebracion', 'regate', 'remate'] }, missions: ['m_calentamiento', 'm_entrega'] },
  { id: 'am2', title: 'MEJENGA · Fut 5 techado', league: 'amigos', home: 'veteranos', away: 'compas', stadium: 'fut5', time: 'night', weather: 'rain', minRep: 0, mult: 0.2, kickoff: 20 * 60,
    assignment: { title: 'Cinco contra cinco', desc: 'Mucha velocidad en poco espacio: remates y atajadas.', tags: ['remate', 'atajada', 'gol', 'disputa'] }, missions: [] },
  { id: 'am3', title: 'MEJENGA · Torneo relámpago', league: 'amigos', home: 'compas', away: 'relampago', stadium: 'fut7', time: 'day', weather: 'clear', minRep: 0, mult: 0.25, kickoff: 10 * 60,
    assignment: { title: 'Semifinal del relámpago', desc: 'Diego llega a semis: la jugada del partido y la reacción del equipo.', tags: ['gol', 'celebracion', 'entrada', 'regate'] }, missions: [] },
  { id: 'am4', title: 'MEJENGA · La final del barrio', league: 'amigos', home: 'compas', away: 'oficina', stadium: 'fut5', time: 'sunset', weather: 'cloudy', minRep: 0, mult: 0.3, kickoff: 17 * 60,
    assignment: { title: 'La copa del barrio', desc: 'La final de los compas: el gol y la foto con el trofeo.', tags: ['gol', 'celebracion', 'final'] }, missions: [] },
);
// La Selección Nacional en el Estadio Nacional (capítulo 6)
EVENTS.push(
  { id: 'sel1', title: 'SELECCIÓN · Amistoso internacional', league: 'seleccion', home: 'cr', away: 'gua', stadium: 'nacional', time: 'night', weather: 'clear', minRep: 0, mult: 2.4, kickoff: 20 * 60,
    assignment: { title: 'Debut con la Sele', desc: 'El himno, la afición en el Nacional y las jugadas de la Selección.', tags: ['publico', 'gol', 'celebracion', 'disputa'] }, missions: ['m_celebracion'] },
  { id: 'sel2', title: 'SELECCIÓN · Eliminatoria', league: 'seleccion', home: 'cr', away: 'hon', stadium: 'nacional', time: 'night', weather: 'rain', minRep: 0, mult: 2.8, kickoff: 20 * 60,
    assignment: { title: 'Noche de eliminatoria', desc: 'Partido trabado bajo la lluvia: duelos, atajadas y el gol que vale oro.', tags: ['disputa', 'atajada', 'gol', 'entrada'] }, missions: ['m_portero', 'm_lluvia'] },
  { id: 'sel3', title: 'SELECCIÓN · Eliminatoria', league: 'seleccion', home: 'cr', away: 'jam', stadium: 'nacional', time: 'sunset', weather: 'clear', minRep: 0, mult: 3, kickoff: 18 * 60,
    assignment: { title: 'La Sele en casa', desc: 'Atardecer en La Sabana: la historia del partido en diez fotos.', tags: ['gol', 'remate', 'celebracion', 'publico'] }, missions: ['m_gol'] },
  { id: 'sel4', title: 'SELECCIÓN · Noche de clasificación', league: 'seleccion', final: true, home: 'cr', away: 'pan', stadium: 'nacional', time: 'night', weather: 'clear', minRep: 0, mult: 3.6, kickoff: 20 * 60,
    assignment: { title: '¡Al Mundial!', desc: 'La foto que va a abrir todos los periódicos: el gol, la celebración y el país entero.', tags: ['gol', 'celebracion', 'final', 'publico'] }, missions: ['m_final', 'm_portada'] },
);
export const LEAGUES = { amigos: 'Mejengas', primera: 'Primera División', segunda: 'Segunda División', menores: 'Ligas menores', cup: 'Copa Centroamericana', seleccion: 'Selección Nacional' };
export const TITLES = [[0, 'Fotógrafo amateur'], [12, 'Colaborador'], [30, 'Fotógrafo de planta'], [50, 'Fotógrafo destacado'], [70, 'Referente nacional'], [90, 'Leyenda de la Liga']];
export const CONTRACTS = [
  { id: 'freelance', name: 'Colaborador · Ascenso Total', minRep: 0, payMult: 1, desc: 'Pago por foto entregada.' },
  { id: 'staff', name: 'Planta · Ascenso Total', minRep: 38, payMult: 1.35, desc: 'Contrato fijo: +35 % por foto y acceso a clásicos.' },
  { id: 'agency', name: 'Agencia Centroamericana de Imágenes', minRep: 62, payMult: 1.7, desc: 'Distribución internacional: +70 % por foto.' },
];

export class Career {
  constructor(game) { this.game = game; this.reset(); }
  reset() {
    this.money = 25000; this.reputation = 0; this.completed = []; this.contract = 'freelance'; this.event = null; this.sessionId = null;
    this.stats = { photos: 0, delivered: 0, best: 0, goals: 0, saves: 0, events: 0, earned: 0, infractions: 0, covers: 0 };
    this.history = []; this.day = 1; this.offersSeen = [];
    // Modo historia: etapa actual, correos y capítulos
    this.tier = 0; this.flags = {}; this.mail = { contacts: [], sent: [], inbox: [] }; this.pendingChapter = 1; this.chaptersSeen = [];
  }
  get tierInfo() { return TIERS[this.tier] || TIERS[3]; }
  doneInTier(i) { return this.completed.filter((id) => { const e = EVENTS.find((x) => x.id === id); return e && tierOf(e) === i; }).length; }
  // Avance de la historia: habilita contactos de correo, mensajes de los personajes y la Copa (automática)
  checkProgress() {
    const g = this.game, ph = g.phone, out = [];
    const unlockMail = (id, from, text) => { if (this.mail.contacts.includes(id)) return; this.mail.contacts.push(id); this.flags.mailApp = true; if (from) ph?.receive(from, text); out.push(id); };
    if (this.tier === 0 && this.doneInTier(0) >= 2) unlockMail('menores', 'diego', 'Maeee 🔥 el profe Andrés, el de las ligas menores del Tibás, vio tus fotos en Lente y preguntó por vos. Te paso el correo: ligasmenores@deportivotibas.cr. ¡Escribile desde el Correo del cel!');
    if (this.tier === 1 && this.doneInTier(1) >= 2) unlockMail('llano', 'kendall', 'Le enseñé sus fotos de los juveniles a Karla Méndez, la de prensa de Atlético El Llano. Andan buscando fotógrafo para la Segunda. Escríbale: prensa@atleticoelllano.cr');
    if (this.tier === 2 && this.doneInTier(2) >= 2) unlockMail('ascenso', 'kendall', 'Ricardo Solano, el editor de Ascenso Total, me preguntó quién tomaba las fotos de El Llano. Le di su nombre. Escríbale a redaccion@ascensototal.cr, no se le duerma.');
    if (this.tier === 3 && this.doneInTier(3) >= 3 && this.reputation >= 30) { this.tier = 4; this.pendingChapter = 5; ph?.receive('editor', 'Ricardo: te inscribí para cubrir la Copa Centroamericana. Acreditación internacional, rivales de toda la región. Revisá la redacción.'); }
    if (this.tier === 4 && this.doneInTier(4) >= 1) unlockMail('sele', 'editor', 'Ricardo: la Selección abre acreditaciones para la eliminatoria. Escribile a Lucía Brenes (prensa@seleccion.cr). Con lo que has hecho en la copa, tenés chance.');
    return out;
  }
  canWrite(id) { return this.mail.contacts.includes(id) && !this.mail.sent.some((m) => m.id === id && (m.status === 'pending' || m.status === 'yes')); }
  sendMail(id) {
    if (!this.canWrite(id)) return false;
    this.mail.sent.push({ id, at: Date.now(), events: this.stats.events, status: 'pending', day: this.day });
    return true;
  }
  // Las respuestas llegan al terminar otra cobertura o después de un rato (en tiempo real)
  mailTick() {
    const now = Date.now(), res = [];
    for (const m of this.mail.sent) {
      if (m.status !== 'pending') continue;
      if (!(this.stats.events > m.events || now - m.at > 50000)) continue;
      const C = MAIL_CONTACTS[m.id], need = C.unlocks === 5 ? 4 : C.unlocks - 1;
      const ok = this.reputation >= C.minRep && this.doneInTier(need) >= C.minEvents;
      m.status = ok ? 'yes' : 'no';
      const name = this.game.playerName || 'Fotógrafo';
      this.mail.inbox.unshift({ from: m.id, subject: 'RE: ' + C.subject, text: (ok ? C.yes : C.no).replaceAll('{name}', name), at: now, read: false, ok });
      if (ok && this.tier < C.unlocks) { this.tier = C.unlocks; this.pendingChapter = C.unlocks + 1; }
      res.push({ id: m.id, ok });
    }
    return res;
  }
  get unreadMail() { return this.mail.inbox.filter((x) => !x.read).length; }
  get title() { let t = TITLES[0][1]; for (const [r, n] of TITLES) if (this.reputation >= r) t = n; return t; }
  get payMult() { return CONTRACTS.find((c) => c.id === this.contract)?.payMult || 1; }
  available() {
    return EVENTS.map((e) => { const t = tierOf(e); return { ...e, tierIdx: t, done: this.completed.includes(e.id), tierLocked: t > this.tier, locked: t > this.tier || this.reputation < e.minRep || (e.clasico && this.contract === 'freelance' && this.reputation < 55) }; });
  }
  nextEvent() { return this.available().find((e) => !e.done && !e.locked) || null; }
  unlockedStadiums() { const s = new Set(['palmas']); for (const e of this.available()) if (!e.locked) s.add(e.stadium); return [...s]; }
  startEvent(ev) {
    this.event = ev; this.sessionId = `${ev.id}_${Date.now()}`;
    this.eventState = { arrivedOnTime: true, infractions: 0, expelled: false, kickoffSeen: false, startedAt: Date.now() };
  }
  currentAssignment() { return this.event?.assignment || null; }
  currentEventName() { return this.event ? `${this.event.title} · ${this.game.teamName(this.event.home)} vs ${this.game.teamName(this.event.away)}` : 'Libre'; }
  eventMultiplier() { return (this.event?.mult || 1) * this.payMult; }
  offers() { if (this.tier < 3) return []; return CONTRACTS.filter((c) => c.id !== this.contract && this.reputation >= c.minRep && CONTRACTS.indexOf(c) > CONTRACTS.findIndex((x) => x.id === this.contract)); }
  // Liquidación de una entrega al editor.
  settle(photos, abandoned = false) {
    const st = this.eventState || {}; const lines = [];
    let rep = 0, money = 0;
    const scores = photos.map((p) => this.game.photos.finalScore(p));
    const valid = photos.filter((p, i) => scores[i] >= 40);
    const tierPay = TIERS[tierOf(this.event)]?.pay ?? 1;
    for (const p of valid) money += Math.round(p.eval.value * (p.editedEval ? p.editedEval.score / Math.max(1, p.eval.score) : 1) * this.payMult * tierPay);
    if (photos.length) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const r = clamp((avg - 55) / 4, -10, 10); rep += r; lines.push([`Promedio de calidad (${avg.toFixed(0)}/100)`, r]);
      const great = scores.filter((s) => s >= 80).length; if (great) { rep += Math.min(6, great); lines.push([`${great} fotografía(s) sobre 80`, Math.min(6, great)]); }
      const bad = scores.filter((s) => s < 40).length; if (bad) { rep -= bad; lines.push([`${bad} imagen(es) deficiente(s) entregada(s)`, -bad]); }
    } else { rep -= 6; lines.push(['No entregaste fotografías', -6]); }
    const a = this.event?.assignment;
    if (a) {
      const fit = photos.some((p, i) => scores[i] >= 50 && (p.eval.tags || []).some((t) => a.tags.includes(t)));
      if (fit) { rep += 4; money += 15000 * this.eventMultiplier(); lines.push([`Encargo cumplido: ${a.title}`, 4]); }
      else { rep -= 3; lines.push([`Encargo no cumplido: ${a.title}`, -3]); }
    }
    if (st.arrivedOnTime === false) { rep -= 3; lines.push(['Llegaste tarde al inicio del partido', -3]); }
    else if (st.early) { rep += 1; lines.push([`Llegaste temprano (${Math.round(st.early / 60 * 10) / 10} h antes del saque)`, 1]); }
    const fol = this.game.phone?.social.followers; if (fol && st.followersAtStart !== undefined && fol > st.followersAtStart) lines.push([`Lente: +${fol - st.followersAtStart} seguidores nuevos`, 0]);
    if (st.infractions) { const v = st.expelled ? -8 : -2 * st.infractions; rep += v; lines.push([st.expelled ? 'Te retiraron de la zona de prensa' : `${st.infractions} infracción(es) de acceso`, v]); }
    if (abandoned) { rep -= 10; lines.push(['Abandonaste el evento', -10]); }
    rep = Math.round(rep);
    const prevRep = this.reputation;
    this.reputation = clamp(this.reputation + rep, 0, 100); this.money += money;
    this.stats.delivered += photos.length; this.stats.earned += money; this.stats.events++;
    this.stats.best = Math.max(this.stats.best, ...scores, 0);
    this.stats.covers += photos.filter((p) => (p.eval.tags || []).includes('portada')).length;
    if (this.event && !this.completed.includes(this.event.id)) this.completed.push(this.event.id);
    this.history.unshift({ event: this.currentEventName(), date: new Date().toISOString(), delivered: photos.length, money, rep, best: Math.max(0, ...scores) });
    this.day++;
    // A veces el club te llama: su fotógrafo oficial se enfermó
    this.officialOffer = null;
    const nxt = this.nextEvent();
    if (nxt && tierOf(nxt) >= 3 && tierOf(this.event) >= 3 && !this.event?.official && this.stats.events >= 1 && Math.random() < 0.4) {
      this.officialOffer = { eventId: nxt.id, team: nxt.home };
      this.game.phone?.receive('editor', `Ricardo: me escribieron de ${this.game.teamName(nxt.home)}. Su fotógrafo oficial se enfermó y te quieren a vos para «${nxt.title}». Acceso a vestuarios, palcos y todo el estadio. Revisá la redacción.`);
    }
    return { rep, money, lines, prevRep, newRep: this.reputation, photos: photos.length };
  }
  serialize() { return { tier: this.tier, flags: this.flags, mail: this.mail, pendingChapter: this.pendingChapter, chaptersSeen: this.chaptersSeen, money: this.money, reputation: this.reputation, completed: this.completed, contract: this.contract, stats: this.stats, history: this.history, day: this.day, offersSeen: this.offersSeen, officialOffer: this.officialOffer || null }; }
  load(d) {
    if (!d) return; Object.assign(this, d);
    // Partidas anteriores al modo historia por etapas: siguen en la Primera (con las etapas previas abiertas)
    if (d.tier === undefined) {
      this.tier = this.completed.some((id) => EVENTS.find((e) => e.id === id)?.cup) ? 4 : 3;
      this.flags = { metMariana: true, metKendall: true, legacy: true }; this.pendingChapter = null; this.chaptersSeen = [1, 2, 3, 4];
      this.mail = { contacts: [], sent: [], inbox: [] };
    }
    this.mail ||= { contacts: [], sent: [], inbox: [] }; this.flags ||= {}; this.chaptersSeen ||= [];
  }
}
