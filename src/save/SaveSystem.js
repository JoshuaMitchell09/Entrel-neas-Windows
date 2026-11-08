// Guardado persistente en localStorage (las fotos viven en IndexedDB asociadas al perfil).
const PREFIX = 'entrelineas.save.';
export const SLOTS = ['auto', '1', '2', '3'];
export class SaveSystem {
  constructor(game) { this.game = game; }
  key(slot) { return PREFIX + slot; }
  snapshot() {
    const g = this.game;
    return { version: 1, savedAt: new Date().toISOString(), profileId: g.profileId, playerName: g.playerName,
      career: g.career.serialize(), inventory: g.inventory.serialize(), missions: g.missions.serialize(), story: g.story.serialize() };
  }
  save(slot = 'auto') {
    if (this.game.arcade) return false; // el modo arcade no toca la carrera
    try { localStorage.setItem(this.key(slot), JSON.stringify(this.snapshot())); this.game.events.emit('game:saved', slot); return true; }
    catch (e) { console.error(e); return false; }
  }
  read(slot) { try { const r = localStorage.getItem(this.key(slot)); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  list() { return SLOTS.map((s) => ({ slot: s, data: this.read(s) })); }
  hasAny() { return SLOTS.some((s) => this.read(s)); }
  latest() { return this.list().filter((x) => x.data).sort((a, b) => b.data.savedAt.localeCompare(a.data.savedAt))[0] || null; }
  async remove(slot) {
    const d = this.read(slot); localStorage.removeItem(this.key(slot));
    if (d && !SLOTS.some((s) => this.read(s)?.profileId === d.profileId)) await this.game.photos.removeProfile(d.profileId);
  }
}
