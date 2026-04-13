// ══════════════════════════════════════════════════════════════════════════════
// Antigravity PDF Editor — Eyedropper & White Eraser (v3)
//
// Eyedropper flow:
//   1. "Pick A" বা "Pick BG" বাটনে ক্লিক → eyedropper cursor চালু
//   2. PDF এর যেকোনো রঙে ক্লিক → সেই রঙ copied/stored
//   3. তারপর টেক্সট বা BG color input এ ক্লিক → stored রঙ paste হয়
//   4. Escape → cancel
//
// White Eraser:
//   Drag করলে সেই আয়তাকার এলাকা সম্পূর্ণ সাদা হয়ে যাবে
//   সাদা জায়গায় নতুন text লেখা যাবে
//   Escape → cancel
// ══════════════════════════════════════════════════════════════════════════════

/* ─── Eyedropper State ───────────────────────────────────────────────────────── */

// Fallback listener refs (cleanup এর জন্য)

/* ─── Eraser State ───────────────────────────────────────────────────────────── */

// ══════════════════════════════════════════════════════════════════════════════
//  EYEDROPPER — PICK PHASE
//  বাটনে ক্লিক করলে eyedropper mode চালু হয়, PDF তে ক্লিক করলে কালার pick হয়
// ══════════════════════════════════════════════════════════════════════════════

/**
 * startEyedropper(targetField)
 * ─────────────────────────────
 * Eyedropper mode চালু করে।
 * targetField: 'text' বা 'bg' — কোন বাটন থেকে ডাকা হয়েছে সেটা মনে রাখে
 * কিন্তু এখন apply সরাসরি হয় না — user পরে যেকোনো color input এ ক্লিক করলে paste হয়।
 */
function startEyedropper(targetField) {
    // অন্য tool বন্ধ
    if (whiteEraserActive) deactivateWhiteEraser();

    _eyeTarget = targetField;
    _eyeMode   = 'picking';
    _eyePickedColor = null;

    // button highlight
    _eyeSetBtnActive(targetField, true);
    _showEyeStatus('picking', null);

    // ── Native EyeDropper API (Chrome 95+) ─────────────────────────────────
    // এটা পুরো screen থেকে pick করতে পারে, browser নিজেই eyedropper cursor দেয়
    if (window.EyeDropper) {
        const picker = new EyeDropper();
        picker.open()
            .then(result => {
                const hex = result.sRGBHex;
                _eyePickedColor = hex;
                _eyeMode = 'picked';
                _eyeSetBtnActive(targetField, false);
                _showEyeStatus('picked', hex);
                // Native API তে ক্লিক মানেই pick হয়ে গেছে
                // এখন color input এ ক্লিক করলে paste হবে — সেটা _installPasteListeners() করে
                _installPasteListeners();
            })
            .catch(() => {
                _eyeCancel();
            });
        return;
    }

    // ── Fallback: canvas pixel picker ───────────────────────────────────────
    _startFallbackPicker(targetField);
}

/**
 * _startFallbackPicker(targetField)
 * ──────────────────────────────────
 * Native API না থাকলে:
 * PDF canvas এর উপরে hover করলে preview দেখায়, ক্লিক করলে কালার pick হয়।
 * cursor: crosshair (ছোট)।
 */
