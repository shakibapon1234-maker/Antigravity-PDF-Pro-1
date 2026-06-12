// ─────────────────────────────────────────────
// core/utils.js — Antigravity PDF Pro
// ছোট helper ফাংশন — UI, স্টাইল, রঙ, ক্যানভাস
// নির্ভর করে: core/state.js
// ─────────────────────────────────────────────

// ════════════════════════════════════════════
// ICON ও INIT
// ════════════════════════════════════════════

function safeCreateIcons() {
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

// ════════════════════════════════════════════
// ট্যাব ও টুল সুইচ
// ════════════════════════════════════════════

function openTool(tool) {
    alert(tool.toUpperCase() + ' tool is coming soon!');
}

function switchTab(tabId) {
    // Special case: Compare PDF opens as a floating panel, not a regular tab
    if (tabId === 'compare-pdf') {
        if (window.PdfCompare) {
            PdfCompare.openTool();
        }
        return;
    }
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const section = document.getElementById(tabId);
    if (section) section.classList.add('active');
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (navBtn) navBtn.classList.add('active');
}

// ── Dashboard greeting: reads user name from settings ──────────────────
(function initDashboardGreeting() {
    function applyGreeting(name) {
        const el = document.getElementById('dashboardGreeting');
        if (!el) return;
        const hour = new Date().getHours();
        let timeGreet = 'Good evening';
        if (hour < 12) timeGreet = 'Good morning';
        else if (hour < 17) timeGreet = 'Good afternoon';
        el.textContent = name
            ? `${timeGreet}, ${name}! 👋`
            : `${timeGreet}! 👋`;

        // Update avatar initials
        const avatarEl = document.getElementById('dashboardAvatar');
        if (avatarEl && name) {
            const parts = name.trim().split(/\s+/);
            const initials = parts.length >= 2
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : name.substring(0, 2).toUpperCase();
            avatarEl.textContent = initials;
        }
    }

    async function loadGreeting() {
        try {
            const settings = await window.electronAPI?.storeGet('userSettings');
            applyGreeting(settings?.displayName || '');
        } catch (e) {
            applyGreeting('');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadGreeting);
    } else {
        loadGreeting();
    }
})();


function updateToolUI(activeId) {
    ['btnSelect', 'btnTypeText', 'btnClearText', 'btnCloneArea', 'btnFreehand', 'btnHighlight', 'btnRedact', 'btnMoveArea', 'btnSignature', 'btnWhiteEraser', 'btnLink'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === activeId);
    });
}

function deactivateAllTools() {
    const pw = document.querySelector('.pdf-page-wrapper');
    if (typeof stopFreehand === 'function') stopFreehand(pw);
    if (typeof stopRedactionMode === 'function') stopRedactionMode();
    if (typeof stopHighlightMode === 'function') stopHighlightMode();
    if (typeof _cancelSigPlacement === 'function') _cancelSigPlacement();
    if (typeof deactivateWhiteEraser === 'function') deactivateWhiteEraser();
    
    // Remove active class from all tool buttons
    document.querySelectorAll('.btn-tool').forEach(btn => btn.classList.remove('active'));
}

// ════════════════════════════════════════════
// রঙ রূপান্তর
// ════════════════════════════════════════════

function hexToRgb(hex) {
    if (!hex || hex === 'transparent') return { r: 1, g: 1, b: 1 };
    if (hex.startsWith('rgb')) {
        const p = hex.match(/\d+/g);
        return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255 };
    }
    if (!hex.startsWith('#') || hex.length < 7) return { r: 1, g: 1, b: 1 };
    return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255
    };
}

// ════════════════════════════════════════════
// EDIT ডেটা সিঙ্ক
// ════════════════════════════════════════════

function syncEditData(span, updates) {
    const id = span.dataset.editId || span.dataset.shapeId;
    if (!id) return;

    let edit = textEdits.find(ed =>
        ed.id === id || `${ed.page}-${ed.originalX}-${ed.originalY}` === id);

    if (!edit && typeof shapeEdits !== 'undefined') {
        edit = shapeEdits.find(ed => ed.id === id);
    }

    if (edit) Object.assign(edit, updates);
}

// ════════════════════════════════════════════
// SELECTION
// ════════════════════════════════════════════

