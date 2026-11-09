import { h, clear } from '../ui/dom.js';
import { formatMoney } from '../core/MathUtil.js';
import { genderize } from '../player/Look.js';

/*
 * Productos de pulpería, soda y bar. Cada uno tiene un efecto real en el juego:
 *  energy: la energía para correr dura más · steady: el pulso tiembla menos · focus: autofoco más rápido · tipsy: el pulso tiembla más.
 */
export const CATALOG = {
  pulperia: [
    { id: 'chicle', icon: '🍬', name: 'Chicles de menta', price: 300, desc: 'Masticar calma los nervios: −28 % de trepidación por 4 min.', fx: { steady: 240 } },
    { id: 'cola', icon: '🥤', name: 'Gaseosa cola 600 ml', price: 900, desc: 'Azúcar y cafeína: energía al máximo y aguante extra por 4 min.', fx: { energy: 240, stamina: 1 } },
    { id: 'papas', icon: '🥔', name: 'Papas tostadas', price: 700, desc: 'Para el hambre de la previa: recupera energía.', fx: { stamina: 1 } },
    { id: 'agua', icon: '💧', name: 'Agua 600 ml', price: 600, desc: 'Hidratación: energía al máximo.', fx: { stamina: 1, energy: 120 } },
    { id: 'choco', icon: '🍫', name: 'Tapita de chocolate', price: 500, desc: 'Un gustito: −15 % de trepidación por 2 min.', fx: { steady: 120 } },
    { id: 'energetica', icon: '⚡', name: 'Bebida energética', price: 1500, desc: 'Energía y autofoco más rápido (+20 %) por 6 min.', fx: { energy: 360, focus: 360, stamina: 1 } },
    { id: 'galletas', icon: '🍪', name: 'Galletas de chocolate', price: 650, desc: 'Recupera energía.', fx: { stamina: 1 } },
    { id: 'pilas', icon: '🔋', name: 'Cargador portátil (alquiler)', price: 2500, desc: 'Carga la batería de la cámara al 100 %.', fx: { battery: 1 } },
  ],
  soda: [
    { id: 'cafe', icon: '☕', name: 'Café chorreado', price: 800, desc: 'Atención: autofoco más rápido (+20 %) por 5 min.', fx: { focus: 300 } },
    { id: 'gallo', icon: '🍳', name: 'Gallo pinto con huevo', price: 2800, desc: 'Desayuno tico: energía y aguante por 8 min.', fx: { energy: 480, stamina: 1 } },
    { id: 'casado', icon: '🍛', name: 'Casado con pollo', price: 3800, desc: 'Almuerzo completo: energía 10 min y pulso firme 4 min.', fx: { energy: 600, steady: 240, stamina: 1 } },
    { id: 'empanada', icon: '🥟', name: 'Empanada de queso', price: 900, desc: 'Recupera energía.', fx: { stamina: 1, energy: 120 } },
    { id: 'fresco', icon: '🧃', name: 'Fresco natural de cas', price: 1000, desc: 'Refresca: energía al máximo.', fx: { stamina: 1, energy: 180 } },
    { id: 'arroz', icon: '🍚', name: 'Arroz con pollo', price: 3200, desc: 'Energía por 8 min.', fx: { energy: 480, stamina: 1 } },
  ],
  bar: [
    { id: 'refresco', icon: '🥤', name: 'Refresco de botella', price: 1000, desc: 'Energía al máximo.', fx: { stamina: 1, energy: 120 } },
    { id: 'chifrijo', icon: '🍲', name: 'Chifrijo', price: 3500, desc: 'La boca más famosa del país: energía 8 min.', fx: { energy: 480, stamina: 1 } },
    { id: 'patacones', icon: '🍌', name: 'Patacones con frijoles', price: 2800, desc: 'Energía 6 min.', fx: { energy: 360, stamina: 1 } },
    { id: 'aguabar', icon: '💧', name: 'Agua con gas', price: 1200, desc: 'Hidratación.', fx: { stamina: 1 } },
    { id: 'cerveza', icon: '🍺', name: 'Cerveza nacional', price: 1800, desc: 'No es buena idea antes de trabajar: +55 % de trepidación por 5 min.', fx: { tipsy: 300 }, adult: true },
  ],
};
// Puestos de la zona de comidas del estadio
CATALOG.chifrijo = [
  { id: 'chifrijo_e', icon: '🍲', name: 'Chifrijo de estadio', price: 3000, desc: 'Energía para todo el partido (10 min).', fx: { energy: 600, stamina: 1 } },
  { id: 'chicharron', icon: '🥓', name: 'Chicharrones con limón', price: 2500, desc: 'Energía 6 min.', fx: { energy: 360, stamina: 1 } },
  { id: 'gaseosa_e', icon: '🥤', name: 'Gaseosa en vaso', price: 1200, desc: 'Energía al máximo y aguante 3 min.', fx: { energy: 180, stamina: 1 } },
  { id: 'agua_e', icon: '💧', name: 'Agua', price: 800, desc: 'Hidratación.', fx: { stamina: 1 } },
];
CATALOG.perros = [
  { id: 'perro', icon: '🌭', name: 'Perro caliente', price: 1800, desc: 'Energía 5 min.', fx: { energy: 300, stamina: 1 } },
  { id: 'perro_esp', icon: '🌭', name: 'Perro especial (con todo)', price: 2600, desc: 'Energía 8 min.', fx: { energy: 480, stamina: 1 } },
  { id: 'papas_e', icon: '🍟', name: 'Papas fritas', price: 1500, desc: 'Energía 4 min.', fx: { energy: 240, stamina: 1 } },
  { id: 'cafe_e', icon: '☕', name: 'Café', price: 900, desc: 'Autofoco más rápido (+20 %) por 5 min.', fx: { focus: 300 } },
];
CATALOG.granizados = [
  { id: 'granizado', icon: '🍧', name: 'Granizado con leche en polvo', price: 1500, desc: 'Refresca y calma: −28 % de trepidación por 3 min.', fx: { steady: 180, stamina: 1 } },
  { id: 'copo', icon: '🍧', name: 'Copo de fresa', price: 1200, desc: 'Refresca: energía al máximo.', fx: { stamina: 1, energy: 120 } },
  { id: 'fresco_e', icon: '🧃', name: 'Fresco de tamarindo', price: 1000, desc: 'Energía al máximo.', fx: { stamina: 1, energy: 150 } },
  { id: 'chicle_e', icon: '🍬', name: 'Chicles', price: 400, desc: 'Pulso más firme (−28 %) por 4 min.', fx: { steady: 240 } },
];
CATALOG.pizza = [
  { id: 'pizza', icon: '🍕', name: 'Porción de pizza', price: 2200, desc: 'Energía 6 min.', fx: { energy: 360, stamina: 1 } },
  { id: 'empanada_e', icon: '🥟', name: 'Empanada de carne', price: 1200, desc: 'Energía 4 min.', fx: { energy: 240, stamina: 1 } },
  { id: 'energetica_e', icon: '⚡', name: 'Bebida energética', price: 1800, desc: 'Energía y autofoco +20 % por 6 min.', fx: { energy: 360, focus: 360, stamina: 1 } },
  { id: 'agua_p', icon: '💧', name: 'Agua', price: 800, desc: 'Hidratación.', fx: { stamina: 1 } },
];
const GREET = {
  chifrijo: ['¡Chifrijo, chifrijo! ¿Cuántos le pongo?', '¿Con chicharrón extra?', '¡Pura vida! ¿Qué va a ser?'],
  perros: ['¡Perros, perros calientes!', '¿Con todo o sencillo?', 'Rapidito antes del segundo tiempo, ¿verdad?'],
  granizados: ['¡Granizados! ¿Con leche en polvo y leche condensada?', 'Hace calor, ¿un copito?', '¿De qué sabor lo quiere?'],
  pizza: ['¡Pizza recién salida!', '¿Una porción o dos?', 'Las empanadas están calientitas.'],
  pulperia: ['¡Buenas! ¿Qué le damos?', 'Pase adelante. ¿Qué se le ofrece?', '¡Diay! ¿Qué va a llevar hoy?'],
  soda: ['¡Buenas! Hoy el casado está buenísimo.', 'Siéntese donde guste. ¿Qué le sirvo?', 'Tenemos cafecito recién chorreado.'],
  bar: ['¡Pura vida! ¿Viene a ver el partido?', 'Bienvenido/a. Hoy hay boca de chifrijo.', '¿Qué le sirvo, compa?'],
};
export const KEEPER_LOOKS = {
  chifrijo: { skin: '#a86f48', hair: '#120c08', shirt: '#6d1f3a', pants: '#2b2b2b', boots: '#222', height: 1.7, cap: '#ffffff' },
  perros: { skin: '#c68d63', hair: '#3a2817', shirt: '#e63946', pants: '#2b2b2b', boots: '#222', height: 1.65, female: true, cap: '#ffd166' },
  granizados: { skin: '#e0ac85', hair: '#5a3b22', shirt: '#2a9d8f', pants: '#2b2b38', boots: '#222', height: 1.74 },
  pizza: { skin: '#8d5a3b', hair: '#120c08', shirt: '#f4a261', pants: '#2b2b2b', boots: '#222', height: 1.62, female: true },
  pulperia: { skin: '#c68d63', hair: '#3a2817', shirt: '#2a9d8f', pants: '#2b2b38', boots: '#222', height: 1.66, female: true, vest: '#ffffff' },
  soda: { skin: '#a86f48', hair: '#120c08', shirt: '#ffffff', pants: '#2b2b2b', boots: '#222', height: 1.6, female: true, vest: '#c8102e', cap: '#ffffff' },
  bar: { skin: '#e0ac85', hair: '#2b1c12', shirt: '#1b1b1b', pants: '#2b2b2b', boots: '#111', height: 1.78 },
};

