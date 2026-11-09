import { Game } from './game/Game.js';
import { EVENTS } from './career/Career.js';

const bootBar = document.getElementById('boot-progress'), bootMsg = document.getElementById('boot-msg');
const bootShots = document.getElementById('boot-shots'), bootTip = document.getElementById('boot-tip');
const progress = (p, msg) => { bootBar.style.width = Math.round(p * 100) + '%'; if (msg) bootMsg.textContent = msg; if (bootShots) bootShots.textContent = String(999 - Math.round(p * 999)).padStart(3, '0'); };
// Consejos mientras carga
const TIPS = [
  'Consejo: con T cambiás a tu segunda cámara al instante.',
  'Consejo: un 1/1000 o más rápido congela la acción del partido.',
  'Consejo: la foto del gol vale más si se ve la pelota y la cara del goleador.',
  'Consejo: de noche subí el ISO, pero ojo con el ruido.',
  'Consejo: en la Segunda y en las ligas menores no te piden reputación.',
  'Consejo: vendé en la tienda el equipo que ya no usás.',
  'Consejo: recogé la acreditación en el parqueo de prensa antes del partido.',
];
let tipIdx = Math.floor(Math.random() * TIPS.length);
const showTip = () => { if (bootTip) { bootTip.textContent = TIPS[tipIdx % TIPS.length]; tipIdx++; } };
showTip(); const tipTimer = setInterval(showTip, 3200);
const bootStart = performance.now();
const tick = () => new Promise((r) => setTimeout(r, 16));

async function boot() {
  try {
    progress(0.1, 'Inicializando motor gráfico…'); await tick();
    const game = new Game(document.getElementById('game-canvas'));
    window.game = game;
    await game.photos.ready;
    progress(0.25, 'Construyendo estadio…'); await tick();
    game.buildLevel(EVENTS[0], (p, m) => progress(0.25 + p * 0.6, m));
    progress(0.9, 'Compilando materiales…'); await tick();
    game.renderer.compile(game.scene, game.camera);
    game.state = 'menu';
    game.start();
    game.screens.mainMenu();
    progress(1, 'Listo'); await tick();
    // Que la animación del logo se vea completa aunque la carga sea muy rápida
    const wait = 2600 - (performance.now() - bootStart); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    clearInterval(tipTimer);
    const b = document.getElementById('boot'); b.classList.add('done'); setTimeout(() => b.remove(), 800);
  } catch (e) {
    console.error(e); bootMsg.textContent = 'Error al iniciar: ' + e.message; bootMsg.style.color = '#ff7a7a';
  }
}
boot();
