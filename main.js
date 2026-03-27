const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

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

function getAllScreenBounds() {
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  displays.forEach(d => {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ─── WINDOW BOUNDS CLAMPING ─────────────────────────────────
// Cache workArea to avoid expensive screen queries every poll tick
let cachedWorkAreas = null;
let workAreaCacheTime = 0;
function getCachedWorkAreas() {
  const now = Date.now();
  if (!cachedWorkAreas || now - workAreaCacheTime > 2000) {
    cachedWorkAreas = screen.getAllDisplays().map(d => d.workArea);
    workAreaCacheTime = now;
  }
  return cachedWorkAreas;
}
function invalidateWorkAreaCache() {
  cachedWorkAreas = null;
  workAreaCacheTime = 0;
}

function clampBoundsToWorkArea(bounds) {
  const areas = getCachedWorkAreas();
  // Find which display the window center is nearest to
  const cx = bounds.x + Math.round(bounds.width / 2);
  const cy = bounds.y + Math.round(bounds.height / 2);
  let best = areas[0] || screen.getPrimaryDisplay().workArea;
  let bestDist = Infinity;
  for (const wa of areas) {
    const wcx = wa.x + wa.width / 2;
    const wcy = wa.y + wa.height / 2;
    const dist = (cx - wcx) ** 2 + (cy - wcy) ** 2;
    if (dist < bestDist) { bestDist = dist; best = wa; }
  }
  // Clamp: ensure at least 100px of the window is visible in the workArea
  const minVisible = 100;
  let x = bounds.x, y = bounds.y, w = bounds.width, h = bounds.height;
  if (x + w < best.x + minVisible) x = best.x;
  if (x > best.x + best.width - minVisible) x = best.x + best.width - minVisible;
  if (y < best.y) y = best.y;
  if (y + h > best.y + best.height) y = best.y + best.height - h;
  if (y < best.y) y = best.y; // if window is taller than workArea
  return { x, y, width: w, height: h };
}

function clampWindowToWorkArea(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const bounds = win.getBounds();
  const clamped = clampBoundsToWorkArea(bounds);
  if (clamped.x !== bounds.x || clamped.y !== bounds.y) {
    win.setBounds(clamped);
  }
}

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const { x: wx, y: wy, width, height } = primary.workArea;

  mainWindow = new BrowserWindow({
    x: wx,
    y: wy,
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
      webSecurity: false,
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
    // Do NOT enable click-through here — the login screen needs to be interactive first.
    // The mouse poller + hit rects will handle click-through once login is complete.
    // setIgnoreMouseEvents stays false until the renderer explicitly enables it.
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
let clickThroughLocked = false;  // when true, click-through is forced OFF (walkthrough active)

ipcMain.on('set-hit-rects', (event, rects) => {
  hitRects = rects || [];
});

ipcMain.on('set-click-through', (event, enable) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (enable) {
    // Re-enable normal click-through behavior
    clickThroughLocked = false;
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    isIgnoringMouse = true;
    // Start mouse poller if not already running
    if (!mousePoller) startMousePoller();
  } else {
    // Disable click-through — login/walkthrough needs all clicks
    clickThroughLocked = true;
    mainWindow.setIgnoreMouseEvents(false);
    isIgnoringMouse = false;
  }
});

function startMousePoller() {
  if (mousePoller) clearInterval(mousePoller);
  // Cache bounds to avoid repeated IPC — updated only when window moves
  let cachedBounds = mainWindow ? mainWindow.getBounds() : null;
  let cachedScale = 1;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const updateBoundsCache = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        cachedBounds = mainWindow.getBounds();
        const disp = screen.getDisplayNearestPoint({ x: cachedBounds.x, y: cachedBounds.y });
        cachedScale = disp.scaleFactor || 1;
      }
    };
    mainWindow.on('move', updateBoundsCache);
    mainWindow.on('resize', updateBoundsCache);
    updateBoundsCache();
  }

  mousePoller = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (clickThroughLocked) return;
    if (!cachedBounds) return;

    const cursor = screen.getCursorScreenPoint();
    const lx = (cursor.x - cachedBounds.x) / cachedScale;
    const ly = (cursor.y - cachedBounds.y) / cachedScale;

    let over = false;
    for (let i = 0, len = hitRects.length; i < len; i++) {
      const r = hitRects[i];
      if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) {
        over = true;
        break;
      }
    }

    if (over && isIgnoringMouse) {
      mainWindow.setIgnoreMouseEvents(false);
      isIgnoringMouse = false;
    } else if (!over && !isIgnoringMouse) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isIgnoringMouse = true;
    }
  }, 50);
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

