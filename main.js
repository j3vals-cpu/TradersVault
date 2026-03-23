const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

app.setName('Traders Vault');

let mainWindow;
let tray;
let currentOpacity = 1.0;
let isOverlayMode = true;
let isIgnoringMouse = false;
let hitRects = [];
let mousePoller = null;

function setupAutoLaunch() {
  if (process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({ openAtLogin: true, name: 'Traders Vault', path: process.execPath });
  } catch (e) {}
}

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.bounds;

  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    frame: false,
    // Always on top by default — this is an overlay app
    alwaysOnTop: true,
    type: 'toolbar',          // Windows: keeps it above normal windows
    skipTaskbar: false,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Force always-on-top at the highest level that still allows interaction
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    // Start fully click-through — poller toggles this based on cursor position
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    isIgnoringMouse = true;
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAA' +
    'AklEQVQ4jWNgGAWDHQAAAIAAAQABqjDnAAAAAABJRU5ErkJggg==', 'base64'
  );
  tray = new Tray(nativeImage.createFromBuffer(iconData));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Traders Vault — Vaulted Desk', enabled: false },
    { type: 'separator' },
    { label: 'Show / Hide', click: () => { mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); } },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (item) => {
        isOverlayMode = item.checked;
        if (isOverlayMode) {
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        } else {
          mainWindow.setAlwaysOnTop(false);
        }
        mainWindow.webContents.send('overlay-mode-changed', isOverlayMode);
      }
    },
    { type: 'separator' },
    { label: 'Quit Traders Vault — Vaulted Desk', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip('Traders Vault — Vaulted Desk');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); });
}

// ─── CLICK-THROUGH POLLER ─────────────────────────────────────
ipcMain.on('set-hit-rects', (event, rects) => {
  hitRects = rects || [];
});

function startMousePoller() {
  if (mousePoller) clearInterval(mousePoller);
  mousePoller = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    const disp = screen.getDisplayNearestPoint(cursor);
    const scale = disp.scaleFactor || 1;

    // Convert screen pixels → logical CSS pixels relative to window
    const lx = (cursor.x - bounds.x) / scale;
    const ly = (cursor.y - bounds.y) / scale;

    const over = hitRects.some(r =>
      lx >= r.x && lx <= r.x + r.w &&
      ly >= r.y && ly <= r.y + r.h
    );

    if (over && isIgnoringMouse) {
      mainWindow.setIgnoreMouseEvents(false);
      isIgnoringMouse = false;
    } else if (!over && !isIgnoringMouse) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isIgnoringMouse = true;
    }
  }, 16);
}

// ─── IPC ─────────────────────────────────────────────────────
ipcMain.handle('set-opacity', (_, value) => {
  currentOpacity = Math.max(0.1, Math.min(1.0, parseFloat(value)));
  mainWindow.setOpacity(currentOpacity);
  return currentOpacity;
});

ipcMain.handle('set-overlay', (_, enable) => {
  isOverlayMode = enable;
  if (enable) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setAlwaysOnTop(false);
  }
  mainWindow.setSkipTaskbar(!enable);
  return enable;
});

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow.hide());
ipcMain.handle('get-overlay-state', () => ({ overlayMode: isOverlayMode, opacity: currentOpacity }));
ipcMain.handle('get-window-bounds', () => mainWindow.getBounds());

ipcMain.handle('expand-to-all-screens', () => {
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  displays.forEach(d => {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  });
  const b = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  mainWindow.setBounds(b);
  return b;
});

// ─── APP LIFECYCLE ────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoLaunch();
  startMousePoller();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (mousePoller) clearInterval(mousePoller);
});
