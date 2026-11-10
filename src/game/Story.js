import * as THREE from 'three';
import { NPC, LOOKS, randomFan } from '../npc/NPC.js';
import { formatClock, rand, pick } from '../core/MathUtil.js';
import { STADIUMS } from '../world/StadiumConfigs.js';
import { ALL_ITEMS } from '../photography/Equipment.js';
import { KEEPER_LOOKS, openShopCounter } from '../world/ShopCatalog.js';

const ALVARO_TIPS = [
  'Seguí la jugada, no el balón. Cuando un extremo encara por la banda, ya deberías estar apuntando al área.',
  'Detrás de la portería tenés las mejores caras: remates de frente, atajadas y celebraciones que vienen hacia vos.',
  'Si la luz baja, subí el ISO antes que bajar la velocidad. Una foto con ruido se publica; una foto movida, no.',
  'El teleobjetivo comprime: con 400 mm el delantero y el defensor parecen pegados. Eso da tensión.',
  'Arrodillate con C: el ángulo bajo hace ver a los jugadores más heroicos y limpia el fondo.',
  'Para el paneo, bajá a 1/250 y seguí al jugador mientras disparás. Fondo barrido, jugador nítido.',
  'Al final, elegí pocas y buenas. El editor no quiere veinte fotos iguales.',
  'Si querés cambiar de lado durante el juego, rodeá por la banda opuesta. Por el área técnica no se pasa.',
];

