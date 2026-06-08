/**
 * Antigravity PDF Pro — Phase 4-D
 * Multi-Format Export
 * একটা PDF থেকে একসাথে multiple format এ export করা যায়
 */

const MultiExport = (() => {
  let currentFile = null; // {name, arrayBuffer}

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    if (document.getElementById('multi-export-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'multi-export-modal';
    modal.className = 'archive-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="archive-panel multi-export-box" style="background: var(--bg-surface); border: 1px solid var(--primary-glow); border-radius: 12px; padding: 24px; max-width: 540px; width: 90%;">
        <div class="archive-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i data-lucide="share-2" style="color: var(--primary); width: 22px; height: 22px;"></i>
            <h3 style="color: #fff; font-size: 20px; font-weight: 700; margin: 0;">Multi-Format Export</h3>
          </div>
          <button class="modal-close-btn" style="background: transparent; border: none; color: #fff; cursor: pointer; font-size: 24px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">&times;</button>
        </div>

        <div class="multi-export-file-info" id="multi-export-file-info" style="margin-bottom: 15px;">
          <i data-lucide="file-text"></i>
          <span id="multi-export-filename">No file loaded</span>
        </div>

        <p class="multi-export-hint" style="margin-bottom: 15px;">নিচে থেকে যে format গুলো চান সেগুলো select করুন:</p>

        <div class="multi-export-options" style="margin-bottom: 15px;">
          <label class="export-option-card">
            <input type="checkbox" name="export-format" value="pdf" checked>
            <div class="export-option-icon"><i data-lucide="file-text"></i></div>
            <div class="export-option-info">
              <strong>PDF</strong>
              <small>Original PDF সংরক্ষণ করুন</small>
            </div>
          </label>

          <label class="export-option-card">
            <input type="checkbox" name="export-format" value="images">
            <div class="export-option-icon"><i data-lucide="image"></i></div>
            <div class="export-option-info">
              <strong>Images (PNG)</strong>
              <small>প্রতিটি পেজ আলাদা PNG হিসেবে</small>
            </div>
          </label>

          <label class="export-option-card">
            <input type="checkbox" name="export-format" value="text">
            <div class="export-option-icon"><i data-lucide="file-type-2"></i></div>
            <div class="export-option-info">
              <strong>Plain Text (.txt)</strong>
              <small>PDF থেকে সব text extract করুন</small>
            </div>
          </label>

          <label class="export-option-card">
            <input type="checkbox" name="export-format" value="html">
            <div class="export-option-icon"><i data-lucide="code"></i></div>
            <div class="export-option-info">
              <strong>HTML</strong>
              <small>Browser এ দেখার জন্য</small>
            </div>
          </label>

          <label class="export-option-card">
            <input type="checkbox" name="export-format" value="json">
            <div class="export-option-icon"><i data-lucide="braces"></i></div>
            <div class="export-option-info">
              <strong>JSON (Text Data)</strong>
              <small>Structured text + positions</small>
            </div>
          </label>
        </div>

        <div class="multi-export-image-opts" id="multi-export-image-opts" style="display:none; margin-bottom: 15px;">
          <label>Image Quality:
            <select id="multi-export-img-quality">
              <option value="0.95">High (95%)</option>
              <option value="0.8" selected>Medium (80%)</option>
              <option value="0.6">Low (60%)</option>
            </select>
          </label>
          <label>Scale:
            <select id="multi-export-img-scale">
              <option value="2">2x (High DPI)</option>
              <option value="1.5" selected>1.5x (Default)</option>
              <option value="1">1x</option>
            </select>
          </label>
          <label>
            <input type="checkbox" id="multi-export-zip-images" checked>
            ZIP এ bundle করুন
          </label>
        </div>

        <div class="multi-export-progress" id="multi-export-progress" style="display:none; margin-bottom: 15px;">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="multi-export-progress-bar" style="width:0%"></div>
          </div>
          <span id="multi-export-progress-text">Exporting...</span>
        </div>

        <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
          <button class="btn btn-outline" id="multi-export-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="multi-export-go-btn" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="download"></i> Export Selected
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    wireEvents(modal);
    if (window.lucide) window.lucide.createIcons();
  }

  function wireEvents(modal) {
    modal.querySelector('.modal-close-btn').addEventListener('click', hide);
    modal.querySelector('#multi-export-cancel-btn').addEventListener('click', hide);
    modal.querySelector('#multi-export-go-btn').addEventListener('click', startExport);
    modal.addEventListener('click', (e) => { if (e.target === modal) hide(); });

    // Toggle image options visibility
    modal.querySelectorAll('input[name="export-format"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const imagesChecked = modal.querySelector('input[value="images"]').checked;
        document.getElementById('multi-export-image-opts').style.display = imagesChecked ? 'flex' : 'none';
      });
    });
  }

  // ─── Export ───────────────────────────────────────────────────────────────────
  async function startExport() {
    const selectedFormats = [...document.querySelectorAll('input[name="export-format"]:checked')]
      .map(cb => cb.value);

    if (selectedFormats.length === 0) {
      showToast('অন্তত একটা format select করুন', 'warning');
      return;
    }

    if (!currentFile) {
      showToast('কোনো PDF লোড করা নেই', 'error');
      return;
    }

    const progressEl = document.getElementById('multi-export-progress');
    const progressBar = document.getElementById('multi-export-progress-bar');
    const progressText = document.getElementById('multi-export-progress-text');
    const goBtn = document.getElementById('multi-export-go-btn');

    progressEl.style.display = 'block';
    goBtn.disabled = true;

    const total = selectedFormats.length;
    let done = 0;

    const setProgress = (text) => {
      done++;
      progressBar.style.width = `${(done / total) * 100}%`;
      progressText.textContent = text;
    };

    try {
      const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      const doc = await pdfjsLib.getDocument({ data: currentFile.arrayBuffer.slice(0) }).promise;
      const baseName = currentFile.name.replace(/\.pdf$/i, '');

      for (const fmt of selectedFormats) {
        switch (fmt) {
          case 'pdf':
            setProgress('Saving PDF...');
            await exportPdf(baseName);
            break;

          case 'images':
            setProgress('Exporting images...');
            await exportImages(doc, baseName);
            break;

          case 'text':
            setProgress('Extracting text...');
            await exportText(doc, baseName);
            break;

          case 'html':
            setProgress('Generating HTML...');
            await exportHtml(doc, baseName);
            break;

          case 'json':
            setProgress('Building JSON...');
            await exportJson(doc, baseName);
            break;
        }
      }

      progressText.textContent = `✅ Done! ${total} file(s) exported.`;
      progressBar.style.width = '100%';
      showToast(`${total} format এ export সম্পন্ন!`, 'success');

    } catch (err) {
      console.error('[multi-export]', err);
      progressText.textContent = `❌ Error: ${err.message}`;
      showToast('Export এ সমস্যা হয়েছে', 'error');
    } finally {
      goBtn.disabled = false;
    }
  }

  // ─── Individual exporters ─────────────────────────────────────────────────────

  async function exportPdf(baseName) {
    const blob = new Blob([currentFile.arrayBuffer], { type: 'application/pdf' });
    downloadBlob(blob, `${baseName}_exported.pdf`);
  }

  async function exportImages(doc, baseName) {
    const quality = parseFloat(document.getElementById('multi-export-img-quality').value);
    const scale = parseFloat(document.getElementById('multi-export-img-scale').value);
    const useZip = document.getElementById('multi-export-zip-images').checked;

    const images = []; // {name, blob}

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise(res => canvas.toBlob(res, 'image/png', quality));
      images.push({ name: `${baseName}_page_${String(p).padStart(3, '0')}.png`, blob });
    }

    if (useZip && window.JSZip) {
      const zip = new window.JSZip();
      images.forEach(({ name, blob }) => zip.file(name, blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${baseName}_images.zip`);
    } else {
      images.forEach(({ name, blob }) => downloadBlob(blob, name));
    }
  }

  async function exportText(doc, baseName) {
    let fullText = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const pageText = tc.items.map(i => i.str).join(' ');
      fullText += `=== Page ${p} ===\n${pageText}\n\n`;
    }
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${baseName}.txt`);
  }

  async function exportHtml(doc, baseName) {
    let body = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const pageText = tc.items.map(i => i.str).join(' ');
      body += `<section class="pdf-page"><h2>Page ${p}</h2><p>${escapeHtml(pageText)}</p></section>\n`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(baseName)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #222; line-height: 1.7; }
  .pdf-page { border-bottom: 2px solid #eee; margin-bottom: 40px; padding-bottom: 20px; }
  h2 { color: #555; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
<h1>${escapeHtml(baseName)}</h1>
${body}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${baseName}.html`);
  }

  async function exportJson(doc, baseName) {
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      pages.push({
        page: p,
        width: viewport.width,
        height: viewport.height,
        items: tc.items.map(item => ({
          text: item.str,
          x: item.transform[4],
          y: viewport.height - item.transform[5],
          fontSize: item.transform[0],
          width: item.width,
        }))
      });
    }

    const json = JSON.stringify({ source: currentFile.name, exportedAt: new Date().toISOString(), pages }, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `${baseName}.json`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(msg, type = 'info') {
    if (window.showToast) { window.showToast(msg, type); return; }
    console.log(`[multi-export] ${type}: ${msg}`);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  function open(file) {
    init();
    if (file) {
      currentFile = file;
      document.getElementById('multi-export-filename').textContent = file.name;
    }
    const modal = document.getElementById('multi-export-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('multi-export-progress').style.display = 'none';
    document.getElementById('multi-export-progress-bar').style.width = '0%';
    if (window.lucide) window.lucide.createIcons();
  }

  function hide() {
    const modal = document.getElementById('multi-export-modal');
    if (modal) modal.style.display = 'none';
  }

  function setFile(file) {
    currentFile = file;
  }

  return { open, hide, setFile };
})();

window.MultiExport = MultiExport;
