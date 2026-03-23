const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setOpacity: (value) => ipcRenderer.invoke('set-opacity', value),
  setOverlay: (enable) => ipcRenderer.invoke('set-overlay', enable),
  getOverlayState: () => ipcRenderer.invoke('get-overlay-state'),
  onOverlayChanged: (callback) => ipcRenderer.on('overlay-mode-changed', (_, val) => callback(val)),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  // Click-through: send panel bounding boxes to main process
  setHitRects: (rects) => ipcRenderer.send('set-hit-rects', rects),
  platform: process.platform,
  isElectron: true,
});
