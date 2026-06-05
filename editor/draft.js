// ─────────────────────────────────────────────────────────────
// editor/draft.js — Antigravity PDF Pro
// Draft সিস্টেম: IndexedDB দিয়ে কাজ সেভ ও লোড করা
// নির্ভর করে: core/state.js
// ─────────────────────────────────────────────────────────────

const DRAFT_DB_NAME    = 'AntigravityPDF_Drafts';
const DRAFT_DB_VERSION = 1;
const DRAFT_STORE      = 'drafts';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 সেকেন্ড

let _draftDb         = null;  // IDBDatabase instance
let _autoSaveTimer   = null;  // setInterval handle
let _currentDraftId  = null;  // বর্তমানে খোলা draft-এর ID

// ════════════════════════════════════════════
// IndexedDB খোলা
// ════════════════════════════════════════════

function openDraftDb() {
    return new Promise((resolve, reject) => {
        if (_draftDb) { resolve(_draftDb); return; }
        const req = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DRAFT_STORE)) {
                const store = db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
                store.createIndex('lastModified', 'lastModified', { unique: false });
            }
        };
        req.onsuccess  = (e) => { _draftDb = e.target.result; resolve(_draftDb); };
        req.onerror    = (e) => reject(e.target.error);
    });
}

// ════════════════════════════════════════════
// পিডিএফ ফাইল → Base64
// ════════════════════════════════════════════

async function _pdfFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result); // data:…;base64,…
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ════════════════════════════════════════════
// Draft সেভ
// ════════════════════════════════════════════

async function saveDraft(name = null) {
    if (!currentPdfObj || !currentPdfFile) {
        _showDraftToast('কোনো PDF খোলা নেই।', 'error');
        return;
    }

    try {
        const db = await openDraftDb();

        const id          = _currentDraftId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
        const pdfBase64   = await _pdfFileToBase64(currentPdfFile);
        const draftName   = name || (currentPdfFile.name.replace(/\.pdf$/i, '') + ' — Draft');
        const now         = new Date().toISOString();

        const draft = {
            id,
            name:         draftName,
            fileName:     currentPdfFile.name,
            pdfBase64,
            textEdits:    JSON.parse(JSON.stringify(textEdits)),
            shapeEdits:   JSON.parse(JSON.stringify(shapeEdits)),
            clearStrokes: JSON.parse(JSON.stringify(clearStrokes)),
            imageEdits:   JSON.parse(JSON.stringify(typeof imageEdits !== 'undefined' ? imageEdits : [])),
            currentPage:  currentPageNum,
            totalPages,
            pdfScale,
            createdAt:    _currentDraftId ? undefined : now, // শুধু নতুনের জন্য
            lastModified: now,
        };

        // createdAt preserve করা
        if (_currentDraftId) {
            const existing = await getDraftById(id);
            if (existing) draft.createdAt = existing.createdAt;
        }
        if (!draft.createdAt) draft.createdAt = now;

        await new Promise((resolve, reject) => {
            const tx  = db.transaction(DRAFT_STORE, 'readwrite');
            const req = tx.objectStore(DRAFT_STORE).put(draft);
            req.onsuccess = resolve;
            req.onerror   = () => reject(req.error);
        });

        _currentDraftId = id;
        _showDraftToast(`✅ Draft সেভ হয়েছে: "${draftName}"`, 'success');
        await renderDraftList();

    } catch (err) {
        console.error('[draft] Save failed:', err);
        _showDraftToast('Draft সেভ করতে সমস্যা হয়েছে।', 'error');
    }
}

// ════════════════════════════════════════════
// সব Draft লিস্ট
// ════════════════════════════════════════════

async function listDrafts() {
    const db = await openDraftDb();
    return new Promise((resolve, reject) => {
        const tx      = db.transaction(DRAFT_STORE, 'readonly');
        const req     = tx.objectStore(DRAFT_STORE).getAll();
        req.onsuccess = () => {
            const all = req.result || [];
            all.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
            resolve(all);
        };
        req.onerror   = () => reject(req.error);
    });
}

// ════════════════════════════════════════════
// একটি Draft লোড
// ════════════════════════════════════════════

