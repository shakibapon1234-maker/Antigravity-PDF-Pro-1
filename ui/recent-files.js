/**
 * ui/recent-files.js — Antigravity PDF Pro
 * ─────────────────────────────────────────
 * Phase 1-B : Recent Files  (electron-store দিয়ে সর্বশেষ ১০টা ফাইল)
 * Phase 1-C : Drag & Drop   (পুরো window এ PDF drop করলে editor এ খুলবে)
 * Phase 1-E : Keyboard Shortcuts (Ctrl+O, Ctrl+S, Ctrl+Z, Ctrl+Y, Escape)
 *
 * নির্ভর করে:
 *   - window.electronAPI  (preload.js দিয়ে expose করা)
 *   - window.loadAndRenderPDF, window.switchTab, window.currentPdfFile
 *   - window.savePdfChanges, window.undoLastAction, window.redoLastAction
 */

(function () {
  'use strict';

  const MAX_RECENT = 10;
  const STORE_KEY  = 'recentFiles';

  // ─── Helper: electron-store read/write ──────────────────────────────────
  async function getRecent() {
    if (!window.electronAPI?.storeGet) return [];
    try {
      const data = await window.electronAPI.storeGet(STORE_KEY);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  async function saveRecent(list) {
    if (!window.electronAPI?.storeSet) return;
    try { await window.electronAPI.storeSet(STORE_KEY, list); } catch { /* silent */ }
  }

  // ─── Add a file to recent list ──────────────────────────────────────────
  async function addToRecent(filePath, fileName) {
    if (!filePath) return;
    let list = await getRecent();
    // Remove duplicates
    list = list.filter(f => f.path !== filePath);
    // Add to front
    list.unshift({ path: filePath, name: fileName || filePath.split(/[\\/]/).pop(), openedAt: Date.now() });
    // Trim to MAX_RECENT
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    await saveRecent(list);
    renderRecentFiles(list);
  }

  // ─── Render Recent Files section in dashboard ────────────────────────────
  function renderRecentFiles(list) {
    const container = document.getElementById('recentFilesContainer');
    const section   = document.getElementById('recentFilesSection');
    if (!container || !section) return;

    if (!list || list.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = list.map((f, i) => {
      const name = f.name || f.path.split(/[\\/]/).pop();
      const date = f.openedAt ? new Date(f.openedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      return `
        <div class="recent-file-item" data-index="${i}" title="${f.path}">
          <div class="recent-file-icon"><i data-lucide="file-text"></i></div>
          <div class="recent-file-info">
            <span class="recent-file-name">${escapeHtml(name)}</span>
            <span class="recent-file-date">${date}</span>
          </div>
          <button class="recent-file-remove" data-index="${i}" title="Remove from list">
            <i data-lucide="x"></i>
          </button>
        </div>`;
    }).join('');

    // Re-init lucide icons inside this container
    if (window.lucide?.createIcons) window.lucide.createIcons();

    // Click to open
    container.querySelectorAll('.recent-file-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.recent-file-remove')) return; // let remove button handle
        const idx  = parseInt(item.dataset.index, 10);
        const file = list[idx];
        if (file) await openRecentFile(file);
      });
    });

    // Remove buttons
    container.querySelectorAll('.recent-file-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        list.splice(idx, 1);
        await saveRecent(list);
        renderRecentFiles(list);
      });
    });
  }

  // ─── Open a recent file via path ─────────────────────────────────────────
  async function openRecentFile(fileEntry) {
    if (!fileEntry?.path) return;

    // Use native open dialog pre-populated? No — Electron can read path via IPC
    // We read the file bytes from main process
    if (!window.electronAPI?.readFileByPath) {
      // Fallback: ask user to locate the file manually
      showToast(`অনুগ্রহ করে ফাইলটি আবার খুলুন — Recent Files সরাসরি খুলতে পারছে না।`, 'warning');
      return;
    }

    try {
      const bytes = await window.electronAPI.readFileByPath(fileEntry.path);
      if (!bytes) {
        showToast(`ফাইল পাওয়া যাচ্ছে না: ${fileEntry.name}`, 'error');
        return;
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], fileEntry.name, { type: 'application/pdf' });

      window.currentPdfFile = file;
      if (typeof window.switchTab === 'function') window.switchTab('editor');
      if (typeof window.loadAndRenderPDF === 'function') await window.loadAndRenderPDF(file);

      // Move to front of recent list
      await addToRecent(fileEntry.path, fileEntry.name);
    } catch (err) {
      console.error('[RecentFiles] openRecentFile error:', err);
      showToast(`ফাইল খুলতে সমস্যা হয়েছে: ${err.message}`, 'error');
    }
  }

  // ─── Track file opens from any source ───────────────────────────────────
  // Hook into loadAndRenderPDF to auto-record the opened file
  const _origLoad = window.loadAndRenderPDF;
  if (typeof _origLoad === 'function') {
    window.loadAndRenderPDF = async function (file, ...args) {
      const result = await _origLoad.call(this, file, ...args);
      // Record if it came from a real file path (electron open dialog)
      if (file && window._lastOpenedFilePath) {
        await addToRecent(window._lastOpenedFilePath, file.name);
        window._lastOpenedFilePath = null;
      }
      return result;
    };
  }

  // ─── Phase 1-C: Window-wide Drag & Drop ─────────────────────────────────
  function setupDragAndDrop() {
    const overlay = document.getElementById('dragDropOverlay');

    let dragCounter = 0; // track nested dragleave events

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      const hasFiles = e.dataTransfer?.types?.includes('Files');
      if (!hasFiles) return;
      dragCounter++;
      if (overlay) overlay.classList.add('visible');
    });

    document.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlay) overlay.classList.remove('visible');
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (overlay) overlay.classList.remove('visible');

      const files = Array.from(e.dataTransfer?.files || []);
      const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf'));
      if (!pdfFile) {
        showToast('শুধুমাত্র PDF ফাইল drop করুন।', 'warning');
        return;
      }

      window.currentPdfFile = pdfFile;
      if (typeof window.switchTab === 'function') window.switchTab('editor');
      if (typeof window.loadAndRenderPDF === 'function') await window.loadAndRenderPDF(pdfFile);

      // Record in recent (path not available via browser drag, skip path)
    });
  }

  // ─── Phase 1-E: Keyboard Shortcuts ──────────────────────────────────────
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Don't fire if user is typing inside an input, textarea, or contenteditable
      const tag = document.activeElement?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      // Escape — always active (close active tool)
      if (e.key === 'Escape') {
        // Deactivate all tool buttons
        document.querySelectorAll('.btn-tool.active').forEach(b => b.classList.remove('active'));
        // If there's a global cancel function, call it
        if (typeof window.cancelActiveTool === 'function') window.cancelActiveTool();
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return; // Only process Ctrl/Cmd combos below
      if (isEditing) return;

      switch (e.key.toLowerCase()) {
        case 'o': // Ctrl+O — Open PDF
          e.preventDefault();
          if (window.electronAPI?.showOpenDialog) {
            const result = await window.electronAPI.showOpenDialog({
              title: 'PDF খুলুন',
              filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths?.length) {
              const fp = result.filePaths[0];
              window._lastOpenedFilePath = fp;
              const bytes = await window.electronAPI.readFileByPath(fp);
              if (bytes) {
                const name = fp.split(/[\\/]/).pop();
                const file = new File([new Blob([bytes], { type: 'application/pdf' })], name, { type: 'application/pdf' });
                window.currentPdfFile = file;
                if (typeof window.switchTab === 'function') window.switchTab('editor');
                if (typeof window.loadAndRenderPDF === 'function') await window.loadAndRenderPDF(file);
                await addToRecent(fp, name);
              }
            }
          } else {
            // Fallback: click the upload button
            document.getElementById('btnUploadEditor')?.click();
          }
          break;

        case 's': // Ctrl+S — Save
          e.preventDefault();
          if (typeof window.savePdfChanges === 'function') window.savePdfChanges();
          break;

        case 'z': // Ctrl+Z — Undo
          e.preventDefault();
          if (typeof window.undoLastAction === 'function') window.undoLastAction();
          break;

        case 'y': // Ctrl+Y — Redo
          e.preventDefault();
          if (typeof window.redoLastAction === 'function') window.redoLastAction();
          break;
      }
    });
  }

  // ─── Toast notification helper ───────────────────────────────────────────
  function showToast(message, type = 'info') {
    // Reuse existing toast if available, otherwise create one
    let toast = document.getElementById('rfToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rfToast';
      toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 99999;
        padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500;
        color: #fff; max-width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        transition: opacity 0.3s; pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    const colors = { info: '#00d4ff', success: '#00ff88', warning: '#ffa500', error: '#ff4d4d' };
    toast.style.background = colors[type] || colors.info;
    toast.style.color = type === 'warning' ? '#000' : '#fff';
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
  }
  window.showToast = showToast; // expose globally so other modules can use it

  // ─── Escape HTML ─────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ─── Listen for files opened from Electron menu (File > Open) ────────────
  function listenForElectronFileOpen() {
    if (!window.electronAPI?.onOpenFile) return;
    window.electronAPI.onOpenFile(async (filePath) => {
      if (!filePath) return;
      window._lastOpenedFilePath = filePath;
      const bytes = await window.electronAPI.readFileByPath(filePath).catch(() => null);
      if (!bytes) { showToast('ফাইল পড়তে সমস্যা হয়েছে।', 'error'); return; }
      const name = filePath.split(/[\\/]/).pop();
      const file = new File([new Blob([bytes], { type: 'application/pdf' })], name, { type: 'application/pdf' });
      window.currentPdfFile = file;
      if (typeof window.switchTab === 'function') window.switchTab('editor');
      if (typeof window.loadAndRenderPDF === 'function') await window.loadAndRenderPDF(file);
      await addToRecent(filePath, name);
    });
  }

  // ─── Init on DOM ready ───────────────────────────────────────────────────
  async function init() {
    // Render initial recent list
    const list = await getRecent();
    renderRecentFiles(list);

    setupDragAndDrop();
    setupKeyboardShortcuts();
    listenForElectronFileOpen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