function _startFallbackPicker(targetField) {
    const cw = document.getElementById('canvasWrapper');
    const pw = document.querySelector('.pdf-page-wrapper');

    // Crosshair cursor — ছোট এবং সঠিক
    if (cw) cw.style.cursor = 'crosshair';
    if (pw) pw.style.cursor = 'crosshair';
    document.body.style.cursor = '';  // body তে কোনো cursor override না

    // ── Hover tooltip (ছোট) ─────────────────────────────────────────────────
    let tip = document.getElementById('_eyeTip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = '_eyeTip';
        tip.style.cssText = `
            position:fixed; pointer-events:none; z-index:999999;
            background:rgba(14,14,26,0.93);
            border:1.5px solid rgba(255,255,255,0.15);
            border-radius:7px; padding:4px 10px;
            display:none; align-items:center; gap:7px;
            font-family:'Outfit',monospace; font-size:12px; color:#fff;
            box-shadow:0 3px 14px rgba(0,0,0,0.55);
            white-space:nowrap; transform:translate(16px,-50%);
        `;
        document.body.appendChild(tip);
    }

    function _updateTip(e) {
        const hex = _sampleAt(e.clientX, e.clientY);
        tip.style.left    = e.clientX + 'px';
        tip.style.top     = e.clientY + 'px';
        tip.style.display = 'flex';
        tip.innerHTML = `
            <span style="width:13px;height:13px;border-radius:3px;
                background:${hex};border:1px solid rgba(255,255,255,0.3);
                flex-shrink:0;display:inline-block;"></span>
            <span>${hex.toUpperCase()}</span>`;
    }

    _eyeMoveListener = (e) => { if (_eyeMode === 'picking') _updateTip(e); };

    _eyeClickListener = (e) => {
        if (_eyeMode !== 'picking') return;
        // PDF canvas এর বাইরে ক্লিক → cancel
        const canvas = document.querySelector('.pdf-page-wrapper canvas');
        if (canvas) {
            const r = canvas.getBoundingClientRect();
            if (e.clientX < r.left - 5 || e.clientX > r.right + 5 ||
                e.clientY < r.top  - 5 || e.clientY > r.bottom + 5) {
                _eyeCancel(); return;
            }
        }
        const hex = _sampleAt(e.clientX, e.clientY);
        _eyePickedColor = hex;
        _eyeMode = 'picked';

        // cursor reset
        if (cw) cw.style.cursor = 'crosshair';
        if (pw) pw.style.cursor = '';
        tip.style.display = 'none';

        _eyeSetBtnActive(targetField, false);
        _showEyeStatus('picked', hex);
        _installPasteListeners();

        // listeners cleanup
        document.removeEventListener('mousemove', _eyeMoveListener, true);
        document.removeEventListener('click',     _eyeClickListener, true);
        document.removeEventListener('keydown',   _eyeKeyListener,  true);

        e.stopPropagation();
        e.preventDefault();
    };

    _eyeKeyListener = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); _eyeCancel(); }
    };

    document.addEventListener('mousemove', _eyeMoveListener,  true);
    document.addEventListener('click',     _eyeClickListener, true);
    document.addEventListener('keydown',   _eyeKeyListener,   true);
}

// ══════════════════════════════════════════════════════════════════════════════
//  EYEDROPPER — PASTE PHASE
//  কালার picked হওয়ার পরে, color input এ ক্লিক করলে সেখানে paste হয়
// ══════════════════════════════════════════════════════════════════════════════


/**
 * _installPasteListeners()
 * ─────────────────────────
 * 'picked' phase এ: user এখন যেকোনো color input এ ক্লিক করলে picked color paste হবে।
 * Escape → cancel।
 */