function selectTextItem(span) {
    if (selectedTextItem && selectedTextItem !== span)
        selectedTextItem.style.outline = '';
    selectedTextItem = span;
    span.style.outline = '2px solid var(--primary)';

    const id   = span.dataset.editId;
    const edit = textEdits.find(ed =>
        ed.id === id || `${ed.page}-${ed.originalX}-${ed.originalY}` === id);

    if (edit) {
        let fontName = edit.font || currentStyle.fontFamily || 'Helvetica';
        const rawFontName = fontName.replace(/['"]/g, '');
        currentStyle.fontFamily  = rawFontName;
        currentStyle.fontSize    = edit.size  || currentStyle.fontSize;
        currentStyle.color       = edit.color || currentStyle.color;
        currentStyle.isBold      = edit.isBold      || false;
        currentStyle.isItalic    = edit.isItalic    || false;
        currentStyle.isUnderline = edit.isUnderline || false;

        const fontSelect = document.getElementById('fontFamily');
        if (fontSelect) fontSelect.value = rawFontName;
        const fsSel = document.getElementById('fontSize');
        if (fsSel) fsSel.value = currentStyle.fontSize;
        const tcSel = document.getElementById('textColor');
        if (tcSel) tcSel.value = currentStyle.color;
        const btnBold = document.getElementById('btnBold');
        if (btnBold) btnBold.classList.toggle('active', currentStyle.isBold);
        const btnItalic = document.getElementById('btnItalic');
        if (btnItalic) btnItalic.classList.toggle('active', currentStyle.isItalic);
        const btnUnderline = document.getElementById('btnUnderline');
        if (btnUnderline) btnUnderline.classList.toggle('active', currentStyle.isUnderline);
    }
}

function deselectTextItem() {
    if (selectedTextItem) {
        selectedTextItem.style.outline = '';
        selectedTextItem = null;
    }
}

// ════════════════════════════════════════════
// SELECTION-AWARE STYLE (ফ্লোটিং এডিটর)
// ════════════════════════════════════════════

function hasEditorSelection() {
    const ae = document.querySelector('.floating-editor');
    if (!ae) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    return ae.contains(sel.anchorNode);
}

function applyStyleToSelection(cssProp, cssVal) {
    const ae = document.querySelector('.floating-editor');
    if (!ae) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    if (!ae.contains(sel.anchorNode)) return false;

    const range = sel.getRangeAt(0);
    if (cssProp === 'fontWeight')     { document.execCommand('bold',      false, null); return true; }
    if (cssProp === 'fontStyle')      { document.execCommand('italic',    false, null); return true; }
    if (cssProp === 'textDecoration') { document.execCommand('underline', false, null); return true; }
    if (cssProp === 'fontSize') {
        try {
            const span = document.createElement('span');
            span.style.fontSize = cssVal;
            range.surroundContents(span);
            sel.removeAllRanges();
        } catch (e) {
            try {
                const frag = range.extractContents();
                const span = document.createElement('span');
                span.style.fontSize = cssVal;
                span.appendChild(frag);
                range.insertNode(span);
                sel.removeAllRanges();
            } catch (e2) {}
        }
        return true;
    }
    return false;
}

function applyFontSize() {
    const ae = document.querySelector('.floating-editor');
    if (ae) {
        const cssVal = `${currentStyle.fontSize * pdfScale}px`;
        if (hasEditorSelection()) {
            applyStyleToSelection('fontSize', cssVal);
        } else {
            ae.style.fontSize = cssVal;
        }
        return;
    }
    if (selectedTextItem) {
        if (selectedTextItem.classList.contains('pdf-shape-element')) return;
        selectedTextItem.style.fontSize = `${currentStyle.fontSize * pdfScale}px`;
        syncEditData(selectedTextItem, { size: currentStyle.fontSize });
    }
}

function applyToActiveOrSelected(prop, val, applyFn, syncFn) {
    const ae = document.querySelector('.floating-editor');
    if (ae) {
        let cssProp = '';
        let cssVal  = '';
        if (prop === 'bold')      { cssProp = 'fontWeight';     cssVal = val ? 'bold'      : 'normal'; }
        if (prop === 'italic')    { cssProp = 'fontStyle';      cssVal = val ? 'italic'    : 'normal'; }
        if (prop === 'underline') { cssProp = 'textDecoration'; cssVal = val ? 'underline' : 'none'; }

        if (cssProp && hasEditorSelection()) {
            applyStyleToSelection(cssProp, cssVal);
        } else {
            applyFn(ae);
        }
        return;
    }
    if (selectedTextItem) {
        applyFn(selectedTextItem);
        syncEditData(selectedTextItem, syncFn(selectedTextItem));
    }
}

// ════════════════════════════════════════════
// ক্যানভাস ব্যাকগ্রাউন্ড স্যাম্পলিং
// ════════════════════════════════════════════

function sampleBackgroundPatch(x, y, width, height, scale) {
    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    if (!pageWrapper) return null;
    const mainCanvas = pageWrapper.querySelector('canvas');
    if (!mainCanvas) return null;

    const pw = Math.max(1, Math.round(width  * scale));
    const ph = Math.max(1, Math.round(height * scale));
    const px = Math.max(0, Math.round(x * scale));
    const py = Math.max(0, Math.round(y * scale));

    const pc = document.createElement('canvas');
    pc.width  = pw;
    pc.height = ph;
    const ctx = pc.getContext('2d');

    try {
        const overlays = pageWrapper.querySelectorAll('.text-layer, .clear-overlay');
        overlays.forEach(o => { o.style.visibility = 'hidden'; });
        ctx.drawImage(mainCanvas, px, py, pw, ph, 0, 0, pw, ph);
        overlays.forEach(o => { o.style.visibility = ''; });

        const check = ctx.getImageData(0, 0, 1, 1).data;
        if (check[3] === 0) return null;
        return pc.toDataURL('image/png');
    } catch (e) {
        return null;
    }
}

function sampleBackgroundColor(x, y) {
    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    if (!pageWrapper) return { r: 1, g: 1, b: 1, hex: '#ffffff' };

    // ── STRATEGY 1: Use inpainted background canvas (text pixels removed) ──
    // This is the most accurate method since text has been removed via inpainting.
    if (typeof _bgCanvasCache !== 'undefined' && _bgCanvasCache &&
        _bgCanvasCache.pageNum === currentPageNum && _bgCanvasCache.canvas) {
        try {
            const bgCv = _bgCanvasCache.canvas;
            const mainCanvas = pageWrapper.querySelector('canvas');
            if (mainCanvas) {
                const scaleX = bgCv.width / pageWrapper.offsetWidth;
                const scaleY = bgCv.height / pageWrapper.offsetHeight;
                const bx = Math.max(0, Math.min(bgCv.width - 1, Math.round(x * scaleX)));
                const by = Math.max(0, Math.min(bgCv.height - 1, Math.round(y * scaleY)));
                const bgCtx = bgCv.getContext('2d', { willReadFrequently: true });
                // Sample a larger area from the clean bg canvas
                const sz = 60;
                const sx = Math.max(0, bx - sz / 2);
                const sy = Math.max(0, by - sz / 2);
                const sw = Math.min(sz, bgCv.width - sx);
                const sh = Math.min(sz, bgCv.height - sy);
                if (sw >= 1 && sh >= 1) {
                    const d = bgCtx.getImageData(sx, sy, sw, sh).data;
                    // Average all non-transparent pixels (text already removed)
                    let tr = 0, tg = 0, tb = 0, cnt = 0;
                    for (let i = 0; i < d.length; i += 4) {
                        if (d[i + 3] > 128) {
                            tr += d[i]; tg += d[i + 1]; tb += d[i + 2]; cnt++;
                        }
                    }
                    if (cnt > 0) {
                        const ar = Math.round(tr / cnt);
                        const ag = Math.round(tg / cnt);
                        const ab = Math.round(tb / cnt);
                        const hex = '#' + [ar, ag, ab].map(v => v.toString(16).padStart(2, '0')).join('');
                        return { r: ar / 255, g: ag / 255, b: ab / 255, hex };
                    }
                }
            }
        } catch (e) {
            // Fall through to strategy 2
        }
    }

    // ── STRATEGY 2: Sample from main canvas, skip dark text pixels ──
    const canvas = pageWrapper.querySelector('canvas');
    if (!canvas) return { r: 1, g: 1, b: 1, hex: '#ffffff' };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
        const overlays = pageWrapper.querySelectorAll('.text-layer, .clear-overlay, .clear-patch, .pdf-image-wrapper');
        overlays.forEach(o => { o.style.visibility = 'hidden'; });

        const scaleX = canvas.width / pageWrapper.offsetWidth;
        const scaleY = canvas.height / pageWrapper.offsetHeight;
        const px = x * scaleX;
        const py = y * scaleY;

        // Use a larger sampling area (80x80) for more accurate background detection
        const sz = 80;
        const sx = Math.max(0, Math.round(px) - sz / 2);
        const sy = Math.max(0, Math.round(py) - sz / 2);
        const sw = Math.min(sz, canvas.width  - sx);
        const sh = Math.min(sz, canvas.height - sy);
        
        // Ensure width and height are at least 1 pixel
        if (sw < 1 || sh < 1) return { r: 1, g: 1, b: 1, hex: '#ffffff' };

        const d  = ctx.getImageData(sx, sy, sw, sh).data;

        overlays.forEach(o => { o.style.visibility = ''; });

        const counts = {};
        let maxCount = 0;
        let modeColor = { r: 255, g: 255, b: 255 };

        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 128) {
                // FIXED: Skip dark pixels (likely text characters) to avoid
                // text color polluting the background color detection
                const lum = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
                if (lum < 100) continue; // skip dark text pixels

                const r = d[i]   & 0xF0;
                const g = d[i+1] & 0xF0;
                const b = d[i+2] & 0xF0;
                const key = `${r},${g},${b}`;
                counts[key] = (counts[key] || 0) + 1;
                if (counts[key] > maxCount) {
                    maxCount = counts[key];
                    modeColor = { r: d[i], g: d[i+1], b: d[i+2] };
                }
            }
        }

        if (maxCount === 0) return { r: 1, g: 1, b: 1, hex: '#ffffff' };
        const hex = '#' + [modeColor.r, modeColor.g, modeColor.b]
            .map(v => v.toString(16).padStart(2, '0')).join('');
        return { r: modeColor.r / 255, g: modeColor.g / 255, b: modeColor.b / 255, hex };
    } catch (e) {
        return { r: 1, g: 1, b: 1, hex: '#ffffff' };
    }
}
