const { app, BrowserWindow, Menu, dialog, ipcMain, shell, Tray, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const log = require('electron-log');

// ─── Configure Logging ───────────────────────────────────────────────────────
// Set log file location to userData/.logs/main.log
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), '.logs', 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB limit
// Redirect console methods to electron-log so all standard console.log/error write to the file
Object.assign(console, log.functions);

// Catch unhandled exceptions and rejections
log.errorHandler.startCatching({
  showDialog: false,
  onError({ error }) {
    console.error('[main] Uncaught Exception:', error);
  }
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[main] Unhandled Rejection at:', promise, 'reason:', reason);
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
      console.error('[server error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('[main] Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('[main] Server exited with code:', code);
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

  // Get app path (for archive directory)
  ipcMain.handle('get-app-path', () => {
    return app.isPackaged
      ? path.join(app.getPath('userData'), 'archive')
      : path.join(__dirname, 'archive');
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