export class Story {
  constructor(game) { this.game = game; this.introDone = false; this.stage = 'street'; this.npcs = []; this.timers = []; }
  serialize() { return { introDone: this.introDone }; }
  // Ceremonia y sorteo: indicaciones al fotógrafo y reubicación de los demás fotógrafos.
  bindMatch() {
    const g = this.game; if (this.matchBound) return; this.matchBound = true;
    g.events.on('match:phase', (ph) => {
      if (!g.inEvent) return;
      if (ph === 'ceremony') { g.ui.toast('¡Salen los equipos! Buscá un buen ángulo de la salida.', 'mission', 3500); }
      if (ph === 'teamphoto') { g.ui.toast('📸 Foto oficial: podés entrar al campo frente a cada equipo. Después volvé a la zona de prensa.', 'mission', 5000); g.ui.setObjective('Foto oficial: fotografiá a los dos equipos formados (entrá al campo frente a ellos).'); }
      if (ph === 'toss') g.ui.setObjective('El árbitro y los capitanes hacen el sorteo en el círculo central.');
      if (ph === 'second' && this.designated) this.designate(this.designated.id === 'press1' ? -1 : 1, true);
    });
    g.events.on('match:toss', ({ homeAttacksEast }) => { if (g.inEvent) this.designate(homeAttacksEast ? 1 : -1, false); });
  }
  designate(side, halftime) {
    const g = this.game, st = g.stadium, z = st.zones.press.find((x) => x.id === 'press' + side);
    this.designated = z;
    g.ui.toast(halftime ? `Medio tiempo: los fotógrafos cambian a la ${z.name}.` : `Sorteo hecho: los fotógrafos se ubican en la ${z.name}, detrás de la portería que ataca el local.`, 'mission', 5000);
    g.ui.setObjective(`Ubicate en la ${z.name} (designada${halftime ? ' para el segundo tiempo' : ' por el sorteo'}).`);
    // Los demás fotógrafos y Kendall caminan a la zona asignada
    const L = (st.P?.L || 105) / 2, sx = side;
    const photogs = this.npcs.filter((n) => n.name === 'Fotógrafo' || n === this.alvaro);
    photogs.forEach((n, i) => {
      const tz = -24 + (i % 12) * 4.2 + (i === photogs.length - 1 ? 1 : 0), tx = sx * (L + 4.4 + (i % 2) * 0.6);
      const goal = new THREE.Vector3(tx, 0, Math.abs(tz) < 5 ? tz + Math.sign(tz || 1) * 6 : tz);
      n.route = [new THREE.Vector3(Math.sign(n.pos.x || 1) * 58, 0, -40.5), new THREE.Vector3(sx * 58, 0, -40.5), goal]; n.ri = 0; n.loop = false; n.speed = 2.2;
      n.baseYaw = sx > 0 ? -Math.PI / 2 : Math.PI / 2; n.idle = 'kneel'; if (n === this.alvaro) st.spots.alvaro = goal.clone();
    });
  }
  objectivePosDesignated() { const z = this.designated; return z ? new THREE.Vector3((z.x0 + z.x1) / 2, 0, 0) : null; }
  load(d) { this.introDone = !!d?.introDone; }
  clear() { for (const n of this.npcs) n.root.parent?.remove(n.root); for (const m of this.props || []) m.parent?.remove(m); this.props = []; this.npcs = []; this.game.storyNPCs = []; this.game.stewards = []; }
  // Prepara NPC, interacciones y objetivos de un evento.
  setup(ev, intro) {
    const g = this.game, st = g.stadium, city = g.city, P = city.P, I = g.interaction;
    this.ev = ev; this.intro = intro; this.stage = g.arcade ? 'street' : 'home'; this.gateHinted = false; this.designated = null;
    this.bindMatch(); this.briefed = false; this.kickedOff = false; this.inBowlOnce = false;
    this.clear();
    const add = (parent, o) => { const n = new NPC(g, parent, o); this.npcs.push(n); return n; };
    // ---------- Personajes principales ----------
    this.mariana = add(city.group, { name: 'Mariana Quesada', role: 'story', look: LOOKS.mariana, pos: city.spots.mariana, yaw: 0, idle: 'clipboard' });
    this.mariana.mapLabel = 'Mariana (acreditaciones)';
    this.guard = add(st.group, { name: 'Oficial Brenes', role: 'story', look: LOOKS.guard, pos: st.spots.guard, yaw: 0, idle: 'loco' });
    this.guard.mapLabel = 'Seguridad';
    if (city.spots.boothGuard) add(city.group, { name: 'Guarda del parqueo', look: LOOKS.guard, pos: city.spots.boothGuard, yaw: Math.PI, idle: 'loco', chatty: 0.3 }).mapLabel = 'Parqueo de prensa';
    this.alvaro = add(st.group, { name: 'Kendall Rojas', role: 'story', look: LOOKS.alvaro, pos: st.spots.alvaro, yaw: -Math.PI / 2, idle: 'sit', camera: 400 });
    this.alvaro.mapLabel = 'Kendall Rojas';
    g.storyNPCs = [this.mariana, this.guard, this.alvaro];
    // Policías en la plaza, periodistas en fila, vendedores
    add(city.group, { name: 'Policía', look: LOOKS.police, pos: new THREE.Vector3(4, 0, st.gateZ + 8), yaw: Math.PI, idle: 'loco' });
    add(city.group, { name: 'Policía', look: LOOKS.police, pos: new THREE.Vector3(-5, 0, st.gateZ + 10), yaw: Math.PI * 0.8, idle: 'talk', chatty: 0.5 });
    add(city.group, { name: 'Periodista', look: LOOKS.journalist, pos: city.spots.mariana.clone().add(new THREE.Vector3(1.5, 0, 3.4)), yaw: Math.PI, idle: 'talk', chatty: 0.6 });
    for (const v of city.vendorSpots) add(city.group, { name: 'Vendedor', look: LOOKS.vendor, pos: v.pos, yaw: Math.PI, idle: 'wave', chatty: 1 });
    // Aficionados caminando y en grupos
    const home = g.team(ev.home), away = g.team(ev.away);
    const routeFan = () => {
      const start = new THREE.Vector3(rand(-150, 150), 0, P + rand(0.8, 3.2));
      const mid = new THREE.Vector3(rand(-30, 30), 0, P - rand(4, 10));
      const nearGate = new THREE.Vector3(pick([-20, -14, 14, 20]), 0, st.gateZ + rand(3, 8));
      return [start, mid, nearGate, new THREE.Vector3(rand(-40, 40), 0, st.gateZ + rand(12, 28)), start];
    };
    const nFans = Math.round(18 * g.settings.q.crowd + 6);
    for (let i = 0; i < nFans; i++) { const r = routeFan(); add(city.group, { name: 'Aficionado', look: randomFan(Math.random() < 0.7 ? home : away), pos: r[0], route: r, speed: rand(1.1, 1.6), chatty: 0.2 }); }
    for (let k = 0; k < 5; k++) {
      const c = new THREE.Vector3(rand(-45, 45), 0, st.gateZ + rand(10, 28));
      for (let j = 0; j < 3; j++) { const a = (j / 3) * Math.PI * 2; add(city.group, { name: 'Aficionado', look: randomFan(home), pos: c.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))), yaw: a + Math.PI, idle: j === 0 ? 'talk' : pick(['loco', 'talk', 'cheer']), chatty: 0.7 }); }
    }
    // Stewards y fotógrafos dentro del estadio
    g.stewards = st.spots.stewards.map((p) => add(st.group, { name: 'Steward', look: LOOKS.steward, pos: p, yaw: p.z > 0 ? Math.PI : 0, idle: 'loco', speed: 2 }));
    const stoolM = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.4 });
    const stool = (pos) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.44, 10), stoolM); m.position.set(pos.x, 0.22, pos.z); m.castShadow = true; st.group.add(m); this.props.push(m); };
    stool(st.spots.alvaro);
    for (const p of st.spots.photographers) { if (Math.random() < 0.7) p.userData = 'sit'; }
    for (const p of st.spots.photographers) add(st.group, { name: 'Fotógrafo', look: { ...LOOKS.photog, skin: pick(['#e0ac85', '#c68d63', '#a86f48', '#f1c9a5']), vest: pick(['#0b3d91', '#c8102e', '#2a9d8f']) }, pos: p, yaw: p.x > 0 ? -Math.PI / 2 : Math.PI / 2, idle: p.userData === 'sit' ? (stool(p), 'sit') : 'kneel', camera: pick([300, 400, 600]) });
    // Locales con interior: dependiente detrás del mostrador y clientes sentados
    const shopNPCs = [];
    for (const sh of city.shops || []) {
      const k = add(city.group, { name: sh.kind === 'bar' ? 'Bartender' : 'Dependiente', role: 'story', look: KEEPER_LOOKS[sh.kind], pos: sh.keeper, yaw: sh.keeperYaw, idle: 'loco', chatty: 0.3 });
      k.mapLabel = sh.name; shopNPCs.push([sh, k]);
      for (const seat of sh.seats) if (Math.random() < (sh.kind === 'bar' ? 0.55 : 0.4)) add(city.group, { name: 'Cliente', look: randomFan(Math.random() < 0.6 ? home : away), pos: seat.pos.clone().setY(0), yaw: seat.yaw, idle: seat.bar ? 'loco' : 'sit', chatty: 0.8 });
    }
    // Zona de comidas del estadio: vendedores en cada puesto y aficionados comiendo
    const stallNPCs = [];
    for (const fs of st.foodStalls || []) {
      const v = add(st.group, { name: 'Vendedor', role: 'story', look: KEEPER_LOOKS[fs.kind], pos: fs.vendor, yaw: fs.vendorYaw, idle: 'loco', chatty: 0.6 });
      v.mapLabel = fs.name; stallNPCs.push([fs, v]);
    }
    for (const tp of st.foodTables || []) for (let k = 0; k < 2; k++) if (Math.random() < 0.75) { const a = k * Math.PI + rand(-0.4, 0.4); add(st.group, { name: 'Aficionado', look: randomFan(Math.random() < 0.7 ? home : away), pos: tp.clone().add(new THREE.Vector3(Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75)), yaw: a + Math.PI, idle: pick(['talk', 'loco', 'talk']), chatty: 0.9 }); }
    if (st.foodStalls) for (let k = 0; k < 3; k++) { const fs = pick(st.foodStalls); add(st.group, { name: 'Aficionado', look: randomFan(home), pos: fs.counter.clone().setY(0).add(new THREE.Vector3(rand(-0.8, 0.8), 0, 0.6 + k * 0.1)), yaw: Math.PI, idle: 'loco', chatty: 0.5 }); }
    // ---------- Interacciones ----------
    I.clear();
    for (const [fs, v] of stallNPCs) I.add({ position: fs.counter, radius: 1.8, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>Comprar en ${fs.name}`, onInteract: () => { v.playOnce('talk', 3); g.audio?.talk?.(v.pos.clone().setY(1.6), 1.2, 1.2); openShopCounter(g, fs); } });
    for (const [sh, k] of shopNPCs) I.add({ position: sh.counter, radius: 2.2, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>Comprar en ${sh.name}`, onInteract: () => { k.playOnce('talk', 3); g.audio?.talk?.(k.pos.clone().setY(1.6), 1.2, sh.kind === 'bar' ? 0.9 : 1.4); openShopCounter(g, sh); } });
    I.add({ position: this.mariana.pos.clone().setY(1.2).add(new THREE.Vector3(0, 0, 2)), radius: 3.2, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>Hablar con Mariana`, onInteract: () => this.talkMariana() });
    I.add({ position: st.spots.guard.clone().setY(1.2), radius: 3.5, prompt: () => this.stage === 'street' || this.stage === 'credential' ? `<kbd>${g.ui.key('interact')}</kbd>Presentarse en seguridad` : null, onInteract: () => this.security() });
    I.add({ getPosition: () => this.alvaro.pos.clone().setY(1), position: this.alvaro.pos, radius: 3, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>Hablar con Kendall Rojas`, onInteract: () => this.talkAlvaro() });
    g.inventory.prepared = false; g.player.syncSecondCamera?.();
    I.add({ position: st.spots.prepBench.clone().setY(1), radius: 2.6, prompt: () => (!g.inventory.prepared && ['inside', 'field'].includes(this.stage) ? `<kbd>${g.ui.key('interact')}</kbd>Preparar equipo` : null), onInteract: () => this.prepare() });
    I.add({ position: st.pressDoor.center, radius: 2.4, prompt: () => (st.pressDoor.isOpen ? null : `<kbd>${g.ui.key('interact')}</kbd>Abrir: Sala de prensa`), onInteract: () => {
      if (!g.inventory.credential) { g.ui.toast('Acceso restringido: se requiere acreditación de prensa.', 'warn'); g.audio?.ui('error'); return; }
      st.pressDoor.open(); g.audio?.ui('door'); g.ui.toast('Tu acreditación abre la sala de prensa.', 'good');
    } });
    // Vestuarios: solo el fotógrafo oficial del club entra (al vestuario de su equipo)
    st.lockerDoors.forEach((d, i) => I.add({ position: d.center, radius: 2.2, prompt: () => (d.isOpen ? null : `<kbd>${g.ui.key('interact')}</kbd>${d.label}`), onInteract: () => {
      const offTeam = ev.official, mine = offTeam && ((i === 0 && offTeam === ev.home) || (i === 1 && offTeam === ev.away));
      if (mine && g.inventory.credential?.official) { d.open(); g.audio?.ui('door'); g.ui.toast(`Fotógrafo oficial de ${g.teamName(offTeam)}: entrás al vestuario. ¡Fotografiá las camisetas, la pizarra y la previa!`, 'good', 4500); g.events.emit('story:locker'); return; }
      g.audio?.ui('error'); g.ui.toast(`${d.label}: acceso exclusivo para jugadores y cuerpo técnico.${offTeam ? ' Tu acceso es solo al vestuario de tu club.' : ' Tu acreditación (Foto · Campo) no incluye esta zona.'}`, 'warn', 4000);
    } }));
    // Palco VIP (escaleras desde el pasillo)
    if (st.palco) {
      I.add({ position: st.palco.stairs.clone().setY(1), radius: 1.8, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>Subir al palco VIP`, onInteract: async () => {
        if (!ev.official) { g.audio?.ui('error'); g.ui.toast('Palco VIP: solo invitados y personal del club.', 'warn', 3000); return; }
        await g.ui.fade(true); const s = st.palco.spot; g.player.place(s.x, s.z, Math.PI); g.player.pos.y = st.palco.deck + 0.02; g.player.root.position.copy(g.player.pos); g.follow.yaw = Math.PI; g.follow.snap(g.player); await g.ui.fade(false);
        g.ui.toast('🥂 Palco VIP: la mejor vista del estadio. Fotografiá el panorama, la afición y a los invitados.', 'good', 4000); g.events.emit('story:palco');
      } });
      I.add({ getPosition: () => st.palco.spot.clone().setY(st.palco.deck + 1), position: st.palco.spot, radius: 2.2, prompt: () => (g.player.pos.y > 3 ? `<kbd>${g.ui.key('interact')}</kbd>Bajar al pasillo` : null), onInteract: async () => {
        await g.ui.fade(true); const s = st.palco.stairs; g.player.place(s.x, s.z + 0.6, 0); g.follow.yaw = 0; g.follow.snap(g.player); await g.ui.fade(false);
      } });
      if (ev.official) for (const seat of st.palco.seats) if (Math.random() < 0.7) add(st.group, { name: 'Invitado VIP', look: { ...randomFan(home), shirt: pick(['#ffffff', '#1d3557', home.colors.primary]), pants: '#2b2b38' }, pos: seat.clone(), yaw: Math.PI, idle: 'sit', chatty: 0.4 });
    }
    // Utileros en el vestuario del club (solo modo fotógrafo oficial)
    if (ev.official && st.lockerRooms) { const L = st.lockerRooms[ev.official === ev.home ? 0 : 1]; for (const [dx, idle] of [[-1.5, 'talk'], [1.6, 'clipboard']]) add(st.group, { name: 'Utilero', look: { ...LOOKS.steward, shirt: g.team(ev.official).colors.primary, vest: null }, pos: L.center.clone().add(new THREE.Vector3(dx, 0, 0.4)), yaw: Math.PI, idle, chatty: 0.6 }); }
    for (const lp of st.pressLaptops) I.add({ position: lp, radius: 1.6, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>${this.stage === 'post' ? 'Entregar fotografías al editor' : 'Usar laptop de prensa'}`, onInteract: () => this.laptop() });
    for (const v of city.vendorSpots) I.add({ position: v.pos.clone().setY(1), radius: 2.5, prompt: () => `<kbd>${g.ui.key('interact')}</kbd>Comprar en «${v.name}» (₡1 000)`, onInteract: () => {
      if (g.career.money < 1000) { g.ui.toast('No te alcanza.', 'warn'); return; }
      g.career.money -= 1000; g.player.stamina = 1; g.audio?.ui('cash'); g.audio?.say('¡Gracias, pura vida!'); g.ui.toast(`Compraste algo en ${v.name}. ¡Energía al máximo!`, 'good');
    } });
    // ---------- Arranque ----------
    g.missions.clearEventMissions();
    g.inventory.credential = null; g.missions.add('m_acred');
    this.setObjective();
    // Hora de llegada: normal (~media hora antes) u horas antes del saque
    const arrive = ev.arrive || (intro ? 34 : 26), early = arrive > 45;
    g.clock = ev.kickoff - arrive - (g.arcade ? 0 : 18); // se sale de la casa: tiempo para el viaje
    if (g.career.eventState) { g.career.eventState.early = early ? arrive : 0; g.career.eventState.followersAtStart = g.phone.social.followers; }
    if (early) { g.env.dynamic = true; g.env.setHour(g.clock / 60, true); }
    const guests = g.phone.onEventStart(ev, { early });
    g.crowdLife.setup(ev, guests);
    if (early) setTimeout(() => g.ui.hint('Llegaste temprano', `Faltan ${Math.floor(arrive / 60)} h ${arrive % 60 ? (arrive % 60) + ' min' : ''} para el saque. El estadio se va llenando poco a poco y los equipos salen a calentar 45 min antes.<br><br>Usá el <b>teléfono</b> (<kbd>${g.ui.key('phone')}</kbd>) para escribirle a tu familia, publicar fotos o <b>esperar</b> con el reloj.`, 12000), 1200);
    setTimeout(() => g.ui.hint(intro ? 'Primera cobertura' : 'Saliendo de casa', `${intro ? 'Hoy es tu primera cobertura. ' : ''}Estás en tu casa. Para llegar al estadio podés:<br>🚗 manejar tu carro (está al frente)<br>🚌 tomar el bus en la parada de la par<br>🚕 pedir un taxi o un Uber con el teléfono (<kbd>${g.ui.key('phone')}</kbd> → Transporte)<br><br><kbd>W A S D</kbd>moverse · <kbd>Shift</kbd>correr · <kbd>${g.ui.key('interact')}</kbd>interactuar · <kbd>M</kbd>mapa · <kbd>Esc</kbd>pausa`, 14000), 600);
  }
  setObjective() {
    if (!this.ev) return;
    const g = this.game, s = this.stage, ko = formatClock(this.ev.kickoff);
    const T = {
      home: `Salí de tu casa y elegí cómo llegar al estadio: tu carro (frente a la casa), el bus (parada a la par) o pedí un taxi o un Uber con el teléfono (${g.ui.key('phone')}).`,
      street: 'Recogé tu acreditación en el toldo azul de prensa (plaza del estadio).',
      credential: 'Andá al acceso de prensa del estadio y pasá el control de seguridad.',
      inside: g.inventory.prepared ? `Cruzá el túnel y buscá a Kendall Rojas detrás de la portería este. Saque inicial: ${ko}.` : 'Prepará tu equipo en la zona de preparación de prensa (pasillo, a la derecha).',
      field: 'Hablá con Kendall Rojas en la zona de prensa este.',
      briefed: this.kickedOff ? 'Cubrí el partido: buscá las mejores jugadas.' : `Fotografiá el calentamiento. El partido inicia a las ${ko} (T: esperar el saque).`,
      match: 'Cubrí el partido. Anticipá las jugadas y respetá las zonas de prensa.',
      post: 'Partido terminado: andá a la sala de prensa y entregá tus fotos al editor.',
      done: 'Cobertura entregada.',
    };
    g.ui.setObjective(T[s] || '');
  }
  objectivePos() {
    const g = this.game, st = g.stadium;
    if (this.designated && ['briefed', 'match'].includes(this.stage)) return this.objectivePosDesignated();
    return { home: this.mariana?.pos, street: this.mariana?.pos, credential: st.spots.guard, inside: g.inventory.prepared ? this.alvaro?.pos : st.spots.prepStand, field: this.alvaro?.pos, post: st.spots.laptop }[this.stage] || null;
  }
  async talkMariana() {
    const g = this.game, inv = g.inventory, ev = this.ev, M = { who: 'Mariana Quesada', role: 'Coordinadora de prensa', color: '#0b3d91', initials: 'MQ', pitch: 1.5, pos: this.mariana.pos.clone().setY(1.6) };
    this.mariana.playOnce('talk', 6);
    if (inv.credential && inv.credential.eventId === ev.id) {
      await g.ui.dialogue([{ ...M, text: pick([`Ya tenés tu acreditación, ${g.playerName}. El acceso de prensa está al fondo de la plaza.`, 'Recordá: nada de pisar la cancha. ¡Suerte!', `El partido arranca a las ${formatClock(ev.kickoff)}. ¡No te me atrasés!`]) }]);
      return;
    }
    const st = STADIUMS[ev.stadium];
    const lines = ev.official ? [
      { ...M, text: `¡${g.playerName}! El club me avisó: hoy sos el fotógrafo oficial de ${g.teamName(ev.official)} porque su fotógrafo se enfermó.` },
      { ...M, text: 'Esta acreditación es de personal del club: ACCESO TOTAL. Podés entrar al vestuario de tu equipo, al palco VIP (escaleras en el pasillo) y moverte por todo el estadio.' },
      { ...M, text: 'Eso sí: la cancha sigue prohibida mientras ruede la pelota. Y el club quiere fotos de la previa en el vestuario. ¡Suerte!', options: [{ label: '¡Gracias, Mariana!', value: 1 }] },
    ] : ev.cup ? [
      { ...M, text: `¡${g.playerName}! Hoy es noche de Copa Centroamericana: ${g.teamName(ev.home)} contra ${g.teamName(ev.away)}. La organización internacional emite su propia acreditación.` },
      { ...M, text: 'Aquí está: es la especial de la copa, con tu número y el holograma verde. El chaleco verde de prensa es obligatorio en el campo. No la perdás.' },
      { ...M, text: `El encargo del editor: «${ev.assignment.title}». Hay más cámaras y más seguridad que en la liga: respetá las zonas.`, options: [{ label: '¡Gracias, Mariana!', value: 1 }] },
    ] : this.intro ? [
      { ...M, text: `¡Hola! Vos debés ser ${g.playerName}, ${g.female ? 'la nueva colaboradora' : 'el nuevo colaborador'} de Ascenso Total. Soy Mariana Quesada, coordinadora de prensa de la Liga.` },
      { ...M, text: 'Dejame verificar en la lista… aquí estás. Esta es tu acreditación: es personal e intransferible.' },
      { ...M, text: 'Te da acceso al túnel, a la sala de prensa y a las zonas de fotógrafos pintadas en azul detrás de las porterías.' },
      { ...M, text: 'Reglas: nunca pisés la cancha y no entrés al área técnica mientras se juega. Si querés cambiar de lado, rodeá por la banda opuesta o por el pasillo detrás de los bancos. Tres faltas y seguridad te saca.' },
      { ...M, text: `El partido es ${g.teamName(ev.home)} contra ${g.teamName(ev.away)} a las ${formatClock(ev.kickoff)}. Kendall Rojas te espera detrás de la portería este. ¡Mucha suerte en tu primera cobertura!`, options: [{ label: '¡Gracias, Mariana!', value: 1 }] },
    ] : [
      { ...M, text: `¡Qué dicha verte de nuevo, ${g.playerName}! Hoy cubrís ${g.teamName(ev.home)} vs ${g.teamName(ev.away)} en el ${st.name}.` },
      { ...M, text: `Aquí está tu acreditación. El encargo del editor es: «${ev.assignment.title}». ${ev.clasico ? 'Es clásico: seguridad está más estricta que nunca.' : 'Ya sabés las reglas.'}`, options: [{ label: 'Gracias', value: 1 }] },
    ];
    await g.ui.dialogue(lines);
    const d = new Date();
    inv.credential = { eventId: ev.id, league: ev.league || null, cup: !!ev.cup && !ev.official, official: ev.official || null, seat: 10 + Math.floor(Math.random() * 80), event: `${ev.title} · ${g.team(ev.home).short} vs ${g.team(ev.away).short}`, home: ev.home, away: ev.away, stadium: st.name, date: d.toLocaleDateString('es-CR') + ' · ' + formatClock(ev.kickoff), number: `LT-26-${String(Math.floor(Math.random() * 9000) + 1000)}` };
    if (!inv.owned.credential) inv.owned.credential = 1;
    g.audio?.ui('mission');
    g.screens.credential(() => {
      this.stage = 'credential'; this.setObjective(); g.events.emit('story:credential'); g.missions.add('m_llegar');
      g.saves.save('auto'); g.ui.toast('Autoguardado', 'info', 1200);
    });
  }
  async security() {
    const g = this.game, st = g.stadium, inv = g.inventory;
    const G = { who: 'Oficial Brenes', role: 'Seguridad del estadio', color: '#2b2f3a', initials: 'OB', pitch: 0.8, pos: this.guard.pos.clone().setY(1.7) };
    this.guard.playOnce('talk', 4);
    if (!inv.credential || inv.credential.eventId !== this.ev.id) {
      await g.ui.dialogue([{ ...G, text: 'Buenas. Este es el acceso de prensa: sin acreditación no lo puedo dejar pasar. Las acreditaciones las entrega Mariana en el toldo azul de la plaza.' }]);
      return;
    }
    if (this.stage !== 'credential' && this.stage !== 'street') return;
    await g.ui.dialogue([
      { ...G, text: '¿Me permite su acreditación, por favor?' },
      { ...G, text: `${g.playerName}… Ascenso Total… zona Foto · Campo, número ${inv.credential.number}. Todo en orden.` },
      { ...G, text: 'Ponga la mochila en la banda del escáner y pase por el arco detector, por favor.' },
    ]);
    // Secuencia de inspección real: la mochila viaja por la banda y el jugador cruza el arco
    g.cinematic = true; this.stage = 'security'; g.ui.setPrompt(null);
    const p = g.player, bp = p.avatar.backpack, bag = bp.clone(); bp.visible = false;
    const xin = st.spots.xrayIn, xout = st.spots.xrayOut; st.group.add(bag); bag.position.copy(xin); bag.rotation.set(Math.PI / 2, 0, 0); bag.scale.setScalar(1);
    g.audio?.ui('scanner');
    st.xrayScreen.material.color.set(0x1a6b3a);
    await this.tween(2.6, (t) => { bag.position.lerpVectors(xin, xout, t); st.xrayScreen.material.color.setHSL(0.33, 0.6, 0.15 + 0.2 * Math.abs(Math.sin(t * 20))); });
    st.xrayScreen.material.color.set(0x0a1a10);
    // Caminar a través del arco
    const a = st.spots.gateOutside.clone().setZ(st.gateZ + 4), b = st.spots.gateOutside.clone().setZ(st.gateZ + 1.2);
    p.place(a.x, a.z, Math.PI); g.follow.yaw = Math.PI; g.follow.snap(p);
    await this.tween(1.6, (t) => { p.pos.lerpVectors(a, b, t); p.root.position.copy(p.pos); p.avatar.update(1 / 60, 1.4); });
    st.detectorLight.material.color.set(0x33ff55); g.audio?.ui('beep');
    st.group.remove(bag); bp.visible = true;
    st.gate.open(); g.audio?.ui('door');
    g.cinematic = false;
    await g.ui.dialogue([{ ...G, text: 'Listo, adelante. A la derecha del pasillo está la zona de preparación de prensa: ahí puede alistar su equipo antes de bajar por el túnel.' }]);
    this.stage = 'inside'; this.setObjective(); if (!this.gateHinted) { this.gateHinted = true; g.events.emit('story:gate'); } g.events.emit('story:security'); g.missions.add('m_preparar');
    g.saves.save('auto');
  }
  // Preparación del equipo: secuencia guiada con cámara cercana sobre la banca.
  async prepare() {
    const g = this.game, st = g.stadium, inv = g.inventory, B = st.spots.prepBench, P = st.spots.prepStand;
    if (inv.prepared) return;
    if (g.photoMode.active) g.photoMode.exit();
    g.cinematic = true; g.ui.setPrompt(null);
    g.player.place(P.x, P.z, Math.PI / 2); g.player.setCameraEquipped(false);
    g.camOverride = { pos: new THREE.Vector3(B.x - 0.95, 1.25, B.z + 0.55), look: new THREE.Vector3(B.x + 0.05, B.y + 0.08, B.z + 0.1) };
    const grp = new THREE.Group(); st.group.add(grp); this.props.push(grp);
    const M = (c, r = 0.5, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.34, 0.3), M(0x22333b, 0.85)); bag.position.set(B.x + 0.05, B.y + 0.17, B.z + 1.1); grp.add(bag);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.31), M(0x1b2a30, 0.85)); flap.position.set(0, 0.18, 0); bag.add(flap);
    const body = new THREE.Group(); const bb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.105, 0.085), M(0x151515, 0.45, 0.25)); body.add(bb);
    const prism = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.06), M(0x151515, 0.45, 0.25)); prism.position.y = 0.07; body.add(prism);
    const mount = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20), M(0xc0c0c0, 0.3, 0.9)); mount.position.z = 0.045; body.add(mount);
    body.position.copy(bag.position); body.visible = false; grp.add(body);
    const battery = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.06), M(0x2b2b2b, 0.6)); battery.visible = false; grp.add(battery);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.002, 0.032), M(0x0b3d91, 0.4)); card.visible = false; grp.add(card);
    g.input.releaseLock();
    const panel = document.createElement('div'); panel.className = 'dialogue prep'; document.getElementById('ui-root').appendChild(panel); g.ui.customNavRoot = panel;
    const step = (title, text, buttons) => new Promise((res) => {
      panel.innerHTML = `<div class="portrait" style="background:#0b3d91">🎒</div><div style="flex:1"><div class="who">PREPARACIÓN DEL EQUIPO<span class="role">${title}</span></div><div class="txt">${text}</div><div class="opts"></div></div>`;
      const opts = panel.querySelector('.opts');
      buttons.forEach(([label, val], i) => { const b = document.createElement('button'); b.className = 'btn' + (i === 0 ? ' primary' : ''); b.textContent = label; b.onclick = () => res(val); opts.appendChild(b); });
    });
    const move = (obj, to, dur, rot) => { const from = obj.position.clone(), r0 = obj.rotation.clone(); obj.visible = true; return this.tween(dur, (t) => { const e = t * t * (3 - 2 * t); obj.position.lerpVectors(from, to, e); obj.position.y += Math.sin(e * Math.PI) * 0.12; if (rot) obj.rotation.set(r0.x + (rot.x - r0.x) * e, r0.y + (rot.y - r0.y) * e, r0.z + (rot.z - r0.z) * e); }); };
    const center = new THREE.Vector3(B.x, B.y + 0.06, B.z);
    await step('Paso 1 de 7', 'Dejá la mochila sobre la banca.', [['Dejar la mochila', 1]]);
    g.player.avatar.backpack && (g.player.avatar.backpack.visible = false); g.audio?.ui('door');
    await move(bag, new THREE.Vector3(B.x + 0.05, B.y + 0.17, B.z + 0.45), 0.8);
    await step('Paso 2 de 7', `Abrí la mochila y sacá el cuerpo <b>${inv.camera.name}</b>.`, [['Sacar la cámara', 1]]);
    g.audio?.ui('click'); flap.rotation.x = -1.2; flap.position.set(0, 0.2, -0.12);
    await move(body, center, 0.9, new THREE.Euler(0, Math.PI / 2, 0));
    const lenses = [inv.equipped.lens, ...[...inv.packed].filter((id) => ALL_ITEMS[id]?.type === 'lens' && id !== inv.equipped.lens)];
    const chosen = lenses.length > 1 ? await step('Paso 3 de 7', 'Elegí el lente para empezar la cobertura (los demás quedan en la mochila).', lenses.map((id) => [ALL_ITEMS[id].name, id])) : (await step('Paso 3 de 7', `Montá el lente <b>${ALL_ITEMS[lenses[0]].name}</b>: alineá el punto rojo y girá hasta escuchar el clic.`, [['Montar lente', lenses[0]]]), lenses[0]);
    const L = ALL_ITEMS[chosen], len = 0.07 + L.max / 1400, rad = 0.035 + L.max / 9000;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.08, len, 24).rotateZ(Math.PI / 2), M(L.max >= 300 ? 0xe9e6dc : 0x1d1d1d, 0.4, 0.3));
    lens.position.copy(bag.position).add(new THREE.Vector3(0, 0.1, 0)); grp.add(lens);
    await move(lens, center.clone().add(new THREE.Vector3(0.045 + len / 2, 0, 0)), 0.9);
    await this.tween(0.35, (t) => { lens.rotation.x = -t * 1.2; });
    g.audio?.ui('af'); if (inv.equipped.lens !== chosen) { inv.packed.add(inv.equipped.lens); inv.packed.delete(chosen); inv.equipped.lens = chosen; }
    await step('Paso 4 de 7', `Insertá la batería (carga ${inv.batteryPct}%). ${inv.spares.length && inv.packed.has('battery') ? `Llevás ${inv.spares.length} de repuesto en la mochila.` : 'No llevás baterías de repuesto.'}`, [['Insertar batería', 1]]);
    battery.position.copy(bag.position).add(new THREE.Vector3(0, 0.12, 0)); await move(battery, center.clone().add(new THREE.Vector3(0, -0.06, 0)), 0.7); battery.visible = false; g.audio?.ui('click');
    await step('Paso 5 de 7', `Insertá la tarjeta <b>${inv.card.name}</b> (${inv.cardCapacity - inv.cardUsed} fotos libres).`, [['Insertar tarjeta', 1]]);
    card.position.copy(bag.position).add(new THREE.Vector3(0, 0.12, 0)); await move(card, center.clone().add(new THREE.Vector3(-0.06, 0.01, 0.03)), 0.7); card.visible = false; g.audio?.ui('click');
    const sport = await step('Paso 6 de 7', 'Encendé la cámara y revisá los ajustes. ¿Cargar el perfil de deportes recomendado por Kendall Rojas (AF-C, 1/1000, ISO AUTO, ráfaga)?', [['Sí, perfil deportes', true], ['Mantener mis ajustes', false]]);
    g.audio?.ui('beep');
    if (sport) { const s2 = g.photoMode.s; s2.af = 'AF-C'; s2.shutterIdx = 10; s2.isoIdx = 0; s2.ev = 0; s2.drive = 'burst'; s2.wbIdx = 0; }
    await step('Paso 7 de 7', 'Todo listo. Colgate la cámara y volvé a ponerte la mochila.', [['Colgarme la cámara', 1]]);
    await this.tween(0.5, (t) => { body.position.y = center.y + t * 0.5; lens.position.y = center.y + t * 0.5; });
    st.group.remove(grp); panel.remove(); g.ui.customNavRoot = null;
    if (g.player.avatar.backpack) g.player.avatar.backpack.visible = true;
    g.player.avatar.setLensLength(L.max); g.player.setCameraEquipped(true);
    g.camOverride = null; g.cinematic = false; g.follow.snap(g.player);
    inv.prepared = true; g.player.syncSecondCamera?.(); this.setObjective(); g.events.emit('story:prepared'); g.missions.add('m_cancha');
    g.ui.toast(`Equipo listo: ${inv.camera.name} + ${L.short}`, 'good', 3000);
    g.saves.save('auto');
  }
  tween(dur, fn) { return new Promise((res) => { this.timers.push({ t: 0, dur, fn, res }); }); }
  async talkAlvaro() {
    const g = this.game, A = { who: 'Kendall Rojas', role: 'Fotógrafo veterano · mentor', color: '#4a5d23', initials: 'KR', pitch: 0.85, pos: this.alvaro.pos.clone().setY(1.2) };
    if (this.stage === 'inside' || this.stage === 'field') {
      const first = !this.introDone && this.intro;
      const lines = first ? [
        { ...A, text: `¡Diay, mae! Vos sos ${g.playerName}, ${g.female ? 'la nueva' : 'el nuevo'}. Kendall Rojas, treinta años sentado detrás de estas porterías. ${g.female ? 'Bienvenida' : 'Bienvenido'} a la cancha.` },
        { ...A, text: `Primero lo primero: sacá la cámara con ${g.ui.key('equip')}. Con clic derecho levantás el visor y con la rueda del mouse hacés zoom.` },
        { ...A, text: `En fútbol la velocidad lo es todo: a 1/1000 o más rápido congelás a los jugadores. En el visor, ${g.ui.key('paramPrev')} y ${g.ui.key('paramNext')} eligen el parámetro; ${g.ui.key('paramDec')} y ${g.ui.key('paramInc')} lo cambian. Dejá el ISO en AUTO si la luz cambia.` },
        { ...A, text: `El enfoque AF-C sigue al jugador: cuando el cuadro se pone verde, está nítido. Con ${g.ui.key('autofocus')} reenfocás sobre lo que tengas en el centro. Con ${g.ui.key('driveMode')} pasás a ráfaga.` },
        { ...A, text: 'Y lo más importante: anticipá. No sigás el balón, seguí la jugada. Cuando un delantero entra al área, vos ya tenés que estar encuadrándolo.' },
        { ...A, text: 'Calentemos la mano: tomame cinco fotos buenas del calentamiento. Cuando arranque el partido, quedate de este lado o buscá la portería donde ataquen más.', options: [{ label: 'Entendido, Kendall Rojas', value: 1 }] },
      ] : [
        { ...A, text: `${pick(['¡Qué hubo!', '¡Pura vida, mae!', '¡Llegó el profesional!'])} Hoy el encargo es «${this.ev.assignment.title}». ${pick(ALVARO_TIPS)}`, options: [{ label: 'Gracias por el consejo', value: 1 }] },
      ];
      this.alvaro.playOnce('talk', 5);
      await g.ui.dialogue(lines);
      this.stage = 'briefed'; this.briefed = true; this.setObjective(); g.events.emit('story:alvaro');
      if (this.intro) g.missions.add('m_calentamiento');
      for (const id of this.ev.missions) if (id !== 'm_entrega' && id !== 'm_calentamiento') g.missions.add(id);
      if (this.ev.official) { g.missions.add('m_vestuario'); g.missions.add('m_palco'); }
      if (first) setTimeout(() => g.ui.hint('Modo fotografía', `<kbd>${g.ui.key('equip')}</kbd>equipar cámara<br><kbd>Clic der.</kbd>visor · <kbd>Clic</kbd>disparar · <kbd>Rueda</kbd>zoom<br><kbd>${g.ui.key('paramPrev')}</kbd>/<kbd>${g.ui.key('paramNext')}</kbd> parámetro · <kbd>${g.ui.key('paramDec')}</kbd>/<kbd>${g.ui.key('paramInc')}</kbd> valor<br><kbd>${g.ui.key('autofocus')}</kbd>autofoco · <kbd>${g.ui.key('driveMode')}</kbd>ráfaga · <kbd>${g.ui.key('crouch')}</kbd>arrodillarse<br><kbd>${g.ui.key('gallery')}</kbd>galería · <kbd>T</kbd>esperar el saque`, 20000), 400);
      return;
    }
    const opts = [{ label: 'Gracias', value: 0 }];
    if (!this.kickedOff) opts.unshift({ label: 'Estoy listo para el partido', value: 'ready' });
    const v = await g.ui.dialogue([{ ...A, text: this.stage === 'post' ? 'Buen partido. Ahora andá a la sala de prensa y escogé con cabeza fría: pocas y buenas.' : pick(ALVARO_TIPS), options: opts }]);
    if (v === 'ready') this.kickoffNow();
  }
  kickoffNow() { const g = this.game; if (!this.kickedOff) g.clock = Math.max(g.clock, this.ev.kickoff); }
  async laptop() {
    const g = this.game;
    if (this.stage !== 'post') {
      await g.ui.dialogue([{ who: 'Laptop de prensa', role: 'Ascenso Total', color: '#0b3d91', initials: 'AT', voice: false, text: 'Sistema de envío de Ascenso Total. Podrás entregar tus fotografías al editor cuando termine el partido. Mientras tanto, podés revisar tu galería con P.' }]);
      return;
    }
    const E = { who: 'Ricardo Solano', role: 'Editor deportivo · videollamada', color: '#c8102e', initials: 'RS', pitch: 0.9 };
    await g.ui.dialogue([{ ...E, text: `Buenas, ${g.playerName}. Mandame tus mejores fotos, máximo diez. El encargo era «${this.ev.assignment.title}». Las reviso de una vez.` }]);
    g.openDelivery();
  }
  update(dt) {
    const g = this.game, st = g.stadium, p = g.player.pos;
    // Animaciones scriptadas
    for (const t of this.timers.slice()) { t.t += dt; t.fn(Math.min(1, t.t / t.dur)); if (t.t >= t.dur) { this.timers.splice(this.timers.indexOf(t), 1); t.res(); } }
    // Disparadores por ubicación
    if (this.stage === 'home' && p.x > -172) { this.stage = 'street'; this.setObjective(); g.ui.toast('📍 Llegaste a la zona del estadio. Buscá el toldo azul de acreditaciones.', 'info', 4000); }
    if (this.stage === 'credential' && p.z < st.gateZ + 14 && Math.abs(p.x) < 12 && !this.gateHinted) { this.gateHinted = true; g.ui.toast('Presentá tu acreditación al guardia de seguridad.', 'info'); g.events.emit('story:gate'); g.missions.add('m_seguridad'); }
    const inBowl = Math.abs(p.x) < 64 && Math.abs(p.z) < 43.6;
    if (inBowl && !this.inBowlOnce) { this.inBowlOnce = true; if (this.stage === 'inside') { this.stage = 'field'; this.setObjective(); } g.ui.toast(`${g.female ? 'Bienvenida' : 'Bienvenido'} al ${STADIUMS[this.ev.stadium].name}.`, 'info'); }
    // Reloj del día y saque inicial
    if (!this.kickedOff) {
      g.clock += dt / 4.2;
      if (inBowl && g.input.keyPressed('KeyT')) { this.kickoffNow(); }
      if (g.clock >= this.ev.kickoff) {
        this.kickedOff = true; g.match.startMatch(!!(g.arcade && g.arcadeCfg?.start === 'kickoff'));
        if (!this.inBowlOnce) { g.career.eventState.arrivedOnTime = false; g.ui.toast('¡El partido empezó y todavía no estás en la cancha! Llegaste tarde.', 'bad', 5000); }
        else g.ui.toast('¡Los equipos salen a la cancha!', 'info');
        if (this.stage === 'briefed') this.setObjective();
        g.missions.active.filter((m) => m.id === 'm_calentamiento' && m.status === 'active').forEach((m) => { m.status = 'failed'; g.ui.toast('El calentamiento terminó.', 'warn'); setTimeout(() => { g.missions.active = g.missions.active.filter((x) => x !== m); }, 2000); });
      }
    } else if (g.match) {
      g.clock = this.ev.kickoff + (g.match.phase === 'warmup' ? 0 : g.match.minute + (g.match.half === 2 ? 15 : 0));
    }
  }
  onMatchEnd() {
    const g = this.game; if (!this.ev || !g.inEvent) return;
    const iv = g.match?.interview;
    const who = iv ? `${iv.mvp.name} (#${iv.mvp.number})` : 'el jugador del partido';
    if (g.arcade) {
      g.ui.toast(`🎙️ Entrevista a ${who} en la zona mixta, junto al túnel. Al terminar verás tus resultados.`, 'mission', 6000);
      g.ui.setObjective(`Fotografiá la entrevista a ${who} junto al túnel. (Esc → Terminar partido para ver resultados ya.)`);
      let fired = false; const fin = () => { if (!fired) { fired = true; g.arcadeEnd(); } };
      g.events.on('match:interviewDone', () => setTimeout(fin, 4000)); setTimeout(fin, 70000);
      return;
    }
    this.stage = 'post'; this.setObjective(); g.missions.add('m_entrevista'); g.missions.add('m_entrega');
    g.ui.toast(`¡Final del partido! 🎙️ ${who} da la entrevista en la zona mixta, junto al túnel. Después entregá tus fotos en la sala de prensa.`, 'mission', 7000);
    g.saves.save('auto');
  }
}