function _installPasteListeners() {
    _removePasteListeners(); // পুরনো listeners সরিয়ে দাও

    _eyePasteClickListener = (e) => {
        if (_eyeMode !== 'picked') return;

        // টেক্সট color input এ ক্লিক করলে
        const txtColorInput = document.getElementById('textColor');
        const bgColorInput  = document.getElementById('bgColor');
        const btnEyeText    = document.getElementById('btnEyedropperText');
        const btnEyeBg      = document.getElementById('btnEyedropperBg');

        let pasteTarget = null;

        if (e.target === txtColorInput || e.target.closest && e.target.closest('.color-picker-wrapper') === txtColorInput?.closest('.color-picker-wrapper')) {
            // text color wrapper এ ক্লিক
            const wrapper = txtColorInput?.closest('.color-picker-wrapper');
            if (wrapper && (e.target === txtColorInput || wrapper.contains(e.target))) {
                pasteTarget = 'text';
            }
        }

        if (!pasteTarget) {
            if (e.target === bgColorInput || e.target.closest && e.target.closest('.color-picker-wrapper') === bgColorInput?.closest('.color-picker-wrapper')) {
                const wrapper = bgColorInput?.closest('.color-picker-wrapper');
                if (wrapper && (e.target === bgColorInput || wrapper.contains(e.target))) {
                    pasteTarget = 'bg';
                }
            }
        }

        // "Pick A" বা "Pick BG" বাটনে আবার ক্লিক করলে সেখানে paste
        if (!pasteTarget && e.target.id === 'btnEyedropperText') pasteTarget = 'text';
        if (!pasteTarget && e.target.id === 'btnEyedropperBg')   pasteTarget = 'bg';
        if (!pasteTarget && e.target.closest && e.target.closest('#btnEyedropperText')) pasteTarget = 'text';
        if (!pasteTarget && e.target.closest && e.target.closest('#btnEyedropperBg'))   pasteTarget = 'bg';

        if (pasteTarget) {
            e.stopPropagation();
            e.preventDefault();
            _applyPickedColor(_eyePickedColor, pasteTarget);
            _eyeCancel();
            return;
        }

        // অন্য জায়গায় ক্লিক করলে আবার picking mode চালু (নতুন কালার pick করতে পারবে)
        // অথবা সম্পূর্ণ cancel করতে Escape চাপবে
        // এখানে cancel না করে রাখা হয়েছে যাতে user আরেকবার pick করতে পারে
    };

    _eyePasteKeyListener = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); _eyeCancel(); }
    };

    document.addEventListener('click',   _eyePasteClickListener, true);
    document.addEventListener('keydown', _eyePasteKeyListener,   true);
}

