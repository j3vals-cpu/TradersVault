const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setOpacity: (value) => ipcRenderer.invoke('set-opacity', value),
  setOverlay: (enable) => ipcRenderer.invoke('set-overlay', enable),
  getOverlayState: () => ipcRenderer.invoke('get-overlay-state'),
  onOverlayChanged: (callback) => ipcRenderer.on('overlay-mode-changed', (_, val) => callback(val)),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  quit: () => ipcRenderer.invoke('app-quit'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Persistent file storage
  saveData: (key, value) => ipcRenderer.invoke('save-data', key, value),
  loadData: (key) => ipcRenderer.invoke('load-data', key),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  // Pop-out panels (multi-monitor)
  popOutPanel: (panelId, bounds) => ipcRenderer.invoke('pop-out-panel', panelId, bounds),
  onPanelPoppedOut: (cb) => ipcRenderer.on('panel-popped-out', (_, id) => cb(id)),
  onPanelPoppedIn: (cb) => ipcRenderer.on('panel-popped-in', (_, id) => cb(id)),
  // Click-through hit rects
  setHitRects: (rects) => ipcRenderer.send('set-hit-rects', rects),
  // Toggle click-through (false = capture all clicks, true = normal overlay behavior)
  setClickThrough: (enable) => ipcRenderer.send('set-click-through', enable),
  // Screenshot (capture desktop behind overlay)
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  // Update download
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // DXTrade browser login
  dxtradeBrowserLogin: (serverUrl) => ipcRenderer.invoke('dxtrade-browser-login', serverUrl),
  // cTrader OAuth
  openCTraderOAuth: () => ipcRenderer.send('open-ctrader-oauth'),
  onCTraderAuth: (callback) => ipcRenderer.on('ctrader-auth-success', (_, data) => callback(data)),
  onCTraderAuthFailed: (callback) => ipcRenderer.on('ctrader-auth-failed', (_, data) => callback(data)),
  platform: process.platform,
  arch: process.arch,
  isElectron: true,
});
