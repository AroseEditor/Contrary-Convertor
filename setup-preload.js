'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  onProgress: (cb) => ipcRenderer.on('setup:progress', (_, data) => cb(data)),
  onStage:    (cb) => ipcRenderer.on('setup:stage',    (_, data) => cb(data)),
  onComplete: (cb) => ipcRenderer.on('setup:complete', () => cb()),
  onError:    (cb) => ipcRenderer.on('setup:error',    (_, data) => cb(data)),
});
