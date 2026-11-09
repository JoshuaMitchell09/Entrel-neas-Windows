import { h, clear, scoreColor } from './dom.js';
import { Gallery } from './Gallery.js';
import { drawCredential } from './Credential.js';
import { ALL_ITEMS, CAMERAS, LENSES, ACCESSORIES } from '../photography/Equipment.js';
import { MISSION_DEFS } from '../missions/Missions.js';
import { TITLES, CONTRACTS } from '../career/Career.js';
import { STADIUMS } from '../world/StadiumConfigs.js';
import { TIME_PRESETS, WEATHER_PRESETS } from '../world/Environment.js';
import { QUALITY_PRESETS } from '../core/Settings.js';
import { ACTION_LABELS, DEFAULT_BINDINGS } from '../core/Input.js';
import { formatMoney, formatClock } from '../core/MathUtil.js';
import { LABELS } from '../photography/PhotoEvaluator.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { TEAMS } from '../football/Teams.js';
import { openCustomizer } from './Customizer.js';

const ICONS = { camera: '📷', lens: '🔭', card: '💾', battery: '🔋', accessory: '🧰', backpack: '🎒', credential: '🪪' };

export class Screens {
  constructor(game) { this.game = game; this.timeChoice = {}; this.arriveChoice = {}; }
  get ui() { return this.game.ui; }
  // ================= MENÚ PRINCIPAL =================
  mainMenu() {
    const g = this.game, has = g.saves.hasAny();
    g.enterMenuScene?.();
    const items = [
      has && { label: 'Continuar', desc: 'Retomá tu carrera donde la dejaste.', go: () => g.continueGame() },
      { label: 'Carrera', desc: 'De novato a fotógrafo estrella de la Liga Tica.', go: () => this.newGameDialog() },
      { label: 'Arcade', desc: 'Un partido rápido: elegí estadio, equipos, hora y clima.', go: () => this.arcadeSetup() },
      has && { label: 'Cargar partida', desc: 'Abrí otra de tus partidas guardadas.', go: () => this.loadMenu() },
      { label: 'Ajustes', desc: 'Gráficos, sonido, controles y accesibilidad.', go: () => this.settingsStandalone() },
      { label: 'Créditos', desc: 'Quiénes hicieron este juego.', go: () => this.credits() },
    ].filter(Boolean);
    const news = [
      { k: 'BIENVENIDA', t: '¡Bienvenido a Entre Líneas!', s: 'El partido lo juegan ellos. La historia la capturás vos.' },
      { k: 'NUEVO', t: 'Copa Centroamericana', s: 'Acreditación especial, rivales de toda la región y noches de copa en la Cueva.' },
      { k: 'CARRERA', t: 'Fotógrafo oficial del club', s: 'Si el titular se enferma, el editor te llama: vestuarios, palco y todo el estadio.' },
      { k: 'MODO CINE', t: 'Grabá con el dron o el celular', s: 'Videos horizontales o verticales para presentar tus mejores tomas.' },
      { k: 'ESTADIOS', t: 'Seis estadios, de día o de noche', s: 'Lluvia, neblina y luces de estadio. Llegá en carro, bus, taxi o Uber.' },
    ];
    let sel = 0, slide = 0;
    const desc = h('div', { class: 'mm-desc' });
    const btns = items.map((it, i) => h('button', { class: 'mm-item', onmouseenter: () => pick(i), onfocus: () => pick(i), onclick: () => { g.audio.ui?.('click'); it.go(); } }, it.label));
    const pick = (i) => { sel = i; btns.forEach((b, k) => b.classList.toggle('on', k === i)); desc.textContent = items[i].desc; };
    const head = h('div', { class: 'mm-slide' });
    const dots = h('div', { class: 'mm-dots' }, ...news.map((_, i) => h('span', { onclick: () => show(i) })));
    const show = (i) => {
      slide = (i + news.length) % news.length; const n = news[slide];
      head.replaceChildren(h('div', { class: 'mm-kicker' }, n.k), h('div', { class: 'mm-title' }, n.t), h('div', { class: 'mm-sub' }, n.s));
      head.classList.remove('in'); void head.offsetWidth; head.classList.add('in');
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === slide));
    };
    const el = h('div', { class: 'screen menu2' },
      h('div', { class: 'mm-panel' }),
      h('div', { class: 'mm-top' },
        h('div', { class: 'mm-badge' }, h('span', { class: 'a' }, 'EL'), h('span', { class: 'b' }, '📷')),
        h('div', { class: 'mm-brand' }, h('div', { class: 'a' }, 'ENTRE LÍNEAS'), h('div', { class: 'b' }, 'FOTÓGRAFO DE LA LIGA TICA')),
        h('button', { class: 'mm-icon', title: 'Ajustes', onclick: () => this.settingsStandalone() }, '⚙')),
      h('div', { class: 'mm-list' }, ...btns, desc),
      h('div', { class: 'mm-news' }, head, dots),
      h('div', { class: 'mm-hint' }, h('span', { class: 'key' }, 'Esc'), ' Ajustes', h('span', { class: 'key', style: { marginLeft: '18px' } }, '↑↓'), ' Navegar', h('span', { class: 'key', style: { marginLeft: '18px' } }, 'Enter'), ' Elegir'),
      h('div', { class: 'mm-foot' }, h('span', { class: 'dot' }), `${g.playerName && g.playerName !== 'Fotógrafo' ? g.playerName + ' · ' : ''}v0.1 · Clubes, estadios y marcas ficticias`));
    pick(0); show(0);
    const timer = setInterval(() => { if (document.body.contains(el)) show(slide + 1); }, 6500);
    const onKey = (e) => {
      if (this.ui.screen !== el || this.ui.root.querySelector('.confirm-layer')) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); pick((sel + 1) % items.length); btns[sel].focus(); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); pick((sel - 1 + items.length) % items.length); btns[sel].focus(); }
      else if (e.code === 'ArrowRight') show(slide + 1); else if (e.code === 'ArrowLeft') show(slide - 1);
      else if (e.code === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); items[sel].go(); }
      else if (e.code === 'Escape') { e.preventDefault(); this.settingsStandalone(); }
    };
    document.addEventListener('keydown', onKey);
    this.ui.openScreen('menu', el);
    this.ui.screenCleanup = () => { clearInterval(timer); document.removeEventListener('keydown', onKey); };
  }
  async newGameDialog() {
    const g = this.game;
    if (g.saves.hasAny() && !(await this.ui.confirm('Empezar una nueva partida no borra tus guardados, pero el autoguardado se sobrescribirá con la nueva carrera.', 'Continuar', false))) return;
    const name = h('input', { type: 'text', value: 'Josué Navarro', maxlength: 28, style: { width: '100%', fontSize: '18px', padding: '10px' } });
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel confirm', style: { width: '520px', textAlign: 'left' } },
      h('div', { class: 'h2' }, 'Nueva carrera'), h('div', { class: 'muted', style: { marginBottom: '14px' } }, 'Tu nombre aparecerá en la acreditación y en los créditos de tus fotos.'),
      name, h('div', { class: 'acts', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => this.mainMenu() }, 'Volver'),
        h('button', { class: 'btn primary', onclick: () => { const nm = name.value.trim() || 'Fotógrafo'; openCustomizer(g, { title: `${nm}: tu fotógrafo`, confirm: 'Comenzar carrera →', onBack: () => this.newGameDialog(), onDone: (look) => g.newGame(nm, look) }); } }, 'Siguiente: apariencia →'))));
    this.ui.openScreen('newgame', el); setTimeout(() => name.focus(), 50);
  }
  loadMenu(fromPause = false) {
    const g = this.game;
    const list = h('div', { class: 'grid', style: { gridTemplateColumns: '1fr' } });
    for (const { slot, data } of g.saves.list()) {
      list.append(h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        h('div', { style: { flex: 1 } }, h('b', {}, slot === 'auto' ? 'Autoguardado' : `Ranura ${slot}`),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, data ? `${data.playerName} · ${new Date(data.savedAt).toLocaleString('es-CR')} · Rep. ${Math.round(data.career.reputation)} · ${formatMoney(data.career.money)} · ${data.career.completed.length} eventos` : 'Vacía')),
        data ? h('button', { class: 'btn primary small', onclick: () => g.loadSlot(slot) }, 'Cargar') : null,
        data ? h('button', { class: 'btn danger small', onclick: async () => { if (await this.ui.confirm('Se eliminará este guardado. Si ningún otro guardado usa esta carrera, también se borrarán sus fotografías.', 'Eliminar')) { await g.saves.remove(slot); this.loadMenu(fromPause); } } }, 'Eliminar') : null));
    }
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel results' }, h('div', { class: 'h2' }, 'Cargar partida'), list,
      h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => (fromPause ? this.pause('guardar') : this.mainMenu()) }, 'Volver'))));
    this.ui.openScreen('load', el);
  }
  credits() {
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel results', style: { maxWidth: '640px' } }, h('div', { class: 'h2' }, 'Créditos'),
      h('p', {}, 'ENTRE LÍNEAS: Fotógrafo de la Liga Tica — simulador de fotografía deportiva.'),
      h('p', { class: 'muted' }, 'Todo el contenido (estadios, clubes, jugadores, marcas, texturas y sonidos) es ficticio y se genera proceduralmente en tiempo real. Motor: Three.js (WebGL) + WebAudio.'),
      h('button', { class: 'btn', onclick: () => this.mainMenu() }, 'Volver')));
    this.ui.openScreen('credits', el);
  }
  settingsStandalone() {
    const body = h('div'); this.settingsTab(body);
    this.ui.openScreen('settings', h('div', { class: 'screen tabs-screen' }, h('div', { class: 'tabs-wrap panel' }, h('div', { class: 'tabbar', style: { padding: '8px 12px 0' } }, h('div', { class: 'tab on' }, 'AJUSTES'), h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => this.mainMenu() }, 'Volver')), h('div', { class: 'tabbody' }, body))));
  }
  // ================= MODO ARCADE =================
  arcadeSetup() {
    const g = this.game;
    let cfg = { stadium: 'cueva', home: 'tibas', away: 'toros', time: 'night', weather: 'clear', halfSeconds: 240, camera: 'jm_pro', lens: 'l_100_400', start: 'warmup', name: g.playerName && g.playerName !== 'Fotógrafo' ? g.playerName : 'Josué Navarro' };
    try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem('entrelineas.arcade') || '{}') }; } catch (e) { /* sin guardado */ }
    const body = h('div');
    const render = () => {
      clear(body);
      const field = (label, ctrl) => h('div', { class: 'card', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, h('div', { class: 'h3', style: { margin: 0 } }, label), ctrl);
      const sel = (key, opts, after) => h('select', { style: { width: '100%', fontSize: '15px', padding: '8px' }, onchange: (e) => { cfg[key] = isNaN(+e.target.value) || key === 'stadium' ? e.target.value : +e.target.value; after?.(); render(); } },
        ...opts.map(([v, l]) => h('option', { value: v, selected: String(cfg[key]) === String(v) ? true : null }, l)));
      const teams = Object.values(TEAMS).map((t) => [t.id, t.name]);
      const st = STADIUMS[cfg.stadium];
      const teamCard = (key, label) => field(label, h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, this.ui.crest(TEAMS[cfg[key]], 44),
        sel(key, teams.filter(([id]) => id !== cfg[key === 'home' ? 'away' : 'home']))));
      const lenses = Object.values(LENSES).map((l) => [l.id, l.name]);
      body.append(
        h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } },
          field('Estadio', h('div', {}, sel('stadium', Object.values(STADIUMS).map((x) => [x.id, x.name]), () => { const local = { cueva: 'tibas', alajuela: 'toros', cartago: 'brumas' }[cfg.stadium]; if (local && local !== cfg.away) cfg.home = local; }),
            h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '6px' } }, `${st.city} · ${st.capacity.toLocaleString('es-CR')} espectadores. ${st.description}`))),
          teamCard('home', 'Equipo local'), teamCard('away', 'Equipo visitante'),
          field('Horario', sel('time', Object.entries(TIME_PRESETS).map(([k, v]) => [k, v.label]))),
          field('Clima', sel('weather', Object.entries(WEATHER_PRESETS).map(([k, v]) => [k, v.label]))),
          field('Duración de cada tiempo', sel('halfSeconds', [[150, 'Corto (2,5 min)'], [240, 'Normal (4 min)'], [360, 'Largo (6 min)'], [540, 'Extendido (9 min)']])),
          field('Cámara', sel('camera', Object.values(CAMERAS).map((c) => [c.id, c.name]))),
          field('Lente inicial (los demás van en la mochila)', sel('lens', lenses)),
          field('Empezar en', sel('start', [['early', 'Llegar 2,5 h antes (estadio vacío que se va llenando)'], ['warmup', 'Calentamiento y salida de los equipos'], ['kickoff', 'Directo al saque inicial']]))),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', gap: '10px', flexWrap: 'wrap' } },
          h('div', { class: 'teams', style: { fontSize: '20px' } }, this.ui.crest(TEAMS[cfg.home], 40), TEAMS[cfg.home].name, h('span', { class: 'muted' }, ' vs '), this.ui.crest(TEAMS[cfg.away], 40), TEAMS[cfg.away].name),
          h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn', onclick: () => this.mainMenu() }, 'Volver'),
            h('button', { class: 'btn', onclick: () => { try { localStorage.setItem('entrelineas.arcade', JSON.stringify(cfg)); } catch (e) { /* */ } openCustomizer(g, { title: 'Tu fotógrafo (arcade)', confirm: 'Guardar', onBack: () => this.arcadeSetup(), onDone: (look) => { g.player.applyLook(look); this.arcadeSetup(); } }); } }, '🎨 Apariencia'),
            h('button', { class: 'btn primary', style: { fontSize: '17px', padding: '12px 26px' }, onclick: () => { try { localStorage.setItem('entrelineas.arcade', JSON.stringify(cfg)); } catch (e) { /* */ } g.startArcade({ ...cfg }); } }, '¡Al estadio! →'))));
    };
    render();
    const el = h('div', { class: 'screen tabs-screen' }, h('div', { class: 'tabs-wrap panel' },
      h('div', { class: 'tabbar', style: { padding: '8px 12px 0' } }, h('div', { class: 'tab on' }, 'MODO ARCADE'), h('div', { class: 'muted', style: { fontSize: '13px', marginLeft: '10px' } }, 'Elegí estadio, equipos, clima y horario. Todo el equipo fotográfico está disponible.')),
      h('div', { class: 'tabbody' }, body)));
    this.ui.openScreen('arcade', el);
  }
  arcadeResults(photos) {
    const g = this.game, cfg = g.arcadeCfg, m = g.match;
    const scores = photos.map((p) => g.photos.finalScore(p));
    const top = photos.slice(0, 10), points = top.reduce((a, p) => a + g.photos.finalScore(p), 0);
    const moments = {}; for (const p of photos) { const k = p.eval.moment.label; if (p.eval.moment.type) moments[k] = (moments[k] || 0) + 1; }
    const best = photos[0];
    const rank = points >= 800 ? 'Leyenda del lente' : points >= 650 ? 'Fotógrafo de portada' : points >= 450 ? 'Profesional' : points >= 250 ? 'Promesa' : 'Aficionado';
    const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' } }, ...top.map((p) => {
      const ev = p.editedEval || p.eval;
      return h('div', { class: 'card', style: { padding: '8px' } }, h('img', { src: p.thumb, style: { width: '100%', borderRadius: '6px' } }),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '6px' } }, h('span', { style: { fontSize: '12px' } }, `${p.eval.moment.label} · ${p.meta.minute}'`), h('b', { style: { color: scoreColor(ev.score) } }, ev.score)));
    }));
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel results' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' } },
        h('div', {}, h('div', { class: 'muted', style: { letterSpacing: '2px', fontSize: '12px' } }, 'MODO ARCADE · ' + STADIUMS[cfg.stadium].name.toUpperCase()),
          h('div', { class: 'h1' }, `${TEAMS[cfg.home].short} ${m?.score[0] ?? 0} - ${m?.score[1] ?? 0} ${TEAMS[cfg.away].short}`),
          h('div', { class: 'muted' }, `${TIME_PRESETS[cfg.time].label} · ${WEATHER_PRESETS[cfg.weather].label} · ${photos.length} fotos tomadas`)),
        h('div', { style: { textAlign: 'right' } }, h('div', { class: 'bigscore', style: { color: 'var(--accent)' } }, points), h('div', { class: 'muted' }, 'puntos (suma de tus 10 mejores fotos)'), h('div', { style: { fontWeight: 700, fontSize: '18px', marginTop: '4px' } }, rank))),
      best ? h('div', { class: 'card', style: { margin: '14px 0', display: 'grid', gridTemplateColumns: 'minmax(200px, 320px) 1fr', gap: '14px', borderColor: 'var(--accent)' } }, h('img', { src: best.thumb, style: { width: '100%', borderRadius: '8px' } }),
        h('div', {}, h('div', { class: 'h3' }, 'Tu mejor foto'), h('div', { style: { fontSize: '18px', fontWeight: 700 } }, `${(best.editedEval || best.eval).label}: ${scores[0]}/100`), h('div', { style: { marginTop: '6px', lineHeight: 1.5 } }, best.eval.comments.join(' ')),
          h('div', { class: 'muted', style: { marginTop: '8px', fontSize: '13px' } }, Object.entries(moments).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Sin jugadas clave capturadas'))) : h('div', { class: 'muted', style: { margin: '14px 0' } }, 'No tomaste fotos en este partido.'),
      h('div', { class: 'h3' }, 'Tus 10 mejores'), grid,
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px', flexWrap: 'wrap' } },
        h('button', { class: 'btn', onclick: () => this.pause('galeria') }, 'Ver galería'),
        h('button', { class: 'btn', onclick: () => { g.arcade = false; g.state = 'menu'; this.arcadeSetup(); } }, 'Configurar otro partido'),
        h('button', { class: 'btn', onclick: () => g.quitToMenu() }, 'Menú principal'),
        h('button', { class: 'btn primary', onclick: () => g.startArcade({ ...cfg }) }, 'Jugar otra vez'))));
    g.state = 'results'; g.lastArcadePhotos = photos; this.ui.openScreen('arcadeResults', el);
  }
  // ================= PAUSA (pestañas) =================
  pause(tab = 'inventario', opts = {}) {
    const g = this.game;
    const tabs = [['inventario', 'INVENTARIO'], ['galeria', 'GALERÍA'], ['misiones', 'MISIONES'], ['mapa', 'MAPA'], ['perfil', 'PERFIL'], ['ajustes', 'AJUSTES'], ['guardar', 'GUARDAR / CARGAR']];
    const bar = h('div', { class: 'tabbar', style: { padding: '8px 12px 0' } });
    const body = h('div', { class: 'tabbody' });
    const go = (t) => {
      for (const b of bar.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.t === t);
      clear(body); this.current = t; g.ui.screenCleanup?.(); g.ui.screenCleanup = null;
      ({ inventario: () => this.inventoryTab(body), galeria: () => body.append(new Gallery(g, opts.gallery || {}).root), misiones: () => this.missionsTab(body), mapa: () => this.mapTab(body),
        perfil: () => this.profileTab(body), ajustes: () => this.settingsTab(body), guardar: () => this.saveTab(body) })[t]();
    };
    for (const [k, l] of tabs) { const b = h('button', { class: 'tab', onclick: () => go(k) }, l); b.dataset.t = k; bar.append(b); }
    bar.append(h('div', { class: 'spacer' }),
      h('button', { class: 'btn small', onclick: () => g.resume() }, g.state === 'play' ? '▶ Reanudar (Esc)' : '← Volver'),
      g.state === 'play' ? h('button', { class: 'btn small', onclick: () => { g.resume(); g.drone.enter(); } }, '🎥 Modo dron (K)') : null,
      g.arcade && g.state === 'play' ? h('button', { class: 'btn small', onclick: () => g.arcadeEnd() }, '⏹ Terminar partido') : null,
      h('button', { class: 'btn small danger', onclick: async () => { if (await this.ui.confirm(g.arcade ? 'Saldrás del partido arcade.' : g.inEvent ? 'Si salís ahora abandonarás el evento (−10 de reputación al liquidar). El progreso guardado se conserva.' : 'Volverás al menú principal. Se guardará automáticamente.', 'Salir al menú')) g.quitToMenu(); } }, 'Salir al menú'));
    const el = h('div', { class: 'screen tabs-screen' }, h('div', { class: 'tabs-wrap panel' }, bar, body));
    this.ui.openScreen('pause', el); go(tab);
  }
  inventoryTab(body) {
    const g = this.game, inv = g.inventory;
    const render = () => {
      clear(body);
      const owned = Object.keys(inv.owned).filter((k) => inv.owned[k] > 0 && ALL_ITEMS[k]);
      const eq = inv.equipped;
      const row = (id) => {
        const it = ALL_ITEMS[id], equipped = [eq.camera, eq.lens, eq.card, eq.backpack].includes(id), packed = inv.packed.has(id);
        const second = eq.camera2 === id || eq.lens2 === id, spare = inv.free(id) > 0;
        const canPack = ['lens', 'accessory', 'battery'].includes(it.type) && !equipped && !(second && !spare);
        const stats = it.type === 'camera' ? `${it.crop > 1 ? 'APS-C' : 'Formato completo'} · ISO máx. ${it.maxISO} · ${it.fps} fps · AF ${Math.round(it.afSpeed * 100)} · batería ${it.battery} disparos`
          : it.type === 'lens' ? `${it.min === it.max ? it.min + ' mm' : it.min + '-' + it.max + ' mm'} · f/${it.fMin}${it.fMax !== it.fMin ? '-' + it.fMax : ''} · estab. ${it.stab} pasos · ${it.weight} kg`
          : it.type === 'card' ? `${it.capacity} fotografías` : it.type === 'battery' ? `${inv.spares.length} repuesto(s): ${inv.spares.map((c) => Math.round(c * 100) + '%').join(', ')}` : it.type === 'backpack' ? `${it.slots} espacios` : it.desc || '';
        return h('div', { class: 'card item' }, h('div', { class: 'ic' }, ICONS[it.type] || '•'),
          h('div', { style: { flex: 1 } }, h('div', { class: 'nm' }, it.name, inv.owned[id] > 1 ? ` ×${inv.owned[id]}` : ''), h('div', { class: 'ds' }, stats)),
          equipped ? h('span', { class: 'pill on' }, 'Equipado') : null, second ? h('span', { class: 'pill on' }, '2.ª cámara') : null, packed ? h('span', { class: 'pill y' }, 'En mochila') : null,
          it.type === 'camera' && !second && spare && !g.inEvent ? h('button', { class: 'btn small', title: 'Llevala colgada como segundo cuerpo (ocupa 2 espacios)', onclick: () => { if (inv.setSecond('camera', id)) { if (!inv.lens2) { const l = Object.keys(inv.owned).find((k) => ALL_ITEMS[k]?.type === 'lens' && inv.free(k) > 0); if (l) inv.setSecond('lens', l); } g.audio?.ui('click'); render(); } } }, '+ Segunda cámara') : null,
          it.type === 'lens' && eq.camera2 && !second && spare && !g.inEvent ? h('button', { class: 'btn small', onclick: () => { if (inv.setSecond('lens', id)) { g.audio?.ui('click'); render(); } } }, 'Montar en la 2.ª') : null,
          ['camera', 'lens', 'card', 'backpack'].includes(it.type) && !equipped ? h('button', { class: 'btn small', onclick: () => { if (inv.equip(id)) { g.audio?.ui('click'); g.player?.avatar.setLensLength(inv.lens.max); render(); } } }, 'Equipar') : null,
          canPack ? h('button', { class: 'btn small', onclick: () => { inv.togglePack(id); render(); } }, packed ? 'Sacar de la mochila' : 'Llevar en la mochila') : null);
      };
      const cred = inv.credential ? h('div', { class: 'card item' }, h('div', { class: 'ic' }, '🪪'), h('div', { style: { flex: 1 } }, h('div', { class: 'nm' }, 'Acreditación de prensa'), h('div', { class: 'ds' }, inv.credential.event)), h('button', { class: 'btn small', onclick: () => this.credential() }, 'Ver')) : null;
      body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' } },
        h('div', { class: 'grid' }, cred, ...owned.map(row)),
        h('div', {}, h('div', { class: 'card' }, h('div', { class: 'h3' }, 'Mochila para el evento'), h('div', { class: 'stat' }, h('span', {}, 'Espacios'), h('b', {}, `${inv.slotsUsed()} / ${inv.slots}`)),
          h('div', { class: 'stat' }, h('span', {}, 'Batería en cámara'), h('b', {}, `${inv.batteryPct}%`)), h('div', { class: 'stat' }, h('span', {}, 'Tarjeta'), h('b', {}, `${inv.cardUsed} / ${inv.cardCapacity}`)),
          h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '8px' } }, 'Durante un evento solo podés cambiar a lentes que estén en la mochila. Las baterías de repuesto se cambian con B.')),
          h('div', { class: 'card', style: { marginTop: '12px' } }, h('div', { class: 'h3' }, 'Segunda cámara'),
            inv.camera2 ? h('div', {}, h('div', { class: 'stat' }, h('span', {}, 'Cuerpo'), h('b', {}, inv.camera2.name)), h('div', { class: 'stat' }, h('span', {}, 'Lente'), h('b', {}, inv.lens2?.short || '— (montá un lente)')),
              h('div', { class: 'stat' }, h('span', {}, 'Batería'), h('b', {}, `${Math.round(inv.charge2 * 100)}%`)),
              h('div', { class: 'muted', style: { fontSize: '12px', margin: '6px 0' } }, `Va colgada a la cadera. Presioná ${g.ui.key ? g.ui.key('swapCamera') : 'T'} (o L3 en el visor) para cambiar de cuerpo al instante: por ejemplo el 400 mm para la acción y un angular para la celebración.`),
              h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                inv.hasSecond ? h('button', { class: 'btn small primary', onclick: () => { g.swapCameraBodies(); render(); } }, '⇄ Intercambiar') : null,
                !g.inEvent ? h('button', { class: 'btn small', onclick: () => { inv.setSecond('camera', null); render(); } }, 'Dejar en casa') : null))
            : h('div', { class: 'muted', style: { fontSize: '12px' } }, 'No llevás segundo cuerpo. Con dos cámaras podés tener un teleobjetivo y un angular listos a la vez, como los profesionales. Elegí una cámara libre con «+ Segunda cámara» (ocupa 2 espacios de la mochila).')),
          h('div', {},
          g.inEvent && inv.packed.has('battery') ? h('button', { class: 'btn small', style: { marginTop: '10px' }, onclick: () => { if (inv.swapBattery()) { g.ui.toast('Batería cambiada.', 'good'); render(); } else g.ui.toast('No hay una batería con más carga.', 'warn'); } }, 'Cambiar batería') : null))));
    };
    render();
  }
  missionsTab(body) {
    const g = this.game, ms = g.missions;
    const card = (m, done) => h('div', { class: 'card', style: { borderLeft: `3px solid ${done ? 'var(--good)' : 'var(--accent2)'}` } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('b', {}, m.title), h('span', { class: 'pill ' + (done ? 'on' : 'y') }, done ? 'Completada' : m.kind === 'story' ? 'Historia' : 'Encargo')),
      h('div', { class: 'muted', style: { margin: '6px 0' } }, m.desc),
      !done ? h('div', {}, h('div', { class: 'repbar' }, h('i', { style: { width: (m.progress / m.target) * 100 + '%' } })), h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, `Progreso: ${m.progress} / ${m.target}`)) : null,
      h('div', { style: { fontSize: '12px', marginTop: '6px' } }, 'Recompensa: ', [m.reward.money ? formatMoney(m.reward.money) : null, m.reward.rep ? `+${m.reward.rep} reputación` : null].filter(Boolean).join(' · ') || '—'));
    const a = g.career.currentAssignment();
    body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
      h('div', {}, h('div', { class: 'h3' }, 'Activas'), a ? h('div', { class: 'card', style: { marginBottom: '10px', borderLeft: '3px solid var(--accent)' } }, h('div', { class: 'muted', style: { fontSize: '12px' } }, 'ENCARGO DEL EDITOR'), h('b', {}, a.title), h('div', { class: 'muted' }, a.desc)) : null,
        h('div', { class: 'grid' }, ...(ms.active.length ? ms.active.map((m) => card(m, m.status === 'done')) : [h('div', { class: 'muted' }, 'Sin misiones activas.')]))),
      h('div', {}, h('div', { class: 'h3' }, 'Completadas'), h('div', { class: 'grid' }, ...ms.done.slice().reverse().map((id) => card({ ...MISSION_DEFS[id], progress: 1, target: 1 }, true))))));
  }
  mapTab(body) {
    const g = this.game, c = h('canvas', { class: 'mapcanvas', width: 1400, height: 900 });
    body.append(c, h('div', { class: 'muted', style: { marginTop: '8px', fontSize: '13px' } }, '■ Azul: zonas de prensa autorizadas · ■ Rojo: zonas restringidas · ▲ Vos · ◆ Objetivo'));
    const draw = () => this.drawMap(c);
    draw(); const iv = setInterval(draw, 500); g.ui.screenCleanup = () => clearInterval(iv);
  }
  drawMap(c) {
    const g = this.game, ctx = c.getContext('2d'), W = c.width, H = c.height;
    const st = g.stadium, city = g.city; if (!st) return;
    const minX = -180, maxX = 180, minZ = -75, maxZ = (city ? city.P + 26 : st.gateZ + 40);
    const s = Math.min(W / (maxX - minX), H / (maxZ - minZ)), ox = (W - (maxX - minX) * s) / 2, oz = (H - (maxZ - minZ) * s) / 2;
    const X = (x) => ox + (x - minX) * s, Z = (z) => oz + (z - minZ) * s;
    const rect = (x0, z0, x1, z1, fill, stroke) => { ctx.fillStyle = fill; ctx.fillRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s); if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s); } };
    ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H);
    if (city) {
      rect(-170, city.P + 4, 170, city.P + 16, '#2b2f36'); rect(-170, city.P, 170, city.P + 4, '#5a5a56'); rect(-170, city.P + 16, 170, city.P + 20, '#5a5a56');
      rect(-170, city.P + 20.5, 170, city.P + 31, '#6b5a48'); rect(-165, city.P - 12.5, -62, city.P - 0.5, '#6b5a48'); rect(62, city.P - 12.5, 165, city.P - 0.5, '#6b5a48');
      rect(-62, st.gateZ, 62, city.P, '#4a4038');
      ctx.fillStyle = '#ddd'; ctx.font = 'bold 18px Arial'; ctx.fillText('CALLE', X(-150), Z(city.P + 11));
      ctx.fillText('PLAZA', X(-8), Z(st.gateZ + 22));
    }
    const D = st.D; rect(-63.5 - D.end, -43.5 - D.far, 63.5 + D.end, st.gateZ, '#3a4150'); rect(-63.5, -43.5, 63.5, 43.5, '#2e5d32'); rect(-52.5, -34, 52.5, 34, '#3f8a35', '#ffffff');
    rect(-24, 51, 12, st.gateZ - 0.3, '#5d6575');
    for (const z of st.zones.press) rect(z.x0, z.z0, z.x1, z.z1, 'rgba(47,124,246,.45)');
    for (const z of st.zones.restricted) if (z.id !== 'pitch') rect(z.x0, z.z0, z.x1, z.z1, 'rgba(255,84,104,.45)');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('SALA DE PRENSA', X(-23), Z(57)); ctx.fillText('TÚNEL', X(-3), Z(48)); ctx.fillText('ACCESO PRENSA', X(-8), Z(st.gateZ + 4));
    const mark = (p, col, label) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.fillText(label, X(p.x) + 10, Z(p.z) + 4); };
    for (const n of g.storyNPCs || []) if (n.mapLabel) mark(n.pos, '#f2c500', n.mapLabel);
    const obj = g.story?.objectivePos?.();
    if (obj) { ctx.save(); ctx.translate(X(obj.x), Z(obj.z)); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#3ddc84'; ctx.fillRect(-9, -9, 18, 18); ctx.restore(); }
    const p = g.player.pos; ctx.save(); ctx.translate(X(p.x), Z(p.z)); ctx.rotate(-g.player.yaw + Math.PI);
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  profileTab(body) {
    const g = this.game, c = g.career, st = c.stats;
    const next = TITLES.find(([r]) => r > c.reputation);
    body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
      h('div', { class: 'card' }, h('div', { class: 'h2' }, g.playerName), h('div', { class: 'muted' }, `${c.title} · ${CONTRACTS.find((x) => x.id === c.contract).name}`),
        h('button', { class: 'btn small primary', style: { marginTop: '10px' }, onclick: () => openCustomizer(g, { title: 'Personalizar apariencia', confirm: 'Guardar apariencia', onBack: () => this.pause('perfil'), onDone: (look) => { g.player.applyLook(look); g.saves.save('auto'); g.ui.toast('Apariencia actualizada', 'good'); this.pause('perfil'); } }) }, '🎨 Personalizar apariencia'),
        h('div', { style: { margin: '14px 0 4px', display: 'flex', justifyContent: 'space-between' } }, h('span', {}, 'Reputación'), h('b', {}, `${Math.round(c.reputation)} / 100`)),
        h('div', { class: 'repbar' }, h('i', { style: { width: c.reputation + '%' } })), next ? h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, `Siguiente título: ${next[1]} (${next[0]})`) : null,
        ...[['Dinero', formatMoney(c.money)], ['Eventos cubiertos', st.events], ['Fotos tomadas', g.photos.records.length], ['Fotos entregadas', st.delivered], ['Mejor puntuación', Math.round(st.best)], ['Posibles portadas', st.covers], ['Ingresos totales', formatMoney(st.earned)], ['Infracciones', st.infractions]].map(([k, v]) => h('div', { class: 'stat' }, h('span', {}, k), h('b', {}, v)))),
      h('div', { class: 'card' }, h('div', { class: 'h3' }, 'Historial'), ...(c.history.length ? c.history.slice(0, 10).map((x) => h('div', { class: 'stat' }, h('span', {}, x.event), h('b', { style: { color: x.rep >= 0 ? 'var(--good)' : 'var(--bad)' } }, `${x.rep >= 0 ? '+' : ''}${x.rep} · ${formatMoney(x.money)}`))) : [h('div', { class: 'muted' }, 'Todavía no has entregado coberturas.')]))));
  }
  settingsTab(body) {
    const g = this.game, s = g.settings.data;
    const row = (label, ctrl) => h('div', { class: 'keyrow', style: { gridTemplateColumns: '1fr 260px' } }, h('span', {}, label), ctrl);
    const sel = (key, opts, after) => { const e = h('select', { onchange: (ev) => { s[key] = ev.target.value; g.settings.save(); after?.(); } }, ...opts.map(([v, l]) => h('option', { value: v, selected: String(s[key]) === String(v) ? true : null }, l))); return e; };
    const rng = (key, min, max, step, after) => { const e = h('input', { type: 'range', min, max, step, value: s[key], style: { width: '100%' } }); e.addEventListener('input', () => { s[key] = +e.value; g.settings.save(); after?.(); }); return e; };
    const chk = (key, after) => { const e = h('input', { type: 'checkbox', checked: s[key] ? true : null }); e.addEventListener('change', () => { s[key] = e.checked; g.settings.save(); after?.(); }); return e; };
    const keys = h('div');
    const renderKeys = () => {
      clear(keys);
      for (const a of Object.keys(DEFAULT_BINDINGS)) {
        const b = h('button', { class: 'btn small', onclick: () => { b.textContent = 'Presioná una tecla…'; g.input.rebindHandler = (code) => { s.bindings[a] = code; g.settings.save(); renderKeys(); }; } }, s.bindings[a]);
        keys.append(row(ACTION_LABELS[a], b));
      }
      keys.append(h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: () => { s.bindings = { ...DEFAULT_BINDINGS }; g.settings.save(); renderKeys(); } }, 'Restablecer controles'));
    };
    renderKeys();
    body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' } },
      h('div', {}, h('div', { class: 'h3' }, 'Gráficos'),
        row('Calidad', sel('quality', Object.keys(QUALITY_PRESETS).map((k) => [k, k[0].toUpperCase() + k.slice(1)]), () => g.applyQuality())),
        row('Escala de resolución', rng('resolutionScale', 0.5, 1.5, 0.05, () => g.applyQuality())),
        row('Resolución dinámica (mantiene los FPS estables)', chk('dynRes', () => { g.dynScale = 1; g.resize(); })),
        row('Vista', sel('view', [['tercera', 'Tercera persona'], ['primera', 'Primera persona']], () => { g.follow.fpPitch = 0; g.follow.snap(g.player); })),
        row('Campo de visión (exploración)', rng('fov', 50, 85, 1)), row('Distancia de cámara', rng('cameraDistance', 1.8, 6, 0.1, () => { g.follow.dist = s.cameraDistance; })),
        row('Mostrar FPS', chk('showFps')),
        h('div', { class: 'muted', style: { fontSize: '12px', margin: '6px 0 14px' } }, 'Los cambios de calidad de sombras y público se aplican por completo al cargar el siguiente escenario.'),
        h('div', { class: 'h3' }, 'Control'), row('Sensibilidad', rng('sensitivity', 0.2, 3, 0.05)), row('Invertir eje Y', chk('invertY')),
        h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Audio'), row('Volumen general', rng('master', 0, 1, 0.01, () => g.audio.applyVolumes())), row('Cánticos / música', rng('music', 0, 1, 0.01, () => g.audio.applyVolumes())),
        row('Efectos', rng('sfx', 0, 1, 0.01, () => g.audio.applyVolumes())), row('Ambiente', rng('ambient', 0, 1, 0.01, () => g.audio.applyVolumes())), row('Voces sintetizadas', chk('voices')),
        h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Tus sonidos'),
        h('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '6px' } }, 'Usá audios propios o con permiso (MP3, M4A, OGG o WAV). Se guardan en este navegador; también podés ponerlos en la carpeta public/audio.'),
        ...Object.entries(AudioEngine.CUSTOM).map(([key, def]) => {
          const status = h('span', { class: 'muted', style: { fontSize: '12px', marginRight: '6px' } }, g.audio.hasCustom(key) ? (def.multi ? `✔ ${g.audio.countFor(key)} grabación(es)` : '✔ cargado') : 'sin archivo');
          const inp = h('input', { type: 'file', accept: 'audio/*,video/mp4', multiple: def.multi ? true : null, style: { display: 'none' } });
          inp.addEventListener('change', async () => { const f = def.multi ? inp.files : inp.files[0]; if (!f || (def.multi && !f.length)) return; status.textContent = 'cargando…'; const ok = await g.audio.loadFile(key, f); status.textContent = ok ? (def.multi ? `✔ ${g.audio.countFor(key)} grabación(es)` : '✔ ' + f.name.slice(0, 22)) : '✖ formato no válido'; g.ui.toast(ok ? `${def.label}: listo` : 'No se pudo leer ese audio.', ok ? 'good' : 'warn'); });
          return row(def.label, h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' } }, status, inp,
            h('button', { class: 'btn small', onclick: () => inp.click() }, def.multi ? 'Agregar…' : 'Elegir…'),
            h('button', { class: 'btn small', onclick: async () => { await g.audio.clearFile(key); status.textContent = 'sin archivo'; } }, 'Quitar')));
        }),
        h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Partido'), row('Duración de cada tiempo', sel('halfSeconds', [[150, 'Corto (2,5 min)'], [240, 'Normal (4 min)'], [360, 'Largo (6 min)'], [540, 'Extendido (9 min)']]))),
      h('div', {}, h('div', { class: 'h3' }, 'Teclas'), keys)));
  }
  saveTab(body) {
    const g = this.game;
    const grid = h('div', { class: 'grid', style: { gridTemplateColumns: '1fr' } });
    for (const { slot, data } of g.saves.list()) {
      if (slot === 'auto') { grid.append(h('div', { class: 'card' }, h('b', {}, 'Autoguardado'), h('div', { class: 'muted', style: { fontSize: '13px' } }, data ? new Date(data.savedAt).toLocaleString('es-CR') : '—'))); continue; }
      grid.append(h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        h('div', { style: { flex: 1 } }, h('b', {}, `Ranura ${slot}`), h('div', { class: 'muted', style: { fontSize: '13px' } }, data ? `${data.playerName} · ${new Date(data.savedAt).toLocaleString('es-CR')} · Rep. ${Math.round(data.career.reputation)}` : 'Vacía')),
        h('button', { class: 'btn small primary', onclick: async () => { if (data && !(await this.ui.confirm('Se sobrescribirá el guardado de esta ranura.', 'Sobrescribir'))) return; g.saves.save(slot); g.ui.toast('Partida guardada.', 'good'); this.saveTab(clear(body)); } }, 'Guardar aquí')));
    }
    body.append(h('div', { class: 'h3' }, 'Guardado manual'), h('div', { class: 'muted', style: { fontSize: '13px', marginBottom: '10px' } }, g.inEvent ? 'Si guardás durante un evento, al cargar volverás al inicio de ese evento con tu equipo e inventario actuales.' : ''), grid,
      h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => this.loadMenu(true) }, 'Cargar partida…')));
  }
  // ================= CREDENCIAL =================
  credential(onClose) {
    const c = h('canvas'); drawCredential(c, this.game);
    const el = h('div', { class: 'screen' }, h('div', { class: 'cred-wrap' }, c, h('div', { class: 'muted' }, 'La acreditación se guardó en tu inventario.'),
      h('button', { class: 'btn primary', onclick: () => { this.ui.closeScreen(); onClose?.(); } }, 'Guardar acreditación')));
    this.ui.openScreen('credential', el);
  }
  // ================= TIENDA / REDACCIÓN =================
  hub() {
    const g = this.game, c = g.career;
    const left = h('div', { style: { overflow: 'auto' } }), right = h('div', { style: { overflow: 'auto' } });
    const render = () => {
      clear(left); clear(right);
      const evs = c.available(), next = c.nextEvent();
      left.append(h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '6px' } }, h('div', { class: 'h1' }, 'REDACCIÓN'), h('div', { class: 'muted' }, `Ascenso Total · Día ${c.day}`)));
      const oo = c.officialOffer && evs.find((x) => x.id === c.officialOffer.eventId && !x.locked);
      if (oo) left.append(h('div', { class: 'event-card official' }, h('div', {},
        h('div', { class: 'muted', style: { fontSize: '12px', letterSpacing: '1px' } }, '⭐ OFERTA ESPECIAL · FOTÓGRAFO OFICIAL'),
        h('div', { class: 'teams', style: { margin: '6px 0' } }, this.ui.crest(g.team(c.officialOffer.team), 30), `${g.teamName(c.officialOffer.team)} te necesita`),
        h('div', { style: { fontSize: '13px' } }, `Su fotógrafo oficial se enfermó. Cubrí «${oo.title}» como personal del club: acceso a vestuarios, palco VIP y todo el estadio. Pago ×1.3.`)),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('button', { class: 'btn primary', onclick: () => { const team = c.officialOffer.team; c.officialOffer = null; g.startEvent({ ...oo, official: team, mult: (oo.mult || 1) * 1.3 }); } }, 'Aceptar'),
          h('button', { class: 'btn small', onclick: () => { c.officialOffer = null; render(); } }, 'Rechazar'))));
      left.append(h('div', { class: 'h3', style: { marginTop: '12px' } }, 'Calendario de coberturas'));
      const lg = (e) => (e.cup ? 'cup' : e.league || 'primera'), F = this.leagueFilter || 'all';
      left.append(h('div', { class: 'league-tabs' }, ...[['all', 'Todas'], ['primera', 'Primera'], ['segunda', 'Segunda'], ['menores', 'Ligas menores'], ['cup', 'Copa']].map(([k, l]) =>
        h('button', { class: 'tab' + (F === k ? ' on' : ''), onclick: () => { this.leagueFilter = k; render(); } }, l, k !== 'all' ? h('span', { class: 'cnt' }, String(evs.filter((e) => lg(e) === k && !e.locked && !e.done).length)) : null))));
      for (const e of evs) {
        if (F !== 'all' && lg(e) !== F) continue;
        const st = STADIUMS[e.stadium];
        left.append(h('div', { class: 'event-card' + (e.locked ? ' locked' : '') + (e.cup ? ' cup' : '') + (e.league ? ' ' + e.league : '') + (next && next.id === e.id ? ' next' : '') },
          h('div', {}, h('div', { class: 'muted', style: { fontSize: '12px', letterSpacing: '1px' } }, `${e.title.toUpperCase()} · ${st.name} · ${formatClock(e.kickoff)} · ${TIME_PRESETS[e.time].label} · ${WEATHER_PRESETS[e.weather].label}`),
            h('div', { class: 'teams', style: { margin: '6px 0' } }, this.ui.crest(g.team(e.home), 30), g.teamName(e.home), h('span', { class: 'muted' }, 'vs'), this.ui.crest(g.team(e.away), 30), g.teamName(e.away)),
            h('div', { style: { fontSize: '13px' } }, h('b', {}, 'Encargo: '), `${e.assignment.title} — ${e.assignment.desc}`),
            h('div', { style: { fontSize: '12px', marginTop: '4px' } }, h('span', { class: 'pill' }, `Pago ×${(e.mult * c.payMult).toFixed(2)}`), e.done ? h('span', { class: 'pill on' }, 'Cubierto') : null, e.locked ? h('span', { class: 'pill r' }, e.clasico && c.reputation >= e.minRep ? 'Requiere contrato de planta o reputación 55' : `Requiere reputación ${e.minRep}`) : null)),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' } },
            (() => { const sel = h('select', { title: 'Horario', onchange: (ev) => { this.timeChoice[e.id] = ev.target.value; } },
              h('option', { value: '' }, `Horario: ${TIME_PRESETS[e.time].label}`), ...Object.entries(TIME_PRESETS).filter(([k]) => k !== e.time).map(([k, v]) => h('option', { value: k, selected: this.timeChoice[e.id] === k ? true : null }, v.label)));
              return sel; })(),
            h('select', { title: 'Hora de llegada', onchange: (ev) => { this.arriveChoice[e.id] = +ev.target.value; } },
              ...[[0, 'Llegada: normal (30 min antes)'], [60, 'Llegar 1 h antes'], [120, 'Llegar 2 h antes'], [180, 'Llegar 3 h antes']].map(([v, l]) => h('option', { value: v, selected: (this.arriveChoice[e.id] || 0) === v ? true : null }, l))),
            h('button', { class: 'btn ' + (!e.locked ? 'primary' : ''), disabled: e.locked ? true : null, onclick: () => { const t = this.timeChoice[e.id], a = this.arriveChoice[e.id]; const ev2 = t ? { ...e, time: t, kickoff: TIME_PRESETS[t].kickoff } : { ...e }; if (a) ev2.arrive = a; g.startEvent(ev2); } }, e.done ? 'Repetir' : 'Cubrir'))));
      }
      // Panel derecho: perfil, contratos, tienda
      right.append(h('div', { class: 'card' }, h('div', { class: 'h3' }, g.playerName), h('div', {}, c.title), h('div', { class: 'repbar', style: { margin: '8px 0' } }, h('i', { style: { width: c.reputation + '%' } })),
        h('div', { class: 'stat' }, h('span', {}, 'Reputación'), h('b', {}, Math.round(c.reputation))), h('div', { class: 'stat' }, h('span', {}, 'Dinero'), h('b', {}, formatMoney(c.money))),
        h('div', { class: 'stat' }, h('span', {}, 'Contrato'), h('b', {}, CONTRACTS.find((x) => x.id === c.contract).name)),
        h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' } }, h('button', { class: 'btn small', onclick: () => this.pause('inventario') }, 'Mochila / equipo'), h('button', { class: 'btn small', onclick: () => this.pause('galeria') }, 'Archivo de fotos'), h('button', { class: 'btn small', onclick: () => this.pause('perfil') }, 'Perfil'), h('button', { class: 'btn small', onclick: () => this.pause('guardar') }, 'Guardar'))));
      for (const o of c.offers()) right.append(h('div', { class: 'card', style: { marginTop: '10px', borderColor: 'var(--accent)' } }, h('div', { class: 'h3' }, 'Nueva oferta de contrato'), h('b', {}, o.name), h('div', { class: 'muted', style: { margin: '4px 0 8px' } }, o.desc),
        h('button', { class: 'btn primary small', onclick: () => { c.contract = o.id; g.audio?.ui('mission'); g.ui.toast(`Firmaste: ${o.name}`, 'mission'); g.saves.save('auto'); render(); } }, 'Firmar contrato')));
      right.append(this.shop(render));
    };
    render();
    const el = h('div', { class: 'screen', style: { background: 'linear-gradient(90deg, rgba(4,7,14,.94), rgba(4,7,14,.78))' } }, h('div', { class: 'hub' }, left, right));
    this.ui.openScreen('hub', el); this.hubRender = render;
  }
  shop(rerender) {
    const g = this.game, c = g.career, inv = g.inventory;
    const box = h('div', { class: 'card', style: { marginTop: '10px' } }, h('div', { class: 'h3' }, 'Tienda Foto Click'));
    const items = [...Object.values(CAMERAS), ...Object.values(LENSES), ...Object.values(ACCESSORIES)].filter((i) => i.price > 0);
    for (const it of items) {
      const owned = inv.owns(it.id) && !it.stack, locked = (it.rep || 0) > c.reputation, afford = c.money >= it.price;
      const another = it.type === 'camera' && inv.owns(it.id) && (inv.owned[it.id] || 0) < 2 && afford;
      box.append(h('div', { class: 'item', style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } }, h('div', { class: 'ic', style: { width: '38px', height: '38px', fontSize: '18px' } }, ICONS[it.type]),
        h('div', { style: { flex: 1, fontSize: '13px' } }, h('div', { class: 'nm' }, it.name), h('div', { class: 'ds' }, it.desc || (it.type === 'lens' ? `Estab. ${it.stab} · AF ${Math.round(it.af * 100)}` : it.type === 'camera' ? `${it.fps} fps · ISO ${it.maxISO}` : it.type === 'card' ? `${it.capacity} fotos` : ''))),
        owned ? h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'pill on' }, (inv.owned[it.id] || 0) > 1 ? `Tuyo ×${inv.owned[it.id]}` : 'Tuyo'),
          another ? h('button', { class: 'btn small', title: 'Otra unidad del mismo cuerpo, para llevarla como segunda cámara', onclick: () => { c.money -= it.price; inv.add(it.id); g.audio?.ui('cash'); g.ui.toast(`Compraste otra ${it.name}.`, 'good'); g.saves.save('auto'); rerender(); } }, `+1 · ${formatMoney(it.price)}`) : null) : h('button', { class: 'btn small' + (afford && !locked ? ' primary' : ''), disabled: !afford || locked ? true : null, title: locked ? `Requiere reputación ${it.rep}` : '', onclick: () => { c.money -= it.price; inv.add(it.id); g.audio?.ui('cash'); g.ui.toast(`Compraste ${it.name}.`, 'good'); g.saves.save('auto'); rerender(); } }, locked ? `Rep. ${it.rep}` : formatMoney(it.price))));
    }
    // Venta de equipo usado
    const sellable = Object.keys(inv.owned).filter((id) => inv.canSell(id));
    box.append(h('div', { class: 'h3', style: { marginTop: '14px' } }, 'Vender equipo usado'),
      h('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '4px' } }, 'La tienda te compra lo que ya no usás a cerca de la mitad de su precio. Lo equipado o montado en la segunda cámara no se puede vender.'),
      ...(sellable.length ? sellable.map((id) => { const it = ALL_ITEMS[id], n = it.type === 'battery' ? inv.spares.length : inv.free(id);
        return h('div', { class: 'item', style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } }, h('div', { class: 'ic', style: { width: '38px', height: '38px', fontSize: '18px' } }, ICONS[it.type] || '•'),
          h('div', { style: { flex: 1, fontSize: '13px' } }, h('div', { class: 'nm' }, it.name, n > 1 ? ` ×${n}` : ''), h('div', { class: 'ds' }, `Pagaste ${formatMoney(it.price)}`)),
          h('button', { class: 'btn small', onclick: async () => { const v = inv.sellPrice(id); if (!(await this.ui.confirm(`¿Vender ${it.name} por ${formatMoney(v)}?`, 'Vender', false))) return; const got = inv.sell(id); if (got) { c.money += got; g.audio?.ui('cash'); g.ui.toast(`Vendiste ${it.name} por ${formatMoney(got)}.`, 'good'); g.saves.save('auto'); rerender(); } } }, `Vender · ${formatMoney(inv.sellPrice(id))}`)); })
        : [h('div', { class: 'muted', style: { fontSize: '12px' } }, 'No tenés equipo libre para vender.')]));
    return box;
  }
  // ================= RESULTADOS =================
  results(res, photos, onContinue) {
    const g = this.game;
    const list = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' } });
    for (const p of photos) {
      const ev = p.editedEval || p.eval;
      list.append(h('div', { class: 'card', style: { display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' } }, h('img', { src: p.thumb, style: { width: '130px', borderRadius: '6px' } }),
        h('div', { style: { fontSize: '12px' } }, h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('b', {}, ev.label), h('b', { style: { color: scoreColor(ev.score), fontSize: '20px' } }, ev.score)),
          h('div', { class: 'muted' }, `${p.eval.moment.label} · ${p.meta.minute}'`), h('div', { style: { marginTop: '4px', lineHeight: 1.35 } }, p.eval.comments.slice(0, 2).join(' ')))));
    }
    const best = photos.slice().sort((a, b) => g.photos.finalScore(b) - g.photos.finalScore(a))[0];
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel results' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' } },
        h('div', {}, h('div', { class: 'muted', style: { letterSpacing: '2px', fontSize: '12px' } }, 'EVALUACIÓN DEL EDITOR · RICARDO SOLANO'), h('div', { class: 'h1' }, 'RESULTADOS'), h('div', { class: 'muted' }, g.career.currentEventName())),
        h('div', { style: { textAlign: 'right' } }, h('div', { class: 'bigscore', style: { color: res.rep >= 0 ? 'var(--good)' : 'var(--bad)' } }, `${res.rep >= 0 ? '+' : ''}${res.rep}`), h('div', { class: 'muted' }, `Reputación ${res.prevRep} → ${res.newRep}`), h('div', { style: { fontSize: '22px', fontWeight: 700, marginTop: '6px' } }, `+ ${formatMoney(res.money)}`))),
      best ? h('div', { class: 'card', style: { margin: '16px 0', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', borderColor: 'var(--accent)' } }, h('img', { src: best.thumb, style: { width: '100%', borderRadius: '8px' } }),
        h('div', {}, h('div', { class: 'h3' }, 'La foto de la jornada'), h('div', { style: { fontSize: '18px', fontWeight: 700 } }, `“${(best.editedEval || best.eval).label}: ${g.photos.finalScore(best)}/100”`), h('div', { style: { marginTop: '6px', lineHeight: 1.5 } }, best.eval.comments.join(' ')))) : null,
      h('div', { class: 'h3' }, 'Desglose de reputación'), ...res.lines.map(([t, v]) => h('div', { class: 'stat' }, h('span', {}, t), h('b', { style: { color: v >= 0 ? 'var(--good)' : 'var(--bad)' } }, `${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}`))),
      h('div', { class: 'h3', style: { marginTop: '16px' } }, `Fotografías entregadas (${photos.length})`), list,
      h('div', { style: { marginTop: '18px', textAlign: 'right' } }, h('button', { class: 'btn primary', onclick: onContinue }, 'Continuar a la redacción →'))));
    this.ui.openScreen('results', el);
  }
}
