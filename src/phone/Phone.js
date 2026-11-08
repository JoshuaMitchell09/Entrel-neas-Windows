import { h, clear } from '../ui/dom.js';
import { formatClock, pick, rand } from '../core/MathUtil.js';
import { topicsFor } from './Conversations.js';

/*
 * Teléfono del fotógrafo: mensajería con familia y amigos, la red social «Lente»
 * para publicar fotos, entradas de cortesía para regalar y un reloj para esperar el partido.
 * Los contactos responden con retraso («escribiendo…») y escriben solos según lo que pasa.
 */
export const CONTACTS = [
  { id: 'mama', name: 'Mamá', emoji: '👩🏽', color: '#d94f7a', family: true },
  { id: 'papa', name: 'Papá', emoji: '👨🏽', color: '#2f7cf6', family: true },
  { id: 'vale', name: 'Valeria', sub: 'hermana', emoji: '👧🏻', color: '#9b5de5', family: true },
  { id: 'abuela', name: 'Abuela Rosa', emoji: '👵🏽', color: '#e07a5f', family: true },
  { id: 'diego', name: 'Diego', sub: 'amigo', emoji: '🧔🏽', color: '#2a9d8f', friend: true },
  { id: 'andy', name: 'Andrés', sub: 'amigo', emoji: '🧑🏻', color: '#f4a261', friend: true },
  { id: 'kendall', name: 'Kendall Rojas', sub: 'mentor', emoji: '📷', color: '#4a5d23' },
  { id: 'mariana', name: 'Mariana Quesada', sub: 'prensa de la Liga', emoji: '🗂️', color: '#0b3d91' },
  { id: 'editor', name: 'Ricardo Solano', sub: 'editor · Ascenso Total', emoji: '📰', color: '#c8102e' },
];
const C = Object.fromEntries(CONTACTS.map((c) => [c.id, c]));
const FEED_FANS = ['@lamorada_pura', '@barra_sur_cr', '@futbol_tico', '@pura_liga', '@el_profe_del_futbol', '@mae_futbolero', '@la_gradería', '@cr_deportes'];