export function buyItem(game, item) {
  const g = game, c = g.career;
  if (c.money < item.price) { g.ui.toast('No te alcanza la plata para eso.', 'warn'); g.audio?.ui('error'); return false; }
  c.money -= item.price; g.audio?.ui('cash');
  const b = (g.buffs ||= {}), now = g.time, fx = item.fx, out = [];
  for (const k of ['energy', 'steady', 'focus', 'tipsy']) if (fx[k]) { b[k] = Math.max(b[k] || 0, now) + fx[k]; out.push(k); }
  if (fx.stamina) g.player.stamina = 1;
  if (fx.battery) g.inventory.mainCharge = 1;
  if (fx.tipsy && g.inEvent) g.ui.toast('🍺 Kendall no estaría orgulloso… El pulso te va a temblar un rato.', 'warn', 4000);
  g.ui.toast(`${item.icon} ${item.name} · −${formatMoney(item.price)}`, 'good', 2600);
  g.events.emit('shop:buy', item);
  return true;
}
export function buffLabels(game) {
  const b = game.buffs || {}, t = game.time, L = { energy: '⚡ Energía', steady: '🫱 Pulso firme', focus: '🎯 Enfoque', tipsy: '🍺 Pulso tembloroso' }, out = [];
  for (const k of Object.keys(L)) if ((b[k] || 0) > t) out.push(`${L[k]} ${Math.ceil((b[k] - t) / 60)}′`);
  return out;
}
export function openShopCounter(game, shop) {
  const g = game, items = CATALOG[shop.kind] || [];
  const body = h('div');
  const render = () => {
    clear(body);
    body.append(h('div', { class: 'shop-head' }, h('div', {}, h('div', { class: 'h2' }, shop.name), h('div', { class: 'muted' }, shop.greet)), h('div', { class: 'shop-cash' }, 'Tenés ', h('b', {}, formatMoney(g.career.money)))));
    const grid = h('div', { class: 'shop-grid' });
    for (const it of items) grid.append(h('div', { class: 'shop-item' }, h('div', { class: 'ic' }, it.icon), h('div', { class: 'nm' }, it.name), h('div', { class: 'ds' }, it.desc),
      h('button', { class: 'btn small ' + (g.career.money >= it.price ? 'primary' : ''), disabled: g.career.money < it.price ? true : null, onclick: () => { if (buyItem(g, it)) { g.audio?.say?.('¡Gracias, pura vida!'); render(); } } }, `Comprar · ${formatMoney(it.price)}`)));
    body.append(grid);
    const bl = buffLabels(g);
    body.append(h('div', { class: 'shop-foot' }, bl.length ? h('div', {}, 'Efectos activos: ', bl.join(' · ')) : h('div', { class: 'muted' }, 'Lo que comprés tiene efecto: energía para correr, pulso más firme o autofoco más rápido.'),
      h('button', { class: 'btn', onclick: () => g.resume() }, 'Volver')));
  };
  shop.greet = genderize(GREET[shop.kind][Math.floor(Math.random() * 3)], g.female);
  render();
  g.ui.openScreen('shop', h('div', { class: 'screen' }, h('div', { class: 'panel shop-panel' }, body)));
}
