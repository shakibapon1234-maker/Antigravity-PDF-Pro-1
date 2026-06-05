// ─────────────────────────────────────────────────────────────
// editor/signature.js — Antigravity PDF Pro
// Digital Signature: Draw / Type / Upload
// নির্ভর করে: core/state.js, core/undo.js
// ─────────────────────────────────────────────────────────────

// ── Signature State ─────────────────────────────────────────
let _sigMode        = 'draw';   // 'draw' | 'type' | 'upload'
let _sigDrawing     = false;
let _sigLastX       = 0;
let _sigLastY       = 0;
let _sigDataUrl     = null;     // বর্তমান signature preview
let _sigPlacing     = false;    // PDF-এ place করার mode
let _sigPreviewEl   = null;     // floating preview div

// ════════════════════════════════════════════
// Modal খোলা / বন্ধ
// ════════════════════════════════════════════

function openSignatureModal() {
    const modal = document.getElementById('signatureModal');
    if (!modal) return;
    modal.style.display = 'flex';
    _sigDataUrl = null;
    _sigPlacing = false;
    _switchSigTab('draw');
    _clearSigCanvas();
}

function closeSignatureModal() {
    const modal = document.getElementById('signatureModal');
    if (modal) modal.style.display = 'none';
    _cancelSigPlacement();
}

// ════════════════════════════════════════════
// Tab switching
// ════════════════════════════════════════════

function _switchSigTab(mode) {
    _sigMode = mode;
    ['draw', 'type', 'upload'].forEach(m => {
        const btn = document.getElementById(`sigTab_${m}`);
        const pane = document.getElementById(`sigPane_${m}`);
        if (btn)  btn.classList.toggle('active', m === mode);
        if (pane) pane.style.display = m === mode ? 'flex' : 'none';
    });
    _sigDataUrl = null;
    _updateSigPreviewStrip();
}

// ════════════════════════════════════════════
// DRAW TAB — Canvas drawing
// ════════════════════════════════════════════

function _initSigCanvas() {
    const canvas = document.getElementById('sigDrawCanvas');
    if (!canvas || canvas._sigInited) return;
    canvas._sigInited = true;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    const start = (e) => {
        _sigDrawing = true;
        const p = getPos(e);
        _sigLastX = p.x; _sigLastY = p.y;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        e.preventDefault();
    };
    const move = (e) => {
        if (!_sigDrawing) return;
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        _sigLastX = p.x; _sigLastY = p.y;
        e.preventDefault();
    };
    const end = () => {
        if (!_sigDrawing) return;
        _sigDrawing = false;
        _sigDataUrl = canvas.toDataURL('image/png');
        _updateSigPreviewStrip();
    };

    canvas.addEventListener('mousedown',  start);
    canvas.addEventListener('mousemove',  move);
    canvas.addEventListener('mouseup',    end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  move,  { passive: false });
    canvas.addEventListener('touchend',   end);
}

function _clearSigCanvas() {
    const canvas = document.getElementById('sigDrawCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _sigDataUrl = null;
    _updateSigPreviewStrip();
}

// ════════════════════════════════════════════
// TYPE TAB — Text → Canvas render
// ════════════════════════════════════════════

function _renderTypedSig() {
    const input = document.getElementById('sigTypeInput');
    const fontSel = document.getElementById('sigTypeFont');
    const colorEl = document.getElementById('sigTypeColor');
    if (!input) return;

    const text  = input.value.trim();
    const font  = fontSel ? fontSel.value : 'Dancing Script';
    const color = colorEl ? colorEl.value : '#1a1a2e';

    if (!text) { _sigDataUrl = null; _updateSigPreviewStrip(); return; }

    const canvas = document.createElement('canvas');
    canvas.width  = 500;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 500, 150);
    ctx.font      = `56px '${font}', cursive`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';
    ctx.fillText(text, 250, 75);

    _sigDataUrl = canvas.toDataURL('image/png');
    _updateSigPreviewStrip();
}

// ════════════════════════════════════════════
// UPLOAD TAB
// ════════════════════════════════════════════

function _handleSigUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
        _sigDataUrl = reader.result;
        _updateSigPreviewStrip();
    };
    reader.readAsDataURL(file);
}

// ════════════════════════════════════════════
// Preview Strip
// ════════════════════════════════════════════

function _updateSigPreviewStrip() {
    const strip = document.getElementById('sigPreviewStrip');
    if (!strip) return;
    if (_sigDataUrl) {
        strip.innerHTML = `<img src="${_sigDataUrl}" style="max-height:60px; max-width:280px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">`;
        strip.style.display = 'flex';
    } else {
        strip.innerHTML = '';
        strip.style.display = 'none';
    }
}

// ════════════════════════════════════════════
// Place Signature on PDF
// ════════════════════════════════════════════

