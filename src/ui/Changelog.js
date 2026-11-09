import { h } from './dom.js';

// Notas de la versión: se muestran al abrir el juego cuando hay una versión nueva (y desde «Novedades» en el menú).
export const VERSION = '0.9.1';
export const AUTHOR = 'MitchellsVisuals';
export const COPYRIGHT = `© ${new Date().getFullYear()} ${AUTHOR}. Todos los derechos reservados.`;

export const CHANGELOG = {
  date: 'Noviembre 2026',
  news: [
    ['🎵', 'Música y ambiente de estadio', 'Música de inicio nueva y grabaciones reales de multitud, festejo de gol, aplausos y el «uuuh» del público (todo de dominio público).'],
    ['🏟️', 'Segunda División', 'Todos los partidos en el Estadio El Llano: gradería techada a la calle, sintética rayada y postes de luz.'],
    ['⚽', 'Ligas menores', 'Partidos U-17 y U-15 en los complejos La Cantera y Centro de Alto Rendimiento Rojinegro, con canchas de entrenamiento alrededor.'],
    ['📷', 'Segunda cámara', 'Llevá dos cuerpos con lentes distintos y cambiá al instante con T (o L3 en el visor).'],
    ['💰', 'Vender equipo', 'La tienda te compra el equipo que ya no usás a cerca de la mitad de su precio.'],
    ['🎮', 'Menú nuevo', 'Menú principal estilo consola con una cámara réflex 3D sobre el césped del estadio de noche.'],
    ['🏆', 'Copa Centroamericana', 'Acreditación especial de la copa y rivales de toda la región.'],
    ['⭐', 'Fotógrafo oficial', 'Cuando el fotógrafo del club se enferma: acceso a vestuarios, palco VIP y todo el estadio.'],
    ['🚩', 'Fuera de juego', 'Los asistentes levantan la bandera y el árbitro pita el fuera de lugar.'],
    ['🅿️', 'Parqueo de prensa', 'Parqueo con aguja para los fotógrafos; la acreditación se recoge adentro.'],
    ['📱', 'Grabar con el celular', 'Videos en horizontal o vertical para presentar tus mejores tomas.'],
  ],
  fixes: [
    'La zona de comidas ya no está en el pasillo de prensa: tiene entrada general desde la calle para el público.',
    'Se quitaron unas franjas amarillas que flotaban en la salida del túnel de prensa.',
    'Las puertas de entrada de Alajuela y Cartago ya no están bloqueadas.',
    'Los focos nocturnos ya no quedan tapados por los techos.',
    'Ya no aparecen casas ni árboles en medio de la avenida.',
    'El carro ya no se sale solo justo después de subirse.',
    'El palco VIP ya no deja caer al jugador a través del piso.',
    'Un carro parqueado ya no bloquea la entrada del parqueo de prensa.',
    'Las fotos publicadas en Lente ya no se ven apelotonadas.',
    'Se quitó el texto «null» que aparecía en la barra de pausa.',
  ],
};

const SEEN_KEY = 'entrelineas.changelog.seen';
export function changelogSeen() { try { return localStorage.getItem(SEEN_KEY) === VERSION; } catch { return false; } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, VERSION); } catch { /* sin almacenamiento */ } }

// Capa encima de cualquier pantalla (no reemplaza el menú)
export function showChangelog(ui) {
  if (ui.root.querySelector('.changelog-layer')) return;
  const layer = h('div', { class: 'screen changelog-layer', style: { zIndex: 40 } });
  const close = () => { markSeen(); layer.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (['Escape', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  const C = CHANGELOG;
  layer.append(h('div', { class: 'panel changelog' },
    h('div', { class: 'cl-head' },
      h('div', {}, h('div', { class: 'cl-kicker' }, `VERSIÓN ${VERSION} · ${C.date}`), h('div', { class: 'cl-title' }, 'Novedades y arreglos')),
      h('button', { class: 'cl-x', title: 'Cerrar', onclick: close }, '✕')),
    h('div', { class: 'cl-body' },
      h('div', {}, h('div', { class: 'cl-sec' }, '✨ Nuevo en el juego'),
        h('div', { class: 'cl-news' }, ...C.news.map(([ic, t, d]) => h('div', { class: 'cl-item' }, h('div', { class: 'ic' }, ic), h('div', {}, h('b', {}, t), h('div', { class: 'muted' }, d)))))),
      h('div', {}, h('div', { class: 'cl-sec' }, '🛠️ Errores arreglados'),
        h('ul', { class: 'cl-fixes' }, ...C.fixes.map((f) => h('li', {}, f))))),
    h('div', { class: 'cl-foot' },
      h('div', { class: 'cl-author' }, h('div', { class: 'muted', style: { fontSize: '11px', letterSpacing: '2px' } }, 'UN JUEGO DE'), h('div', { class: 'name' }, AUTHOR), h('div', { class: 'muted', style: { fontSize: '12px' } }, COPYRIGHT)),
      h('button', { class: 'btn primary', onclick: close }, '¡A jugar!'))));
  ui.root.appendChild(layer);
  setTimeout(() => layer.querySelector('.btn.primary')?.focus(), 50);
}
