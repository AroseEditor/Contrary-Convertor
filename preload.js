'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close:    () => ipcRenderer.send('win:close'),

  // File dialog
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),

  // File detection (includes probe data for video/audio)
  detectFile: (filePath) => ipcRenderer.invoke('file:detect', filePath),

  // Conversion
  convertFile: (params) => ipcRenderer.invoke('file:convert', params),

  // Progress / error events
  onProgress: (cb) => ipcRenderer.on('convert:progress', (_e, d) => cb(d)),
  onError:    (cb) => ipcRenderer.on('convert:error',    (_e, d) => cb(d)),
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('convert:progress');
    ipcRenderer.removeAllListeners('convert:error');
  },

  // Shell actions
  openFile:     (p) => ipcRenderer.invoke('shell:open',       p),
  showInFolder: (p) => ipcRenderer.invoke('shell:showFolder', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Download
  selectDownloadFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  downloadUrl: (params) => ipcRenderer.invoke('download:start', params),
  cancelDownload: () => ipcRenderer.send('download:cancel'),
  onDownloadProgress: (cb) => ipcRenderer.on('download:progress', (_e, d) => cb(d)),
  removeDownloadListener: () => {
    ipcRenderer.removeAllListeners('download:progress');
  },

  // Background removal
  bgLoadImage: (params) => ipcRenderer.invoke('bg:loadImage', params),
  bgDetectSubject: (params) => ipcRenderer.invoke('bg:detectSubject', params),
  bgApply: (params) => ipcRenderer.invoke('bg:apply', params),
  bgApplyWithRefine: (params) => ipcRenderer.invoke('bg:applyWithRefine', params),

  // Auto-update
  getVersion: () => ipcRenderer.invoke('app:version'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_e, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_e, pct) => cb(pct)),
  onUpdateReady: (cb) => ipcRenderer.on('update:ready', (_e, installerPath) => cb(installerPath)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update:not-available', () => cb()),
  onUpdateError: (cb) => ipcRenderer.on('update:error', (_e, msg) => cb(msg)),
  checkForUpdates: () => ipcRenderer.send('update:check'),
  downloadUpdate: (url) => ipcRenderer.send('update:download', url),
  installUpdate: (path) => ipcRenderer.send('update:install', path),
});