function _removePasteListeners() {
    if (_eyePasteClickListener) {
        document.removeEventListener('click',   _eyePasteClickListener, true);
        _eyePasteClickListener = null;
    }
    if (_eyePasteKeyListener) {
        document.removeEventListener('keydown', _eyePasteKeyListener, true);
        _eyePasteKeyListener = null;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  APPLY / CANCEL / HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * _applyPickedColor(hex, targetField)
 * ─────────────────────────────────────
 * Picked color কে text বা bg color এ apply করে।
 */
function _applyPickedColor(hex, targetField) {
    if (!hex) return;
    if (!hex.startsWith('#')) hex = '#' + hex;

    if (targetField === 'bg') {
        currentStyle.bgColor = hex;
        const inp = document.getElementById('bgColor');
        if (inp) inp.value = hex;
        const ae = document.querySelector('.floating-editor');
        if (ae) {
            ae.style.backgroundColor = hex;
        } else if (typeof selectedTextItem !== 'undefined' && selectedTextItem) {
            selectedTextItem.style.backgroundColor = hex;
            if (typeof syncEditData === 'function') syncEditData(selectedTextItem, { bgHex: hex });
        }
    } else {
        currentStyle.color = hex;
        const inp = document.getElementById('textColor');
        if (inp) inp.value = hex;
        const ae = document.querySelector('.floating-editor');
        if (ae) {
            ae.style.color = hex;
        } else if (typeof selectedTextItem !== 'undefined' && selectedTextItem) {
            selectedTextItem.style.color = hex;
            if (typeof syncEditData === 'function') syncEditData(selectedTextItem, { color: hex });
        }
    }

    _showColorToast(hex, targetField);
}

/**
 * _eyeCancel()
 * ─────────────
 * সব eyedropper state reset করে।
 */
function _eyeCancel() {
    _eyeMode        = 'idle';
    _eyePickedColor = null;

    // listeners সরানো
    if (_eyeMoveListener)  { document.removeEventListener('mousemove', _eyeMoveListener,  true); _eyeMoveListener = null; }
    if (_eyeClickListener) { document.removeEventListener('click',     _eyeClickListener, true); _eyeClickListener = null; }
    if (_eyeKeyListener)   { document.removeEventListener('keydown',   _eyeKeyListener,   true); _eyeKeyListener = null; }
    _removePasteListeners();

    // cursor reset
    const cw = document.getElementById('canvasWrapper');
    const pw = document.querySelector('.pdf-page-wrapper');
    if (cw) cw.style.cursor = 'crosshair';
    if (pw) pw.style.cursor = '';
    document.body.style.cursor = '';

    // tooltip hide
    const tip = document.getElementById('_eyeTip');
    if (tip) tip.style.display = 'none';

    // status badge সরানো
    _showEyeStatus('idle', null);

    // button highlights সরানো
    ['btnEyedropperText', 'btnEyedropperBg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
}

/**
 * _sampleAt(clientX, clientY)
 * ────────────────────────────
 * PDF canvas এর pixel থেকে hex color বের করে।
 */
function _sampleAt(clientX, clientY) {
    const pw = document.querySelector('.pdf-page-wrapper');
    if (!pw) return '#ffffff';
    const canvas = pw.querySelector('canvas');
    if (!canvas) return '#ffffff';

    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    const px = Math.round((clientX - r.left) * sx);
    const py = Math.round((clientY - r.top)  * sy);

    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return '#ffffff';

    try {
        const overlays = pw.querySelectorAll('.text-layer,.clear-overlay,.clear-patch,.white-erase-patch');
        overlays.forEach(o => { o.style.visibility = 'hidden'; });
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const d   = ctx.getImageData(px, py, 1, 1).data;
        overlays.forEach(o => { o.style.visibility = ''; });
        return '#' + [d[0],d[1],d[2]].map(v => v.toString(16).padStart(2,'0')).join('');
    } catch(e) { return '#ffffff'; }
}

/**
 * _eyeSetBtnActive(targetField, active)
 */
function _eyeSetBtnActive(targetField, active) {
    const id  = targetField === 'bg' ? 'btnEyedropperBg' : 'btnEyedropperText';
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', active);
}

/**
 * _showEyeStatus(phase, hex)
 * ───────────────────────────
 * Toolbar এর নিচে একটা ছোট status bar দেখায়:
 * - picking: "কোনো রঙে ক্লিক করুন"
 * - picked:  "✓ রঙ copied! এখন Text বা BG color এ ক্লিক করুন"
 * - idle:    সরিয়ে দেয়
 */
function _showEyeStatus(phase, hex) {
    let bar = document.getElementById('_eyeStatusBar');

    if (phase === 'idle') {
        if (bar) bar.style.display = 'none';
        return;
    }

    if (!bar) {
        bar = document.createElement('div');
        bar.id = '_eyeStatusBar';
        bar.style.cssText = `
            position:fixed; top:0; left:50%; transform:translateX(-50%);
            z-index:999998; padding:7px 20px;
            border-radius:0 0 12px 12px;
            font-family:'Outfit',sans-serif; font-size:13px; font-weight:500;
            display:flex; align-items:center; gap:10px;
            box-shadow:0 4px 20px rgba(0,0,0,0.4);
            transition: background 0.3s;
            pointer-events:none;
        `;
        document.body.appendChild(bar);
    }

    if (phase === 'picking') {
        bar.style.display    = 'flex';
        bar.style.background = 'linear-gradient(90deg,#1a1a2e,#2a1a4e)';
        bar.style.color      = '#fff';
        bar.style.border     = '1px solid rgba(184,41,249,0.4)';
        bar.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b829f9" stroke-width="2">
                <path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8"/>
            </svg>
            <span>PDF এর যেকোনো রঙে <strong>ক্লিক</strong> করুন • <kbd style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:4px;">Esc</kbd> = বাতিল</span>
        `;
    } else if (phase === 'picked') {
        bar.style.display    = 'flex';
        bar.style.background = 'linear-gradient(90deg,#0a2a1a,#0a3a1a)';
        bar.style.color      = '#fff';
        bar.style.border     = '1px solid rgba(0,255,136,0.4)';
        bar.innerHTML = `
            <span style="width:16px;height:16px;border-radius:4px;background:${hex};
                border:1.5px solid rgba(255,255,255,0.4);display:inline-block;flex-shrink:0;"></span>
            <span>✓ <strong>${hex.toUpperCase()}</strong> picked! এখন
                <strong style="color:#00ff88;">Text Color</strong> বা
                <strong style="color:#ff9933;">BG Color</strong> বাটনে ক্লিক করুন •
                <kbd style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:4px;">Esc</kbd> = বাতিল</span>
        `;
    }
}

/**
 * _showColorToast(hex, targetField)
 * ───────────────────────────────────
 * Apply হওয়ার পরে একটা ছোট confirmation toast।
 */
function _showColorToast(hex, targetField) {
    let t = document.getElementById('_colToast');
    if (!t) {
        t = document.createElement('div');
        t.id = '_colToast';
        t.style.cssText = `
            position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
            background:#1a1a2e; border:1px solid rgba(255,255,255,0.15);
            border-radius:12px; padding:9px 16px;
            display:flex; align-items:center; gap:10px; z-index:99999;
            box-shadow:0 8px 32px rgba(0,0,0,0.5);
            font-family:'Outfit',sans-serif; color:#fff; font-size:13px;
            transition:opacity .4s; opacity:0;
        `;
        document.body.appendChild(t);
    }
    t.innerHTML = `
        <span style="width:20px;height:20px;border-radius:4px;background:${hex};
            border:1.5px solid rgba(255,255,255,0.3);display:inline-block;"></span>
        <strong>${targetField === 'bg' ? 'BG Color' : 'Text Color'}</strong> →
        <span style="font-family:monospace;letter-spacing:1px;">${hex.toUpperCase()}</span>
        <button onclick="navigator.clipboard.writeText('${hex}').catch(()=>{})"
            style="background:rgba(255,255,255,0.1);border:none;color:#fff;
            padding:2px 9px;border-radius:5px;cursor:pointer;font-size:11px;">Copy</button>
    `;
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ══════════════════════════════════════════════════════════════════════════════
//  WHITE ERASER  (unchanged from v2 — ঠিকঠাক কাজ করছে)
// ══════════════════════════════════════════════════════════════════════════════

function activateWhiteEraser() {
    if (_eyeMode !== 'idle') _eyeCancel();

    whiteEraserActive = true;
    activeTool = 'whiteEraser';
    _weUpdateToolbar('btnWhiteEraser');

    // Eraser icon cursor
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/><path d='M22 21H7'/><path d='m5 11 9 9'/></svg>`;
    const cur = `url("data:image/svg+xml,${svg}") 2 18, crosshair`;
    const cw = document.getElementById('canvasWrapper');
    if (cw) cw.style.cursor = cur;
    const pw = document.querySelector('.pdf-page-wrapper');
    if (pw) pw.style.cursor = cur;
}

function deactivateWhiteEraser() {
    whiteEraserActive = false;
    _weIsDrawing = false;
    if (_weRectEl) { _weRectEl.remove(); _weRectEl = null; }
    _weContainer = null;
    const cw = document.getElementById('canvasWrapper');
    if (cw) cw.style.cursor = 'crosshair';
    const pw = document.querySelector('.pdf-page-wrapper');
    if (pw) pw.style.cursor = '';
    _weUpdateToolbar(null);
}

function _weUpdateToolbar(activeId) {
    ['btnSelect','btnTypeText','btnClearText','btnWhiteEraser'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === activeId);
    });
}

function _weOnMouseDown(e, container) {
    if (activeTool !== 'whiteEraser' || e.button !== 0) return false;
    if (e.target.closest('.shape-toolbar,.floating-editor,.floating-editor-handle')) return false;

    const rect = container.getBoundingClientRect();
    _weStartX    = e.clientX - rect.left;
    _weStartY    = e.clientY - rect.top;
    _weIsDrawing = true;
    _weContainer = container;

    _weRectEl = document.createElement('div');
    _weRectEl.style.cssText = `
        position:absolute; left:${_weStartX}px; top:${_weStartY}px;
        width:0; height:0;
        background:rgba(255,255,255,0.18);
        border:2px dashed rgba(255,255,255,0.8);
        box-shadow:0 0 0 1px rgba(0,0,0,0.2);
        pointer-events:none; z-index:300; box-sizing:border-box; border-radius:2px;
    `;
    container.appendChild(_weRectEl);

    document.addEventListener('mousemove', _weDocMove);
    document.addEventListener('mouseup',   _weDocUp);

    e.preventDefault();
    e.stopPropagation();
    return true;
}

function _weDocMove(e) {
    if (!_weIsDrawing || !_weRectEl || !_weContainer) return;
    const r  = _weContainer.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    _weRectEl.style.left   = `${Math.min(_weStartX, cx)}px`;
    _weRectEl.style.top    = `${Math.min(_weStartY, cy)}px`;
    _weRectEl.style.width  = `${Math.abs(cx - _weStartX)}px`;
    _weRectEl.style.height = `${Math.abs(cy - _weStartY)}px`;
}

function _weDocUp(e) {
    document.removeEventListener('mousemove', _weDocMove);
    document.removeEventListener('mouseup',   _weDocUp);

    if (!_weIsDrawing || !_weRectEl || !_weContainer) { _weIsDrawing = false; return; }
    _weIsDrawing = false;

    const l = parseFloat(_weRectEl.style.left)  || 0;
    const t = parseFloat(_weRectEl.style.top)   || 0;
    const w = parseFloat(_weRectEl.style.width)  || 0;
    const h = parseFloat(_weRectEl.style.height) || 0;

    _weRectEl.remove(); _weRectEl = null;
    const cont = _weContainer; _weContainer = null;
    if (w < 4 || h < 4) return;
    _commitWhiteErase(cont, l, t, w, h);
}

function _commitWhiteErase(container, l, t, w, h) {
    if (typeof captureUndoSnapshot === 'function') captureUndoSnapshot('White Erase');

    // ── সাদা div ─────────────────────────────────────────────────────────────
    const wd = document.createElement('div');
    wd.className = 'white-erase-patch';
    wd.style.cssText = `
        position:absolute; left:${l}px; top:${t}px;
        width:${w}px; height:${h}px;
        background:#ffffff; pointer-events:none; z-index:6;
    `;
    container.appendChild(wd);

    // ── text spans clear ──────────────────────────────────────────────────────
    const cr = container.getBoundingClientRect();
    container.querySelectorAll('.editable-text-unit').forEach(span => {
        if (span.classList.contains('floating-editor')) return;
        const sr = span.getBoundingClientRect();
        const sl = sr.left - cr.left;
        const st = sr.top  - cr.top;
        const sw = sr.width  || span.offsetWidth  || 30;
        const sh = sr.height || span.offsetHeight || 14;

        if (sl < l + w && sl + sw > l && st < t + h && st + sh > t) {
            span._cleared = true; span._textCleared = true;
            span.textContent = '';
            span.style.color           = 'transparent';
            span.style.backgroundColor = 'transparent';
            span.style.backgroundImage = 'none';
            span.style.pointerEvents   = 'auto';

            const editId = span.dataset.editId
                || `we-${currentPageNum}-${Math.round(sl)}-${Math.round(st)}`;
            const entry = {
                id: editId, page: currentPageNum, isNew: false,
                originalX: sl/pdfScale, originalY: (container.offsetHeight-st-sh)/pdfScale,
                x: sl/pdfScale, y: (container.offsetHeight-st-sh)/pdfScale,
                text:'', size: parseFloat(span.style.fontSize)/pdfScale||12,
                color:'transparent', bgHex:'#ffffff', bgR:1,bgG:1,bgB:1,
                font:'Helvetica', isBold:false, isItalic:false, isUnderline:false,
                width: sw/pdfScale, height: sh/pdfScale
            };
            const idx = textEdits.findIndex(ed =>
                ed.id === editId ||
                `${ed.page}-${ed.originalX}-${ed.originalY}` === editId);
            if (idx > -1) textEdits[idx] = entry; else textEdits.push(entry);
        }
    });

    // ── clearStrokes record ───────────────────────────────────────────────────
    let pe = clearStrokes.find(s => s.page === currentPageNum);
    if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
    pe.rects.push({
        x:l/pdfScale, y:(container.offsetHeight-t-h)/pdfScale,
        w:w/pdfScale, h:h/pdfScale,
        r:1,g:1,b:1, patch:null, isWhiteErase:true
    });

    if (typeof updateUndoButtonState === 'function') updateUndoButtonState();
}

// ══════════════════════════════════════════════════════════════════════════════
//  ESCAPE KEY  — দুটো tool ই Escape এ বন্ধ
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (_eyeMode !== 'idle') {
        e.stopPropagation();
        _eyeCancel();
        return;
    }
    if (whiteEraserActive) {
        e.stopPropagation();
        deactivateWhiteEraser();
        activeTool = 'text';
        if (typeof updateToolUI === 'function') updateToolUI('btnTypeText');
    }
}, true);

