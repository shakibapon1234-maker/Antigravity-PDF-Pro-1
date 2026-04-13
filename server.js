const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ARCHIVE_DIR = path.join(__dirname, 'archive');
const INDEX_FILE = path.join(ARCHIVE_DIR, 'index.json');

if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, JSON.stringify([]));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ARCHIVE_DIR);
  },
  filename: (req, file, cb) => {
    // store with temp name; we'll move into item folder
    cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(__dirname));

// Suppress favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Allow CORS so Live Server (different origin) can call the API during development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeIndex(data) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
}

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

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
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
      tags: (req.body.tags && typeof req.body.tags === 'string') ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : []
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
  const index = readIndex();
  res.json(index);
});

app.get('/archive/:id', (req, res) => {
  const id = req.params.id;
  const index = readIndex();
  const item = index.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(ARCHIVE_DIR, id, item.storedName);
  // Log file existence and size for diagnostics
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
  const index = readIndex();
  const item = index.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(ARCHIVE_DIR, id, item.storedName);
  // For now: return the file for download; client can choose what to do
  res.download(filePath, item.originalName);
});

app.listen(PORT, () => {
  console.log(`Archive server running on http://localhost:${PORT}`);
});
