const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');
const log = require('electron-log');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Path resolution (works in both dev and Electron packaged app) ────────────
// When packaged: process.env.APP_ROOT points to resources/app/
// When dev: APP_ROOT = __dirname
const APP_ROOT = process.env.APP_ROOT || __dirname;

const ARCHIVE_DIR = process.env.ELECTRON_APP
  ? path.join(require('os').homedir(), '.antigravity-pdf-pro', 'archive')
  : path.join(APP_ROOT, 'archive');

const LOG_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, '.logs')
  : path.join(APP_ROOT, '.logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'server.log');
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.level = 'info';
log.transports.console.level = 'error';

process.on('uncaughtException', (error) => {
  log.error('[server] Uncaught Exception:', error);
  console.error('[server] Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  log.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
});

const INDEX_FILE = path.join(ARCHIVE_DIR, 'index.json');

// Ensure archive directory exists
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, JSON.stringify([]));

// ─── qpdf binary path ─────────────────────────────────────────────────────────
// In packaged app: extraResources copies bin/ to resources/bin/
// In dev: bin/ is next to server.js
function getQpdfPath() {
  if (process.env.QPDF_PATH) {
    return process.env.QPDF_PATH;
  }
  if (process.env.ELECTRON_APP && require('electron') !== undefined) {
    try {
      const { app: electronApp } = require('electron');
      return path.join(process.resourcesPath, 'bin', 'qpdf.exe');
    } catch (e) {
      // electron not available in fork context, use APP_ROOT
    }
  }
  if (process.env.APP_ROOT) {
    const p = path.join(process.env.APP_ROOT, 'bin', 'qpdf.exe');
    if (fs.existsSync(p)) return p;
  }
  return path.join(APP_ROOT, 'bin', 'qpdf.exe');
}

// ─── Multer storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ARCHIVE_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(APP_ROOT));

// Suppress favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// CORS (for dev with Live Server on different port)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Archive helpers ──────────────────────────────────────────────────────────
function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeIndex(data) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
}

