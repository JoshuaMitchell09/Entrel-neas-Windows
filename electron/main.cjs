// ENTRE LÍNEAS · versión de escritorio (Electron).
// Sirve el juego compilado desde un servidor local (127.0.0.1) para que WebGL, el audio,
// el control y los guardados (localStorage / IndexedDB) funcionen igual que en el navegador.
// Los audios propios se leen desde la carpeta "audio" que está junto al ejecutable.
const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Rendimiento en Windows: GPU dedicada en laptops híbridas, sin limitar la ventana en segundo plano.
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-zero-copy');
if (process.platform === 'win32') app.setAppUserModelId('com.entrelineas.juego');
// Una sola instancia: si ya está abierto, se trae al frente.
if (!app.requestSingleInstanceLock()) app.quit();
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const WEB = path.join(__dirname, '..', 'dist');
// Audios propios: carpeta 'audio' junto al .exe (o public/audio en desarrollo).
const USER_AUDIO = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'audio') : path.join(__dirname, '..', 'public', 'audio');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.woff2': 'font/woff2' };

function send(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
function handler(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (p === '/') p = '/index.html';
  if (p.startsWith('/audio/')) {
    const f = path.join(USER_AUDIO, path.basename(p));
    if (fs.existsSync(f)) return send(res, f);
  }
  const f = path.normalize(path.join(WEB, p));
  if (!f.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
  send(res, f);
}
// Puerto fijo: el origen debe ser siempre el mismo para conservar las partidas guardadas.
function listen(port, tries = 8) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler);
    srv.once('error', (e) => (tries > 0 && e.code === 'EADDRINUSE' ? resolve(listen(port + 1, tries - 1)) : reject(e)));
    srv.listen(port, '127.0.0.1', () => resolve(port));
  });
}

app.whenReady().then(async () => {
  const port = await listen(47823);
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 600, backgroundColor: '#070b14', title: 'ENTRE LÍNEAS · Fotógrafo de la Liga Tica',
    autoHideMenuBar: true, show: false, icon: path.join(__dirname, '..', 'assets', 'icon.png'), webPreferences: { backgroundThrottling: false, spellcheck: false },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  app.on('second-instance', () => { if (win.isMinimized()) win.restore(); win.focus(); });
  // F11: pantalla completa · Ctrl+Shift+I: herramientas de desarrollo
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'I' && input.control && input.shift) win.webContents.toggleDevTools();
  });
  // Descargas (exportar JPG): guardar en la carpeta Imágenes/Entre Lineas
  win.webContents.session.on('will-download', (e, item) => {
    const dir = path.join(app.getPath('pictures'), 'Entre Lineas'); fs.mkdirSync(dir, { recursive: true });
    item.setSavePath(path.join(dir, item.getFilename()));
    item.once('done', (ev, state) => { if (state === 'completed') shell.showItemInFolder(item.getSavePath()); });
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL(`http://127.0.0.1:${port}/`);
});
app.on('window-all-closed', () => app.quit());
