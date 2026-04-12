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
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (navBtn) navBtn.classList.add('active');
}

function updateToolUI(activeId) {
    ['btnSelect', 'btnTypeText', 'btnClearText'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === activeId);
    });
}

// ════════════════════════════════════════════
// রঙ রূপান্তর
// ════════════════════════════════════════════

function hexToRgb(hex) {
    if (!hex) return { r: 1, g: 1, b: 1 };
    if (hex.startsWith('rgb')) {
        const p = hex.match(/\d+/g);
        return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255 };
    }
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
    const canvas = pageWrapper.querySelector('canvas');
    if (!canvas) return { r: 1, g: 1, b: 1, hex: '#ffffff' };

    const ctx = canvas.getContext('2d');
    try {
        const overlays = pageWrapper.querySelectorAll('.text-layer, .clear-overlay');
        overlays.forEach(o => { o.style.visibility = 'hidden'; });

        const sz = 40;
        const sx = Math.max(0, Math.round(x) - sz / 2);
        const sy = Math.max(0, Math.round(y) - sz / 2);
        const sw = Math.min(sz, canvas.width  - sx);
        const sh = Math.min(sz, canvas.height - sy);
        const d  = ctx.getImageData(sx, sy, sw, sh).data;

        overlays.forEach(o => { o.style.visibility = ''; });

        const counts = {};
        let maxCount = 0;
        let modeColor = { r: 255, g: 255, b: 255 };

        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 128) {
                const r = d[i]   & 0xF8;
                const g = d[i+1] & 0xF8;
                const b = d[i+2] & 0xF8;
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
