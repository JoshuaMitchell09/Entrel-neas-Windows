import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';
import { Input } from '../core/Input.js';
import { Settings } from '../core/Settings.js';
import { CollisionWorld } from '../core/Collision.js';
import { setMaxAnisotropy } from '../gfx/Textures.js';
import { Environment } from '../world/Environment.js';
import { Stadium, APRON_X, APRON_Z } from '../world/Stadium.js';
import { City } from '../world/City.js';
import { STADIUMS } from '../world/StadiumConfigs.js';
import { TIME_PRESETS } from '../world/Environment.js';
import { ALL_ITEMS } from '../photography/Equipment.js';
import { TEAMS } from '../football/Teams.js';
import { Match } from '../football/Match.js';
import { PlayerController } from '../player/PlayerController.js';
import { FollowCamera } from '../player/FollowCamera.js';
import { InteractionSystem } from '../interaction/Interaction.js';
import { PhotoMode } from '../photography/PhotoMode.js';
import { Inventory } from '../inventory/Inventory.js';
import { Career, EVENTS } from '../career/Career.js';
import { MissionSystem } from '../missions/Missions.js';
import { SaveSystem } from '../save/SaveSystem.js';
import { PhotoLibrary } from '../save/PhotoLibrary.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { UI } from '../ui/UI.js';
import { Screens } from '../ui/Screens.js';
import { Gallery } from '../ui/Gallery.js';
import { h } from '../ui/dom.js';
import { Rules } from './Rules.js';
import { PostFX } from '../gfx/PostFX.js';
import { Scenery } from '../world/Scenery.js';
import { ViewModel } from '../player/ViewModel.js';
import { Story } from './Story.js';
import { Phone } from '../phone/Phone.js';
import { CrowdLife } from '../world/CrowdLife.js';
import { DroneCam } from '../cinema/DroneCam.js';
import { Travel } from '../world/Travel.js';
import { Recorder } from '../cinema/Recorder.js';
import { PhoneCam } from '../cinema/PhoneCam.js';
import { clamp } from '../core/MathUtil.js';
import { buildMenuCamera } from '../world/MenuCameraProp.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas; this.events = new EventBus(); this.settings = new Settings();
    const q = this.settings.q;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.data.fov, 1, 0.1, 2500);
    this.input = new Input(canvas, this.settings);
    this.collision = new CollisionWorld();
    this.env = new Environment(this);
    this.audio = new AudioEngine(this);
    this.ui = new UI(this); this.screens = new Screens(this);
    this.photos = new PhotoLibrary(this); this.inventory = new Inventory(this); this.career = new Career(this);
    this.missions = new MissionSystem(this); this.saves = new SaveSystem(this); this.story = new Story(this); this.rules = new Rules(this);
    this.interaction = new InteractionSystem(this); this.photoMode = new PhotoMode(this);
    this.player = new PlayerController(this); this.follow = new FollowCamera(this, this.camera);
    this.post = new PostFX(this); this.scene.add(this.camera); this.viewModel = new ViewModel(this);
    this.phone = new Phone(this); this.crowdLife = new CrowdLife(this); this.drone = new DroneCam(this); this.travel = new Travel(this); this.recorder = new Recorder(this); this.phoneCam = new PhoneCam(this);
    this.state = 'boot'; this.clock = 15 * 60; this.time = 0; this.fps = 60; this.inEvent = false; this.cinematic = false;
    this.playerName = 'Fotógrafo'; this.profileId = null; this.menuT = 0;
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.bindEvents();
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    window.addEventListener('pointerdown', () => this.audio.start(), { once: false });
    window.addEventListener('keydown', () => this.audio.start());
  }
  // ---------------- Escena del menú principal: cámara sobre el césped, estadio de noche ----------------
  enterMenuScene() {
    if (!this.stadium) return;
    if (!this.menuProp) this.menuProp = buildMenuCamera();
    if (!this.menuProp.parent) { this.scene.add(this.menuProp); this.menuT = 0; }
    if (this.env.time !== 'night' && !this.menuPrevEnv) { this.menuPrevEnv = [this.env.time, this.env.weather]; this.env.configure('night', 'clear', this.stadium.lightPositions); this.post?.configure(); }
  }
  leaveMenuScene() {
    if (this.menuProp?.parent) this.scene.remove(this.menuProp);
    if (this.menuPrevEnv && this.stadium) { const [t, w] = this.menuPrevEnv; this.env.configure(t, w, this.stadium.lightPositions); this.post?.configure(); }
    this.menuPrevEnv = null;
  }
  updateMenuShot(dt) {
    // Toma baja a ras de césped: la cámara 3D a la derecha del cuadro, la gradería iluminada detrás
    const S = this.menuShotCfg || (this.menuShotCfg = { cam: [-6, 0.17, 26], yaw: 0.1, pitch: 0.05, d: 0.86, r: 0.3, rot: -1.05, fov: 38 });
    const t = this.menuT, P = this.menuProp, c = this.camera;
    const yaw = S.yaw + Math.sin(t * 0.07) * 0.025, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    P.position.set(S.cam[0] + fx * S.d + rx * S.r, 0, S.cam[2] + fz * S.d + rz * S.r);
    P.rotation.y = S.rot + Math.sin(t * 0.2) * 0.35;
    c.position.set(S.cam[0] + rx * Math.sin(t * 0.13) * 0.04, S.cam[1] + Math.sin(t * 0.17) * 0.01, S.cam[2] + rz * Math.sin(t * 0.13) * 0.04);
    c.lookAt(c.position.x + fx, S.cam[1] + Math.tan(S.pitch), c.position.z + fz); c.fov = S.fov; c.updateProjectionMatrix();
  }
  team(id) { return TEAMS[id]; }
  teamName(id) { return TEAMS[id]?.name || id; }
  resize() {
    const s = this.settings.data, q = this.settings.q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * q.pixelRatio * s.resolutionScale * (this.dynScale ?? 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
    this.post?.resize(window.innerWidth, window.innerHeight, this.renderer.getPixelRatio());
  }
  applyQuality() { this.post.setup(); this.resize(); this.renderer.shadowMap.enabled = this.settings.q.shadows > 0; this.env.sun.castShadow = this.settings.q.shadows > 0; }
  bindEvents() {
    const E = this.events;
    E.on('match:goal', ({ team }) => {
      this.audio.goalRoar(1); if (this.player.pos.z < (this.stadium?.gateZ ?? 0)) this.input.rumble(0.8, 0.6, 700); const st = this.stadium; if (!st) return;
      st.crowd.uniforms.uFocus.value.set(this.match.ball.pos.x * 1.2, 0, 0); st.crowd.uniforms.uFocusAmt.value = 0.8;
      this.career.stats.goals++;
    });
    E.on('match:save', () => this.audio.groan());
    E.on('match:event', (ev) => { if (ev.type === 'remate') setTimeout(() => { if (this.match && !this.match.events.some((e) => e.type === 'gol' && e.t > ev.t)) this.audio.groan(); }, 1300); });
    E.on('match:end', () => this.story.onMatchEnd());
    E.on('env:label', () => this.post?.configure());
    E.on('battery:empty', () => { this.ui.toast('¡Batería agotada! Presioná B para cambiarla.', 'bad', 4000); if (this.photoMode.active) this.photoMode.exit(); });
    E.on('photo:taken', (rec) => { this.career.stats.photos++; });
    E.on('inventory:changed', () => this.player?.syncSecondCamera?.());
  }
  // ---------------- Niveles ----------------
  disposeLevel() {
    this.menuPrevEnv = null; if (this.menuProp?.parent) this.scene.remove(this.menuProp);
    this.match?.dispose(); this.match = null;
    for (const o of [this.stadium?.group, this.city?.group]) if (o) { this.scene.remove(o); o.traverse((c) => { if (c.isMesh || c.isLine || c.isPoints) { c.geometry?.dispose(); } }); }
    this.scenery?.dispose(); this.scenery = null;
    this.stadium = null; this.city = null; this.collision = new CollisionWorld(); this.interaction.clear(); this.rules.reset();
    this.story.clear();
  }
  buildLevel(ev, onProgress = () => {}) {
    this.disposeLevel();
    const home = TEAMS[ev.home], away = TEAMS[ev.away];
    this.env.clearRegistry();
    this.env.configure(ev.time, ev.weather, []);
    onProgress(0.3, 'Construyendo estadio…');
    this.stadium = new Stadium(this, { ...STADIUMS[ev.stadium], cup: !!ev.cup }, home, away);
    this.audio.setStadium(ev.stadium);
    this.env.configure(ev.time, ev.weather, this.stadium.lightPositions);
    onProgress(0.6, 'Construyendo la ciudad…');
    this.city = new City(this, this.stadium.gateZ);
    this.scenery = new Scenery(this, new THREE.Vector3(0, 0, 0), 175);
    if (!this.post.composer && this.settings.q.bloom) this.post.setup(); else this.post.configure();
    onProgress(0.8, 'Calentando a los equipos…');
    this.match = new Match(this, this.stadium, home, away, { halfSeconds: +this.settings.data.halfSeconds || 240, youth: !!(ev.youth || home.youth) });
    this.collision.rebuild();
    this.scene.add(this.player.root);
    this.player.avatar.setLensLength(this.inventory.lens.max);
  }
  async startEvent(ev) {
    this.ui.closeScreen(true);
    await this.ui.fade(true);
    this.state = 'loading';
    const intro = !!ev.intro && !this.story.introDone;
    await new Promise((r) => setTimeout(r, 30));
    this.buildLevel(ev);
    this.career.startEvent(ev); this.inEvent = true;
    this.inventory.rechargeAll(); this.inventory.cardUsed = 0;
    this.story.setup(ev, intro);
    // Se sale desde la casa: carro propio, bus, taxi o Uber
    this.travel.setup(true);
    const H = this.city.spots.home; this.player.place(H.x, H.z, Math.PI / 2);
    this.player.setCameraEquipped(false); this.player.crouch = false;
    this.follow.yaw = Math.PI / 2; this.follow.pitch = 0.15; this.follow.snap(this.player);
    this.state = 'play'; this.input.wantLock = true;
    this.renderer.compile(this.scene, this.camera);
    await this.ui.fade(false);
    this.ui.toast(`${ev.title}: ${this.teamName(ev.home)} vs ${this.teamName(ev.away)}`, 'mission', 4000);
  }
  // ---------------- Partidas ----------------
  get female() { return this.player?.look?.gender === 'mujer'; }
  async newGame(name, look) {
    this.arcade = false;
    if (look) this.player.applyLook(look);
    this.playerName = name; this.profileId = 'p_' + Date.now();
    await this.photos.setProfile(this.profileId);
    this.career.reset(); this.inventory.reset(); this.missions.active = []; this.missions.done = []; this.story.introDone = false; this.phone.reset();
    this.saves.save('auto');
    await this.startEvent(EVENTS[0]);
  }
  async applySave(d) {
    this.arcade = false;
    this.playerName = d.playerName; this.profileId = d.profileId;
    await this.photos.setProfile(this.profileId);
    this.career.reset(); this.career.load(d.career); this.inventory.reset(); this.inventory.load(d.inventory); this.missions.load(d.missions); this.story.load(d.story); this.phone.load(d.phone);
    if (d.look) this.player.applyLook(d.look);
  }
  async continueGame() { const l = this.saves.latest(); if (l) await this.loadSlot(l.slot); }
  async loadSlot(slot) {
    const d = this.saves.read(slot); if (!d) return;
    await this.applySave(d);
    this.ui.toast('Partida cargada.', 'good');
    if (this.story.introDone) this.openHub(); else await this.startEvent(EVENTS[0]);
  }
  // ---------------- Modo arcade ----------------
  async startArcade(cfg) {
    this.arcadeCfg = cfg; this.arcade = true;
    this.ui.closeScreen(true);
    this.playerName = cfg.name || 'Fotógrafo';
    await this.photos.setProfile('arcade'); this.phone.reset();
    // Equipo completo disponible y listo
    const inv = this.inventory; inv.reset();
    for (const id of Object.keys(ALL_ITEMS)) if (ALL_ITEMS[id].type !== 'credential') inv.owned[id] = Math.max(1, inv.owned[id] || 0);
    const cam2 = cfg.camera2 === undefined ? (cfg.camera === 'jm_pro' ? 'jm_sport' : 'jm_pro') : cfg.camera2, lens2 = cam2 ? (cfg.lens2 || (cfg.lens === 'l_24_70' ? 'l_16_35' : 'l_24_70')) : null;
    inv.equipped = { camera: cfg.camera, lens: cfg.lens, card: 'card_256', backpack: 'backpack_pro', camera2: cam2, lens2 };
    inv.packed = new Set(['battery', 'monopod', 'raincover', ...Object.keys(ALL_ITEMS).filter((id) => ALL_ITEMS[id].type === 'lens' && id !== cfg.lens && id !== lens2)]);
    inv.spares = [1, 1];
    this.career.reset();
    const T = TIME_PRESETS[cfg.time];
    const ev = { id: 'arcade', title: 'Arcade', home: cfg.home, away: cfg.away, stadium: cfg.stadium, time: cfg.time, weather: cfg.weather, minRep: 0, mult: 1, kickoff: T.kickoff,
      assignment: { title: 'Partido arcade', desc: 'Las mejores fotos del partido.', tags: ['gol', 'celebracion', 'remate', 'atajada', 'disputa', 'entrada', 'regate', 'penal', 'expulsion', 'publico'] }, missions: [] };
    this.settings.data.halfSeconds = cfg.halfSeconds;
    await this.ui.fade(true);
    this.state = 'loading'; await new Promise((r) => setTimeout(r, 30));
    this.buildLevel(ev);
    this.career.startEvent(ev); this.inEvent = true;
    this.story.setup(ev, false);
    this.travel.setup(false);
    // Directo a la cancha: acreditado, preparado y con la cámara colgada
    this.missions.active = [];
    inv.credential = { eventId: 'arcade', event: 'Arcade', home: cfg.home, away: cfg.away, stadium: STADIUMS[cfg.stadium].name, date: '', number: 'ARC-001' };
    inv.prepared = true; this.story.stage = 'briefed'; this.story.inBowlOnce = true; this.story.briefed = true;
    this.stadium.gate.open();
    this.player.place(57.2, -12, -Math.PI / 2); this.player.crouch = false;
    this.player.setCameraEquipped(true); this.player.avatar.setLensLength(inv.lens.max);
    this.follow.yaw = -Math.PI / 2; this.follow.pitch = 0.15; this.follow.snap(this.player);
    this.clock = cfg.start === 'kickoff' ? T.kickoff : cfg.start === 'early' ? T.kickoff - 150 : T.kickoff - 4;
    if (cfg.start === 'early') { this.env.dynamic = true; this.env.setHour(this.clock / 60, true); }
    this.crowdLife.warmAnnounced = this.clock >= T.kickoff - 45;
    if (cfg.start === 'kickoff') this.story.kickoffNow();
    this.ui.setObjective(`Arcade: ${this.teamName(cfg.home)} vs ${this.teamName(cfg.away)} · Conseguí las mejores fotos del partido.`);
    this.state = 'play'; this.input.wantLock = true;
    this.renderer.compile(this.scene, this.camera);
    await this.ui.fade(false);
    this.ui.toast(`ARCADE · ${STADIUMS[cfg.stadium].name} · ${TIME_PRESETS[cfg.time].label}`, 'mission', 3500);
  }
  arcadeEnd() {
    if (!this.arcade || this.state !== 'play') return;
    if (this.photoMode.active) this.photoMode.exit();
    this.inEvent = false;
    const photos = this.photos.session().slice().sort((a, b) => this.photos.finalScore(b) - this.photos.finalScore(a));
    this.screens.arcadeResults(photos);
  }
  async quitToMenu() {
    if (this.arcade) { this.arcade = false; this.inEvent = false; if (this.photoMode.active) this.photoMode.exit(); this.ui.closeScreen(true); this.state = 'menu'; this.screens.mainMenu(); return; }
    if (this.inEvent) { this.career.settle([], true); this.inEvent = false; }
    if (this.profileId) this.saves.save('auto');
    if (this.photoMode.active) this.photoMode.exit();
    this.ui.closeScreen(true); this.state = 'menu'; this.screens.mainMenu();
  }
  openHub() {
    this.inEvent = false; this.state = 'hub'; if (this.photoMode.active) this.photoMode.exit();
    if (!this.stadium) this.buildLevel(this.career.nextEvent() || EVENTS[0]);
    this.screens.hub();
  }
  // ---------------- Entrega al editor ----------------
  openDelivery() {
    const gal = new Gallery(this, { mode: 'deliver', onDeliver: (sel) => this.deliver(sel) });
    const el = h('div', { class: 'screen tabs-screen' }, h('div', { class: 'tabs-wrap panel' },
      h('div', { class: 'tabbar', style: { padding: '8px 12px 0' } }, h('div', { class: 'tab on' }, 'ENTREGA AL EDITOR'), h('div', { class: 'muted', style: { fontSize: '13px', marginLeft: '12px' } }, `Encargo: ${this.career.currentAssignment()?.title || '—'} · Seleccioná hasta 10 fotos (casilla inferior izquierda)`),
        h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => this.resume() }, 'Cerrar')),
      h('div', { class: 'tabbody' }, gal.root)));
    this.ui.openScreen('delivery', el);
  }
  async deliver(sel) {
    for (const r of sel) { r.delivered = true; r.selected = false; await this.photos.update(r); }
    const res = this.career.settle(sel);
    if (sel.some((r) => this.photos.finalScore(r) >= 40)) this.events.emit('delivery:valid');
    this.story.stage = 'done'; this.story.setObjective(); this.story.introDone = true; this.inEvent = false;
    this.audio.ui('cash');
    this.saves.save('auto');
    this.screens.results(res, sel, () => { this.saves.save('auto'); this.openHub(); });
  }
  // ---------------- Pausa / entrada ----------------
  resume() {
    this.ui.closeScreen();
    if (this.state === 'play') { this.input.wantLock = true; this.input.requestLock(); }
    else if (this.state === 'hub') this.screens.hub();
    else if (this.state === 'results') this.screens.arcadeResults(this.lastArcadePhotos || []);
    else if (this.state === 'menu') this.screens.mainMenu();
  }
  onLockChange() {
    const locked = !!document.pointerLockElement;
    if (!locked && this.input.expectingRelease) { this.input.expectingRelease = false; return; }
    if (!locked && this.state === 'play' && !this.ui.screen && !this.ui.dialogueActive && this.lockWasOn) this.onEscape();
    this.lockWasOn = locked;
  }
  onEscape() {
    if (this.state !== 'play') return;
    if (this.phoneCam.active) { this.phoneCam.exit(); return; }
    if (this.drone.active) { this.drone.exit(); return; }
    if (this.photoMode.active) { this.photoMode.exit(); return; }
    if (this.ui.dialogueActive || this.cinematic) return;
    if (this.ui.screen) { this.resume(); return; }
    this.screens.pause('inventario');
  }
  handleInput() {
    const inp = this.input, pm = this.photoMode, p = this.player;
    if (this.drone.active) { if (inp.keyPressed('Escape')) this.drone.exit(); return; }
    if (this.phoneCam.active) { if (!this.ui.screen && (inp.keyPressed(inp.bind('phone')))) { this.phone.open(); } return; }
    if (this.travel.mode) { if (inp.keyPressed('Escape') || inp.padPressed('pause')) this.onEscape(); else if (!this.ui.screen && (inp.keyPressed(inp.bind('phone')) || (inp.padPressed('phone')))) { inp.consumePad(); this.phone.open(); } return; }
    if (inp.keyPressed('Escape') || inp.padPressed('pause')) this.onEscape();
    if (this.ui.screenName === 'phone' && (inp.keyPressed(inp.bind('phone')) || inp.padPressed('phone'))) { inp.consumePad(); this.resume(); return; }
    if (this.ui.screen || this.ui.dialogueActive || this.cinematic) return;
    if (!pm.active) {
      if (inp.wasPressed('inventory')) return this.screens.pause('inventario');
      if (inp.wasPressed('gallery')) return this.screens.pause('galeria');
      if (inp.wasPressed('map')) return this.screens.pause('mapa');
      if (inp.wasPressed('missions')) return this.screens.pause('misiones');
      if (inp.wasPressed('gear')) return this.screens.pause('inventario');
      if (inp.wasPressed('phone')) { inp.consumePad(); return this.phone.open(); }
      if (inp.keyPressed('KeyK')) return this.drone.enter();
      if (inp.wasPressed('interact')) this.interaction.interact();
      if (inp.wasPressed('view')) this.toggleView();
    }
    const notReady = this.inEvent && !this.inventory.prepared;
    if ((inp.wasPressed('equip') || inp.mouse.rightPressed || inp.padTriggerPressed(6)) && notReady) {
      this.ui.toast('Tu cámara está guardada en la mochila: prepará el equipo en la zona de preparación de prensa (después de seguridad).', 'warn', 3500); return;
    }
    if (inp.wasPressed('equip')) {
      if (pm.active) pm.exit();
      p.setCameraEquipped(!p.cameraEquipped); this.audio.ui('click');
      this.ui.toast(p.cameraEquipped ? `Cámara equipada: ${this.inventory.camera.name} + ${this.inventory.lens.short}` : 'Cámara guardada', 'info', 1400);
    }
    if (inp.mouse.rightPressed || inp.padTriggerPressed(6)) {
      if (pm.active) pm.exit();
      else { if (!p.cameraEquipped) p.setCameraEquipped(true); pm.enter(); }
    }
    if (inp.keyPressed(inp.bind('swapCamera')) || (pm.active && inp.padPressed('sprint'))) this.swapCameraBodies();
    if (inp.keyPressed(inp.bind('swapBattery')) || (pm.active && inp.padPressed('swapBattery'))) {
      if (this.inventory.swapBattery()) { this.ui.toast(`Batería cambiada (${this.inventory.batteryPct}%).`, 'good'); this.audio.ui('click'); }
      else this.ui.toast('No hay baterías de repuesto con carga en la mochila.', 'warn');
    }
  }
  swapCameraBodies() {
    const inv = this.inventory, pm = this.photoMode;
    if (!inv.hasSecond) { this.ui.toast('No llevás segunda cámara. Armá el segundo cuerpo en el inventario (antes del evento).', 'warn', 2600); return; }
    if (this.inEvent && !inv.prepared) { this.ui.toast('Primero prepará el equipo en la zona de prensa.', 'warn'); return; }
    const prevFocal = pm.s.focal; pm.s.focal = this.cam2Focal ?? inv.lens2.min; this.cam2Focal = prevFocal;
    inv.swapBodies();
    pm.clampFocal(); pm.clampAperture?.();
    const p = this.player; p.avatar.setLensLength(inv.lens.max); p.avatar.setCameraBody(inv.camera.look); p.syncSecondCamera();
    this.audio.ui('click');
    this.ui.toast(`Segunda cámara en mano: ${inv.camera.name} + ${inv.lens.short} (${inv.batteryPct}% batería)`, 'info', 1800);
  }
  toggleView() {
    const s = this.settings.data, fp = s.view !== 'primera';
    s.view = fp ? 'primera' : 'tercera'; this.settings.save();
    if (fp) this.follow.fpPitch = 0; else this.follow.snap(this.player);
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    this.ui.toast(fp ? 'Vista en primera persona' : 'Vista en tercera persona', 'info', 1400);
  }
  // ---------------- Bucle ----------------
  // Resolución dinámica: baja la resolución interna si los FPS caen y la sube cuando sobran
  dynamicResolution(dt) {
    if (!this.settings.data.dynRes || this.state !== 'play' || this.drone?.rec) { if (this.dynScale !== 1 && !this.drone?.rec) { this.dynScale = 1; this.resize(); } return; }
    this.dynT = (this.dynT || 0) + dt; if (this.dynT < 1.5) return; this.dynT = 0;
    const s = this.dynScale ?? 1, f = this.fps;
    let n = s;
    if (f < 45) n = Math.max(0.6, s - (f < 32 ? 0.15 : 0.08)); else if (f > 58 && s < 1) n = Math.min(1, s + 0.05);
    if (Math.abs(n - s) > 0.001) { this.dynScale = n; this.resize(); }
  }
  start() {
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
      this.dynamicResolution(dt);
      try { this.update(this.drone.active ? dt * this.drone.timeScale : dt); this.drone.update(); this.render(); this.recorder.frame(); } catch (e) { console.error(e); }
      this.input.endFrame();
    };
    requestAnimationFrame(loop);
  }
  update(dt) {
    this.time += dt;
    this.input.pollPad();
    if (this.input.pad && !this.padAnnounced) { this.padAnnounced = true; this.audio.start(); this.ui.toast(this.input.isPlayStation ? '🎮 Control de PlayStation conectado' : '🎮 Control conectado', 'good'); }
    if (!this.input.pad) this.padAnnounced = false;
    this.ui.padNav(dt);
    const st = this.stadium, m = this.match, p = this.player;
    if (this.state === 'menu' || this.state === 'hub' || this.state === 'results') {
      // Cámara orbital cinematográfica sobre el estadio
      this.menuT += dt;
      if (m) { m.update(dt); }
      if (this.state === 'menu' && this.menuProp?.parent) this.updateMenuShot(dt);
      else {
        if (this.menuProp?.parent) this.leaveMenuScene();
        const a = this.menuT * 0.05;
        this.camera.position.set(Math.cos(a) * 75, 22 + Math.sin(this.menuT * 0.1) * 4, Math.sin(a) * 52);
        this.camera.lookAt(0, 2, 0); this.camera.fov = 50; this.camera.updateProjectionMatrix();
      }
      if (st) { st.update(dt, this.time, m?.excite || 0.2); const cu = st.crowd.uniforms; cu.uExcite.value = 0.25; cu.uFill.value = 1; cu.uNear.value = 0; cu.uAimAmt.value = 0; cu.uChant.value = 0.4; }
      this.env.update(dt, new THREE.Vector3(0, 0, 0), this.time);
      this.audio.update(dt, { inStadiumBowl: true, interior: false, distToStadium: 0, excite: 0.25, weather: this.env.weather, time: this.env.time, crowd: !!st, city: false, menu: true });
      this.player.root.visible = false;
      return;
    }
    if (this.menuProp?.parent) this.leaveMenuScene();
    if (this.state !== 'play') { if (this.drone.active) this.drone.exit(); if (this.phoneCam.active) this.phoneCam.exit(); return; }
    this.handleInput();
    const paused = !!this.ui.screen;
    if (paused) { this.phone.update(dt); this.ui.update(dt); return; }
    const freeMove = !this.ui.dialogueActive && !this.cinematic && !this.drone.active && !this.travel.mode;
    if (this.phoneCam.active) {
      p.update(dt, this.input, this.phoneCam.moveYaw(), freeMove);
    } else if (!this.photoMode.active) {
      this.follow.update(dt, this.input, p, freeMove && (this.input.locked || this.input.pad));
      p.update(dt, this.input, this.follow.yaw, freeMove);
      p.root.visible = this.drone.active || (!this.follow.firstPerson && !this.camOverride);
    } else {
      p.update(dt, this.input, this.photoMode.yaw, freeMove);
      this.photoMode.update(dt);
    }
    if (this.camOverride) { this.camera.position.lerp(this.camOverride.pos, 1 - Math.exp(-6 * dt)); this.camera.lookAt(this.camOverride.look); if (Math.abs(this.camera.fov - 45) > 0.1) { this.camera.fov = 45; this.camera.updateProjectionMatrix(); } }
    // Superficie para pasos
    p.surface = Math.abs(p.pos.x) < 60.5 && Math.abs(p.pos.z) < 42 ? 'grass' : p.pos.z > APRON_Z && st && p.pos.z < st.gateZ ? 'tile' : 'concrete';
    // Interacción contextual
    if (freeMove && !this.photoMode.active) this.ui.setPrompt(this.interaction.update(p.pos, p.forward)); else this.ui.setPrompt(null);
    // Mundo
    const outside = st && p.pos.z > st.gateZ + 0.5, deepInside = st && p.pos.z < st.gateZ - 3;
    if (m) {
      m.update(dt);
      m.group.visible = !outside && this.crowdLife.pitchVisible;
    }
    if (st) {
      st.gate.watch = p.pos;
      st.update(dt, this.time, m?.excite || 0.15);
      const cu = st.crowd.uniforms;
      cu.uExcite.value = m ? m.excite * 0.85 : 0.1;
      cu.uStand.value = !m || m.phase === 'warmup' ? 0.12 : m.phase === 'halftime' ? 0.05 : 0.3;
      cu.uFocusAmt.value = Math.max(0, cu.uFocusAmt.value - dt * 0.08);
      if (m && m.half === 2 && m.phase === 'play' && m.excite < 0.3 && Math.random() < dt * 0.01 && cu.uWave.value > 400) cu.uWave.value = -200;
      if (cu.uWave.value < 500) cu.uWave.value += dt * 32;
      st.crowd.mesh.visible = !outside;
      if (m && Math.floor(this.time * 2) !== this.sbTick) { this.sbTick = Math.floor(this.time * 2); st.updateScoreboard({ home: m.score[0], away: m.score[1], minute: m.minute, phase: m.phase === 'warmup' ? 'PREVIA' : m.half === 1 ? '1T' : '2T', message: m.phase === 'goal' ? '¡¡¡GOOOL!!!' : m.phase === 'halftime' ? 'ENTRETIEMPO' : m.phase === 'fulltime' ? 'FINAL' : null }); }
    }
    if (this.city) { this.city.update(dt, p.pos, this.audio); }
    const farFromStadium = st && p.pos.x < -230;
    if (st) st.group.visible = !farFromStadium;
    for (const n of this.story.npcs) {
      const inCity = n.root.parent === this.city?.group;
      const vis = (inCity ? !deepInside : !outside || n === this.story.guard) && Math.abs(n.pos.x - p.pos.x) < 170;
      n.root.visible = vis;
      if (vis && n.pos.distanceTo(p.pos) < 140) n.update(dt, p.pos);
    }
    this.story.update(dt); this.rules.update(dt); this.crowdLife.update(dt); this.phone.update(dt); this.travel.update(dt); this.phoneCam.update(dt);
    this.env.update(dt, st && Math.abs(p.pos.x) < 75 && Math.abs(p.pos.z) < 48 ? new THREE.Vector3(0, 0, 0) : this.camera.position, this.time, this.clock / 60);
    // Audio
    const interior = st && p.pos.z > APRON_Z + 0.5 && p.pos.z < st.gateZ && Math.abs(p.pos.x) < 25;
    this.audio.updateListener(this.camera);
    this.audio.update(dt, { inStadiumBowl: st && Math.abs(p.pos.x) < APRON_X + 1 && Math.abs(p.pos.z) < APRON_Z + 0.5, interior, distToStadium: st ? Math.max(0, p.pos.z - st.gateZ) : 0,
      excite: m ? m.excite : 0.1, weather: this.env.weather, time: this.env.time, crowd: true, city: true, clasico: !!(this.stadium?.cfg.clasico || this.career.event?.clasico) });
    this.viewModel.update(dt);
    this.ui.update(dt);
  }
  render() {
    // Sombras: con poca holgura de FPS se recalculan cada dos cuadros (casi imperceptible y ahorra mucho)
    const sm = this.renderer.shadowMap; sm.autoUpdate = false;
    sm.needsUpdate = (this.frameN = (this.frameN || 0) + 1) % ((this.dynScale ?? 1) < 0.9 && this.settings.data.dynRes ? 2 : 1) === 0;
    if (this.state === 'boot' || this.state === 'loading') { this.renderer.render(this.scene, this.camera); return; }
    if (this.photoMode.active && !this.ui.screen) this.photoMode.pipeline.renderLive(this.scene, this.camera, this.photoMode.opticsState());
    else this.post.draw(this.camera);
    if (this.state !== 'play') this.ui.update(0);
  }
}
