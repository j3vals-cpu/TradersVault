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
  // Click-through hit rects
  setHitRects: (rects) => ipcRenderer.send('set-hit-rects', rects),
  platform: process.platform,
  isElectron: true,
});
