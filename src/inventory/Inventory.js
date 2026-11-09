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
    this.equipped = { camera: 'jm_basic', lens: 'kit_18_135', card: 'card_16', backpack: 'backpack_basic', camera2: null, lens2: null };
    this.packed = new Set(['battery']);
    this.mainCharge = 1; this.charge2 = 1; this.spares = [1]; this.cardUsed = 0; this.credential = null;
  }
  get camera() { return CAMERAS[this.equipped.camera]; }
  get lens() { return LENSES[this.equipped.lens]; }
  get card() { return ACCESSORIES[this.equipped.card]; }
  get backpack() { return ACCESSORIES[this.equipped.backpack]; }
  get camera2() { return this.equipped.camera2 ? CAMERAS[this.equipped.camera2] : null; }
  get lens2() { return this.equipped.lens2 ? LENSES[this.equipped.lens2] : null; }
  get hasSecond() { return !!(this.camera2 && this.lens2); }
  // Unidades de un artículo que están en uso (cámara principal, segundo cuerpo, mochila…)
  inUse(id) { const e = this.equipped; return ['camera', 'lens', 'card', 'backpack', 'camera2', 'lens2'].filter((k) => e[k] === id).length; }
  free(id) { return (this.owned[id] || 0) - this.inUse(id); }
  setSecond(kind, id) {
    const key = kind === 'camera' ? 'camera2' : 'lens2';
    if (this.game.inEvent) { this.game.ui.toast('El segundo cuerpo se arma en casa, antes del evento.', 'warn'); return false; }
    if (id && this.equipped[key] !== id && this.free(id) < 1) { this.game.ui.toast('No tenés otra unidad libre de ese equipo.', 'warn'); return false; }
    if (id && !this.equipped.camera2 && kind === 'camera' && this.slotsUsed() + 2 > this.slots) { this.game.ui.toast('La mochila está llena: el segundo cuerpo ocupa 2 espacios.', 'warn'); return false; }
    if (id && kind === 'lens' && this.packed.has(id) && this.free(id) <= 1) this.packed.delete(id);
    this.equipped[key] = id || null;
    if (kind === 'camera' && !id) this.equipped.lens2 = null;
    this.charge2 = 1;
    this.game.events.emit('inventory:changed'); return true;
  }
  // Cambia de cuerpo: la segunda cámara pasa a las manos y la otra queda colgada
  swapBodies() {
    if (!this.hasSecond) return false;
    const e = this.equipped;
    [e.camera, e.camera2] = [e.camera2, e.camera]; [e.lens, e.lens2] = [e.lens2, e.lens]; [this.mainCharge, this.charge2] = [this.charge2, this.mainCharge];
    this.game.events.emit('inventory:changed'); return true;
  }
  sellPrice(id) { const it = ALL_ITEMS[id]; if (!it || !it.price || it.noSell) return 0; return Math.round(it.price * (/usad/i.test(it.name) ? 0.45 : 0.55) / 1000) * 1000; }
  canSell(id) { const it = ALL_ITEMS[id]; if (!this.sellPrice(id)) return false; if (it.type === 'battery') return this.spares.length > 0; return this.free(id) > 0; }
  sell(id) {
    if (!this.canSell(id)) return 0;
    const price = this.sellPrice(id), it = ALL_ITEMS[id];
    this.owned[id]--;
    if (it.type === 'battery') { let k = 0; this.spares.forEach((c, i) => { if (c < this.spares[k]) k = i; }); this.spares.splice(k, 1); if (!this.spares.length) this.packed.delete(id); }
    else if (this.free(id) <= 0) this.packed.delete(id);
    if (this.owned[id] <= 0) delete this.owned[id];
    this.game.events.emit('inventory:changed'); return price;
  }
  get cardCapacity() { return this.card.capacity; }
  get batteryCharge() { return Math.round(this.mainCharge * this.camera.battery); }
  get batteryPct() { return Math.round(this.mainCharge * 100); }
  has(id) {
    if (id === 'credential') return !!this.credential;
    if (Object.values(this.equipped).includes(id)) return true;
    if (id === 'battery') return this.packed.has(id) && this.spares.length > 0;
    return (this.owned[id] || 0) > 0 && (this.packed.has(id) || ['camera', 'card', 'backpack'].includes(ALL_ITEMS[id]?.type));
  }
  owns(id) { return (this.owned[id] || 0) > 0; }
  add(id, n = 1) {
    this.owned[id] = (this.owned[id] || 0) + n;
    if (id === 'battery') for (let i = 0; i < n; i++) this.spares.push(1);
    this.game.events.emit('inventory:changed');
  }
  slotsUsed() { let n = 1 + (this.equipped.camera2 ? 2 : 0); for (const id of this.packed) n += id === 'battery' ? this.spares.length : 1; return n; }
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
    // Si ese equipo estaba en el segundo cuerpo y no hay otra unidad, se intercambian
    const s2 = slot === 'camera' ? 'camera2' : slot === 'lens' ? 'lens2' : null;
    if (s2 && this.equipped[s2] === id && (this.owned[id] || 0) < 2) this.equipped[s2] = prev;
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
  rechargeAll() { this.mainCharge = 1; this.charge2 = 1; this.spares = this.spares.map(() => 1); }
  serialize() { return { owned: this.owned, equipped: this.equipped, packed: [...this.packed], mainCharge: this.mainCharge, charge2: this.charge2, spares: this.spares, cardUsed: this.cardUsed, credential: this.credential }; }
  load(d) { if (!d) return; this.owned = d.owned; this.equipped = d.equipped; this.packed = new Set(d.packed); this.equipped.camera2 ??= null; this.equipped.lens2 ??= null; this.mainCharge = d.mainCharge; this.charge2 = d.charge2 ?? 1; this.spares = d.spares; this.cardUsed = d.cardUsed; this.credential = d.credential; }
}
