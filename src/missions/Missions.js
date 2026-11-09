// Sistema de misiones: objetivos con progreso, condiciones de finalización y recompensas.
export const MISSION_DEFS = {
  m_acred: { title: 'Recogé tu acreditación', desc: 'Buscá el puesto de prensa en la plaza del estadio y hablá con Mariana.', kind: 'story', target: 1, trigger: 'story:credential', reward: { rep: 1 } },
  m_llegar: { title: 'Llegá al estadio', desc: 'Caminá hasta el acceso de prensa del estadio.', kind: 'story', target: 1, trigger: 'story:gate', reward: {} },
  m_seguridad: { title: 'Pasá el control de seguridad', desc: 'Presentá tu acreditación al guardia y pasá la mochila por el escáner.', kind: 'story', target: 1, trigger: 'story:security', reward: {} },
  m_preparar: { title: 'Prepará tu equipo', desc: 'En la zona de preparación del pasillo: dejá la mochila, montá el lente, batería y tarjeta.', kind: 'story', target: 1, trigger: 'story:prepared', reward: {} },
  m_cancha: { title: 'Encontrá a Kendall Rojas', desc: 'Atravesá el túnel y buscalo en la zona de prensa detrás de la portería este.', kind: 'story', target: 1, trigger: 'story:alvaro', reward: { rep: 1 } },
  m_calentamiento: { title: 'Primera cobertura', desc: 'Capturá 5 fotografías del calentamiento (calidad mínima 35).', kind: 'event', target: 5, photo: { tags: ['calentamiento'], min: 35 }, reward: { money: 10000, rep: 2 } },
  m_entrega: { title: 'Tu primera entrega', desc: 'Entregá al editor al menos una fotografía válida (40 o más).', kind: 'story', target: 1, trigger: 'delivery:valid', reward: { money: 5000, rep: 2 } },
  m_gol: { title: 'El gol', desc: 'Capturá una fotografía de un gol (calidad mínima 50).', kind: 'event', target: 1, photo: { tags: ['gol'], min: 50 }, reward: { money: 30000, rep: 3 } },
  m_celebracion: { title: 'La celebración', desc: 'Fotografiá una celebración después de un gol (calidad mínima 55).', kind: 'event', target: 1, photo: { tags: ['celebracion'], min: 55 }, reward: { money: 22000, rep: 2 } },
  m_portero: { title: 'El guardameta', desc: 'Capturá 3 atajadas (calidad mínima 45).', kind: 'event', target: 3, photo: { tags: ['atajada'], min: 45 }, reward: { money: 45000, rep: 4 } },
  m_lluvia: { title: 'Agua y barro', desc: 'Conseguí 3 fotos de entradas o disputas bajo la lluvia (mínimo 60).', kind: 'event', target: 3, photo: { tags: ['entrada', 'disputa'], min: 60 }, reward: { money: 40000, rep: 3 } },
  m_clasico: { title: 'El clásico', desc: 'Conseguí 10 fotografías de calidad superior a 80.', kind: 'event', target: 10, photo: { tags: null, min: 80 }, reward: { money: 120000, rep: 6 } },
  m_portada: { title: 'La portada', desc: 'Capturá una imagen digna de portada (momento clave, 85+ y buena composición).', kind: 'event', target: 1, photo: { tags: ['portada'], min: 85 }, reward: { money: 90000, rep: 6 } },
  m_entrevista: { title: 'Zona mixta', desc: 'Fotografiá la entrevista al jugador del partido junto al túnel (calidad mínima 45).', kind: 'event', target: 1, photo: { tags: ['entrevista'], min: 45 }, reward: { money: 15000, rep: 2 } },
  m_vestuario: { title: 'La previa en el vestuario', desc: 'Como fotógrafo oficial: fotografiá el vestuario de tu club (camisetas, pizarra) antes del partido.', kind: 'event', target: 1, trigger: 'story:lockerPhoto', reward: { money: 25000, rep: 3 } },
  m_palco: { title: 'Vista desde el palco', desc: 'Subí al palco VIP y tomá una foto panorámica del estadio.', kind: 'event', target: 1, trigger: 'story:palcoPhoto', reward: { money: 15000, rep: 2 } },
  m_final: { title: 'Campeones', desc: 'Fotografiá la celebración del campeón al final del partido (mínimo 60).', kind: 'event', target: 1, photo: { tags: ['final', 'celebracion'], min: 60, phase: 'fulltime' }, reward: { money: 80000, rep: 5 } },
};
export class MissionSystem {
  constructor(game) {
    this.game = game; this.active = []; this.done = [];
    game.events.on('photo:taken', (rec) => this.onPhoto(rec));
    for (const t of ['story:credential', 'story:gate', 'story:security', 'story:prepared', 'story:alvaro', 'delivery:valid', 'story:lockerPhoto', 'story:palcoPhoto']) game.events.on(t, () => this.onTrigger(t));
  }
  add(id) {
    if (this.active.some((m) => m.id === id) || (this.done.includes(id) && MISSION_DEFS[id].kind === 'story' && !['m_acred', 'm_llegar', 'm_seguridad', 'm_preparar', 'm_cancha'].includes(id))) return;
    const d = MISSION_DEFS[id]; if (!d) return;
    const m = { id, ...d, progress: 0, status: 'active' };
    this.active.push(m); this.game.events.emit('mission:added', m);
    this.game.ui?.toast(`Nueva misión: ${d.title}`, 'mission');
  }
  clearEventMissions() { this.active = this.active.filter((m) => m.kind === 'story' && m.status === 'active'); }
  onTrigger(t) { for (const m of this.active) if (m.status === 'active' && m.trigger === t) this.advance(m, 1); }
  onPhoto(rec) {
    // Fotos de lugares especiales (fotógrafo oficial)
    const g = this.game, st = g.stadium, p = g.player.pos;
    if (st?.lockerRooms?.some((L) => p.x > L.box.x0 && p.x < L.box.x1 && p.z > L.box.z0 && p.z < L.box.z1)) g.events.emit('story:lockerPhoto');
    if (st?.palco && p.y > 3) g.events.emit('story:palcoPhoto');
    const ph = this.game.match?.phase;
    for (const m of this.active) {
      if (m.status !== 'active' || !m.photo) continue;
      const okTag = !m.photo.tags || m.photo.tags.some((t) => rec.eval.tags.includes(t));
      const okPhase = !m.photo.phase || ph === m.photo.phase;
      if (okTag && okPhase && rec.eval.score >= m.photo.min) this.advance(m, 1);
    }
  }
  advance(m, n) {
    m.progress = Math.min(m.target, m.progress + n);
    this.game.events.emit('mission:progress', m);
    if (m.progress >= m.target) this.complete(m);
  }
  complete(m) {
    m.status = 'done'; this.done.push(m.id);
    const c = this.game.career;
    if (m.reward.money) { c.money += m.reward.money; c.stats.earned += m.reward.money; }
    if (m.reward.rep) c.reputation = Math.min(100, c.reputation + m.reward.rep);
    this.game.events.emit('mission:done', m);
    this.game.audio?.ui('mission');
    const parts = [m.reward.money ? `+₡${m.reward.money.toLocaleString('es-CR')}` : null, m.reward.rep ? `+${m.reward.rep} reputación` : null].filter(Boolean).join(' · ');
    this.game.ui?.toast(`✔ Misión completada: ${m.title}${parts ? ' — ' + parts : ''}`, 'mission', 4000);
    setTimeout(() => { this.active = this.active.filter((x) => x !== m); this.game.events.emit('mission:changed'); }, 4500);
  }
  serialize() { return { active: this.active.map((m) => ({ id: m.id, progress: m.progress })), done: this.done }; }
  load(d) {
    if (!d) return; this.done = d.done || [];
    this.active = (d.active || []).map((a) => ({ id: a.id, ...MISSION_DEFS[a.id], progress: a.progress, status: 'active' })).filter((m) => m.title);
  }
}
