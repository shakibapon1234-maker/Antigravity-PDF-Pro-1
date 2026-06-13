/**
 * Antigravity PDF Pro — Phase 4-B
 * PDF Page Thumbnail Sidebar
 * বাম পাশে সব পেজের ছোট preview দেখায়, click করলে সেই পেজে যাওয়া যায়
 */

const ThumbnailSidebar = (() => {
  let isVisible = false;
  let currentDoc = null;
  let currentActivePage = 1;
  let renderQueue = [];
  let isRendering = false;
  let thumbnailCache = new Map(); // pageNum -> dataURL

  const THUMB_SCALE = 0.25; // thumbnail render scale — must be >0.18 to avoid blank render

  // ─── Build sidebar DOM ────────────────────────────────────────────────────────
  function init() {
    if (document.getElementById('thumb-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'thumb-sidebar';
    sidebar.className = 'thumb-sidebar hidden';
    sidebar.innerHTML = `
      <div class="thumb-sidebar-header">
        <span><i data-lucide="layout-list"></i> Pages</span>
        <button class="btn-icon thumb-close-btn" title="Close sidebar">
          <i data-lucide="panel-left-close"></i>
        </button>
      </div>
      <div class="thumb-sidebar-body" id="thumb-sidebar-body">
        <div class="thumb-empty-state">
          <i data-lucide="file-text"></i>
          <p>PDF লোড করুন</p>
        </div>
      </div>
    `;

    // Always append to body — sidebar is position:fixed so layout doesn't matter
    document.body.appendChild(sidebar);

    sidebar.querySelector('.thumb-close-btn').addEventListener('click', hide);

    if (window.lucide) window.lucide.createIcons();
  }

  // ─── Public: Load a PDF document ─────────────────────────────────────────────
  async function loadDocument(pdfDoc) {
    init();
    currentDoc = pdfDoc;
    thumbnailCache.clear();
    renderQueue = [];
    currentActivePage = 1;

    const body = document.getElementById('thumb-sidebar-body');
    body.innerHTML = '';

    const totalPages = pdfDoc.numPages;

    // Create placeholder tiles immediately
    for (let p = 1; p <= totalPages; p++) {
      const tile = createTile(p, totalPages);
      body.appendChild(tile);
    }

    // Show sidebar
    show();

    // Render visible thumbnails first (lazy)
    renderVisibleThumbnails();
    setupScrollListener();

    if (window.lucide) window.lucide.createIcons();
  }

  // ─── Tile creation ────────────────────────────────────────────────────────────
  function createTile(pageNum, total) {
    const tile = document.createElement('div');
    tile.className = 'thumb-tile';
    tile.dataset.page = pageNum;
    tile.id = `thumb-tile-${pageNum}`;
    tile.title = `Page ${pageNum}`;

    tile.innerHTML = `
      <div class="thumb-canvas-wrap">
        <div class="thumb-placeholder"><div class="thumb-spinner"></div></div>
        <canvas class="thumb-canvas" id="thumb-canvas-${pageNum}" style="display:none"></canvas>
      </div>
      <div class="thumb-label">
        <span>${pageNum}</span>
        <span class="thumb-total">/ ${total}</span>
      </div>
    `;

    tile.addEventListener('click', () => goToPage(pageNum));
    return tile;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────────
  function renderVisibleThumbnails() {
    if (!currentDoc) return;
    const body = document.getElementById('thumb-sidebar-body');
    if (!body) return;

    const tiles = body.querySelectorAll('.thumb-tile[data-page]');
    const bodyRect = body.getBoundingClientRect();

    tiles.forEach(tile => {
      const rect = tile.getBoundingClientRect();
      const isVisible = rect.top < bodyRect.bottom + 200 && rect.bottom > bodyRect.top - 200;
      if (isVisible) {
        const p = parseInt(tile.dataset.page);
        if (!thumbnailCache.has(p) && !renderQueue.includes(p)) {
          renderQueue.push(p);
        }
      }
    });

    processQueue();
  }

  async function processQueue() {
    if (isRendering || renderQueue.length === 0) return;
    isRendering = true;

    while (renderQueue.length > 0) {
      const pageNum = renderQueue.shift();
      if (!thumbnailCache.has(pageNum) && currentDoc) {
        await renderThumbnail(pageNum);
      }
    }

    isRendering = false;
  }

  async function renderThumbnail(pageNum) {
    if (!currentDoc || pageNum > currentDoc.numPages) return;

    try {
      const page     = await currentDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: THUMB_SCALE });

      const canvas = document.getElementById(`thumb-canvas-${pageNum}`);
      if (!canvas) return;

      // Set actual pixel dimensions
      canvas.width  = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // White background so pages don't look transparent
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;

      const dataURL = canvas.toDataURL('image/jpeg', 0.8);
      thumbnailCache.set(pageNum, dataURL);

      // Hide placeholder, show canvas
      const tile = document.getElementById(`thumb-tile-${pageNum}`);
      if (tile) {
        const placeholder = tile.querySelector('.thumb-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        canvas.style.display = 'block';
      }
    } catch (err) {
      console.warn(`[thumbnail] Failed to render page ${pageNum}:`, err);
    }
  }

  function setupScrollListener() {
    const body = document.getElementById('thumb-sidebar-body');
    if (!body) return;
    body.removeEventListener('scroll', onScroll);
    body.addEventListener('scroll', onScroll, { passive: true });
  }

  let scrollTimeout = null;
  function onScroll() {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(renderVisibleThumbnails, 150);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────
  function goToPage(pageNum) {
    setActivePage(pageNum);

    // Try to trigger the app's own page-change mechanism
    if (window.goToPage) {
      window.goToPage(pageNum);
    } else if (window.AppState) {
      // Try common state patterns
      if (typeof window.AppState.setPage === 'function') {
        window.AppState.setPage(pageNum);
      }
    } else {
      // Fallback: dispatch a custom event the renderer can listen to
      document.dispatchEvent(new CustomEvent('thumbnail:goToPage', { detail: { page: pageNum } }));
    }
  }

  function setActivePage(pageNum) {
    currentActivePage = pageNum;

    // Remove old active
    document.querySelectorAll('.thumb-tile.active').forEach(t => t.classList.remove('active'));

    // Set new active
    const tile = document.getElementById(`thumb-tile-${pageNum}`);
    if (tile) {
      tile.classList.add('active');
      tile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ─── Visibility ─────────────────────────────────────────────────────
  function show() {
    init();
    const sidebar = document.getElementById('thumb-sidebar');
    if (sidebar) {
      sidebar.classList.remove('hidden');
      isVisible = true;
    }
    // Shift main content right to avoid overlap
    const main = document.querySelector('.main-content');
    if (main) main.classList.add('thumb-open');
    renderVisibleThumbnails();
  }

  function hide() {
    const sidebar = document.getElementById('thumb-sidebar');
    if (sidebar) {
      sidebar.classList.add('hidden');
      isVisible = false;
    }
    // Restore main content
    const main = document.querySelector('.main-content');
    if (main) main.classList.remove('thumb-open');
  }

  function toggle() {
    if (isVisible) hide(); else show();
  }

  // ─── Called when user navigates pages in the main editor ─────────────────────
  function onEditorPageChange(pageNum) {
    setActivePage(pageNum);
    // Trigger render for nearby pages
    const nearby = [pageNum - 1, pageNum, pageNum + 1].filter(p => p >= 1);
    nearby.forEach(p => {
      if (!thumbnailCache.has(p) && !renderQueue.includes(p)) renderQueue.push(p);
    });
    processQueue();
  }

  // ─── Refresh a single thumbnail (after edit) ──────────────────────────────────
  async function refreshPage(pageNum) {
    thumbnailCache.delete(pageNum);
    const canvas = document.getElementById(`thumb-canvas-${pageNum}`);
    if (canvas) canvas.style.display = 'none';
    const placeholder = document.querySelector(`#thumb-tile-${pageNum} .thumb-placeholder`);
    if (placeholder) placeholder.style.display = 'flex';
    renderQueue.unshift(pageNum);
    await processQueue();
  }

  return {
    loadDocument,
    show,
    hide,
    toggle,
    setActivePage,
    onEditorPageChange,
    refreshPage,
    isVisible: () => isVisible,
  };
})();

window.ThumbnailSidebar = ThumbnailSidebar;

// Listen for editor page changes via custom event
document.addEventListener('editor:pageChanged', (e) => {
  if (e.detail && e.detail.page) ThumbnailSidebar.onEditorPageChange(e.detail.page);
});


// ─── Universal Tool Hook ──────────────────────────────────────────────────────
// Strategy A: intercept ALL <input type="file"> change events at document level
//   → catches tool-specific upload buttons that bypass window.loadXxxPdf
// Strategy B: wrap window.loadXxxPdf functions (catches global drag-drop handler)
(function installThumbHook() {

  // IDs of file inputs that should NOT trigger thumbnail loading
  // (e.g. the watermark image picker, signature upload, etc.)
  const SKIP_INPUT_IDS = new Set([
    'wmImageInput',         // watermark image
    'signatureImageInput',  // signature upload
    'stampImageInput',      // stamp image
  ]);

  // ── Helper: render PDF bytes into ThumbnailSidebar ──────────────────────────
  async function feedThumbsFromFile(file) {
    if (!file || !window.pdfjsLib) return;
    if (!file.name || !file.name.toLowerCase().endsWith('.pdf')) return;
    try {
      const buf  = await file.arrayBuffer();
      const doc  = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      ThumbnailSidebar.loadDocument(doc);
    } catch (err) {
      console.warn('[ThumbnailSidebar] Could not generate thumbnails for',
                   file && file.name, err);
    }
  }

  // ── Strategy A: global capture-phase 'change' on every file input ────────────
  // Fires BEFORE the tool's own handler so thumbnails load immediately.
  document.addEventListener('change', function(e) {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return;
    if (SKIP_INPUT_IDS.has(el.id)) return;          // non-PDF input → skip

    const file = el.files && el.files[0];
    if (file) feedThumbsFromFile(file);
  }, true /* capture */);

  // ── Strategy B: wrap window.loadXxxPdf functions ─────────────────────────────
  // Catches the global drag-drop handler in index.html (window.loadXxxPdf(file))
  const TOOL_LOAD_FNS = [
    'loadCompressPdf',
    'loadRotatePdf',
    'loadProtectPdf',
    'loadUnlockPdf',
    'loadWatermarkPdf',
    'loadOrganizePdf',
    'loadSplitPdf',
    'loadCropPdf',
    'loadMergePdfs',
    'loadPdfToImage',
    'loadPageNumbersPdf',
  ];

  const wrapped = new Set();

  function wrapLoadFn(name) {
    if (wrapped.has(name)) return;
    const original = window[name];
    if (typeof original !== 'function') return;
    wrapped.add(name);
    window[name] = function(fileOrFiles, ...rest) {
      const file = fileOrFiles instanceof FileList ? fileOrFiles[0]
                 : Array.isArray(fileOrFiles)      ? fileOrFiles[0]
                 :                                   fileOrFiles;
      if (file instanceof File) feedThumbsFromFile(file);
      return original.call(this, fileOrFiles, ...rest);
    };
  }

  function patchAll() { TOOL_LOAD_FNS.forEach(wrapLoadFn); }

  // Run once DOM is ready, then again after 1 s to catch late registrations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      patchAll();
      setTimeout(patchAll, 1000);
    }, { once: true });
  } else {
    patchAll();
    setTimeout(patchAll, 1000);
  }
})();