async function getDraftById(id) {
    const db = await openDraftDb();
    return new Promise((resolve, reject) => {
        const tx      = db.transaction(DRAFT_STORE, 'readonly');
        const req     = tx.objectStore(DRAFT_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => reject(req.error);
    });
}

async function loadDraft(id) {
    try {
        const draft = await getDraftById(id);
        if (!draft) { _showDraftToast('Draft পাওয়া যায়নি।', 'error'); return; }

        // Base64 → File
        const base64Data = draft.pdfBase64.split(',')[1];
        const binary     = atob(base64Data);
        const bytes      = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob       = new Blob([bytes], { type: 'application/pdf' });
        const file       = new File([blob], draft.fileName || 'draft.pdf', { type: 'application/pdf' });

        // state পুনরুদ্ধার
        textEdits    = JSON.parse(JSON.stringify(draft.textEdits    || []));
        shapeEdits   = JSON.parse(JSON.stringify(draft.shapeEdits   || []));
        clearStrokes = JSON.parse(JSON.stringify(draft.clearStrokes || []));
        if (typeof imageEdits !== 'undefined') {
            imageEdits = JSON.parse(JSON.stringify(draft.imageEdits || []));
        }
        if (draft.pdfScale) pdfScale = draft.pdfScale;

        _currentDraftId = id;

        // PDF লোড
        currentPdfFile = file;
        if (typeof loadAndRenderPDF === 'function') {
            await loadAndRenderPDF(file);
        }

        // undo history রিসেট
        undoHistory = [];
        redoHistory = [];
        if (typeof captureUndoSnapshot === 'function') {
            captureUndoSnapshot('Draft loaded');
        }

        _showDraftToast(`📂 "${draft.name}" লোড হয়েছে।`, 'success');
        closeDraftPanel();

    } catch (err) {
        console.error('[draft] Load failed:', err);
        _showDraftToast('Draft লোড করতে সমস্যা হয়েছে।', 'error');
    }
}

// ════════════════════════════════════════════
// Draft ডিলিট
// ════════════════════════════════════════════

async function deleteDraft(id) {
    const db = await openDraftDb();
    await new Promise((resolve, reject) => {
        const tx  = db.transaction(DRAFT_STORE, 'readwrite');
        const req = tx.objectStore(DRAFT_STORE).delete(id);
        req.onsuccess = resolve;
        req.onerror   = () => reject(req.error);
    });
    if (_currentDraftId === id) _currentDraftId = null;
    await renderDraftList();
    _showDraftToast('Draft মুছে ফেলা হয়েছে।', 'info');
}

// ════════════════════════════════════════════
// Auto-Save
// ════════════════════════════════════════════

function startAutoSave() {
    if (_autoSaveTimer) return;
    _autoSaveTimer = setInterval(async () => {
        if (currentPdfObj && currentPdfFile) {
            await saveDraft();
            _showAutoSavePulse();
        }
    }, AUTOSAVE_INTERVAL_MS);
}

function stopAutoSave() {
    if (_autoSaveTimer) { clearInterval(_autoSaveTimer); _autoSaveTimer = null; }
}

// ════════════════════════════════════════════
// Draft Panel UI
// ════════════════════════════════════════════

function openDraftPanel() {
    const panel = document.getElementById('draftPanel');
    const overlay = document.getElementById('draftPanelOverlay');
    if (!panel) return;
    panel.classList.add('open');
    if (overlay) { overlay.style.display = 'block'; requestAnimationFrame(() => overlay.style.opacity = '1'); }
    renderDraftList();
}

function closeDraftPanel() {
    const panel = document.getElementById('draftPanel');
    const overlay = document.getElementById('draftPanelOverlay');
    if (!panel) return;
    panel.classList.remove('open');
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
}

async function renderDraftList() {
    const listEl = document.getElementById('draftListContainer');
    if (!listEl) return;

    const drafts = await listDrafts();

    if (drafts.length === 0) {
        listEl.innerHTML = `
            <div class="draft-empty">
                <div class="draft-empty-icon">📄</div>
                <p>কোনো draft সেভ নেই।</p>
                <p class="draft-empty-hint">PDF খুলুন এবং "Save Draft" চাপুন।</p>
            </div>`;
        return;
    }

    listEl.innerHTML = drafts.map(d => {
        const date = new Date(d.lastModified).toLocaleString('bn-BD', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const isActive = d.id === _currentDraftId;
        return `
            <div class="draft-item ${isActive ? 'active' : ''}" data-id="${d.id}">
                <div class="draft-item-icon">📝</div>
                <div class="draft-item-info">
                    <div class="draft-item-name" title="${d.name}">${d.name}</div>
                    <div class="draft-item-meta">${d.fileName} · ${date}</div>
                </div>
                <div class="draft-item-actions">
                    <button class="draft-btn-load" title="এই Draft খুলুন" onclick="loadDraft('${d.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </button>
                    <button class="draft-btn-del" title="Draft মুছুন" onclick="confirmDeleteDraft('${d.id}', '${d.name.replace(/'/g, "\\'")}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                </div>
            </div>`;
    }).join('');
}

function confirmDeleteDraft(id, name) {
    if (confirm(`"${name}" draft টি মুছে ফেলবেন?`)) {
        deleteDraft(id);
    }
}

// ════════════════════════════════════════════
// Toast Notification
// ════════════════════════════════════════════

function _showDraftToast(msg, type = 'info') {
    let toast = document.getElementById('draftToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'draftToast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className   = `draft-toast draft-toast-${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function _showAutoSavePulse() {
    const btn = document.getElementById('btnSaveDraft');
    if (!btn) return;
    btn.classList.add('autosave-pulse');
    setTimeout(() => btn.classList.remove('autosave-pulse'), 1500);
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Draft panel বাটন
    const btnOpen  = document.getElementById('btnDraftPanel');
    if (btnOpen) btnOpen.addEventListener('click', openDraftPanel);

    const btnClose = document.getElementById('btnCloseDraftPanel');
    if (btnClose) btnClose.addEventListener('click', closeDraftPanel);

    const btnSave  = document.getElementById('btnSaveDraft');
    if (btnSave) btnSave.addEventListener('click', () => saveDraft());

    // Draft panel overlay click → close
    const overlay = document.getElementById('draftPanelOverlay');
    if (overlay) overlay.addEventListener('click', closeDraftPanel);

    // Auto-save শুরু
    startAutoSave();

    // DB pre-init
    openDraftDb().catch(e => console.warn('[draft] DB init failed:', e));
});
