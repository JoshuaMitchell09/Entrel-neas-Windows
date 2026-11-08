import { Game } from './game/Game.js';
import { EVENTS } from './career/Career.js';

const bootBar = document.getElementById('boot-progress'), bootMsg = document.getElementById('boot-msg');
const progress = (p, msg) => { bootBar.style.width = Math.round(p * 100) + '%'; if (msg) bootMsg.textContent = msg; };
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
    const b = document.getElementById('boot'); b.style.opacity = 0; setTimeout(() => b.remove(), 700);
  } catch (e) {
    console.error(e); bootMsg.textContent = 'Error al iniciar: ' + e.message; bootMsg.style.color = '#ff7a7a';
  }
}
boot();