// ══════════════════════════════════════════════════════════════════════════════
//  MONKEY-PATCH handlePageMouseDown
// ══════════════════════════════════════════════════════════════════════════════

function _hookMouseHandlers() {
    if (typeof window.handlePageMouseDown !== 'function') {
        setTimeout(_hookMouseHandlers, 300);
        return;
    }
    const _orig = window.handlePageMouseDown;
    window.handlePageMouseDown = function(e, container, viewport, page) {
        if (activeTool === 'whiteEraser') {
            _weOnMouseDown(e, container);
            return;
        }
        _orig.call(this, e, container, viewport, page);
    };
    console.log('[EyedropperEraser v3] hooked ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
//  TOOLBAR BUTTON WIRING
// ══════════════════════════════════════════════════════════════════════════════

function initEyedropperAndEraser() {
    // Pick A (text color eyedropper)
    const btnET = document.getElementById('btnEyedropperText');
    if (btnET) {
        btnET.addEventListener('click', (e) => {
            e.stopPropagation();
            if (_eyeMode !== 'idle') { _eyeCancel(); return; }
            startEyedropper('text');
        });
    }

    // Pick BG (bg color eyedropper)
    const btnEB = document.getElementById('btnEyedropperBg');
    if (btnEB) {
        btnEB.addEventListener('click', (e) => {
            e.stopPropagation();
            if (_eyeMode !== 'idle') { _eyeCancel(); return; }
            startEyedropper('bg');
        });
    }

    // White Eraser
    const btnWE = document.getElementById('btnWhiteEraser');
    if (btnWE) {
        btnWE.addEventListener('click', () => {
            if (whiteEraserActive) {
                deactivateWhiteEraser();
                activeTool = 'text';
                if (typeof updateToolUI === 'function') updateToolUI('btnTypeText');
            } else {
                activateWhiteEraser();
            }
        });
    }

    // color input এ ক্লিক করলে picked color paste (যদি picked mode এ থাকে)
    // এটা _installPasteListeners() এর মাধ্যমে handle হয়, তবে color picker wrapper এও handle করা হচ্ছে
    const textColorWrapper = document.getElementById('textColor')?.closest('.color-picker-wrapper');
    const bgColorWrapper   = document.getElementById('bgColor')?.closest('.color-picker-wrapper');

    if (textColorWrapper) {
        textColorWrapper.addEventListener('click', (e) => {
            if (_eyeMode === 'picked') {
                e.stopPropagation();
                e.preventDefault();
                _applyPickedColor(_eyePickedColor, 'text');
                _eyeCancel();
            }
        }, true);
    }

    if (bgColorWrapper) {
        bgColorWrapper.addEventListener('click', (e) => {
            if (_eyeMode === 'picked') {
                e.stopPropagation();
                e.preventDefault();
                _applyPickedColor(_eyePickedColor, 'bg');
                _eyeCancel();
            }
        }, true);
    }

    _hookMouseHandlers();
    console.log('[EyedropperEraser v3] Init ✓');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initEyedropperAndEraser, 400));
} else {
    setTimeout(initEyedropperAndEraser, 400);
}