ipcMain.handle('window-minimize', () => {
  mainWindow.hide();
});

ipcMain.handle('window-maximize', () => {
  if (isOverlayMode) {
    // Switch to windowed mode
    isOverlayMode = false;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
    isIgnoringMouse = false;
    if (mousePoller) { clearInterval(mousePoller); mousePoller = null; }
    // Use the display the cursor is on, not primary — use workArea not bounds
    const cursor = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(cursor);
    const { x: dx, y: dy, width, height } = currentDisplay.workArea;
    const w = Math.round(width * 0.8);
    const h = Math.round(height * 0.8);
    mainWindow.setBounds({
      x: dx + Math.round((width - w) / 2),
      y: dy + Math.round((height - h) / 2),
      width: w,
      height: h
    });
    mainWindow.setResizable(true);
    mainWindow.setMovable(true);
    mainWindow.setSkipTaskbar(false);
  } else {
    // Switch back to overlay mode on the display the window is currently on
    isOverlayMode = true;
    const winBounds = mainWindow.getBounds();
    const centerPoint = { x: winBounds.x + Math.round(winBounds.width / 2), y: winBounds.y + Math.round(winBounds.height / 2) };
    const targetDisplay = screen.getDisplayNearestPoint(centerPoint);
    mainWindow.setBounds(targetDisplay.workArea);
    mainWindow.setResizable(false);
    mainWindow.setMovable(false);
    mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver');
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    isIgnoringMouse = true;
    startMousePoller();
    mainWindow.setSkipTaskbar(false);
  }
  mainWindow.webContents.send('overlay-mode-changed', isOverlayMode);
  return isOverlayMode;
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
ipcMain.handle('get-app-version', () => app.getVersion());

// ─── POP-OUT PANELS ─────────────────────────────────────────
const popoutWindows = {};

ipcMain.handle('pop-out-panel', (_, panelId, bounds) => {
  if (popoutWindows[panelId]) {
    popoutWindows[panelId].focus();
    return;
  }

  // Clamp initial pop-out position to workArea
  const initBounds = clampBoundsToWorkArea({
    x: bounds.screenX || 100,
    y: bounds.screenY || 100,
    width: bounds.w || 400,
    height: bounds.h || 500,
  });

  const popWin = new BrowserWindow({
    width: initBounds.width,
    height: initBounds.height,
    x: initBounds.x,
    y: initBounds.y,
    frame: true,
    transparent: false,
    backgroundColor: '#0e0e13',
    alwaysOnTop: false,
    resizable: true,
    movable: true,
    title: 'Traders Vault \u2014 ' + panelId,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  // Clamp pop-out window after move/resize
  popWin.on('moved', () => clampWindowToWorkArea(popWin));

  popWin.loadFile('index.html', { query: { popout: panelId } });
  popoutWindows[panelId] = popWin;

  popWin.on('closed', () => {
    delete popoutWindows[panelId];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('panel-popped-in', panelId);
    }
  });

  // Tell main renderer to hide the panel
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('panel-popped-out', panelId);
  }
});

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
  const b = getAllScreenBounds();
  mainWindow.setBounds(b);
  return b;
});

