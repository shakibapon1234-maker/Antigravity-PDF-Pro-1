/**
 * Antigravity PDF Pro — Phase 4-A
 * PDF Comparison Tool
 * দুটো PDF এর পার্থক্য side-by-side দেখায়
 */

const PdfCompare = (() => {
  let pdfA = null; // { name, data (ArrayBuffer), doc (PDFDocumentProxy) }
  let pdfB = null;
  let currentPage = 1;
  let totalPages = 0;
  let isRendering = false;
  let diffHighlight = true;

  // ─── DOM refs ────────────────────────────────────────────────────────────────
  const getEl = (id) => document.getElementById(id);

  // ─── Init UI ─────────────────────────────────────────────────────────────────
  function init() {
    if (getEl('compare-panel')) return; // already injected

    const panel = document.createElement('div');
    panel.id = 'compare-panel';
    panel.className = 'tool-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="compare-header">
        <h3><i data-lucide="git-compare"></i> PDF Comparison</h3>
        <button class="btn-icon close-compare-btn" title="Close"><i data-lucide="x"></i></button>
      </div>

      <div class="compare-drop-zone-row">
        <!-- PDF A -->
        <div class="compare-drop-zone" id="compare-zone-a">
          <i data-lucide="file-text"></i>
          <p>PDF A (Original)</p>
          <span id="compare-name-a" class="compare-filename">ফাইল বেছে নিন</span>
          <input type="file" id="compare-file-a" accept=".pdf" style="display:none">
          <button class="btn-sm" onclick="document.getElementById('compare-file-a').click()">
            <i data-lucide="upload"></i> Browse
          </button>
        </div>

        <div class="compare-vs-badge">VS</div>

        <!-- PDF B -->
        <div class="compare-drop-zone" id="compare-zone-b">
          <i data-lucide="file-text"></i>
          <p>PDF B (Modified)</p>
          <span id="compare-name-b" class="compare-filename">ফাইল বেছে নিন</span>
          <input type="file" id="compare-file-b" accept=".pdf" style="display:none">
          <button class="btn-sm" onclick="document.getElementById('compare-file-b').click()">
            <i data-lucide="upload"></i> Browse
          </button>
        </div>
      </div>

      <div class="compare-controls">
        <button class="btn-primary" id="compare-start-btn" disabled>
          <i data-lucide="play"></i> Compare Now
        </button>
        <label class="compare-toggle-label">
          <input type="checkbox" id="compare-diff-toggle" checked>
          Highlight Differences
        </label>
      </div>

      <div class="compare-status" id="compare-status" style="display:none">
        <div class="compare-stats">
          <span id="compare-stat-added" class="stat-badge added">+ 0 added</span>
          <span id="compare-stat-removed" class="stat-badge removed">- 0 removed</span>
          <span id="compare-stat-pages" class="stat-badge pages">0 pages</span>
        </div>
      </div>

      <div class="compare-nav" id="compare-nav" style="display:none">
        <button class="btn-icon" id="compare-prev-btn"><i data-lucide="chevron-left"></i></button>
        <span id="compare-page-indicator">Page 1 / 1</span>
        <button class="btn-icon" id="compare-next-btn"><i data-lucide="chevron-right"></i></button>
      </div>

      <div class="compare-canvas-row" id="compare-canvas-row" style="display:none">
        <div class="compare-canvas-wrap">
          <div class="compare-label">Original (A)</div>
          <canvas id="compare-canvas-a"></canvas>
        </div>
        <div class="compare-diff-overlay-wrap">
          <div class="compare-label">Differences</div>
          <canvas id="compare-canvas-diff"></canvas>
        </div>
        <div class="compare-canvas-wrap">
          <div class="compare-label">Modified (B)</div>
          <canvas id="compare-canvas-b"></canvas>
        </div>
      </div>

      <div id="compare-loading" class="compare-loading" style="display:none">
        <div class="spinner"></div>
        <p id="compare-loading-text">Comparing PDFs...</p>
      </div>
    `;

    document.body.appendChild(panel);

    // Wire events
    getEl('compare-file-a').addEventListener('change', (e) => handleFile(e, 'A'));
    getEl('compare-file-b').addEventListener('change', (e) => handleFile(e, 'B'));
    getEl('compare-start-btn').addEventListener('click', startComparison);
    getEl('compare-prev-btn').addEventListener('click', () => changePage(-1));
    getEl('compare-next-btn').addEventListener('click', () => changePage(1));
    getEl('compare-diff-toggle').addEventListener('change', (e) => {
      diffHighlight = e.target.checked;
      if (pdfA && pdfB) renderPage(currentPage);
    });
    panel.querySelector('.close-compare-btn').addEventListener('click', closeTool);

    // Drag & Drop for both zones
    setupDropZone('compare-zone-a', 'A');
    setupDropZone('compare-zone-b', 'B');

    // Init lucide icons
    if (window.lucide) window.lucide.createIcons();
  }

  function setupDropZone(zoneId, slot) {
    const zone = getEl(zoneId);
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') loadPdfSlot(file, slot);
      else showToast('শুধু PDF ফাইল drop করুন', 'error');
    });
  }

  // ─── File Loading ─────────────────────────────────────────────────────────────
  async function handleFile(event, slot) {
    const file = event.target.files[0];
    if (!file) return;
    await loadPdfSlot(file, slot);
  }

  async function loadPdfSlot(file, slot) {
    const nameEl = getEl(`compare-name-${slot.toLowerCase()}`);
    const zoneEl = getEl(`compare-zone-${slot.toLowerCase()}`);
    nameEl.textContent = file.name;
    zoneEl.classList.add('loaded');

    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

    if (slot === 'A') {
      pdfA = { name: file.name, data: arrayBuffer, doc };
    } else {
      pdfB = { name: file.name, data: arrayBuffer, doc };
    }

    updateStartButton();
  }

  function updateStartButton() {
    const btn = getEl('compare-start-btn');
    btn.disabled = !(pdfA && pdfB);
  }

  // ─── Comparison ───────────────────────────────────────────────────────────────
  async function startComparison() {
    if (!pdfA || !pdfB) return;

    showLoading('Analyzing PDFs...');
    getEl('compare-canvas-row').style.display = 'none';
    getEl('compare-nav').style.display = 'none';
    getEl('compare-status').style.display = 'none';

    currentPage = 1;
    totalPages = Math.max(pdfA.doc.numPages, pdfB.doc.numPages);

    // Count text differences
    let addedCount = 0, removedCount = 0;
    try {
      for (let p = 1; p <= Math.min(pdfA.doc.numPages, pdfB.doc.numPages); p++) {
        const [textA, textB] = await Promise.all([extractPageText(pdfA.doc, p), extractPageText(pdfB.doc, p)]);
        const diff = simpleDiff(textA, textB);
        addedCount += diff.added;
        removedCount += diff.removed;
      }
    } catch (e) {
      console.warn('[compare] text diff failed', e);
    }

    // Update stats
    getEl('compare-stat-added').textContent = `+ ${addedCount} added`;
    getEl('compare-stat-removed').textContent = `- ${removedCount} removed`;
    getEl('compare-stat-pages').textContent = `${totalPages} pages`;
    getEl('compare-status').style.display = 'block';

    hideLoading();
    getEl('compare-canvas-row').style.display = 'flex';
    getEl('compare-nav').style.display = 'flex';

    await renderPage(1);
  }

  async function extractPageText(doc, pageNum) {
    if (pageNum > doc.numPages) return '';
    const page = await doc.getPage(pageNum);
    const tc = await page.getTextContent();
    return tc.items.map(i => i.str).join(' ');
  }

  function simpleDiff(textA, textB) {
    const wordsA = new Set(textA.split(/\s+/).filter(Boolean));
    const wordsB = new Set(textB.split(/\s+/).filter(Boolean));
    let added = 0, removed = 0;
    wordsB.forEach(w => { if (!wordsA.has(w)) added++; });
    wordsA.forEach(w => { if (!wordsB.has(w)) removed++; });
    return { added, removed };
  }

  // ─── Rendering ────────────────────────────────────────────────────────────────
  async function renderPage(pageNum) {
    if (isRendering) return;
    isRendering = true;

    currentPage = pageNum;
    getEl('compare-page-indicator').textContent = `Page ${currentPage} / ${totalPages}`;
    getEl('compare-prev-btn').disabled = currentPage <= 1;
    getEl('compare-next-btn').disabled = currentPage >= totalPages;

    const SCALE = 1.2;

    // Render A
    const canvasA = getEl('compare-canvas-a');
    const canvasDiff = getEl('compare-canvas-diff');
    const canvasB = getEl('compare-canvas-b');

    if (pdfA && currentPage <= pdfA.doc.numPages) {
      await renderPdfPage(pdfA.doc, pageNum, canvasA, SCALE);
    } else {
      clearCanvas(canvasA, canvasB);
    }

    if (pdfB && currentPage <= pdfB.doc.numPages) {
      await renderPdfPage(pdfB.doc, pageNum, canvasB, SCALE);
    } else {
      clearCanvas(canvasB);
    }

    // Generate diff canvas
    if (diffHighlight) {
      generateDiffCanvas(canvasA, canvasB, canvasDiff);
    } else {
      const ctx = canvasDiff.getContext('2d');
      canvasDiff.width = canvasA.width;
      canvasDiff.height = canvasA.height;
      ctx.clearRect(0, 0, canvasDiff.width, canvasDiff.height);
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvasDiff.width, canvasDiff.height);
      ctx.fillStyle = '#999';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Diff highlight off', canvasDiff.width / 2, canvasDiff.height / 2);
    }

    isRendering = false;
  }

  async function renderPdfPage(doc, pageNum, canvas, scale) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No page', canvas.width / 2, canvas.height / 2);
  }

  /**
   * Pixel-level diff: red = removed (in A, not B), green = added (in B, not A)
   */
  function generateDiffCanvas(canvasA, canvasB, canvasDiff) {
    const w = Math.max(canvasA.width, canvasB.width);
    const h = Math.max(canvasA.height, canvasB.height);

    canvasDiff.width = w;
    canvasDiff.height = h;

    const ctxA = canvasA.getContext('2d');
    const ctxB = canvasB.getContext('2d');
    const ctxD = canvasDiff.getContext('2d');

    // White background
    ctxD.fillStyle = '#ffffff';
    ctxD.fillRect(0, 0, w, h);

    const dataA = ctxA.getImageData(0, 0, canvasA.width, canvasA.height).data;
    const dataB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height).data;

    const diffImageData = ctxD.createImageData(w, h);
    const diffData = diffImageData.data;

    let diffPixels = 0;
    const THRESHOLD = 30;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idxD = (y * w + x) * 4;

        const idxA = (y * canvasA.width + x) * 4;
        const idxB = (y * canvasB.width + x) * 4;

        const inA = x < canvasA.width && y < canvasA.height;
        const inB = x < canvasB.width && y < canvasB.height;

        const rA = inA ? dataA[idxA] : 255;
        const gA = inA ? dataA[idxA + 1] : 255;
        const bA = inA ? dataA[idxA + 2] : 255;

        const rB = inB ? dataB[idxB] : 255;
        const gB = inB ? dataB[idxB + 1] : 255;
        const bB = inB ? dataB[idxB + 2] : 255;

        const dist = Math.sqrt((rA - rB) ** 2 + (gA - gB) ** 2 + (bA - bB) ** 2);

        if (dist > THRESHOLD) {
          diffPixels++;
          // Red = removed from A
          diffData[idxD] = 220;
          diffData[idxD + 1] = 50;
          diffData[idxD + 2] = 50;
          diffData[idxD + 3] = 180;
        } else {
          // Faded original
          diffData[idxD] = Math.round((rA + rB) / 2);
          diffData[idxD + 1] = Math.round((gA + gB) / 2);
          diffData[idxD + 2] = Math.round((bA + bB) / 2);
          diffData[idxD + 3] = 60;
        }
      }
    }

    ctxD.putImageData(diffImageData, 0, 0);

    // Show percentage
    const pct = ((diffPixels / (w * h)) * 100).toFixed(1);
    getEl('compare-stat-pages').textContent = `${totalPages} pages | ~${pct}% diff`;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────
  function changePage(delta) {
    const next = currentPage + delta;
    if (next < 1 || next > totalPages) return;
    renderPage(next);
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────────
  function showLoading(text = 'Loading...') {
    const el = getEl('compare-loading');
    if (el) {
      el.style.display = 'flex';
      const t = getEl('compare-loading-text');
      if (t) t.textContent = text;
    }
  }

  function hideLoading() {
    const el = getEl('compare-loading');
    if (el) el.style.display = 'none';
  }

  function showToast(msg, type = 'info') {
    if (window.showToast) { window.showToast(msg, type); return; }
    console.log(`[compare] ${type}: ${msg}`);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  function openTool() {
    init();
    const panel = getEl('compare-panel');
    if (panel) panel.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  }

  function closeTool() {
    const panel = getEl('compare-panel');
    if (panel) panel.style.display = 'none';
  }

  return { openTool, closeTool };
})();

window.PdfCompare = PdfCompare;
