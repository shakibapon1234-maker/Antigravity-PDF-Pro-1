// ─────────────────────────────────────────────────────────────
// editor/hyperlinks.js — Antigravity PDF Pro
// Interactive Hyperlink Tool: Add, Move, Resize, and Edit Links
// ─────────────────────────────────────────────────────────────

if (typeof window.hyperlinks === 'undefined') {
    window.hyperlinks = [];
}

let _editingLinkId = null;

// ════════════════════════════════════════════
// Open / Close Link Modal
// ════════════════════════════════════════════

function openLinkModal(isEdit = false, linkObj = null) {
    const modal = document.getElementById('linkModal');
    const titleEl = document.getElementById('linkModalTitle');
    const inputEl = document.getElementById('linkUrlInput');
    const deleteBtn = document.getElementById('btnDeleteLink');

    if (!modal) return;

    if (isEdit && linkObj) {
        _editingLinkId = linkObj.id;
        titleEl.textContent = 'হাইপারলিংক পরিবর্তন করুন (Edit Hyperlink)';
        inputEl.value = linkObj.url;
        if (deleteBtn) deleteBtn.style.display = 'block';
    } else {
        _editingLinkId = null;
        titleEl.textContent = 'হাইপারলিংক যোগ করুন (Add Hyperlink)';
        inputEl.value = 'https://';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
    inputEl.focus();
}

function closeLinkModal() {
    const modal = document.getElementById('linkModal');
    if (modal) modal.style.display = 'none';
    _editingLinkId = null;
}

// ════════════════════════════════════════════
// Hyperlink Creation & Rendering
// ════════════════════════════════════════════

function addHyperlink(url) {
    if (!currentPdfObj) {
        alert('কোনো PDF খোলা নেই।');
        return;
    }

    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    if (!pageWrapper) return;

    if (typeof captureUndoSnapshot === 'function') {
        captureUndoSnapshot('Add Hyperlink');
    }

    const link = {
        id: 'link_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        page: currentPageNum,
        x: 100,
        y: 100,
        w: 120,
        h: 28,
        url: url
    };

    window.hyperlinks.push(link);
    _renderHyperlinkElement(link, pageWrapper);
    _selectHyperlink(link.id);
}

function _renderHyperlinkElement(link, pageWrapper) {
    const el = document.createElement('div');
    el.className = 'placed-hyperlink draggable';
    el.dataset.linkId = link.id;

    // Scale position and sizing based on pdfScale
    const scaledX = link.x * pdfScale;
    const scaledY = link.y * pdfScale;
    const scaledW = link.w * pdfScale;
    const scaledH = link.h * pdfScale;

    el.style.cssText = `
        position: absolute;
        left: ${scaledX}px;
        top: ${scaledY}px;
        width: ${scaledW}px;
        height: ${scaledH}px;
        border: 2px dashed #0284c7;
        background-color: rgba(2, 132, 199, 0.15);
        color: #0284c7;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        font-family: 'Outfit', sans-serif;
        font-size: 10px;
        font-weight: 600;
        z-index: 170;
        cursor: move;
        box-sizing: border-box;
        user-select: none;
        overflow: hidden;
        padding: 0 6px;
    `;

    _updateHyperlinkLabel(el, link);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'link-resize-handle';
    resizeHandle.style.cssText = `
        position: absolute; right: 0; bottom: 0;
        width: 8px; height: 8px; background: #0284c7;
        cursor: se-resize; z-index: 171;
    `;
    el.appendChild(resizeHandle);

    pageWrapper.appendChild(el);
    _makeHyperlinkDraggableAndResizable(el, resizeHandle, link, pageWrapper);
}

function _updateHyperlinkLabel(el, link) {
    const displayUrl = link.url.replace(/https?:\/\/(www\.)?/, '');
    el.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; flex-shrink: 0;">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span style="pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width: 100%;">${displayUrl}</span>
    `;
}

function _makeHyperlinkDraggableAndResizable(el, resizeHandle, link, pageWrapper) {
    let startX, startY, startW, startH, startL, startT;
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW  = el.offsetWidth;
        startH  = el.offsetHeight;

        let snapshotCaptured = false;
        const onMove = (ev) => {
            if (!isResizing) return;
            if (!snapshotCaptured) {
                snapshotCaptured = true;
                if (typeof captureUndoSnapshot === 'function') {
                    captureUndoSnapshot('Hyperlink resized');
                }
            }
            const newW = Math.max(40, startW + (ev.clientX - startX));
            const newH = Math.max(16, startH + (ev.clientY - startY));
            el.style.width  = `${newW}px`;
            el.style.height = `${newH}px`;

            link.w = newW / pdfScale;
            link.h = newH / pdfScale;
        };
        const onUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    el.addEventListener('mousedown', (e) => {
        if (e.target === resizeHandle) return;
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        startL = parseFloat(el.style.left) || 0;
        startT = parseFloat(el.style.top)  || 0;

        let hasDragged = false;
        let snapshotCaptured = false;

        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                hasDragged = true;
                if (!snapshotCaptured) {
                    snapshotCaptured = true;
                    if (typeof captureUndoSnapshot === 'function') {
                        captureUndoSnapshot('Hyperlink moved');
                    }
                }
            }

            el.style.left = `${startL + dx}px`;
            el.style.top  = `${startT + dy}px`;

            link.x = (startL + dx) / pdfScale;
            link.y = (startT + dy) / pdfScale;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (!hasDragged) {
                _selectHyperlink(link.id);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openLinkModal(true, link);
    });
}

function _selectHyperlink(id) {
    document.querySelectorAll('.placed-hyperlink').forEach(div => {
        const isActive = div.dataset.linkId === id;
        div.style.borderColor = isActive ? '#ef4444' : '#0284c7';
        div.style.backgroundColor = isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)';
        div.style.color = isActive ? '#ef4444' : '#0284c7';
        const rh = div.querySelector('.link-resize-handle');
        if (rh) rh.style.backgroundColor = isActive ? '#ef4444' : '#0284c7';
    });
}

function _deselectAllHyperlinks() {
    document.querySelectorAll('.placed-hyperlink').forEach(div => {
        div.style.borderColor = '#0284c7';
        div.style.backgroundColor = 'rgba(2, 132, 199, 0.15)';
        div.style.color = '#0284c7';
        const rh = div.querySelector('.link-resize-handle');
        if (rh) rh.style.backgroundColor = '#0284c7';
    });
}

// ════════════════════════════════════════════
// PDF Restore Integration
// ════════════════════════════════════════════

function restoreHyperlinksToDom(pageWrapper) {
    pageWrapper.querySelectorAll('.placed-hyperlink').forEach(el => el.remove());

    if (!window.hyperlinks) window.hyperlinks = [];

    window.hyperlinks.filter(l => l.page === currentPageNum).forEach(link => {
        _renderHyperlinkElement(link, pageWrapper);
    });
}

// ════════════════════════════════════════════
// INIT Event Listeners
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Toolbar Button Click
    const btnLink = document.getElementById('btnLink');
    if (btnLink) {
        btnLink.addEventListener('click', () => {
            if (!currentPdfObj) {
                alert('কোনো PDF খোলা নেই।');
                return;
            }
            deactivateAllTools();
            activeTool = 'link';
            if (typeof updateToolUI === 'function') updateToolUI('btnLink');
            openLinkModal(false);
        });
    }

    // Modal Actions
    const btnClose = document.getElementById('btnCloseLinkModal');
    if (btnClose) btnClose.addEventListener('click', () => {
        closeLinkModal();
        // Return to select tool
        const selectBtn = document.getElementById('btnSelect');
        if (selectBtn) selectBtn.click();
    });

    const btnCancel = document.getElementById('btnCancelLink');
    if (btnCancel) btnCancel.addEventListener('click', () => {
        closeLinkModal();
        // Return to select tool
        const selectBtn = document.getElementById('btnSelect');
        if (selectBtn) selectBtn.click();
    });

    const btnConfirm = document.getElementById('btnLinkConfirm');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            const inputVal = document.getElementById('linkUrlInput').value.trim();
            if (!inputVal) {
                alert('অনুগ্রহ করে একটি ইউআরএল দিন।');
                return;
            }

            if (_editingLinkId) {
                // Edit existing link
                if (typeof captureUndoSnapshot === 'function') {
                    captureUndoSnapshot('Edit Hyperlink URL');
                }
                const link = window.hyperlinks.find(l => l.id === _editingLinkId);
                if (link) {
                    link.url = inputVal;
                    const el = document.querySelector(`.placed-hyperlink[data-link-id="${link.id}"]`);
                    if (el) _updateHyperlinkLabel(el, link);
                }
            } else {
                // Create new link
                addHyperlink(inputVal);
            }

            closeLinkModal();
            // Return to select tool
            const selectBtn = document.getElementById('btnSelect');
            if (selectBtn) selectBtn.click();
        });
    }

    const btnDelete = document.getElementById('btnDeleteLink');
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (!_editingLinkId) return;
            if (confirm('এই হাইপারলিংকটি মুছে ফেলবেন?')) {
                if (typeof captureUndoSnapshot === 'function') {
                    captureUndoSnapshot('Delete Hyperlink');
                }
                window.hyperlinks = window.hyperlinks.filter(l => l.id !== _editingLinkId);
                const el = document.querySelector(`.placed-hyperlink[data-link-id="${_editingLinkId}"]`);
                if (el) el.remove();
                closeLinkModal();
                // Return to select tool
                const selectBtn = document.getElementById('btnSelect');
                if (selectBtn) selectBtn.click();
            }
        });
    }

    // De-selection on body click if tool is select
    document.addEventListener('mousedown', (e) => {
        if (activeTool === 'select') {
            const isLinkEl = e.target.classList.contains('placed-hyperlink') || e.target.closest('.placed-hyperlink');
            const isModal = e.target.closest('#linkModal');
            if (!isLinkEl && !isModal) {
                _deselectAllHyperlinks();
            }
        }
    });
});
