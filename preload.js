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
  // Screenshot (capture desktop behind overlay)
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  // Update download
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  isElectron: true,
});
