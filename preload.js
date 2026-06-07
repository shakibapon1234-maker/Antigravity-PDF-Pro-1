/**
 * preload.js — Electron Preload Script
 * Safely exposes IPC methods to the renderer (index.html) via contextBridge.
 * No direct Node.js access from renderer — security best practice.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Show native Save dialog — returns { canceled, filePath }
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // Show native Open dialog — returns { canceled, filePaths }
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Update window title bar
  setTitle: (title) => ipcRenderer.send('set-title', title),

  // Get app version string
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Get archive directory path
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Listen for file open events triggered from the app menu (File > Open PDF)
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file', (event, filePath) => callback(filePath));
  },

  // Check if running inside Electron
  isElectron: true,

  // Electron Store IPC wrappers
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
});
