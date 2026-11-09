// Reglas de acceso y posicionamiento dentro del estadio.
const PLAY_PHASES = new Set(['play', 'restart', 'goal', 'walkout']);
export class Rules {
  constructor(game) { this.game = game; this.inZone = null; this.zoneT = 0; this.lockout = 0; this.warned = new Set(); this.label = null; }
  reset() { this.inZone = null; this.zoneT = 0; this.lockout = 0; this.warned.clear(); }
  activeRestricted() {
    const g = this.game, st = g.stadium, m = g.match; if (!st) return [];
    const playing = m && PLAY_PHASES.has(m.phase);
    const photo = m && m.phase === 'teamphoto';
    // Fotógrafo oficial del club: acceso a todo el estadio salvo la cancha mientras se juega
    if (g.career?.event?.official && !g.arcade) return st.zones.restricted.filter((z) => z.id === 'pitch' && playing);
    return st.zones.restricted.filter((z) => (z.when === 'always' && !(photo && z.id === 'pitch')) || (z.when === 'play' && playing));
  }
  update(dt) {
    const g = this.game, st = g.stadium; if (!st || !g.inEvent) { this.label = null; return; }
    this.lockout = Math.max(0, this.lockout - dt);
    const p = g.player.pos;
    const z = st.zoneAt(p.x, p.z, this.activeRestricted());
    const press = st.zoneAt(p.x, p.z, st.zones.press);
    if (z) {
      if (this.inZone !== z) { this.inZone = z; this.zoneT = 0; g.ui.toast(`⚠ Estás en ${z.name}. Salí de inmediato o recibirás una sanción.`, 'bad', 3500); g.audio?.whistle(1); this.callSteward(); }
      this.zoneT += dt;
      if (this.zoneT > 4) { this.zoneT = -6; this.infraction(z); }
      this.label = { text: `⚠ ZONA RESTRINGIDA: ${z.name.toUpperCase()}`, bad: true };
    } else {
      this.inZone = null; this.zoneT = 0;
      const des = g.story?.designated, firstOrSecond = g.match && ['walkout', 'restart', 'play', 'goal'].includes(g.match.phase);
      this.label = this.lockout > 0 ? { text: `RETIRADO DE LA ZONA DE PRENSA · ${Math.ceil(this.lockout)} s`, bad: true }
        : g.match?.phase === 'teamphoto' && Math.abs(p.x) < 53 && Math.abs(p.z) < 35 ? { text: 'FOTO OFICIAL · CAMPO HABILITADO' }
        : press ? { text: press.name.toUpperCase() + (des && firstOrSecond && press.id !== des.id && press.id.startsWith('press') ? ' · NO ASIGNADA' : des && press.id === des.id ? ' · TU ZONA' : '') } : null;
    }
  }
  callSteward() {
    const g = this.game; if (!g.stewards?.length) return;
    let best = null, bd = 1e9; for (const s of g.stewards) { const d = s.pos.distanceTo(g.player.pos); if (d < bd) { bd = d; best = s; } }
    if (best) { best.route = [g.player.pos.clone().setY(0), best.pos.clone()]; best.ri = 0; best.loop = false; best.speed = 3; best.playOnce('point', 2); }
  }
  infraction(z) {
    const g = this.game, es = g.career.eventState; if (!es) return;
    es.infractions++; g.career.stats.infractions++;
    g.audio?.ui('warn');
    if (es.infractions >= 3) { this.expel(); return; }
    g.ui.toast(`Infracción ${es.infractions}/3: invadiste ${z.name}. El encargado de prensa tomó nota.`, 'bad', 4500);
  }
  async expel() {
    const g = this.game, es = g.career.eventState; es.expelled = true;
    g.ui.toast('Seguridad te retiró de la zona de prensa por reincidir. No podrás fotografiar durante 60 segundos.', 'bad', 6000);
    if (g.photoMode.active) g.photoMode.exit();
    g.cinematic = true; await g.ui.fade(true);
    const t = g.stadium.spots.hall; g.player.place(t.x, t.z, Math.PI); g.follow.snap(g.player);
    await g.ui.fade(false); g.cinematic = false;
    this.lockout = 60; es.infractions = 2;
  }
  canShoot() {
    if (this.lockout > 0) { this.game.ui.toast(`No podés fotografiar: retirado ${Math.ceil(this.lockout)} s.`, 'bad', 1500); return false; }
    return true;
  }
  currentZoneLabel() { return this.label; }
}