export class Phone {
  constructor(game) {
    this.game = game; this.reset();
    game.events.on('match:goal', (d) => this.onGoal(d));
    game.events.on('match:end', () => this.onMatchEnd());
    game.events.on('story:credential', () => this.after(4, () => this.receive('mariana', 'Te registré en la lista de prensa. Cualquier problema en seguridad, me llamás 📞')));
    game.events.on('story:prepared', () => { if (Math.random() < 0.6) this.after(6, () => this.receive('kendall', '¿Ya alistó el equipo? Lo espero detrás de la portería este. Traiga el tele 📷')); });
    game.events.on('photo:taken', (rec) => this.onPhoto(rec));
  }
  reset() {
    this.chats = {}; this.options = {}; this.unread = {}; this.typing = {}; this.used = {}; this.chatT = rand(150, 260);
    this.social = { followers: 120, posts: [], feed: [] };
    this.tickets = []; this.guests = []; this.prediction = null; this.lastGoalMsg = -99; this.goodShots = 0; this.eventId = null;
    this.timers = []; this.view = 'home'; this.app = null; this.sel = null; this.fanThanks = 0;
    this.receive('mama', '¡Mucha suerte en el trabajo nuevo! Estoy orgullosa de vos ❤️', { silent: true });
    this.receive('vale', 'Te hice una cuenta en Lente para que subás tus fotos 📸 ¡Ya tenés seguidores!', { silent: true });
  }
  serialize() {
    return { chats: this.chats, options: this.options, unread: this.unread, social: { followers: this.social.followers, posts: this.social.posts.slice(-30), feed: this.social.feed.slice(-25) }, tickets: this.tickets, guests: this.guests };
  }
  load(d) {
    this.reset(); if (!d) return;
    Object.assign(this.chats, d.chats || {}); this.options = d.options || {}; this.unread = d.unread || {};
    this.social.followers = d.social?.followers ?? 120; this.social.posts = d.social?.posts || []; this.social.feed = d.social?.feed || [];
    this.tickets = d.tickets || []; this.guests = d.guests || [];
  }
  get handle() { return '@' + (this.game.playerName || 'fotografo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_foto'; }
  get totalUnread() { return Object.values(this.unread).reduce((a, b) => a + b, 0) + (this.social.newLikes ? 1 : 0); }
  stamp() { return formatClock(this.game.clock); }
  // Retrasos en tiempo real (pausan cuando el juego no está en marcha)
  after(sec, fn) { this.timers.push({ t: sec, fn }); }
  update(dt) {
    // De vez en cuando alguien te escribe para conversar
    if (this.game.state === 'play') {
      this.chatT -= dt;
      if (this.chatT <= 0) {
        this.chatT = rand(160, 300);
        const id = pick(['mama', 'papa', 'vale', 'diego', 'andy', 'abuela', 'diego', 'vale']);
        const tps = this.topics(id, 2);
        if (tps.length && !this.options[id] && !this.typing[id]) {
          const open = { mama: ['¿Cómo vas, mi amor?', '¿Ya comiste?', 'Hola, ¿estás ocupado/a?'], papa: ['¿Qué tal, campeón/a?', '¿Cómo va todo por allá?'], vale: ['Holaaa 👋', 'Ey, ¿qué hacés?', 'Aburrida. Hablame 😩'], diego: ['¡Mae! ¿Qué contás?', 'Diay, ¿cómo va la vara?'], andy: ['Mae 😂', '¿Qué hay, compa?'], abuela: ['Hola mi cielo, ¿cómo está?'] }[id];
          this.receive(id, pick(open), { options: tps.map((t) => ({ label: t.label, reply: t.reply, next: t.next, onPick: () => (this.used[id] ||= []).push(t.key) })) });
        }
      }
    }
    for (const t of this.timers.slice()) { t.t -= dt; if (t.t <= 0) { this.timers.splice(this.timers.indexOf(t), 1); t.fn(); } }
    // Los likes de las publicaciones crecen con el tiempo
    for (const p of this.social.posts) {
      if (p.likes < p.target) {
        const add = Math.max(1, Math.round((p.target - p.likes) * dt * 0.08 * rand(0.5, 1.5)));
        if (Math.random() < dt * 3) { p.likes = Math.min(p.target, p.likes + add); this.social.followers += Math.random() < 0.25 ? 1 : 0; this.social.newLikes = true; }
        if (p.pendingComments?.length && Math.random() < dt * 0.25) { p.comments.push(p.pendingComments.shift()); this.social.newLikes = true; }
      }
    }
    this.liveRender?.();
  }
  // ---------- Mensajería ----------
  push(id, msg) { (this.chats[id] ||= []).push(msg); if (this.chats[id].length > 60) this.chats[id].splice(0, this.chats[id].length - 60); }
  receive(id, text, o = {}) {
    this.push(id, { from: 'them', text, at: this.stamp(), ticket: o.ticket || null });
    if (o.options) this.options[id] = o.options;
    const open = this.isOpen() && this.view === 'chat' && this.sel === id;
    if (!open) this.unread[id] = (this.unread[id] || 0) + 1;
    if (!o.silent && !open) this.notify(C[id], text);
    this.render();
  }
  // Responder: el contacto «escribe» y contesta después de unos segundos
  send(id, opt) {
    this.push(id, { from: 'me', text: opt.label, at: this.stamp() });
    delete this.options[id];
    this.game.audio?.ui('tick');
    opt.onPick?.();
    if (opt.reply) { this.typing[id] = true; this.after(rand(1.6, 3.4), () => { this.typing[id] = false; this.receive(id, opt.reply, { options: opt.next }); }); }
    this.render();
  }
  // Temas para iniciar conversación: se rotan para no repetir siempre lo mismo
  topics(id, n = 3) {
    const all = topicsFor(this, id); if (!all.length) return [];
    let used = this.used[id] || [];
    if (all.every((t) => used.includes(t.key))) used = this.used[id] = [];
    return all.filter((t) => !used.includes(t.key)).slice(0, n);
  }
  startTopic(id, t) { (this.used[id] ||= []).push(t.key); this.send(id, t); }
  notify(c, text) {
    const g = this.game; if (!c || g.drone?.active || g.ui.screen) return;
    g.audio?.ui('tick'); setTimeout(() => g.audio?.ui('tick'), 140); g.input.rumble(0.15, 0.35, 90);
    const el = h('div', { class: 'phone-notif' }, h('div', { class: 'pn-ic', style: { background: c.color } }, c.emoji), h('div', {}, h('b', {}, c.name), h('div', {}, text.length > 90 ? text.slice(0, 88) + '…' : text)), h('kbd', {}, g.ui.key('phone')));
    const box = this.notifBox || (this.notifBox = h('div', { class: 'phone-notifs' }));
    if (!box.parentNode) g.ui.root.appendChild(box);
    box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 5200);
  }
  // ---------- Reacciones a la partida ----------
  onEventStart(ev, opts = {}) {
    const g = this.game; this.eventId = ev.id; this.goodShots = 0; this.prediction = null; this.lastGoalMsg = -99; this.fanThanks = 0;
    const home = g.teamName(ev.home), away = g.teamName(ev.away), ko = formatClock(ev.kickoff);
    this.social.feed.push({ author: '@AscensoTotal', avatar: '📰', text: `HOY · ${home} vs ${away} a las ${ko}. Nuestra cobertura en vivo desde el estadio 📸`, likes: Math.round(rand(300, 1400)) });
    this.after(rand(8, 16), () => this.receive('mama', opts.early ? `¿Ya saliste? ¡Qué temprano vas hoy! Avisame cuando llegués 🙏` : '¿Ya llegaste al estadio? Avisame 🙏', {
      options: [{ label: 'Sí, ma. Ya estoy aquí 😊', reply: '¡Qué dicha! Cuidate mucho y comé algo. Te quiero ❤️' }, { label: 'Voy llegando', reply: 'Con cuidado, por favor. Avisame cuando estés adentro.' }] }));
    this.after(rand(30, 55), () => this.receive('diego', `Mae, ¿quién gana hoy? Yo digo que ${home} 2-1 🔥`, {
      options: [{ label: `Gana ${home}`, reply: 'Eso, mae. ¡Mandá fotos del gol!', onPick: () => { this.prediction = 0; } }, { label: `${away} da la sorpresa`, reply: '¿¿Qué?? Ni loco 😂 Ya veremos.', onPick: () => { this.prediction = 1; } }, { label: 'Empate', reply: 'Mae, qué aburrido 😴 jaja', onPick: () => { this.prediction = 2; } }] }));
    if (opts.early) this.after(rand(18, 30), () => this.receive('andy', '¿¿Ya estás en el estadio?? Qué tempranero, mae 😂 Mandá una foto del estadio vacío.', { options: [{ label: 'Llegué horas antes, pa agarrar el mejor puesto 😎', reply: 'Eso es ser profesional, mae 👏' }] }));
    // Invitados con las entradas regaladas
    const guests = this.guests.filter((x) => x.forEvent === 'next' || x.forEvent === ev.id);
    this.guests = this.guests.filter((x) => !guests.includes(x));
    for (const t of this.tickets) if (t.given && t.status === 'regalada') t.status = 'usada';
    // De vez en cuando, alguien le regala entradas al fotógrafo
    const nTickets = this.tickets.filter((t) => t.status === 'disponible').length;
    if (!g.arcade && nTickets < 2 && (Math.random() < 0.45 || (this.tickets.length === 0 && g.career.stats.events >= 1))) {
      const who = pick(['mariana', 'kendall', 'mariana']);
      this.after(rand(60, 120), () => this.giftTickets(who));
    }
    return guests;
  }
  giftTickets(from, count = 2) {
    const t = { id: 'tk_' + Date.now(), count, from, status: 'disponible', given: null, zone: pick(['Gradería Sol', 'Platea', 'Preferencial']) };
    this.tickets.push(t);
    const text = from === 'mariana' ? `¡Hola! El club me dio ${count} cortesías para el próximo partido (${t.zone}). Son tuyas: regaláselas a quien querás 🎟️` : `Mae, a un compa le sobraron ${count} entradas (${t.zone}) para el próximo partido. Se las dejo, lléveles a la familia 🎟️`;
    this.receive(from, text, { ticket: t.id });
    this.game.ui.toast(`🎟️ Te regalaron ${count} entradas para el próximo partido. Abrí el teléfono (${this.game.ui.key('phone')}) para regalarlas.`, 'mission', 5000);
  }
  giveTicket(t, cid) {
    const c = C[cid]; t.given = cid; t.status = 'regalada';
    this.guests.push({ contactId: cid, count: t.count, zone: t.zone, forEvent: 'next' });
    this.push(cid, { from: 'me', text: `¡Te regalo ${t.count} entradas para el próximo partido (${t.zone})! 🎟️`, at: this.stamp() });
    const replies = { mama: '¡¡Ay, qué lindo!! Voy con tu papá. Te voy a hacer un rótulo para que nos veas 😭❤️', papa: '¡Qué detallazo! Ahí estaremos, en primera fila. Hasta camiseta nueva me compro 😄', vale: '¡¡NO TE CREO!! Llevo a mi amiga. Vamos a gritar tu nombre 😂', abuela: '¡Ay, Dios me lo bendiga! Hace años no voy a un estadio. Me llevo la sombrilla.', diego: '¡¡MAE!! ¡Sos el mejor! Llevo a Andy. Busco la gradería y te saludo 🙌', andy: 'Mae, ¡GRACIAS! Ya tengo la bandera lista 🔥' };
    this.typing[cid] = true; this.after(rand(1.5, 3), () => { this.typing[cid] = false; this.receive(cid, replies[cid] || '¡Muchas gracias! 🙌'); });
    this.game.audio?.ui('mission'); this.game.saves?.save('auto'); this.render();
  }
  onGoal({ team }) {
    const g = this.game, m = g.match; if (!g.inEvent || !m) return;
    if (g.time - this.lastGoalMsg < 40) return; this.lastGoalMsg = g.time;
    const tn = m.teams[team].name;
    this.after(rand(5, 12), () => this.receive(pick(['andy', 'diego', 'vale', 'papa']), pick([`¡¡¡GOOOOL de ${tn}!!! ¿Lo agarraste? 😱`, '¡Qué golazo! Decime que tenés la foto 📸', `¡GOL! Aquí en la casa saltamos todos 🙌 (${m.score[0]}-${m.score[1]})`])));
    this.social.feed.push({ author: pick(['@AscensoTotal', '@LigaTica', pick(FEED_FANS)]), avatar: '⚽', text: `¡GOOOL de ${tn}! ${m.teams[0].short} ${m.score[0]}-${m.score[1]} ${m.teams[1].short} ${pick(['🔥', '😱', '🙌', '⚽'])}`, likes: Math.round(rand(500, 4000)) });
  }
  onMatchEnd() {
    const g = this.game, m = g.match; if (!g.inEvent || !m) return;
    const [a, b] = m.score, res = a > b ? 0 : b > a ? 1 : 2, sc = `${m.teams[0].short} ${a}-${b} ${m.teams[1].short}`;
    this.after(rand(10, 20), () => this.receive('papa', `Terminó ${sc}. Orgulloso de vos. ¿Cómo te fue con las fotos?`, {
      options: [{ label: '¡Muy bien, pa! Tengo varias buenas 💪', reply: '¡Así se hace! Mañana las vemos en la página.' }, { label: 'Más o menos… fue difícil', reply: 'Tranquilo. Los mejores también tienen días duros. A la próxima 👊' }] }));
    if (this.prediction !== null) this.after(rand(25, 40), () => this.receive('diego', this.prediction === res ? '¡TE LO DIJE! Acerté, mae 😎 Pagás vos las birras.' : 'Bueno… no acerté ni una 😂 ¿Qué tal las fotos?'));
    this.social.feed.push({ author: '@LigaTica', avatar: '🏆', text: `FINAL · ${sc}. Gracias a la afición por llenar el estadio 💙`, likes: Math.round(rand(800, 5000)) });
  }
  onPhoto(rec) {
    const g = this.game; if (!g.inEvent) return;
    if (rec.eval.score >= 80) { this.goodShots++; if (this.goodShots === 1) this.after(rand(15, 30), () => this.receive('kendall', 'Le vi una buena en la pantallita hace rato 👀 Siga así. Publíquela en Lente después.')); }
  }
  fanThanked(name) {
    this.fanThanks++; const gain = Math.round(rand(15, 45));
    this.social.followers += gain;
    if (this.fanThanks <= 3) this.social.feed.push({ author: name, avatar: '🙋', text: `¡El fotógrafo de ${pick(['Ascenso Total', 'la Liga'])} me tomó una foto en la gradería! Gracias ${this.handle} 🙌`, likes: Math.round(rand(20, 160)) });
    return gain;
  }
  // ---------- Red social «Lente» ----------
  captions(rec) {
    const tags = rec.eval.tags || [], ev = this.game.career.event, vs = ev ? `${this.game.team(ev.home).short} vs ${this.game.team(ev.away).short}` : '';
    const list = [];
    if (tags.includes('gol')) list.push(`¡GOOOL! ⚽🔥 ${vs}`);
    if (tags.includes('celebracion')) list.push('Así se celebra 🙌');
    if (tags.includes('atajada')) list.push('Manos de seguridad 🧤');
    if (tags.includes('publico')) list.push('La afición es el alma del fútbol 💙');
    if (tags.includes('calentamiento')) list.push('La previa 📋⚽');
    list.push(`Desde la cancha · ${vs} 📸`, 'Fútbol tico desde mi lente 🇨🇷', 'Un instante. Un partido. Una historia.');
    return [...new Set(list)].slice(0, 4);
  }
  publish(rec, caption) {
    const sc = this.game.photos.finalScore ? this.game.photos.finalScore(rec) : rec.eval.score;
    const base = this.social.followers * 0.09 + 12 + this.game.career.reputation * 4;
    const target = Math.round(base * Math.pow(Math.max(20, sc) / 60, 2.2) * rand(0.8, 1.3));
    const tags = rec.eval.tags || [];
    const pool = ['¡Brutal! 👏', 'Qué nitidez 😮', 'Pura vida, gran foto', '¿Con qué lente la tomaste?', 'Para enmarcar 🖼️', '🔥🔥🔥', 'Esto es fútbol tico 🇨🇷', 'Qué momento', ...(tags.includes('gol') ? ['¡QUÉ GOLAZO!', 'Se me pone la piel de gallina'] : []), ...(tags.includes('publico') ? ['¡Salgo yo ahí! 😂', 'Esa barra es otra cosa'] : []), ...(sc < 45 ? ['Un poco movida, pero se siente el momento', 'Le falta enfoque 😬'] : [])];
    const fams = CONTACTS.filter((c) => c.family || c.friend);
    const comments = Array.from({ length: Math.min(6, 1 + Math.floor(target / 60)) }, () => ({ who: Math.random() < 0.3 ? pick(fams).name : pick(FEED_FANS), text: pick(pool) }));
    const post = { id: 'po_' + Date.now(), photoId: rec.id, thumb: rec.thumb, caption, likes: 0, target, comments: [], pendingComments: comments, at: this.stamp(), score: sc };
    this.social.posts.push(post); rec.posted = true;
    this.social.followers += Math.round(target * 0.12);
    this.game.audio?.ui('mission');
    this.after(rand(6, 14), () => this.receive(pick(['vale', 'mama', 'andy']), pick(['¡Qué foto más linda! Ya la compartí 😍', 'Vi tu publicación en Lente. ¡Qué crack! 👏', 'Mae, esa foto está demasiado buena 🔥'])));
    if (sc >= 82) this.after(rand(20, 40), () => { this.social.followers += 180; this.social.feed.push({ author: '@AscensoTotal', avatar: '📰', text: `📣 Compartimos la foto de nuestro fotógrafo ${this.handle}: «${caption}»`, thumb: rec.thumb, likes: Math.round(target * 2.5) }); this.game.ui.toast('📣 Ascenso Total compartió tu foto en Lente (+180 seguidores)', 'good', 4000); });
    return post;
  }
  // ---------- Interfaz ----------
  isOpen() { return this.game.ui.screenName === 'phone'; }
  open(app = null) {
    const g = this.game;
    if (g.photoMode.active) g.photoMode.exit();
    this.view = app || 'home'; this.app = app;
    this.el = h('div', { class: 'screen phone-screen' });
    this.frame = h('div', { class: 'phone' });
    this.el.appendChild(this.frame);
    g.ui.openScreen('phone', this.el);
    g.audio?.ui('click');
    // Refresco en vivo solo cuando cambia algo visible (hora, mensajes, me gusta); conserva el foco del control
    let acc = 0; this.liveRender = () => { if (++acc % 20 || !this.isOpen() || !['home', 'lente', 'perfil', 'reloj'].includes(this.view)) return; const sig = this.signature(); if (sig !== this.lastSig) this.render(); };
    g.ui.screenCleanup = () => { this.liveRender = null; };
    this.render();
  }
  go(view, sel = null) { const changed = view !== this.view; this.view = view; if (sel !== null) this.sel = sel; if (changed) this.focusIdx = null; this.render(); this.game.audio?.ui('tick'); }
  signature() { const g = this.game; return [this.view, Math.floor(g.clock), this.totalUnread, this.social.followers, this.social.posts.reduce((a, p) => a + p.likes + p.comments.length, 0), this.social.feed.length, this.tickets.length].join('|'); }
  focusables() { return [...this.frame.querySelectorAll('button:not([disabled])')]; }
  render() {
    if (!this.isOpen() || !this.frame) return;
    const g = this.game, f = this.frame, ui = g.ui;
    // Recordar qué botón tenía el foco del control para devolverlo tras redibujar
    const prev = this.focusables(); const pi = prev.indexOf(ui.navEl); if (pi >= 0) this.focusIdx = pi;
    const bodyEl = f.querySelector('.ph-body'), scroll = bodyEl ? bodyEl.scrollTop : 0, sameView = this.renderedView === this.view;
    this.lastSig = this.signature(); this.renderedView = this.view;
    clear(f);
    const bat = Math.max(9, 96 - Math.floor((g.time || 0) / 90));
    f.append(h('div', { class: 'ph-status' }, h('b', {}, formatClock(g.clock)), h('span', {}, `▂▄▆ 4G · ${bat}%`)));
    const body = h('div', { class: 'ph-body' }); f.append(body);
    const title = (t, back = 'home') => body.append(h('div', { class: 'ph-title' }, h('button', { class: 'ph-back', onclick: () => this.go(back) }, '‹ Volver'), h('span', {}, t)));
    const V = this.view;
    if (V === 'home') {
      body.append(h('div', { class: 'ph-wall' }, h('div', { class: 'ph-bigclock' }, formatClock(g.clock)), h('div', { class: 'muted' }, this.kickoffLine())));
      const unreadChats = Object.values(this.unread).reduce((a, b) => a + b, 0);
      const apps = [['msgs', '💬', 'Mensajes', unreadChats], ['lente', '📷', 'Lente', this.social.newLikes ? '•' : 0], ['entradas', '🎟️', 'Entradas', this.tickets.filter((t) => t.status === 'disponible').length], ['reloj', '⏱️', 'Reloj', 0], ['galeria', '🖼️', 'Galería', 0], ['mapa', '🗺️', 'Mapa', 0]];
      body.append(h('div', { class: 'ph-apps' }, apps.map(([id, ic, name, badge]) => h('button', { class: 'ph-app', onclick: () => {
        if (id === 'galeria') { g.screens.pause('galeria'); return; }
        if (id === 'mapa') { g.screens.pause('mapa'); return; }
        this.go(id);
      } }, h('span', { class: 'ic' }, ic), name, badge ? h('i', { class: 'badge' }, badge) : null))));
    } else if (V === 'msgs') {
      title('Mensajes');
      const order = CONTACTS.slice().sort((a, b) => (this.unread[b.id] || 0) - (this.unread[a.id] || 0) || (this.chats[b.id]?.length ? 1 : 0) - (this.chats[a.id]?.length ? 1 : 0));
      for (const c of order) {
        const last = this.chats[c.id]?.slice(-1)[0];
        body.append(h('button', { class: 'ph-row', onclick: () => { this.unread[c.id] = 0; this.go('chat', c.id); } }, h('span', { class: 'av', style: { background: c.color } }, c.emoji),
          h('span', { class: 'mid' }, h('b', {}, c.name, c.sub ? h('small', {}, ' · ' + c.sub) : null), h('span', { class: 'prev' }, this.typing[c.id] ? 'escribiendo…' : last ? (last.from === 'me' ? 'Vos: ' : '') + last.text : 'Sin mensajes')),
          this.unread[c.id] ? h('i', { class: 'badge' }, this.unread[c.id]) : null));
      }
    } else if (V === 'chat') {
      const c = C[this.sel]; this.unread[c.id] = 0;
      title(c.name, 'msgs');
      const list = h('div', { class: 'ph-chat' });
      for (const m of this.chats[c.id] || []) {
        const tk = m.ticket && this.tickets.find((t) => t.id === m.ticket);
        list.append(h('div', { class: 'bub ' + m.from }, m.text, tk ? h('div', { class: 'tk' }, `🎟️ ${tk.count} entradas · ${tk.zone}`, tk.status === 'disponible' ? h('button', { class: 'btn small primary', onclick: () => this.go('entradas') }, 'Regalar') : h('small', {}, ` · ${tk.status}`)) : null, h('small', {}, m.at)));
      }
      if (this.typing[c.id]) list.append(h('div', { class: 'bub them typing' }, '• • •'));
      body.append(list);
      const opts = this.options[c.id] || [];
      const tps = !opts.length && !this.typing[c.id] ? this.topics(c.id) : [];
      body.append(h('div', { class: 'ph-replies' }, opts.map((o) => h('button', { class: 'btn small primary', onclick: () => this.send(c.id, o) }, o.label)),
        tps.length ? h('div', { class: 'ph-hint' }, 'Escribir sobre…') : null,
        tps.map((t) => h('button', { class: 'btn small', onclick: () => this.startTopic(c.id, t) }, t.label))));
      setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
    } else if (V === 'lente') {
      this.social.newLikes = false;
      title('Lente');
      const s = this.social;
      body.append(h('div', { class: 'ph-profile' }, h('span', { class: 'av big' }, '📸'), h('div', {}, h('b', {}, this.handle), h('div', { class: 'muted' }, `${s.followers.toLocaleString('es-CR')} seguidores · ${s.posts.length} publicaciones`)),
        h('div', { class: 'ph-tabs' }, h('button', { class: 'btn small primary', onclick: () => this.go('publicar') }, '＋ Publicar foto'), h('button', { class: 'btn small', onclick: () => this.go('perfil') }, 'Mi perfil'))));
      const feed = [...s.posts.map((p) => ({ mine: true, author: this.handle, avatar: '📸', text: p.caption, thumb: p.thumb, likes: p.likes, comments: p.comments })), ...s.feed].slice(-20).reverse();
      if (!feed.length) body.append(h('div', { class: 'muted', style: { padding: '12px' } }, 'Todavía no hay publicaciones. ¡Subí tu primera foto!'));
      for (const p of feed) body.append(this.postCard(p));
    } else if (V === 'perfil') {
      title('Mi perfil', 'lente');
      const s = this.social;
      body.append(h('div', { class: 'ph-profile' }, h('span', { class: 'av big' }, '📸'), h('div', {}, h('b', {}, this.handle), h('div', { class: 'muted' }, `${s.followers.toLocaleString('es-CR')} seguidores · ${s.posts.reduce((a, p) => a + p.likes, 0).toLocaleString('es-CR')} me gusta en total`))));
      if (!s.posts.length) body.append(h('div', { class: 'muted', style: { padding: '12px' } }, 'Aún no publicaste nada.'));
      for (const p of s.posts.slice().reverse()) body.append(this.postCard({ mine: true, author: this.handle, avatar: '📸', text: p.caption, thumb: p.thumb, likes: p.likes, comments: p.comments }));
    } else if (V === 'publicar') {
      title('Publicar en Lente', 'lente');
      const recs = g.photos.records.filter((r) => !r.posted && !this.social.posts.some((p) => p.photoId === r.id)).slice(-12).reverse();
      if (!recs.length) body.append(h('div', { class: 'muted', style: { padding: '12px' } }, 'No tenés fotos nuevas. Tomá algunas con la cámara y volvé.'));
      body.append(h('div', { class: 'ph-grid' }, recs.map((r) => h('button', { class: 'ph-thumb' + (this.pick === r.id ? ' on' : ''), onclick: () => { this.pick = r.id; this.render(); } }, h('img', { src: r.thumb }), h('i', {}, Math.round(r.eval.score))))));
      const rec = recs.find((r) => r.id === this.pick);
      if (rec) {
        body.append(h('div', { class: 'h3', style: { margin: '8px 4px 4px' } }, 'Elegí un texto:'));
        body.append(h('div', { class: 'ph-replies' }, this.captions(rec).map((cap) => h('button', { class: 'btn small primary', onclick: () => { this.publish(rec, cap); this.pick = null; g.ui.toast('📷 Publicaste en Lente', 'good'); this.go('lente'); } }, cap))));
      }
    } else if (V === 'entradas') {
      title('Entradas');
      if (!this.tickets.length) body.append(h('div', { class: 'muted', style: { padding: '12px' } }, 'No tenés entradas. A veces el club, Mariana o Kendall te regalan cortesías: te van a escribir por Mensajes.'));
      for (const t of this.tickets.slice().reverse()) {
        body.append(h('div', { class: 'ph-ticket ' + t.status }, h('div', { class: 'tk-l' }, '🎟️', h('b', {}, `${t.count} entradas`), h('span', {}, t.zone), h('small', {}, `Próximo partido · de ${C[t.from]?.name || 'el club'}`)),
          h('div', { class: 'tk-r' }, t.status === 'disponible' ? h('button', { class: 'btn small primary', onclick: () => { this.sel = t.id; this.go('regalar'); } }, 'Regalar') : h('span', { class: 'pill' }, t.status === 'regalada' ? `Para ${C[t.given]?.name}` : 'Usada'))));
      }
    } else if (V === 'regalar') {
      title('¿A quién se las regalás?', 'entradas');
      const t = this.tickets.find((x) => x.id === this.sel);
      body.append(h('div', { class: 'muted', style: { padding: '4px 8px 8px' } }, 'Van a estar en la gradería en tu próxima cobertura, cerca de tu zona de prensa. ¡Buscalos y tomales una foto!'));
      for (const c of CONTACTS.filter((x) => x.family || x.friend)) body.append(h('button', { class: 'ph-row', onclick: () => { if (t && t.status === 'disponible') { this.giveTicket(t, c.id); this.go('chat', c.id); } } }, h('span', { class: 'av', style: { background: c.color } }, c.emoji), h('span', { class: 'mid' }, h('b', {}, c.name), h('span', { class: 'prev' }, c.family ? 'Familia' : 'Amigo'))));
    } else if (V === 'reloj') {
      title('Reloj');
      body.append(h('div', { class: 'ph-wall' }, h('div', { class: 'ph-bigclock' }, formatClock(g.clock)), h('div', {}, this.kickoffLine())));
      const st = g.story, ev = st?.ev;
      if (ev && !st.kickedOff) {
        const left = ev.kickoff - g.clock;
        const waits = [[15, 'Esperar 15 min'], [30, 'Esperar 30 min'], [60, 'Esperar 1 hora']].filter(([m]) => m < left - 2);
        const marks = [];
        if (left > 47) marks.push([left - 45, 'Hasta el calentamiento (−45 min)']);
        if (left > 12) marks.push([left - 10, 'Hasta 10 min antes del saque']);
        body.append(h('div', { class: 'ph-replies' }, [...waits, ...marks].map(([m, l]) => h('button', { class: 'btn small primary', onclick: () => this.wait(m) }, l))));
        body.append(h('div', { class: 'muted', style: { padding: '8px', fontSize: '12px' } }, 'Mientras esperás, el estadio se sigue llenando y la luz cambia con la hora.'));
      } else body.append(h('div', { class: 'muted', style: { padding: '8px' } }, st?.kickedOff ? 'El partido está en juego.' : 'Sin coberturas activas.'));
    }
    f.append(h('div', { class: 'ph-nav' }, h('button', { class: 'btn small', onclick: () => this.go('home') }, '⌂ Inicio'), h('button', { class: 'btn small', onclick: () => g.resume() }, 'Cerrar')));
    if (sameView) body.scrollTop = scroll;
    // Foco del control: el mismo botón si seguimos en la misma pantalla; si no, el primero que no sea «Volver»
    if (g.input.pad) {
      const items = this.focusables();
      const t = sameView && this.focusIdx != null && items[this.focusIdx] ? items[this.focusIdx] : items.find((b) => !b.classList.contains('ph-back') && !b.closest('.ph-nav')) || items[0];
      if (t) { ui.focusNav(t); this.focusIdx = items.indexOf(t); }
    }
  }
  postCard(p) {
    return h('div', { class: 'ph-post' }, h('div', { class: 'ph-post-h' }, h('span', { class: 'av' }, p.avatar), h('b', {}, p.author)),
      p.thumb ? h('img', { src: p.thumb }) : null, h('div', { class: 'ph-post-t' }, p.text),
      h('div', { class: 'ph-post-f' }, `♥ ${(p.likes || 0).toLocaleString('es-CR')}`, p.comments ? ` · 💬 ${p.comments.length}` : ''),
      p.comments?.length ? h('div', { class: 'ph-comments' }, p.comments.slice(-3).map((c) => h('div', {}, h('b', {}, c.who), ' ', c.text))) : null);
  }
  kickoffLine() {
    const g = this.game, ev = g.story?.ev; if (!ev || !g.inEvent) return 'Sin coberturas activas';
    if (g.story.kickedOff) return g.match ? `En juego · ${g.match.teams[0].short} ${g.match.score[0]}-${g.match.score[1]} ${g.match.teams[1].short}` : 'En juego';
    const left = Math.max(0, Math.round(ev.kickoff - g.clock));
    return `Saque inicial ${formatClock(ev.kickoff)} · faltan ${left >= 60 ? Math.floor(left / 60) + ' h ' : ''}${left % 60} min`;
  }
  async wait(min) {
    const g = this.game; g.resume();
    await g.ui.fade(true);
    g.clock += min;
    g.crowdLife?.skipTo();
    await new Promise((r) => setTimeout(r, 250));
    await g.ui.fade(false);
    g.ui.toast(`⏱️ Pasaron ${min >= 60 ? Math.floor(min / 60) + ' h ' : ''}${Math.round(min % 60) ? Math.round(min % 60) + ' min' : ''}. ${this.kickoffLine()}`, 'info', 3500);
  }
}