// ─── APP LIFECYCLE ────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
  createWindow();
  createTray();
  setupAutoLaunch();
  // Mouse poller starts when renderer sends first set-click-through(true) after login

  // Re-fit overlay to primary when monitors change & clamp all popouts
  function onDisplayChange() {
    invalidateWorkAreaCache();
    if (isOverlayMode && mainWindow && !mainWindow.isDestroyed()) {
      const p = screen.getPrimaryDisplay();
      mainWindow.setBounds(p.workArea);
    }
    // Clamp all pop-out windows
    Object.values(popoutWindows).forEach(w => clampWindowToWorkArea(w));
  }
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  screen.on('display-metrics-changed', onDisplayChange);

  // Safety interval — every 8 seconds, clamp any out-of-bounds pop-out windows
  setInterval(() => {
    Object.values(popoutWindows).forEach(w => clampWindowToWorkArea(w));
    // Also re-fit overlay if needed
    if (!isOverlayMode && mainWindow && !mainWindow.isDestroyed()) {
      clampWindowToWorkArea(mainWindow);
    }
  }, 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (mousePoller) clearInterval(mousePoller);
});

// ─── DOWNLOAD UPDATE ─────────────────────────────────────────
ipcMain.handle('download-update', async (_, url) => {
  if (!url) return { ok: false, error: 'No URL' };
  const downloadsDir = app.getPath('downloads');
  const fileName = url.split('/').pop() || 'TradersVault-update.exe';
  const filePath = path.join(downloadsDir, fileName);

  return new Promise((resolve) => {
    function doGet(reqUrl, redirects) {
      if (redirects > 10) return resolve({ ok: false, error: 'Too many redirects' });
      const mod = reqUrl.startsWith('https') ? https : http;
      const req = mod.get(reqUrl, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return resolve({ ok: false, error: 'HTTP ' + res.statusCode });
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(filePath);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          // Send progress to renderer
          if (mainWindow && !mainWindow.isDestroyed() && totalBytes > 0) {
            const pct = Math.round((downloaded / totalBytes) * 100);
            mainWindow.webContents.send('download-progress', { pct, downloaded, total: totalBytes });
          }
        });
        res.on('end', () => {
          file.end();
          resolve({ ok: true, path: filePath });
        });
        res.on('error', (e) => {
          file.end();
          resolve({ ok: false, error: e.message });
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
    }
    doGet(url, 0);
  });
});

ipcMain.handle('open-file', (_, filePath) => {
  if (filePath) shell.openPath(filePath);
});

// ─── SCREENSHOT (hide overlay, capture screen, restore) ───
ipcMain.handle('capture-screen', async () => {
  try {
    // Hide overlay so we capture the desktop/chart underneath
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    // Wait a moment for the window to actually hide
    await new Promise(r => setTimeout(r, 200));
    // Capture the primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds } = primaryDisplay;
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: bounds.width, height: bounds.height }
    });
    // Restore overlay
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    if (sources.length > 0) {
      const img = sources[0].thumbnail;
      const pngBuffer = img.toPNG();
      // Save to temp file and return base64
      const tmpPath = path.join(app.getPath('temp'), 'tv-signal-' + Date.now() + '.png');
      fs.writeFileSync(tmpPath, pngBuffer);
      return { ok: true, path: tmpPath, base64: pngBuffer.toString('base64'), width: img.getSize().width, height: img.getSize().height };
    }
    return { ok: false, error: 'No screen source found' };
  } catch (e) {
    // Make sure overlay comes back even on error
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    return { ok: false, error: e.message };
  }
});

