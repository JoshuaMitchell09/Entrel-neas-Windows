import { buffLabels } from '../world/ShopCatalog.js';
import { h, clear } from './dom.js';
import { formatClock, formatMoney } from '../core/MathUtil.js';
import { PARAMS, PARAM_LABELS } from '../photography/PhotoMode.js';
import { WBS, fmtShutter } from '../photography/Equipment.js';
import { crestCanvas } from '../gfx/Textures.js';

/*
 * Gestor de interfaz: HUD de exploración, HUD del visor, avisos, diálogos y pantallas modales.
 */
// Íconos del control (DualSense) por acción
const PAD_GLYPHS = { interact: '✕', crouch: '○', jump: '□', driveMode: '□', equip: '△', paramPrev: 'L1', paramNext: 'R1', paramDec: '←', paramInc: '→',
  autofocus: 'R3', view: 'R3', sprint: 'L3', gear: 'Create', pause: 'Options', swapBattery: 'Panel', phone: 'Panel', inventory: '↑', missions: '↓', map: '←', gallery: '→', zoomIn: '↑', zoomOut: '↓', walk: '—', forward: 'L↑', back: 'L↓', left: 'L←', right: 'L→' };
export class UI {
  constructor(game) {
    this.game = game; this.root = document.getElementById('ui-root'); this.screen = null; this.screenName = null;
    this.build(); this.toastQ = [];
    game.events.on('match:feed', (t) => this.feed(t));
  }
  build() {
    const r = this.root;
    this.hud = h('div', { class: 'hud' },
      this.objEl = h('div', { class: 'objective' }, h('div', { class: 'tag' }, 'OBJETIVO'), this.objText = h('div', { class: 'text' }), this.missionsEl = h('div', { class: 'missions-mini' })),
      h('div', { class: 'topright' }, this.clockEl = h('div', { class: 'clock' }), this.scoreEl = h('div', { class: 'scorebug', style: { display: 'none' } }), this.walletEl = h('div', { class: 'wallet' }), this.buffEl = h('div', { class: 'buffs' })),
      this.zoneEl = h('div', { class: 'zone' }),
      this.promptEl = h('div', { class: 'prompt' }),
      this.feedEl = h('div', { class: 'feed' }),
      this.gearEl = h('div', { class: 'gearbox' }),
      this.hintEl = h('div', { class: 'hint' }),
      this.crossEl = h('div', { class: 'crosshair', style: { display: 'none' } }),
      this.phoneEl = h('div', { class: 'phone-hud' }));
    this.vf = this.buildViewfinder();
    this.toastsEl = h('div', { class: 'toasts' });
    this.dlgEl = h('div');
    this.screenEl = h('div');
    this.fadeEl = h('div', { class: 'fade' });
    this.fpsEl = h('div', { class: 'fps' });
    r.append(this.hud, this.vf.root, this.toastsEl, this.dlgEl, this.screenEl, this.fadeEl, this.fpsEl);
  }
  buildViewfinder() {
    const v = {};
    v.root = h('div', { class: 'vf' },
      v.masks = [0, 1, 2, 3].map(() => h('div', { class: 'mask' })),
      v.frame = h('div', { class: 'frame' }, h('div', { class: 'thirds' })),
      v.afzone = h('div', { class: 'afzone' }),
      v.af = h('div', { class: 'af' }), v.afl = h('div', { class: 'aflabel' }),
      v.top = h('div', { class: 'top' }),
      v.rec = h('div', { class: 'rec' }, '● RÁFAGA'),
      v.help = h('div', { class: 'helpline' }),
      v.bar = h('div', { class: 'bar' }),
      v.review = h('div', { class: 'review' }, v.revImg = h('img'), v.revR = h('div', { class: 'r' }), v.revC = h('div', { class: 'c' })),
      v.blackout = h('div', { class: 'blackout' }));
    return v;
  }
  // ---------- Avisos ----------
  toast(text, kind = 'info', ms = 2600) {
    const el = h('div', { class: 'toast ' + kind }, text);
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.removeChild(this.toastsEl.firstChild);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = 0; setTimeout(() => el.remove(), 400); }, ms);
  }
  // Subtítulos (entrevistas): quién habla y qué dice, abajo al centro
  subtitle(who, text, sec = 4.5) {
    if (!this.subEl) { this.subEl = h('div', { class: 'subtitle' }); this.root.appendChild(this.subEl); }
    this.subEl.innerHTML = ''; this.subEl.append(h('b', {}, who + ': '), text); this.subEl.classList.add('show');
    clearTimeout(this.subT); this.subT = setTimeout(() => this.subEl.classList.remove('show'), sec * 1000);
  }
  feed(text) {
    const m = this.game.match;
    const el = h('div', {}, h('b', {}, m ? `${Math.floor(m.minute)}'` : ''), text);
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 5) this.feedEl.removeChild(this.feedEl.lastChild);
    setTimeout(() => el.remove(), 12000);
  }
  setObjective(t) { this.objText.textContent = t; }
  setPrompt(t) { if (t) { this.promptEl.innerHTML = t; this.promptEl.classList.add('show'); } else this.promptEl.classList.remove('show'); }
  hint(title, text, ms = 0) {
    if (!text) { this.hintEl.classList.remove('show'); return; }
    this.hintEl.innerHTML = ''; this.hintEl.append(h('div', { class: 'h' }, title), h('div', { html: text })); this.hintEl.classList.add('show');
    clearTimeout(this.hintT); if (ms) this.hintT = setTimeout(() => this.hintEl.classList.remove('show'), ms);
  }
  fade(on) { this.fadeEl.classList.toggle('on', on); return new Promise((r) => setTimeout(r, 520)); }
  key(action) {
    if (this.game.input.lastDevice === 'pad') return PAD_GLYPHS[action] || '';
    const c = this.game.settings.data.bindings[action] || ''; return c.replace('Key', '').replace('Digit', '').replace('ShiftLeft', 'Shift').replace('AltLeft', 'Alt').replace('Escape', 'Esc').replace('Space', 'Espacio'); }
  // ---------- Actualización por frame ----------
  update(dt) {
    const g = this.game;
    const showHud = !this.screen && g.state === 'play' && !g.photoMode.active && !this.dialogueActive && !g.cinematic && !g.drone?.active;
    this.hud.classList.toggle('hidden', !showHud);
    this.vf.root.classList.toggle('show', g.photoMode.active && !this.screen);
    this.crossEl.style.display = showHud && g.follow.firstPerson ? 'block' : 'none';
    if (this.phoneTick % 15 === 0) this.buffEl.textContent = buffLabels(g).join('  ·  ');
    if (g.phone && (this.phoneTick = (this.phoneTick || 0) + 1) % 15 === 0) { const n = g.phone.totalUnread; this.phoneEl.innerHTML = `<kbd>${this.key('phone')}</kbd>📱 Teléfono${n ? `<i>${n}</i>` : ''}`; this.phoneEl.classList.toggle('has', n > 0); }
    if (g.settings.data.showFps) this.fpsEl.textContent = `${g.fps.toFixed(0)} FPS · ${g.renderer.info.render.calls} dc`; else this.fpsEl.textContent = '';
    if (g.state !== 'play') return;
    // Reloj / marcador
    const m = g.match;
    this.clockEl.innerHTML = `${formatClock(g.clock)}<small>${g.env.time === 'night' ? 'NOCHE' : g.env.time === 'sunset' ? 'ATARDECER' : 'TARDE'} · ${g.env.weather === 'rain' ? 'LLUVIA' : g.env.weather === 'cloudy' ? 'NUBLADO' : 'DESPEJADO'}</small>`;
    if (m && m.phase !== 'warmup') {
      this.scoreEl.style.display = 'flex';
      const ph = { walkout: 'PREVIA', halftime: 'ENTRETIEMPO', fulltime: 'FINAL' }[m.phase];
      const key = `${m.score[0]}-${m.score[1]}-${Math.floor(m.minute)}-${ph}`;
      if (this.scoreKey !== key) {
        this.scoreKey = key; clear(this.scoreEl);
        this.scoreEl.append(h('div', { class: 'sw', style: { background: m.teams[0].colors.primary } }), h('div', { class: 'team' }, m.teams[0].short),
          h('div', { class: 'score' }, `${m.score[0]} - ${m.score[1]}`), h('div', { class: 'team' }, m.teams[1].short), h('div', { class: 'sw', style: { background: m.teams[1].colors.primary } }),
          h('div', { class: 'min' }, ph || `${Math.floor(m.minute)}'`));
      }
    } else if (m) { this.scoreEl.style.display = 'flex'; const wk = g.crowdLife?.pitchVisible === false ? 'pre' : 'warm'; if (this.scoreKey !== wk) { this.scoreKey = wk; clear(this.scoreEl).append(h('div', { class: 'team' }, `${m.teams[0].short} vs ${m.teams[1].short}`), h('div', { class: 'min' }, wk === 'pre' ? 'PREVIA' : 'CALENTAMIENTO')); } }
    else this.scoreEl.style.display = 'none';
    this.walletEl.innerHTML = `<b>${formatMoney(g.career.money)}</b> · Rep. <b>${Math.round(g.career.reputation)}</b>`;
    // Misiones activas
    const ms = g.missions.active.slice(0, 4);
    const mkey = ms.map((x) => x.id + x.progress + x.status).join('|');
    if (mkey !== this.mkey) {
      this.mkey = mkey; clear(this.missionsEl);
      for (const x of ms) this.missionsEl.append(h('div', { class: 'mm' + (x.status === 'done' ? ' done' : '') }, `${x.status === 'done' ? '✔ ' : ''}${x.title}${x.target > 1 ? ` (${x.progress}/${x.target})` : ''}`, h('div', { class: 'bar' }, h('i', { style: { width: (x.progress / x.target) * 100 + '%' } }))));
    }
    // Zona
    const z = g.rules?.currentZoneLabel();
    if (z) { this.zoneEl.textContent = z.text; this.zoneEl.className = 'zone show' + (z.bad ? ' bad' : ''); } else this.zoneEl.className = 'zone';
    // Equipo
    const inv = g.inventory;
    if (g.player.cameraEquipped || g.photoMode.active) {
      this.gearEl.classList.add('show');
      const bp = inv.batteryPct;
      this.gearEl.innerHTML = `<div class="row"><span>Cámara</span><span>${inv.camera.name}</span></div><div class="row"><span>Lente</span><span>${inv.lens.short}</span></div>
        <div class="row"><span>Batería</span><span>${bp}%</span></div><div class="meter"><i style="width:${bp}%;background:${bp < 20 ? 'var(--bad)' : 'var(--good)'}"></i></div>
        <div class="row"><span>Tarjeta</span><span>${inv.cardCapacity - inv.cardUsed} fotos libres</span></div><div class="row"><span>Repuestos</span><span>${inv.packed.has('battery') ? inv.spares.map((c) => Math.round(c * 100) + '%').join(' · ') : '—'}</span></div>`;
    } else this.gearEl.classList.remove('show');
    if (g.photoMode.active) this.updateViewfinder();
  }
  updateViewfinder() {
    const g = this.game, pm = g.photoMode, v = this.vf, inv = g.inventory;
    const W = window.innerWidth, H = window.innerHeight, fh = Math.min(H, W / 1.5), fw = fh * 1.5, x0 = (W - fw) / 2, y0 = (H - fh) / 2;
    const [m0, m1, m2, m3] = v.masks;
    Object.assign(m0.style, { left: 0, top: 0, width: x0 + 'px', height: H + 'px' }); Object.assign(m1.style, { left: x0 + fw + 'px', top: 0, width: x0 + 'px', height: H + 'px' });
    Object.assign(m2.style, { left: x0 + 'px', top: 0, width: fw + 'px', height: y0 + 'px' }); Object.assign(m3.style, { left: x0 + 'px', top: y0 + fh + 'px', width: fw + 'px', height: y0 + 'px' });
    Object.assign(v.frame.style, { left: x0 + 'px', top: y0 + 'px', width: fw + 'px', height: fh + 'px' });
    // Punto AF: sigue al sujeto rastreado en AF-C
    let ax = W / 2, ay = H / 2, cls = 'af';
    if (pm.s.af === 'AF-C' && pm.afTarget && pm.afTarget.pos) {
      const p = pm.afTarget.pos.clone(); p.y += pm.afTarget.kind === 'ball' ? 0 : 1.1; p.project(g.camera);
      if (p.z < 1) { ax = (p.x + 1) / 2 * W; ay = (1 - p.y) / 2 * H; cls += ' track'; }
    }
    if (pm.s.af !== 'MF' && pm.focusOk && (pm.s.af === 'AF-C' || pm.afLocked)) cls += ' ok';
    v.af.className = cls; v.af.style.left = ax + 'px'; v.af.style.top = ay + 'px';
    const zr = (0.12 + inv.camera.tracking * 0.45) * fh * 0.5;
    Object.assign(v.afzone.style, { left: W / 2 - zr * 1.5 + 'px', top: H / 2 - zr + 'px', width: zr * 3 + 'px', height: zr * 2 + 'px', display: pm.s.af === 'AF-C' ? 'block' : 'none' });
    v.afl.style.left = ax + 'px'; v.afl.style.top = ay + 26 + 'px';
    v.afl.textContent = pm.afTarget ? (pm.afTarget.number ? `#${pm.afTarget.number} ${pm.afTarget.name}` : pm.afTarget.name) + ` · ${pm.afTargetDist.toFixed(1)} m` : `${pm.afTargetDist.toFixed(1)} m`;
    // Barra inferior con parámetros
    const sel = PARAMS[pm.param], d = pm.exposureDelta;
    const iso = pm.iso, isoAuto = pm.s.isoIdx === 0;
    const p = (key, label, val, warn) => h('div', { class: 'p' + (sel === key ? ' sel' : '') + (warn ? ' warn' : '') }, h('small', {}, label), val);
    const ticks = h('div', { class: 'ev', style: { position: 'relative' } }, ...[-3, -2, -1, 0, 1, 2, 3].map((i) => h('div', { class: 'tick' + (i === 0 ? ' mid' : ''), style: { marginRight: '12px' } })), h('div', { class: 'needle', style: { left: `${(Math.max(-3, Math.min(3, d)) + 3) * 15}px` } }));
    clear(v.bar).append(
      p('af', 'ENFOQUE', pm.s.af), h('div', { class: 'p' }, h('small', {}, 'MODO'), pm.s.drive === 'burst' ? `▤ ${inv.camera.fps}fps` : '▢ 1'),
      p('shutter', 'OBTURACIÓN', fmtShutter(pm.shutter), pm.shutter > 1 / 400), p('aperture', 'APERTURA', `f/${pm.aperture}`),
      p('iso', isoAuto ? 'ISO AUTO' : 'ISO', String(iso), iso >= 6400), p('ev', 'COMP. EV', `${pm.s.ev >= 0 ? '+' : ''}${pm.s.ev.toFixed(1)}`),
      h('div', { class: 'p' }, h('small', {}, 'EXPOSICIÓN'), ticks),
      p('wb', 'BALANCE', WBS[pm.s.wbIdx].label.split(' ')[0]), p('focus', 'FOCO', pm.s.af === 'MF' ? `${pm.s.focusDist.toFixed(1)} m` : 'AUTO'),
      h('div', { class: 'p' }, h('small', {}, 'FOCAL'), `${Math.round(pm.s.focal)}mm`), h('div', { class: 'p' }, h('small', {}, 'EQUIV.'), `${Math.round(pm.focalEff)}mm`));
    const bp = inv.batteryPct;
    v.top.innerHTML = `<span>${inv.camera.name} · ${inv.lens.short}</span><span class="${bp < 20 ? 'warn' : ''}">▮ ${bp}%</span><span class="${inv.cardCapacity - inv.cardUsed < 20 ? 'warn' : ''}">[${inv.cardCapacity - inv.cardUsed}]</span><span>BUFFER ${Math.max(0, inv.camera.buffer - pm.bufferUsed)}</span>${pm.shakeRate() < 0.012 ? '<span>ESTABLE</span>' : pm.shakeRate() > 0.06 ? '<span class="warn">PULSO INESTABLE</span>' : ''}${g.player.crouch ? '<span>ÁNGULO BAJO</span>' : ''}`;
    if (g.input.lastDevice === 'pad') v.help.innerHTML = `<kbd>R2</kbd>Disparar · <kbd>↑</kbd><kbd>↓</kbd>Zoom · <kbd>R3</kbd>AF · <kbd>L1</kbd><kbd>R1</kbd>Parámetro · <kbd>←</kbd><kbd>→</kbd>Valor<br><kbd>□</kbd>Ráfaga · <kbd>○</kbd>Arrodillarse · <kbd>L2</kbd>Bajar cámara · <kbd>Panel</kbd>Batería`;
    else v.help.innerHTML = `<kbd>Clic</kbd>Disparar · <kbd>Rueda</kbd>Zoom · <kbd>${this.key('autofocus')}</kbd>AF · <kbd>${this.key('paramPrev')}</kbd><kbd>${this.key('paramNext')}</kbd>Parámetro · <kbd>${this.key('paramDec')}</kbd><kbd>${this.key('paramInc')}</kbd>Valor<br><kbd>${this.key('driveMode')}</kbd>Ráfaga · <kbd>${this.key('crouch')}</kbd>Arrodillarse · <kbd>Clic der.</kbd>/<kbd>Esc</kbd>Bajar cámara · <kbd>${this.key('swapBattery')}</kbd>Batería`;
    v.rec.style.display = g.input.mouse.left && pm.s.drive === 'burst' ? 'block' : 'none';
    v.blackout.style.opacity = pm.blackout > 0 ? 1 : 0;
    const lr = pm.lastResult;
    if (lr && Date.now() - lr.createdAt < 4500) {
      v.review.style.display = 'block';
      if (v.revImg.src !== lr.thumb) v.revImg.src = lr.thumb;
      v.revR.innerHTML = `<span>${lr.eval.label}</span><b style="color:${lr.eval.score >= 80 ? '#f2c500' : lr.eval.score >= 55 ? '#3ddc84' : '#ff8a8a'}">${lr.eval.score}</b>`;
      v.revC.textContent = lr.eval.comments.slice(1, 3).join(' ') || lr.eval.comments[0];
    } else v.review.style.display = 'none';
  }
  // ---------- Diálogo ----------
  dialogue(lines) {
    // lines: [{who, role, color, initials, text, options:[{label, value}]}]
    return new Promise((resolve) => {
      this.dialogueActive = true; this.game.input.releaseLock();
      let i = 0, typing = null;
      const box = h('div', { class: 'dialogue' });
      clear(this.dlgEl).append(box);
      const show = () => {
        const L = lines[i]; clear(box);
        const txt = h('div', { class: 'txt' });
        box.append(h('div', { class: 'portrait', style: { background: L.color || '#0b3d91' } }, L.initials || L.who[0]),
          h('div', { style: { flex: 1 } }, h('div', { class: 'who' }, L.who, h('span', { class: 'role' }, L.role || '')), txt,
            L.options ? h('div', { class: 'opts' }, ...L.options.map((o, k) => h('button', { class: 'btn' + (k === 0 ? ' primary' : ''), onclick: (e) => { e.stopPropagation(); finish(o.value); } }, o.label))) : h('div', { class: 'cont' }, 'Clic / Espacio / E para continuar')));
        if (L.voice !== false) this.game.audio?.talk(L.pos || this.game.camera.position, Math.min(3, L.text.length / 30), L.pitch || 1);
        if (L.say) this.game.audio?.say(L.text);
        let n = 0; clearInterval(typing);
        typing = setInterval(() => { n += 2; txt.textContent = L.text.slice(0, n); if (n >= L.text.length) { clearInterval(typing); typing = null; } }, 16);
        box.dataset.full = L.text;
      };
      const next = () => {
        if (typing) { clearInterval(typing); typing = null; box.querySelector('.txt').textContent = box.dataset.full; return; }
        if (lines[i].options) return;
        i++; if (i >= lines.length) finish(null); else show();
      };
      this.dialogueNext = next;
      const finish = (v) => { this.dialogueNext = null; clearInterval(typing); document.removeEventListener('keydown', onKey); box.removeEventListener('click', next); clear(this.dlgEl); this.dialogueActive = false; resolve(v); };
      const onKey = (e) => { if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); next(); } };
      box.addEventListener('click', next); document.addEventListener('keydown', onKey);
      show();
    });
  }
  // ---------- Pantallas ----------
  openScreen(name, el) {
    this.closeScreen(true);
    this.screen = el; this.screenName = name; this.screenEl.appendChild(el); this.game.input.releaseLock(); this.game.input.uiCapture = true;
    this.game.events.emit('ui:open', name);
  }
  closeScreen(silent) {
    if (!this.screen) return;
    this.screen.remove(); this.screen = null; const n = this.screenName; this.screenName = null; this.game.input.uiCapture = false;
    this.screenCleanup?.(); this.screenCleanup = null;
    if (!silent) this.game.events.emit('ui:close', n);
  }
  confirm(text, okLabel = 'Confirmar', danger = true) {
    return new Promise((res) => {
      const layer = h('div', { class: 'screen confirm-layer', style: { zIndex: 30 } });
      const done = (v) => { layer.remove(); res(v); };
      layer.append(h('div', { class: 'panel confirm' }, h('div', { class: 'h2' }, '¿Estás seguro?'), h('div', { class: 'muted' }, text),
        h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => done(false) }, 'Cancelar'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, okLabel))));
      this.root.appendChild(layer);
    });
  }
  // Navegación de menús con el control: cruceta / stick izq. mueven el foco, ✕ acepta, ○ vuelve.
  padNav(dt) {
    const inp = this.game.input; if (!inp.pad) return;
    this.navCD = Math.max(0, (this.navCD || 0) - dt);
    const confirmLayer = this.root.querySelector('.confirm-layer');
    const dlg = this.dlgEl.firstChild;
    const root = confirmLayer || (dlg && dlg.querySelector('.opts') ? dlg : null) || this.screen || this.customNavRoot;
    // Diálogo sin opciones: ✕ / ○ avanzan
    if (dlg && !dlg.querySelector('.opts') && !confirmLayer) {
      if (inp.padTriggerPressed(0) || inp.padTriggerPressed(1)) { this.dialogueNext?.(); inp.consumePad(); }
      return;
    }
    if (!root) { if (this.navEl) { this.navEl.classList.remove('padfocus'); this.navEl = null; } return; }
    const items = [...root.querySelectorAll('button:not([disabled]), .tab, .ph, select, input[type=range], input[type=checkbox]')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; });
    if (!items.length) return;
    if (!this.navEl || !items.includes(this.navEl)) this.focusNav(items.find((e) => e.classList.contains('primary')) || items[0]);
    const ax = inp.padAxes?.[0] || 0, ay = inp.padAxes?.[1] || 0;
    let dx = (inp.padHeld(15) ? 1 : 0) - (inp.padHeld(14) ? 1 : 0) + (Math.abs(ax) > 0.5 ? Math.sign(ax) : 0);
    let dy = (inp.padHeld(13) ? 1 : 0) - (inp.padHeld(12) ? 1 : 0) + (Math.abs(ay) > 0.5 ? Math.sign(ay) : 0);
    const cur = this.navEl;
    if ((dx || dy) && this.navCD <= 0) {
      this.navCD = 0.18;
      if (cur.type === 'range' && dx && !dy) { const st = +cur.step || 1; cur.value = +cur.value + dx * st * (Math.abs(+cur.max - +cur.min) / st > 40 ? 3 : 1); cur.dispatchEvent(new Event('input')); }
      else {
        const a = cur.getBoundingClientRect(), ac = [a.left + a.width / 2, a.top + a.height / 2];
        let best = null, bs = Infinity;
        for (const e of items) {
          if (e === cur) continue;
          const r = e.getBoundingClientRect(), c = [r.left + r.width / 2, r.top + r.height / 2];
          const vx = c[0] - ac[0], vy = c[1] - ac[1];
          const along = dx ? vx * Math.sign(dx) : vy * Math.sign(dy), across = dx ? Math.abs(vy) : Math.abs(vx);
          if (along <= 4) continue;
          const sc = along + across * 2.5; if (sc < bs) { bs = sc; best = e; }
        }
        if (best) { this.focusNav(best); this.game.audio?.ui('tick'); }
      }
    }
    if (inp.padTriggerPressed(0)) {
      inp.consumePad();
      if (cur.tagName === 'SELECT') { cur.selectedIndex = (cur.selectedIndex + 1) % cur.options.length; cur.dispatchEvent(new Event('change')); }
      else if (cur.type === 'checkbox') { cur.checked = !cur.checked; cur.dispatchEvent(new Event('change')); }
      else cur.click();
      this.game.audio?.ui('click');
    } else if (inp.padTriggerPressed(1)) {
      inp.consumePad();
      if (confirmLayer) confirmLayer.querySelector('.btn')?.click();
      else if (!dlg) { const back = [...root.querySelectorAll('button')].find((b) => /Volver|Cancelar|Cerrar|Reanudar/.test(b.textContent)); if (back) back.click(); else if (this.game.state === 'play') this.game.resume(); }
    }
  }
  focusNav(el) {
    this.navEl?.classList.remove('padfocus'); this.navEl = el; el.classList.add('padfocus');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  crest(team, size = 36) { const c = crestCanvas(team, size * 2); c.style.width = size + 'px'; c.style.height = size + 'px'; return c; }
}
