const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Traders Vault');

let mainWindow;
let splashWindow;
let tray;
let currentOpacity = 1.0;
let isOverlayMode = true;
let isIgnoringMouse = false;
let hitRects = [];
let mousePoller = null;

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

function setupAutoLaunch() {
  try {
    if (isWin) {
      app.setLoginItemSettings({ openAtLogin: true, name: 'Traders Vault', path: process.execPath });
    } else if (isMac) {
      app.setLoginItemSettings({ openAtLogin: true });
    }
  } catch (e) {}
}

function createSplash() {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  const w = 320, h = 180;

  splashWindow = new BrowserWindow({
    width: w, height: h,
    x: Math.round((sw - w) / 2),
    y: Math.round((sh - h) / 2),
    frame: false,
    transparent: true,
    backgroundColor: '#07070a',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.loadFile('splash.html');
  splashWindow.show();
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
    alwaysOnTop: true,
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
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver');
    if (isMac) {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    isIgnoringMouse = true;
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      app.isQuitting = true;
      if (mousePoller) clearInterval(mousePoller);
      // Give renderer time to save via beforeunload
      setTimeout(() => app.quit(), 300);
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
          mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver');
        } else {
          mainWindow.setAlwaysOnTop(false);
        }
        mainWindow.webContents.send('overlay-mode-changed', isOverlayMode);
      }
    },
    { type: 'separator' },
    { label: 'Quit Traders Vault', click: () => { app.isQuitting = true; app.quit(); } }
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
    mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver');
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
ipcMain.handle('window-close', () => {
  app.isQuitting = true;
  if (mousePoller) clearInterval(mousePoller);
  app.quit();
});
ipcMain.handle('app-quit', () => {
ipcMain.handle('open-external', (_, url) => { if (url) shell.openExternal(url); });
  app.isQuitting = true;
  if (mousePoller) clearInterval(mousePoller);
  app.quit();
});
ipcMain.handle('get-overlay-state', () => ({ overlayMode: isOverlayMode, opacity: currentOpacity }));

// ─── PERSISTENT FILE STORAGE ─────────────────────────────────
const dataDir = path.join(app.getPath('userData'), 'vault-data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

ipcMain.handle('save-data', (_, key, value) => {
  try {
    const filePath = path.join(dataDir, key + '.json');
    fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
    return true;
  } catch (e) {
    console.error('Save error:', e);
    return false;
  }
});

ipcMain.handle('load-data', (_, key) => {
  try {
    const filePath = path.join(dataDir, key + '.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  } catch (e) {
    console.error('Load error:', e);
    return null;
  }
});

ipcMain.handle('get-data-path', () => dataDir);
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
  createSplash();
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

// macOS: hide dock icon since this is an overlay app
if (isMac) {
  app.dock?.hide();
}

// macOS: don't quit when all windows closed
app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
