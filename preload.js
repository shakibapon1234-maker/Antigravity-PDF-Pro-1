/**
 * preload.js — Electron Preload Script
 * Safely exposes IPC methods to the renderer (index.html) via contextBridge.
 * No direct Node.js access from renderer — security best practice.
 */
const { contextBridge, ipcRenderer } = require('electron');
let initSentry;
try {
  initSentry = require('@sentry/electron/renderer').init;
} catch (e) {
  console.warn('[preload] Failed to load Sentry renderer SDK:', e);
}

if (initSentry) {
  try {
    initSentry();
  } catch (e) {
    console.warn('[preload] Failed to initialize Sentry renderer SDK:', e);
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Show native Save dialog — returns { canceled, filePath }
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // Show native Open dialog — returns { canceled, filePaths }
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Update window title bar
  setTitle: (title) => ipcRenderer.send('set-title', title),

  // Get app version string
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Check if running in development mode
  isDev: () => ipcRenderer.invoke('is-dev'),

  // Get archive directory path
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Listen for file open events triggered from the app menu (File > Open PDF)
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file', (event, filePath) => callback(filePath));
  },

  // Listen for print trigger events
  onTriggerPrint: (callback) => {
    ipcRenderer.on('trigger-print', () => callback());
  },

  // Check if running inside Electron
  isElectron: true,

  // Electron Store IPC wrappers
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Get unique hardware ID for licensing
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),

  // Read a file from disk by its full path (for Recent Files)
  readFileByPath: (filePath) => ipcRenderer.invoke('read-file-by-path', filePath),

  // Auto-backup: save a copy of the PDF to userData/.backups/
  saveBackup: (fileName, buffer) => ipcRenderer.invoke('save-backup', { fileName, buffer }),
});
