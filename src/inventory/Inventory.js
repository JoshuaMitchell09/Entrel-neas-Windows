import { ALL_ITEMS, CAMERAS, LENSES, ACCESSORIES } from '../photography/Equipment.js';

/*
 * Inventario: equipo propio, equipo cargado en la mochila para el evento, batería y tarjeta.
 */
export class Inventory {
  constructor(game) {
    this.game = game;
    this.reset();
  }
  reset() {
    this.owned = { jm_basic: 1, kit_18_135: 1, card_16: 1, backpack_basic: 1, battery: 1 };
    this.equipped = { camera: 'jm_basic', lens: 'kit_18_135', card: 'card_16', backpack: 'backpack_basic' };
    this.packed = new Set(['battery']);
    this.mainCharge = 1; this.spares = [1]; this.cardUsed = 0; this.credential = null;
  }
  get camera() { return CAMERAS[this.equipped.camera]; }
  get lens() { return LENSES[this.equipped.lens]; }
  get card() { return ACCESSORIES[this.equipped.card]; }
  get backpack() { return ACCESSORIES[this.equipped.backpack]; }
  get cardCapacity() { return this.card.capacity; }
  get batteryCharge() { return Math.round(this.mainCharge * this.camera.battery); }
  get batteryPct() { return Math.round(this.mainCharge * 100); }
  has(id) {
    if (id === 'credential') return !!this.credential;
    if (Object.values(this.equipped).includes(id)) return true;
    return (this.owned[id] || 0) > 0 && (this.packed.has(id) || ['camera', 'card', 'backpack'].includes(ALL_ITEMS[id]?.type));
  }
  owns(id) { return (this.owned[id] || 0) > 0; }
  add(id, n = 1) {
    this.owned[id] = (this.owned[id] || 0) + n;
    if (id === 'battery') for (let i = 0; i < n; i++) this.spares.push(1);
    this.game.events.emit('inventory:changed');
  }
  slotsUsed() { let n = 1; for (const id of this.packed) n += id === 'battery' ? this.spares.length : 1; return n; }
  get slots() { return this.backpack.slots; }
  togglePack(id) {
    if (this.packed.has(id)) this.packed.delete(id);
    else {
      if (this.slotsUsed() + 1 > this.slots) { this.game.ui.toast('La mochila está llena.', 'warn'); return false; }
      this.packed.add(id);
    }
    this.game.events.emit('inventory:changed'); return true;
  }
  equip(id) {
    const it = ALL_ITEMS[id]; if (!it || !this.owns(id)) return false;
    if (it.type === 'lens' && this.game.photoMode?.active) { this.game.ui.toast('Bajá la cámara para cambiar de lente.', 'warn'); return false; }
    if (it.type === 'lens' && this.game.inEvent && !this.packed.has(id) && this.equipped.lens !== id) { this.game.ui.toast('Ese lente no está en tu mochila para este evento.', 'warn'); return false; }
    const slot = { camera: 'camera', lens: 'lens', card: 'card', backpack: 'backpack' }[it.type];
    if (!slot) return false;
    const prev = this.equipped[slot];
    this.equipped[slot] = id;
    if (it.type === 'lens' && prev && prev !== id && this.game.inEvent) { this.packed.add(prev); this.packed.delete(id); }
    if (it.type === 'card' && prev !== id) this.cardUsed = 0;
    this.game.events.emit('inventory:changed');
    return true;
  }
  drainBattery(units) {
    this.mainCharge = Math.max(0, this.mainCharge - units / this.camera.battery);
    if (this.mainCharge <= 0) this.game.events.emit('battery:empty');
  }
  swapBattery() {
    if (!this.packed.has('battery') || !this.spares.length) return false;
    let idx = -1, best = 0;
    this.spares.forEach((c, i) => { if (c > best) { best = c; idx = i; } });
    if (idx < 0 || best <= this.mainCharge) return false;
    const old = this.mainCharge; this.mainCharge = this.spares[idx]; this.spares[idx] = old;
    this.game.events.emit('inventory:changed'); return true;
  }
  rechargeAll() { this.mainCharge = 1; this.spares = this.spares.map(() => 1); }
  serialize() { return { owned: this.owned, equipped: this.equipped, packed: [...this.packed], mainCharge: this.mainCharge, spares: this.spares, cardUsed: this.cardUsed, credential: this.credential }; }
  load(d) { if (!d) return; this.owned = d.owned; this.equipped = d.equipped; this.packed = new Set(d.packed); this.mainCharge = d.mainCharge; this.spares = d.spares; this.cardUsed = d.cardUsed; this.credential = d.credential; }
}