// ─── DXTRADE BROWSER LOGIN ──────────────────────────────────
ipcMain.handle('dxtrade-browser-login', async (_, serverUrl) => {
  return new Promise((resolve) => {
    let resolved = false;
    const loginWin = new BrowserWindow({
      width: 1000,
      height: 700,
      title: 'Connect DXTrade',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    loginWin.loadURL(serverUrl);

    const sess = loginWin.webContents.session;

    const checkInterval = setInterval(async () => {
      if (resolved) return;
      try {
        const cookies = await sess.cookies.get({ url: serverUrl });
        const jsession = cookies.find(c => c.name === 'JSESSIONID');

        if (jsession) {
          const currentUrl = loginWin.webContents.getURL();
          const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/Login');

          if (isLoggedIn) {
            clearInterval(checkInterval);
            const allCookies = {};
            cookies.forEach(c => { allCookies[c.name] = c.value; });

            let token = null;
            try {
              token = await loginWin.webContents.executeJavaScript(`
                (function() {
                  try {
                    return localStorage.getItem('dx.token') ||
                           sessionStorage.getItem('dx.token') ||
                           localStorage.getItem('authToken') ||
                           sessionStorage.getItem('authToken') ||
                           '';
                  } catch(e) { return ''; }
                })()
              `);
            } catch(e) {}

            resolved = true;
            if (!loginWin.isDestroyed()) loginWin.close();
            resolve({
              ok: true,
              serverUrl: serverUrl,
              cookies: allCookies,
              sessionId: jsession.value,
              token: token || null,
            });
          }
        }
      } catch(e) {}
    }, 2000);

    loginWin.on('closed', () => {
      clearInterval(checkInterval);
      if (!resolved) {
        resolved = true;
        resolve({ ok: false, error: 'Window closed' });
      }
    });

    setTimeout(() => {
      clearInterval(checkInterval);
      if (!resolved) {
        resolved = true;
        if (!loginWin.isDestroyed()) loginWin.close();
        resolve({ ok: false, error: 'Login timed out' });
      }
    }, 300000);
  });
});

// ── CTRADER OAUTH (simplified) ──────────────────────────────────
ipcMain.on('open-ctrader-oauth', (event) => {
  const authUrl = 'https://id.ctrader.com/my/settings/openapi/grantingaccess/?client_id=24039_fMwbudNZ9md7AvngvYnIPwc2QROzJJpOUVh3qnjA0UOdukqgtq&redirect_uri=https://tradersvault.app/api/auth/callback&scope=trading&product=web';

  // Hide main overlay so auth window is accessible
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.hide();
  }

  const authWin = new BrowserWindow({
    width: 800, height: 700, title: 'Connect cTrader',
    autoHideMenuBar: true, center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  authWin.loadURL(authUrl);
  authWin.focus();

  let resolved = false;

  function restoreMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  function sendTokens(tokens) {
    if (resolved) return;
    resolved = true;
    restoreMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ctrader-auth-success', tokens);
    }
    if (!authWin.isDestroyed()) authWin.close();
  }

  // Simple approach: poll the page content every 500ms looking for #ctrader-tokens div
  // The callback page at tradersvault.app/api/auth/callback renders this div with token JSON
  const poll = setInterval(() => {
    if (resolved || authWin.isDestroyed()) { clearInterval(poll); return; }
    authWin.webContents.executeJavaScript(
      `(function(){ try { var e=document.getElementById('ctrader-tokens'); return e?e.textContent:''; } catch(x){return '';} })()`
    ).then(data => {
      if (!data || resolved) return;
      try {
        const t = JSON.parse(data);
        if (t.accessToken) { clearInterval(poll); sendTokens(t); }
      } catch(e) {}
    }).catch(() => {});
  }, 500);

  // Cleanup after 2 minutes max
  setTimeout(() => clearInterval(poll), 120000);

  authWin.on('closed', () => {
    clearInterval(poll);
    restoreMainWindow();
    if (!resolved && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ctrader-auth-failed', { error: 'Window closed' });
    }
  });
});

// macOS: hide dock icon since this is an overlay app
if (isMac) {
  app.dock?.hide();
}

// macOS: don't quit when all windows closed
app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
