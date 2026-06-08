const { app, BrowserWindow, Menu, dialog, ipcMain, shell, Tray, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const log = require('electron-log');
let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.warn('[main] electron-updater module not found. Auto-updates will be disabled.');
}


// ─── Configure Logging ───────────────────────────────────────────────────────
const logDir = path.join(app.getPath('userData'), '.logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB limit
log.transports.file.level = 'info';
log.transports.console.level = 'silly';

// Redirect console methods to electron-log so all standard console.log/error write to the file
Object.assign(console, log.functions);

// Crash reporter helpers
const CRASH_LOG_FILES = ['main.log', 'server.log'];

function getCrashLogFileContents() {
  const parts = [];
  CRASH_LOG_FILES.forEach((name) => {
    const filePath = path.join(logDir, name);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      parts.push(`--- ${name} ---\n${content}`);
    }
  });
  return parts.join('\n\n');
}

async function exportCrashLogs() {
  const defaultFile = path.join(app.getPath('desktop'), 'Antigravity-PDF-Pro-Logs.txt');
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Log File',
    defaultPath: defaultFile,
    filters: [
      { name: 'Text File', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return false;

  const data = getCrashLogFileContents();
  if (!data) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Export Logs',
      message: 'No log files were found to export.',
    });
    return false;
  }

  fs.writeFileSync(filePath, data, 'utf8');
  return true;
}

async function showCrashReporterDialog(title, details) {
  if (!mainWindow) return;

  const message = `${title}\n\n${details || 'An unexpected error occurred.'}`;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Something went wrong',
    message: 'Antigravity PDF Pro encountered a problem.',
    detail: message,
    buttons: ['Export Log File', 'Close'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    const success = await exportCrashLogs();
    if (success) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Export Complete',
        message: 'Log file exported successfully.',
      });
    }
  }
}

// Catch unhandled exceptions and rejections
log.errorHandler.startCatching({
  showDialog: false,
  onError({ error }) {
    console.error('[main] Uncaught Exception:', error);
    showCrashReporterDialog('Unhandled exception', error?.message || String(error));
  }
});
process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught Exception:', error);
  showCrashReporterDialog('Unhandled exception', error?.stack || error?.message || String(error));
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[main] Unhandled Rejection at:', promise, 'reason:', reason);
  showCrashReporterDialog('Unhandled rejection', reason?.stack || reason?.message || String(reason));
});


// Disable hardware acceleration to prevent GPU crashes on systems with missing/incompatible graphics drivers
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');


// ─── Constants ───────────────────────────────────────────────────────────────
const PORT = 3000;
const isDev = process.argv.includes('--dev');

let mainWindow = null;
let serverProcess = null;
let tray = null;
let serverReady = false;

// ─── Get correct path (works both in dev and packaged app) ───────────────────
function getAppPath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', ...segments);
  }
  return path.join(__dirname, ...segments);
}

// ─── Start the Express server ─────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getAppPath('server.js');

    console.log('[main] Starting server at:', serverPath);

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(PORT),
        ELECTRON_APP: '1',
        APP_ROOT: app.isPackaged ? path.join(process.resourcesPath, 'app') : __dirname,
        USER_DATA_PATH: app.getPath('userData'),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      console.log('[server]', msg);
      if (msg.includes(`running on http://localhost:${PORT}`) || msg.includes('running on')) {
        serverReady = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.error('[server error]', message);
    });

    serverProcess.on('error', (err) => {
      console.error('[main] Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      if (code !== 0) {
        console.error('[main] Server exited unexpectedly:', { code, signal });
      } else {
        console.log('[main] Server exited cleanly:', { code, signal });
      }
      serverReady = false;
    });

    // Timeout fallback — resolve after 4s even if no log message
    setTimeout(() => {
      if (!serverReady) {
        console.log('[main] Server start timeout — proceeding anyway');
        resolve();
      }
    }, 4000);
  });
}

// ─── Create main window ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Antigravity PDF Pro',
    backgroundColor: '#0f0f23',
    show: false, // show after load to avoid flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // needed for local file access (PDF.js workers etc.)
    },
    // Use default Electron icon (we'll set custom later if icon.ico exists)
  });

  // Load the app
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Show window when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // Handle window title updates
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    event.preventDefault(); // we'll manage title ourselves
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercept new-window (open links in browser, not new Electron window)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[main] Renderer process gone:', details);
    log.error('[main] Renderer process gone:', details);
    showCrashReporterDialog('Renderer process crashed', `Reason: ${details.reason}`);
  });

  mainWindow.webContents.on('child-process-gone', (event, details) => {
    console.error('[main] Child process gone:', details);
    log.error('[main] Child process gone:', details);
    showCrashReporterDialog('Child process crashed', `Type: ${details.type}\nReason: ${details.reason}`);
  });
}

