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
    if (isMac) mainWindow.moveTop();
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

  // macOS: debounce transitions to avoid flaky setIgnoreMouseEvents
  let overCount = 0;
  let notOverCount = 0;
  const enterThreshold = isMac ? 2 : 0; // ticks before enabling capture
  const leaveThreshold = isMac ? 4 : 0; // ticks before re-enabling pass-through

  mousePoller = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (clickThroughLocked) return;
    if (!cachedBounds) return;

    const cursor = screen.getCursorScreenPoint();
    const lx = (cursor.x - cachedBounds.x) / cachedScale;
    const ly = (cursor.y - cachedBounds.y) / cachedScale;

    // Expand hit rects slightly on macOS for better click reliability
    const pad = isMac ? 4 : 0;
    let over = false;
    for (let i = 0, len = hitRects.length; i < len; i++) {
      const r = hitRects[i];
      if (lx >= r.x - pad && lx <= r.x + r.w + pad && ly >= r.y - pad && ly <= r.y + r.h + pad) {
        over = true;
        break;
      }
    }

    if (over) {
      overCount++;
      notOverCount = 0;
      if (overCount > enterThreshold && isIgnoringMouse) {
        mainWindow.setIgnoreMouseEvents(false);
        isIgnoringMouse = false;
        // macOS: ensure window can receive clicks (dock-hidden accessory app quirk)
        if (isMac) mainWindow.moveTop();
      }
    } else {
      notOverCount++;
      overCount = 0;
      if (notOverCount > leaveThreshold && !isIgnoringMouse) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        isIgnoringMouse = true;
      }
    }
  }, isMac ? 35 : 50);
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
    if (isMac) mainWindow.moveTop();
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
ipcMain.handle('open-external', (_, url) => { if (url) shell.openExternal(url); });
ipcMain.handle('app-quit', () => {
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

  // Derive a safe .exe filename from the URL.
  // If the URL doesn't end with .exe (e.g. it's a release page URL like
  // /releases/tag/v2.8.0), build a proper installer filename so Windows
  // recognises the downloaded file as an executable.
  let fileName = (url.split('/').pop() || '').split('?')[0]; // strip query params
  if (!fileName || !fileName.toLowerCase().endsWith('.exe')) {
    const verMatch = url.match(/(\d+\.\d+\.\d+)/);
    fileName = verMatch
      ? 'Traders.Vault.Setup.' + verMatch[1] + '.exe'
      : 'TradersVault-update.exe';
  }

  let filePath = path.join(downloadsDir, fileName);

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

        // Try to get a better filename from Content-Disposition header
        const cd = res.headers['content-disposition'];
        if (cd) {
          const m = cd.match(/filename[^;=\n]*=\s*["']?([^"';\n]+)/i);
          if (m && m[1] && m[1].toLowerCase().endsWith('.exe')) {
            filePath = path.join(downloadsDir, m[1].trim());
          }
        }

        // Final safety net: ensure .exe extension on Windows
        if (process.platform === 'win32' && !filePath.toLowerCase().endsWith('.exe')) {
          filePath += '.exe';
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

// ── CTRADER OAUTH ──────────────────────────────────────────────
ipcMain.on('open-ctrader-oauth', (event) => {
  const authUrl = 'https://id.ctrader.com/my/settings/openapi/grantingaccess/?client_id=24039_fMwbudNZ9md7AvngvYnIPwc2QROzJJpOUVh3qnjA0UOdukqgtq&redirect_uri=https://tradersvault.app/api/auth/callback&scope=trading&product=web';
  const https = require('https');

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.hide();
  }

  let resolved = false;

  const authWin = new BrowserWindow({
    width: 800, height: 700, title: 'Connect cTrader',
    autoHideMenuBar: true, center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  function restoreMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  function showPage(html) {
    if (!authWin.isDestroyed()) {
      authWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    }
  }

  function exchangeCode(code) {
    if (resolved) return;
    resolved = true;

    showPage('<html><body style="background:#07070a;color:#e8b84b;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><h2>Connecting...</h2><p style="color:#888">Exchanging tokens...</p></div></body></html>');

    const tokenUrl = 'https://tradersvault.app/api/auth/callback?code=' + encodeURIComponent(code) + '&format=json';
    https.get(tokenUrl, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let tokens;
        try { tokens = JSON.parse(body); } catch(e) { tokens = null; }
        if (tokens && tokens.accessToken) {
          restoreMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ctrader-auth-success', tokens);
          if (!authWin.isDestroyed()) authWin.close();
        } else {
          const err = (tokens && tokens.error) || body.substring(0, 200);
          showPage('<html><body style="background:#07070a;color:#ff4d6d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center;max-width:500px;padding:20px"><h2>Token Exchange Failed</h2><p style="color:#888;margin:12px 0;word-break:break-all">' + String(err).replace(/</g,'&lt;').substring(0,300) + '</p><p style="color:#555;font-size:12px">Close this window and try again</p></div></body></html>');
        }
      });
    }).on('error', (err) => {
      showPage('<html><body style="background:#07070a;color:#ff4d6d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><h2>Network Error</h2><p style="color:#888">' + err.message + '</p></div></body></html>');
    });
  }

  // Use webRequest.onBeforeRedirect to detect when cTrader sends the 302 to our callback
  // This fires when the RESPONSE is a redirect, before the browser follows it
  const filter = { urls: ['*://*.ctrader.com/*', '*://id.ctrader.com/*'] };
  authWin.webContents.session.webRequest.onBeforeRedirect(filter, (details) => {
    if (resolved) return;
    const redirectUrl = details.redirectURL;
    if (redirectUrl && redirectUrl.includes('tradersvault.app') && redirectUrl.includes('callback') && redirectUrl.includes('code=')) {
      try {
        const u = new URL(redirectUrl);
        const code = u.searchParams.get('code');
        if (code) exchangeCode(code);
      } catch(e) {}
    }
  });

  // Also use onBeforeRequest to block the actual request to our callback (backup)
  const cbFilter = { urls: ['*://tradersvault.app/api/auth/callback*'] };
  authWin.webContents.session.webRequest.onBeforeRequest(cbFilter, (details, callback) => {
    if (!resolved) {
      try {
        const u = new URL(details.url);
        const code = u.searchParams.get('code');
        if (code) {
          callback({ cancel: true });
          exchangeCode(code);
          return;
        }
      } catch(e) {}
    }
    callback({ cancel: resolved });
  });

  // Keep popups in the same window
  authWin.webContents.setWindowOpenHandler(({ url }) => {
    authWin.loadURL(url);
    return { action: 'deny' };
  });

  authWin.loadURL(authUrl);
  authWin.focus();

  authWin.on('closed', () => {
    try { authWin.webContents.session.webRequest.onBeforeRedirect(filter, null); } catch(e) {}
    try { authWin.webContents.session.webRequest.onBeforeRequest(cbFilter, null); } catch(e) {}
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