function _startSigPlacement() {
    if (!_sigDataUrl) {
        alert('আগে signature তৈরি করুন।');
        return;
    }
    if (!currentPdfObj) {
        alert('কোনো PDF খোলা নেই।');
        return;
    }
    closeSignatureModal();

    _sigPlacing = true;
    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    if (!pageWrapper) return;

    pageWrapper.style.cursor = 'crosshair';

    _sigPreviewEl = document.createElement('img');
    _sigPreviewEl.src = _sigDataUrl;
    _sigPreviewEl.style.cssText = `
        position:absolute; width:180px; height:auto; opacity:0.7;
        pointer-events:none; z-index:200; border:2px dashed #6366f1;
        border-radius:4px; display:none;
    `;
    pageWrapper.appendChild(_sigPreviewEl);

    const onMove = (e) => {
        if (!_sigPlacing || !_sigPreviewEl) return;
        const r = pageWrapper.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        _sigPreviewEl.style.left    = `${x}px`;
        _sigPreviewEl.style.top     = `${y}px`;
        _sigPreviewEl.style.display = 'block';
    };

    const onClick = (e) => {
        if (!_sigPlacing) return;
        const r = pageWrapper.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        _placeSig(x, y, pageWrapper);
        _cancelSigPlacement();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('click', onClick);
    };

    const onEsc = (e) => {
        if (e.key === 'Escape') {
            _cancelSigPlacement();
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onEsc);
        }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('click',     onClick);
    document.addEventListener('keydown',   onEsc);
}

function _placeSig(x, y, pageWrapper) {
    if (!_sigDataUrl) return;

    captureUndoSnapshot('Signature placed');

    const sigW = 180;  // px (default width)
    const sigH = 60;

    // Permanent signature div
    const sigEl = document.createElement('div');
    sigEl.className = 'placed-signature draggable';
    sigEl.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        width:${sigW}px; height:auto;
        z-index:200; cursor:move;
    `;
    sigEl.innerHTML = `
        <img src="${_sigDataUrl}" style="width:100%; height:auto; display:block; border-radius:2px;" draggable="false">
        <div class="sig-resize-handle"></div>
    `;
    pageWrapper.appendChild(sigEl);

    // Drag-to-move
    _makeSigDraggable(sigEl, pageWrapper);

    // Store in imageEdits for PDF export
    if (typeof imageEdits !== 'undefined') {
        imageEdits.push({
            page:     currentPageNum,
            x:        x / pdfScale,
            y:        (pageWrapper.offsetHeight - y - sigH) / pdfScale,
            w:        sigW / pdfScale,
            h:        sigH / pdfScale,
            dataUrl:  _sigDataUrl,
            isSig:    true
        });
    }
}

function _cancelSigPlacement() {
    _sigPlacing = false;
    if (_sigPreviewEl) { _sigPreviewEl.remove(); _sigPreviewEl = null; }
    const pw = document.querySelector('.pdf-page-wrapper');
    if (pw) pw.style.cursor = '';
}

// ════════════════════════════════════════════
// Make signature draggable after placing
// ════════════════════════════════════════════

function _makeSigDraggable(el, container) {
    let startX, startY, startL, startT;

    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('sig-resize-handle')) return;
        startX = e.clientX; startY = e.clientY;
        startL = parseFloat(el.style.left) || 0;
        startT = parseFloat(el.style.top)  || 0;

        const onMove = (ev) => {
            el.style.left = `${startL + ev.clientX - startX}px`;
            el.style.top  = `${startT + ev.clientY - startY}px`;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });

    // Right-click = remove
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm('Signature সরিয়ে ফেলবেন?')) {
            el.remove();
        }
    });
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Signature modal বাটন
    const btnSig = document.getElementById('btnSignature');
    if (btnSig) btnSig.addEventListener('click', openSignatureModal);

    const btnClose = document.getElementById('btnCloseSigModal');
    if (btnClose) btnClose.addEventListener('click', closeSignatureModal);

    // Tab buttons
    ['draw', 'type', 'upload'].forEach(m => {
        const btn = document.getElementById(`sigTab_${m}`);
        if (btn) btn.addEventListener('click', () => _switchSigTab(m));
    });

    // Draw tab
    _initSigCanvas();
    const btnClearSig = document.getElementById('btnClearSigCanvas');
    if (btnClearSig) btnClearSig.addEventListener('click', _clearSigCanvas);

    // Type tab
    const typeInput = document.getElementById('sigTypeInput');
    if (typeInput) typeInput.addEventListener('input', _renderTypedSig);
    const fontSel = document.getElementById('sigTypeFont');
    if (fontSel) fontSel.addEventListener('change', _renderTypedSig);
    const colorEl = document.getElementById('sigTypeColor');
    if (colorEl) colorEl.addEventListener('change', _renderTypedSig);

    // Upload tab
    const uploadInput = document.getElementById('sigUploadInput');
    if (uploadInput) uploadInput.addEventListener('change', _handleSigUpload);

    // Place button
    const btnPlace = document.getElementById('btnPlaceSig');
    if (btnPlace) btnPlace.addEventListener('click', _startSigPlacement);

    // Modal overlay click → close
    const modal = document.getElementById('signatureModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeSignatureModal();
        });
    }
});