// ─── App Menu ─────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open PDF...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Open PDF',
              filters: [
                { name: 'PDF Files', extensions: ['pdf'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              properties: ['openFile'],
            });
            if (filePaths && filePaths.length > 0) {
              mainWindow.webContents.send('open-file', filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Full Screen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Developer Tools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: manualCheckForUpdates,
        },
        {
          label: 'Export Logs...',
          click: () => exportCrashLogs().then((success) => {
            if (success) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Export Logs',
                message: 'Log file exported successfully.',
              });
            }
          }),
        },
        { type: 'separator' },
        {
          label: 'About Antigravity PDF Pro',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Antigravity PDF Pro',
              message: 'Antigravity PDF Pro',
              detail: 'Version 1.0.0\n\nA powerful desktop PDF editor and converter.\n\nBuilt with Electron + Node.js',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (!autoUpdater) {
    console.log('[auto-updater] Skipping auto-update because electron-updater module is not installed');
    return;
  }
  if (isDev || !app.isPackaged) {
    console.log('[auto-updater] Skipping auto-update in development/unpackaged mode');
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] Error:', err ? err.message || err : 'unknown');
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[auto-updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    handleUpdateAvailable(info);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[auto-updater] No updates available');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log('[auto-updater] Download progress:', `${progress.percent?.toFixed(2)}%`, progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    handleUpdateDownloaded(info);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[auto-updater] Check for updates failed:', err);
  });
}

function handleUpdateAvailable(info) {
  if (!mainWindow) return;
  const message = `A new version ${info.version} is available.\n\nRelease notes:\n${info.releaseNotes || 'No release notes provided.'}\n\nDownload now?`;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
}

function handleUpdateDownloaded(info) {
  if (!mainWindow) return;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Update ${info.version} has been downloaded and is ready to install.`,
    buttons: ['Install and Restart', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
    }
  });
}

function manualCheckForUpdates() {
  if (!mainWindow) return;
  if (!autoUpdater || isDev || !app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Check for Updates',
      message: 'Auto-update is disabled in development or unpackaged mode.',
      buttons: ['OK'],
    });
    return;
  }

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[auto-updater] Manual check failed:', err);
  });
}

function setupIPC() {
  // Native save dialog
  ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  // Native open dialog
  ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  // Update window title
  ipcMain.on('set-title', (event, title) => {
    if (mainWindow) mainWindow.setTitle(title);
  });

  // Get app version
  ipcMain.handle('get-version', () => app.getVersion());

  // Check if running in development mode
  ipcMain.handle('is-dev', () => isDev || !app.isPackaged);

  // Get app path (for archive directory)
  ipcMain.handle('get-app-path', () => {
    return app.isPackaged
      ? path.join(app.getPath('userData'), 'archive')
      : path.join(__dirname, 'archive');
  });

  // Electron Store handlers (CommonJS ES import bridge)
  let store = null;
  const getStoreEncryptionKey = () => {
    return crypto.createHash('sha256')
      .update(app.getPath('userData') + 'antigravity-encryption-key')
      .digest('hex');
  };

  const getStore = async () => {
    if (!store) {
      const { default: Store } = await import('electron-store');
      store = new Store({ encryptionKey: getStoreEncryptionKey() });
    }
    return store;
  };

  ipcMain.handle('store-get', async (event, key) => {
    const s = await getStore();
    return s.get(key);
  });

  ipcMain.handle('store-set', async (event, key, value) => {
    const s = await getStore();
    s.set(key, value);
    return true;
  });

  // ── Read a local file by path (for Recent Files feature) ──────────────
  ipcMain.handle('read-file-by-path', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') return null;
      const buffer = fs.readFileSync(filePath);
      return buffer; // Uint8Array in renderer
    } catch (err) {
      console.error('[main] read-file-by-path error:', err.message);
      return null;
    }
  });

  // ── Auto-Backup: save a PDF backup copy to userData/.backups/ ─────────
  ipcMain.handle('save-backup', async (event, { fileName, buffer }) => {
    try {
      const backupDir = path.join(app.getPath('userData'), '.backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      // Timestamp-based filename
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const dest = path.join(backupDir, `${ts}_${safe}`);

      fs.writeFileSync(dest, Buffer.from(buffer));
      console.log('[main] Backup saved:', dest);

      // Keep only last 5 backups — sort by mtime, delete oldest
      const allBackups = fs.readdirSync(backupDir)
        .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (allBackups.length > 5) {
        allBackups.slice(5).forEach(f => {
          try { fs.unlinkSync(path.join(backupDir, f.name)); } catch { /* ignore */ }
        });
      }
      return { success: true, path: dest };
    } catch (err) {
      console.error('[main] save-backup error:', err.message);
      return { success: false, error: err.message };
    }
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[main] App ready. Starting server...');

  try {
    await startServer();
    console.log('[main] Server started. Creating window...');
  } catch (err) {
    console.error('[main] Server failed to start:', err);
    dialog.showErrorBox(
      'Server Error',
      'Failed to start the internal server. Please try restarting the application.\n\n' + err.message
    );
    app.quit();
    return;
  }

  setupIPC();
  buildMenu();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up server on quit
app.on('before-quit', () => {
  console.log('[main] Quitting — killing server...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

// Uncaught exceptions are handled by electron-log at the top

