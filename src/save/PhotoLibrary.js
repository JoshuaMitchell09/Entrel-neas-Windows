// Biblioteca de fotografías: cada foto es un JPEG real almacenado en IndexedDB con sus metadatos EXIF simulados.
const DB_NAME = 'entrelineas-photos', STORE = 'photos';
export class PhotoLibrary {
  constructor(game) {
    this.game = game; this.records = []; this.mem = new Map(); this.db = null; this.profileId = null;
    this.ready = this.open();
  }
  open() {
    return new Promise((res) => {
      try {
        const rq = indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = () => { const s = rq.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('profile', 'profileId'); };
        rq.onsuccess = () => { this.db = rq.result; res(); };
        rq.onerror = () => res();
      } catch (e) { res(); }
    });
  }
  tx(mode) { return this.db.transaction(STORE, mode).objectStore(STORE); }
  async setProfile(id) {
    this.profileId = id; this.records = [];
    await this.ready;
    if (!this.db) { this.records = [...this.mem.values()].filter((r) => r.profileId === id).map(stripBlob); return; }
    this.records = await new Promise((res) => {
      const out = []; const rq = this.tx('readonly').index('profile').openCursor(IDBKeyRange.only(id));
      rq.onsuccess = () => { const c = rq.result; if (c) { out.push(stripBlob(c.value)); c.continue(); } else res(out); };
      rq.onerror = () => res(out);
    });
    this.records.sort((a, b) => a.createdAt - b.createdAt);
  }
  async addCapture(canvas, meta, ev) {
    const thumb = makeThumb(canvas, 360);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
    const rec = { id: `ph_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, profileId: this.profileId, createdAt: Date.now(), sessionId: meta.sessionId,
      meta, eval: ev, thumb, favorite: false, selected: false, delivered: false, edits: null, editedEval: null };
    this.records.push(rec);
    await this.put({ ...rec, blob });
    return rec;
  }
  async put(full) {
    await this.ready;
    if (!this.db) { this.mem.set(full.id, full); return; }
    await new Promise((res) => { const rq = this.tx('readwrite').put(full); rq.onsuccess = res; rq.onerror = res; });
  }
  async update(rec) {
    const blob = await this.getBlob(rec.id);
    await this.put({ ...rec, blob });
  }
  async getBlob(id) {
    await this.ready;
    if (!this.db) return this.mem.get(id)?.blob;
    return new Promise((res) => { const rq = this.tx('readonly').get(id); rq.onsuccess = () => res(rq.result?.blob); rq.onerror = () => res(null); });
  }
  async remove(id) {
    this.records = this.records.filter((r) => r.id !== id);
    await this.ready;
    if (!this.db) { this.mem.delete(id); return; }
    await new Promise((res) => { const rq = this.tx('readwrite').delete(id); rq.onsuccess = res; rq.onerror = res; });
  }
  async removeProfile(id) {
    await this.ready;
    if (!this.db) { for (const [k, v] of this.mem) if (v.profileId === id) this.mem.delete(k); return; }
    await new Promise((res) => {
      const rq = this.tx('readwrite').index('profile').openCursor(IDBKeyRange.only(id));
      rq.onsuccess = () => { const c = rq.result; if (c) { c.delete(); c.continue(); } else res(); }; rq.onerror = res;
    });
  }
  session(sessionId = this.game.career?.sessionId) { return this.records.filter((r) => r.sessionId === sessionId); }
  sessionMetas() { return this.session().map((r) => ({ momentType: r.eval.moment.type, eventId: r.meta.eventId })); }
  finalScore(r) { return r.editedEval ? r.editedEval.score : r.eval.score; }
}
function stripBlob(r) { const { blob, ...rest } = r; return rest; }
function makeThumb(canvas, w) {
  const h = Math.round(w * canvas.height / canvas.width), c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(canvas, 0, 0, w, h); return c.toDataURL('image/jpeg', 0.78);
}
