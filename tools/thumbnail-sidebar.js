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

  const THUMB_SCALE = 0.18; // thumbnail render scale

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

    // Insert before main canvas area
    const editorArea = document.getElementById('editor-area') ||
                       document.getElementById('canvas-container') ||
                       document.querySelector('.editor-container') ||
                       document.querySelector('main');
    if (editorArea && editorArea.parentNode) {
      editorArea.parentNode.insertBefore(sidebar, editorArea);
    } else {
      document.body.appendChild(sidebar);
    }

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
      const page = await currentDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: THUMB_SCALE });

      const canvas = document.getElementById(`thumb-canvas-${pageNum}`);
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataURL = canvas.toDataURL('image/jpeg', 0.7);
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

  // ─── Visibility ───────────────────────────────────────────────────────────────
  function show() {
    init();
    const sidebar = document.getElementById('thumb-sidebar');
    if (sidebar) {
      sidebar.classList.remove('hidden');
      isVisible = true;
    }
    renderVisibleThumbnails();
  }

  function hide() {
    const sidebar = document.getElementById('thumb-sidebar');
    if (sidebar) {
      sidebar.classList.add('hidden');
      isVisible = false;
    }
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
// Intercepts every window.loadXxxPdf function so Thumbs works in ALL tools,
// not only the text editor.
(function installThumbHook() {
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
  ];

  const wrapped = new Set();

  async function feedThumbsFromFile(file) {
    if (!file || !window.pdfjsLib) return;
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      ThumbnailSidebar.loadDocument(doc);
    } catch (err) {
      console.warn('[ThumbnailSidebar] Could not generate thumbnails for',
                   file && file.name, err);
    }
  }

  function wrapLoadFn(name) {
    if (wrapped.has(name)) return;          // already patched
    const original = window[name];
    if (typeof original !== 'function') return;
    wrapped.add(name);
    window[name] = function(fileOrFiles, ...rest) {
      const file = fileOrFiles instanceof FileList
        ? fileOrFiles[0]
        : Array.isArray(fileOrFiles)
          ? fileOrFiles[0]
          : fileOrFiles;
      if (file instanceof File) feedThumbsFromFile(file);
      return original.call(this, fileOrFiles, ...rest);
    };
  }

  function patchAll() { TOOL_LOAD_FNS.forEach(wrapLoadFn); }

  // Run after DOM + all scripts are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      patchAll();
      setTimeout(patchAll, 800); // catch late-registering tools
    }, { once: true });
  } else {
    // DOM already loaded (script loaded async/defer)
    patchAll();
    setTimeout(patchAll, 800);
  }
})();