// ─── Archive routes ───────────────────────────────────────────────────────────
app.post('/archive', upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    console.log('[archive] Upload received:', {
      originalname: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const itemDir = path.join(ARCHIVE_DIR, id);
    fs.mkdirSync(itemDir);
    const destPath = path.join(itemDir, file.originalname);
    fs.renameSync(path.join(ARCHIVE_DIR, file.filename), destPath);

    const meta = {
      id,
      originalName: file.originalname,
      storedName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      createdAt: new Date().toISOString(),
      sourceTool: req.body.sourceTool || 'unknown',
      notes: req.body.notes || '',
      tags: (req.body.tags && typeof req.body.tags === 'string')
        ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
        : []
    };

    const index = readIndex();
    index.unshift(meta);
    writeIndex(index);

    res.json({ success: true, item: meta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to archive' });
  }
});

app.get('/archive', (req, res) => {
  res.json(readIndex());
});

app.get('/archive/:id', (req, res) => {
  const id = req.params.id;
  const item = readIndex().find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(ARCHIVE_DIR, id, item.storedName);
  try {
    const st = fs.statSync(filePath);
    console.log('[archive] Serving', item.originalName, { id, path: filePath, size: st.size });
  } catch (e) {
    console.error('[archive] Could not stat file', filePath, e && e.message);
  }
  res.download(filePath, item.originalName);
});

app.delete('/archive/:id', (req, res) => {
  const id = req.params.id;
  let index = readIndex();
  const item = index.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const itemDir = path.join(ARCHIVE_DIR, id);
  try {
    fs.rmSync(itemDir, { recursive: true, force: true });
    console.log('[archive] Deleted item', id, item.originalName);
  } catch (e) { console.error('[archive] Delete failed', id, e && e.message); }
  index = index.filter(i => i.id !== id);
  writeIndex(index);
  res.json({ success: true });
});

app.post('/archive/:id/restore', (req, res) => {
  const id = req.params.id;
  const item = readIndex().find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(ARCHIVE_DIR, id, item.storedName);
  res.download(filePath, item.originalName);
});

// ─── PDF Protect via qpdf ─────────────────────────────────────────────────────
app.post('/api/tools/protect-pdf', upload.single('file'), (req, res) => {
  const file = req.file;
  const password = req.body.password;

  if (!file || !password) {
    return res.status(400).json({ error: 'Missing file or password' });
  }

  const inputPath = file.path;
  const outputPath = path.join(ARCHIVE_DIR, `protected_${Date.now()}.pdf`);
  const qpdfPath = getQpdfPath();

  const command = `"${qpdfPath}" --encrypt "${password}" "${password}" 256 -- "${inputPath}" "${outputPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`qpdf error: ${stderr}`);
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(500).json({ error: 'Encryption failed. Ensure qpdf is installed.', details: stderr });
    }
    res.download(outputPath, `protected_${file.originalname}`, (err) => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  });
});

// ─── PDF Decrypt via qpdf ─────────────────────────────────────────────────────
app.post('/api/tools/decrypt-pdf', upload.single('file'), (req, res) => {
  const file = req.file;
  const password = req.body.password || '';

  if (!file) {
    return res.status(400).json({ error: 'Missing file' });
  }

  const inputPath = file.path;
  const outputPath = path.join(ARCHIVE_DIR, `decrypted_${Date.now()}.pdf`);
  const qpdfPath = getQpdfPath();

  let command = `"${qpdfPath}" --decrypt`;
  if (password) {
    const escapedPassword = password.replace(/"/g, '\\"');
    command += ` --password="${escapedPassword}"`;
  }
  command += ` -- "${inputPath}" "${outputPath}"`;

  console.log('[decrypt-pdf] Running command:', command);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`qpdf error: ${stderr}`);
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      let userMsg = 'Decryption failed.';
      if (stderr.includes('password') || stderr.includes('incorrect') || stderr.includes('Invalid password')) {
        userMsg = 'Incorrect password. Please enter the correct password.';
      }
      return res.status(500).json({ error: userMsg, details: stderr });
    }
    res.download(outputPath, `decrypted_${file.originalname}`, (err) => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  });
});

// ─── Mock Licensing Endpoints for local testing ───────────────────────────────
const mockLicenses = new Map();
// Add default test license keys
mockLicenses.set('AGP-1111-2222-3333', { email: 'dev@localhost', status: 'inactive', device_id: null, expires_at: new Date(Date.now() + 365*24*60*60*1000).toISOString() });
mockLicenses.set('AGP-BETA-2026-FREE', { email: 'beta@localhost', status: 'inactive', device_id: null, expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString() });

app.post('/api/license/activate', (req, res) => {
  const { license_key, device_id } = req.body;
  console.log('[mock-license] Activation request:', { license_key, device_id });
  if (!license_key || !device_id) {
    return res.status(400).json({ error: 'Missing license_key or device_id' });
  }
  const license = mockLicenses.get(license_key);
  if (!license) {
    return res.status(404).json({ error: 'License key not found. Use AGP-1111-2222-3333 or AGP-BETA-2026-FREE.' });
  }
  if (license.status === 'active' && license.device_id !== device_id) {
    return res.status(403).json({ error: 'License is already active on another machine.' });
  }
  license.status = 'active';
  license.device_id = device_id;
  res.json({ success: true, message: 'Mock activation successful', expires_at: license.expires_at, email: license.email });
});

app.post('/api/license/validate', (req, res) => {
  const { license_key, device_id } = req.body;
  console.log('[mock-license] Validation request:', { license_key, device_id });
  const license = mockLicenses.get(license_key);
  if (!license || license.device_id !== device_id || license.status !== 'active') {
    return res.json({ valid: false, error: 'Invalid license or device mismatch.' });
  }
  res.json({ valid: true, expires_at: license.expires_at, email: license.email });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Archive server running on http://localhost:${PORT}`);
});
