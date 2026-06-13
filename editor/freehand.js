// ─────────────────────────────────────────────────────────────
// editor/freehand.js — Antigravity PDF Pro
// Freehand Drawing (Pencil), Highlight, Redaction
// নির্ভর করে: core/state.js, core/undo.js
// ─────────────────────────────────────────────────────────────

// ════════════════════════════════════════════
// Freehand Pencil Tool
// ════════════════════════════════════════════

let _fhActive     = false;
let _fhDrawing    = false;
let _fhCanvas     = null;
let _fhCtx        = null;
let _fhColor      = '#e53e3e';
let _fhSize       = 3;
let _fhPaths      = [];      // all drawn paths stored for undo
let _fhCurrentPts = [];
let _fhStartPt    = null;   // for Shift straight-line mode
let _fhLastShift  = false;  // was previous mousemove in shift-mode?
let _fhDocUpHandler = null; // document-level mouseup for out-of-canvas release

function startFreehand(pageWrapper) {
    if (_fhActive) { stopFreehand(pageWrapper); return; }
    _fhActive = true;

    // Remove any static snapshot canvas left from when the tool was inactive
    const existingStatic = pageWrapper.querySelector('.fh-static-canvas');
    if (existingStatic) existingStatic.remove();

    // Remove any stale interactive canvas
    if (_fhCanvas) { _fhCanvas.remove(); _fhCanvas = null; _fhCtx = null; }

    // Create overlay canvas
    _fhCanvas = document.createElement('canvas');
    _fhCanvas.className = 'freehand-canvas';
    _fhCanvas.width     = pageWrapper.offsetWidth;
    _fhCanvas.height    = pageWrapper.offsetHeight;
    _fhCanvas.style.cssText = `
        position:absolute; left:0; top:0;
        width:100%; height:100%;
        z-index:150; cursor:crosshair;
        pointer-events:auto;
        touch-action:none;
    `;
    pageWrapper.appendChild(_fhCanvas);
    _fhCtx = _fhCanvas.getContext('2d');

    // Redraw all existing paths on the new canvas
    _fhRedraw();

    const getXY = (e) => {
        const r = _fhCanvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    // Helper: constrain point to straight line from start (Shift key)
    const constrainToLine = (start, end) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        // If mostly horizontal → lock Y; if mostly vertical → lock X; else 45°
        if (adx > ady * 2) return { x: end.x, y: start.y };           // horizontal
        if (ady > adx * 2) return { x: start.x, y: end.y };           // vertical
        const d = Math.min(adx, ady);
        return { x: start.x + (dx > 0 ? d : -d), y: start.y + (dy > 0 ? d : -d) }; // 45°
    };

    // ── Commit function (declared first so mousedown can reference it) ──────────
    const _fhDoCommit = () => {
        if (!_fhDrawing) return;
        _fhDrawing = false;
        _fhStartPt = null;

        if (_fhCurrentPts.length > 1) {
            captureUndoSnapshot('Freehand draw');
            _fhPaths.push({ pts: [..._fhCurrentPts], color: _fhColor, size: _fhSize, page: currentPageNum });
            _storeFreehandToState(_fhPaths[_fhPaths.length - 1], pageWrapper);
            _fhRedraw(); // redraw so the committed stroke renders from _fhPaths
        }

        _fhCurrentPts = [];

        // Clean up the document-level safety handler
        if (_fhDocUpHandler) {
            document.removeEventListener('mouseup', _fhDocUpHandler);
            _fhDocUpHandler = null;
        }
    };

    _fhCanvas.addEventListener('mousedown', _fhOnDown = (e) => {
        // If a previous stroke was never committed, force-commit it first.
        if (_fhDrawing) _fhDoCommit();

        _fhDrawing    = true;
        _fhStartPt    = getXY(e);
        _fhCurrentPts = [_fhStartPt];
        _fhLastShift  = false;

        // Re-register the document-level mouseup for THIS stroke
        if (_fhDocUpHandler) document.removeEventListener('mouseup', _fhDocUpHandler);
        _fhDocUpHandler = (docE) => {
            if (docE.target !== _fhCanvas) _fhDoCommit();
        };
        document.addEventListener('mouseup', _fhDocUpHandler);

        // Draw a dot at the start point so single-clicks are visible
        _fhCtx.beginPath();
        _fhCtx.arc(_fhStartPt.x, _fhStartPt.y, _fhSize / 2, 0, Math.PI * 2);
        _fhCtx.fillStyle = _fhColor;
        _fhCtx.fill();

        e.preventDefault();
    });

    _fhCanvas.addEventListener('mousemove', _fhOnMove = (e) => {
        if (!_fhDrawing) return;
        let p = getXY(e);
        const isShift = e.shiftKey && _fhStartPt;

        if (isShift) {
            p = constrainToLine(_fhStartPt, p);
            _fhCurrentPts = [_fhStartPt, p];
        } else {
            _fhCurrentPts.push(p);
        }

        // Full redraw every frame — robust, no accumulated ctx path bugs
        _fhRedraw();

        // Draw current in-progress stroke on top
        if (_fhCurrentPts.length >= 2) {
            _fhCtx.beginPath();
            _fhCtx.moveTo(_fhCurrentPts[0].x, _fhCurrentPts[0].y);
            for (let i = 1; i < _fhCurrentPts.length; i++) {
                _fhCtx.lineTo(_fhCurrentPts[i].x, _fhCurrentPts[i].y);
            }
            _fhCtx.strokeStyle = _fhColor;
            _fhCtx.lineWidth   = _fhSize;
            _fhCtx.lineCap     = 'round';
            _fhCtx.lineJoin    = 'round';
            _fhCtx.stroke();
        }

        _fhLastShift = isShift;
        e.preventDefault();
    });

    _fhCanvas.addEventListener('mouseup', _fhOnUp = _fhDoCommit);

    pageWrapper.style.cursor = 'crosshair';
    document.getElementById('btnFreehand')?.classList.add('active');
}

function stopFreehand(pageWrapper) {
    _fhActive  = false;
    _fhDrawing = false;
    _fhStartPt = null;

    // Remove document-level mouseup safety handler
    if (_fhDocUpHandler) {
        document.removeEventListener('mouseup', _fhDocUpHandler);
        _fhDocUpHandler = null;
    }

    // ── Before removing the interactive canvas, paint all strokes onto a
    // ── static canvas so they remain visible while the pencil tool is off.
    if (pageWrapper) {
        const paths = _fhPaths.filter(p => p.page === currentPageNum);
        if (paths.length > 0) {
            let sc = pageWrapper.querySelector('.fh-static-canvas');
            if (!sc) {
                sc = document.createElement('canvas');
                sc.className = 'fh-static-canvas';
                sc.style.cssText = `
                    position:absolute; left:0; top:0;
                    width:100%; height:100%;
                    z-index:30; pointer-events:none;
                `;
                pageWrapper.appendChild(sc);
            }
            sc.width  = pageWrapper.offsetWidth;
            sc.height = pageWrapper.offsetHeight;
            const ctx = sc.getContext('2d');
            ctx.clearRect(0, 0, sc.width, sc.height);
            paths.forEach(path => {
                if (path.pts.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(path.pts[0].x, path.pts[0].y);
                for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i].x, path.pts[i].y);
                ctx.strokeStyle = path.color;
                ctx.lineWidth   = path.size;
                ctx.lineCap     = 'round';
                ctx.lineJoin    = 'round';
                ctx.stroke();
            });
        }
    }

    // Now remove the interactive canvas
    if (_fhCanvas) { _fhCanvas.remove(); _fhCanvas = null; _fhCtx = null; }
    if (pageWrapper) pageWrapper.style.cursor = '';
    document.getElementById('btnFreehand')?.classList.remove('active');
}

function _fhRedraw() {
    if (!_fhCtx || !_fhCanvas) return;
    _fhCtx.clearRect(0, 0, _fhCanvas.width, _fhCanvas.height);
    _fhPaths.filter(p => p.page === currentPageNum).forEach(path => {
        if (path.pts.length < 2) return;
        _fhCtx.beginPath();
        _fhCtx.moveTo(path.pts[0].x, path.pts[0].y);
        path.pts.forEach(pt => _fhCtx.lineTo(pt.x, pt.y));
        _fhCtx.strokeStyle = path.color;
        _fhCtx.lineWidth   = path.size;
        _fhCtx.lineCap     = 'round';
        _fhCtx.lineJoin    = 'round';
        _fhCtx.stroke();
    });
}

function _storeFreehandToState(path, pageWrapper) {
    // Convert canvas path to PNG dataURL and store in imageEdits for export
    const tmp = document.createElement('canvas');
    tmp.width  = pageWrapper.offsetWidth;
    tmp.height = pageWrapper.offsetHeight;
    const tc = tmp.getContext('2d');
    if (path.pts.length < 2) return;
    tc.beginPath();
    tc.moveTo(path.pts[0].x, path.pts[0].y);
    path.pts.forEach(pt => tc.lineTo(pt.x, pt.y));
    tc.strokeStyle = path.color;
    tc.lineWidth   = path.size;
    tc.lineCap     = 'round';
    tc.lineJoin    = 'round';
    tc.stroke();

    // Get bounding box of the drawn stroke
    const xs = path.pts.map(p => p.x);
    const ys = path.pts.map(p => p.y);
    const x1 = Math.max(0, Math.min(...xs) - path.size);
    const y1 = Math.max(0, Math.min(...ys) - path.size);
    const x2 = Math.min(tmp.width,  Math.max(...xs) + path.size);
    const y2 = Math.min(tmp.height, Math.max(...ys) + path.size);
    const bw = x2 - x1;
    const bh = y2 - y1;
    if (bw < 1 || bh < 1) return;

    const crop = document.createElement('canvas');
    crop.width = bw; crop.height = bh;
    crop.getContext('2d').drawImage(tmp, x1, y1, bw, bh, 0, 0, bw, bh);

    // Use exact PDF page height in pts to avoid DPI-scaling Y-flip errors.
    // window._pdfPageNaturalSize is set by renderer.js after each page render.
    const pageHeightPts = (window._pdfPageNaturalSize && window._pdfPageNaturalSize.height)
        ? window._pdfPageNaturalSize.height
        : pageWrapper.offsetHeight / pdfScale;

    if (typeof imageEdits !== 'undefined') {
        imageEdits.push({
            page:    currentPageNum,
            x:       x1 / pdfScale,
            // y = PDF bottom-up: distance from page bottom to bottom of bounding box
            y:       pageHeightPts - (y2 / pdfScale),
            // save-pdf.js reads 'width'/'height' — use those field names
            width:   bw / pdfScale,
            height:  bh / pdfScale,
            // keep w/h aliases for any other code that reads them
            w:       bw / pdfScale,
            h:       bh / pdfScale,
            dataUrl: crop.toDataURL('image/png'),
            isFreehand: true
        });
    }
}

// ════════════════════════════════════════════
// Permanent Redaction (Solid Black Patch)
// ════════════════════════════════════════════

let _redactActive    = false;
let _redactRectEl    = null;
let _redactStart     = { x: 0, y: 0 };
let _redactContainer = null;

function startRedactionMode(pageWrapper) {
    if (_redactActive) { stopRedactionMode(); return; }
    _redactActive    = true;
    _redactContainer = pageWrapper;
    pageWrapper.style.cursor = 'crosshair';
    document.getElementById('btnRedact')?.classList.add('active');
    document.body.classList.add('redact-active');
}

function stopRedactionMode() {
    _redactActive = false;
    if (_redactRectEl) { _redactRectEl.remove(); _redactRectEl = null; }
    if (_redactContainer) _redactContainer.style.cursor = '';
    _redactContainer = null;
    document.getElementById('btnRedact')?.classList.remove('active');
    document.body.classList.remove('redact-active');
}

function startRedactStroke(x, y, container) {
    _redactContainer = container;
    _redactStart     = { x, y };
    _redactRectEl    = document.createElement('div');
    _redactRectEl.style.cssText = `
        position:absolute; left:${x}px; top:${y}px; width:0; height:0;
        background:#000000; opacity:0.7;
        pointer-events:none; z-index:99999; box-sizing:border-box;
    `;
    container.appendChild(_redactRectEl);

    const onMove = (e) => {
        if (!_redactRectEl) return;
        const r = container.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        _redactRectEl.style.left   = `${Math.min(_redactStart.x, cx)}px`;
        _redactRectEl.style.top    = `${Math.min(_redactStart.y, cy)}px`;
        _redactRectEl.style.width  = `${Math.abs(cx - _redactStart.x)}px`;
        _redactRectEl.style.height = `${Math.abs(cy - _redactStart.y)}px`;
    };
    const onUp = (e) => {
        if (!_redactRectEl) return;
        const l = parseFloat(_redactRectEl.style.left)   || 0;
        const t = parseFloat(_redactRectEl.style.top)    || 0;
        const w = parseFloat(_redactRectEl.style.width)  || 0;
        const h = parseFloat(_redactRectEl.style.height) || 0;
        _redactRectEl.remove();
        _redactRectEl = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        if (w < 4 || h < 4) return;
        _applyRedaction(l, t, w, h, container);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
}

function _applyRedaction(l, t, w, h, container) {
    captureUndoSnapshot('Redaction');

    // 1. Visual solid black patch
    const patchEl = document.createElement('div');
    patchEl.className = 'redact-patch';
    patchEl.style.cssText = `
        position:absolute; left:${l}px; top:${t}px;
        width:${w}px; height:${h}px;
        background:#000000;
        pointer-events:none; z-index:55;
    `;
    container.appendChild(patchEl);

    // 2. Hide any text spans underneath
    const contRect = container.getBoundingClientRect();
    container.querySelectorAll('.editable-text-unit, .text-layer span, .textLayer span').forEach(span => {
        const sr = span.getBoundingClientRect();
        const sl = sr.left - contRect.left;
        const st = sr.top  - contRect.top;
        if (sl < l + w && sl + sr.width > l && st < t + h && st + sr.height > t) {
            span.style.visibility = 'hidden';
        }
    });

    // 3. Store in clearStrokes for PDF export (black rectangle)
    // Use exact PDF page height in pts to avoid DPI-scaling Y-flip errors.
    const pageHeightPts = (window._pdfPageNaturalSize && window._pdfPageNaturalSize.height)
        ? window._pdfPageNaturalSize.height
        : container.offsetHeight / pdfScale;
    let pe = clearStrokes.find(s => s.page === currentPageNum);
    if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
    pe.rects.push({
        x: l / pdfScale,
        y: pageHeightPts - (t + h) / pdfScale,
        w: w / pdfScale,
        h: h / pdfScale,
        r: 0, g: 0, b: 0,
        patch: null,
        isRedaction: true
    });
}

// ════════════════════════════════════════════
// Highlight Tool
// ════════════════════════════════════════════

let _hlActive    = false;
let _hlRectEl    = null;
let _hlStart     = { x: 0, y: 0 };
let _hlColor     = '#ffff00';  // default yellow
let _hlContainer = null;

function startHighlightMode(pageWrapper) {
    if (_hlActive) { stopHighlightMode(); return; }
    _hlActive    = true;
    _hlContainer = pageWrapper;
    pageWrapper.style.cursor = 'crosshair';
    document.getElementById('btnHighlight')?.classList.add('active');
    document.body.classList.add('highlight-active');
}

function stopHighlightMode() {
    _hlActive = false;
    if (_hlRectEl) { _hlRectEl.remove(); _hlRectEl = null; }
    if (_hlContainer) _hlContainer.style.cursor = '';
    _hlContainer = null;
    document.getElementById('btnHighlight')?.classList.remove('active');
    document.body.classList.remove('highlight-active');
}

function startHighlightStroke(x, y, container) {
    _hlContainer = container;
    _hlStart     = { x, y };
    _hlRectEl    = document.createElement('div');
    _hlRectEl.style.cssText = `
        position:absolute; left:${x}px; top:${y}px; width:0; height:0;
        background:${_hlColor}; opacity:0.35;
        pointer-events:none; z-index:45; box-sizing:border-box;
    `;
    container.appendChild(_hlRectEl);

    const onMove = (e) => {
        if (!_hlRectEl) return;
        const r = container.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        _hlRectEl.style.left   = `${Math.min(_hlStart.x, cx)}px`;
        _hlRectEl.style.top    = `${Math.min(_hlStart.y, cy)}px`;
        _hlRectEl.style.width  = `${Math.abs(cx - _hlStart.x)}px`;
        _hlRectEl.style.height = `${Math.abs(cy - _hlStart.y)}px`;
    };
    const onUp = () => {
        if (!_hlRectEl) return;
        const l = parseFloat(_hlRectEl.style.left)   || 0;
        const t = parseFloat(_hlRectEl.style.top)    || 0;
        const w = parseFloat(_hlRectEl.style.width)  || 0;
        const h = parseFloat(_hlRectEl.style.height) || 0;
        _hlRectEl.style.opacity = '0.35';
        _hlRectEl.style.pointerEvents = 'none';
        _hlRectEl = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        if (w < 3 || h < 3) return;
        _saveHighlight(l, t, w, h, _hlColor);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
}

function _saveHighlight(l, t, w, h, color) {
    captureUndoSnapshot('Highlight');
    // Use exact PDF page height in pts to avoid DPI-scaling Y-flip errors.
    const pageHeightPts = (window._pdfPageNaturalSize && window._pdfPageNaturalSize.height)
        ? window._pdfPageNaturalSize.height
        : ((_hlContainer?.offsetHeight || 0) / pdfScale);
    // Store as a transparent-colored shape for PDF export
    if (typeof shapeEdits !== 'undefined') {
        shapeEdits.push({
            page: currentPageNum,
            type: 'highlight',
            x:    l / pdfScale,
            y:    pageHeightPts - (t + h) / pdfScale,
            w:    w / pdfScale,
            h:    h / pdfScale,
            // also store as width/height for consistency with shape drawing code
            width:  w / pdfScale,
            height: h / pdfScale,
            color,
            opacity: 0.35
        });
    }
}

// ════════════════════════════════════════════
// INIT — page mouse handlers (called from init.js)
// ════════════════════════════════════════════

function handleFreehandMouseDown(e, pageWrapper) {
    if (!_fhActive) return false;
    // Already handled by canvas listener
    return true;
}

function handleRedactMouseDown(e, pageWrapper) {
    if (!_redactActive) return false;
    const r = pageWrapper.getBoundingClientRect();
    startRedactStroke(e.clientX - r.left, e.clientY - r.top, pageWrapper);
    return true;
}

function handleHighlightMouseDown(e, pageWrapper) {
    if (!_hlActive) return false;
    const r = pageWrapper.getBoundingClientRect();
    startHighlightStroke(e.clientX - r.left, e.clientY - r.top, pageWrapper);
    return true;
}

// ════════════════════════════════════════════
// Color/size picker helpers
// ════════════════════════════════════════════

function setFreehandColor(color) { _fhColor = color; }
function setFreehandSize(size)   { _fhSize  = Number(size); }
function setHighlightColor(color){ _hlColor = color; }

/**
 * Called by renderer.js when a new PDF is opened.
 * Wipes all freehand strokes from the previous document so they
 * do not bleed onto the newly loaded file.
 */
function clearFreehandPaths() {
    _fhPaths      = [];
    _fhCurrentPts = [];
    _fhStartPt    = null;
    _fhLastShift  = false;
    _fhDrawing    = false;
}

/**
 * Called by undo.js after renderPage() finishes (which destroys the old DOM).
 * If the pencil tool was active, this re-attaches the overlay canvas to the
 * newly created pageWrapper and redraws all committed strokes on the current page.
 * If the pencil tool is not active, it just ensures the canvas is removed (no orphan).
 */
window.fhReattachCanvas = function() {
    const newWrapper = document.querySelector('.pdf-page-wrapper');
    if (!newWrapper) return;

    // Remove stale canvas if any
    if (_fhCanvas) {
        _fhCanvas.remove();
        _fhCanvas = null;
        _fhCtx    = null;
    }

    if (!_fhActive) {
        // Tool not active — just redraw paths as a static snapshot image
        // (so restored strokes are visible even without the tool open)
        _fhRenderStaticPaths(newWrapper);
        return;
    }

    // Re-create the canvas overlay on the new wrapper
    _fhCanvas = document.createElement('canvas');
    _fhCanvas.className = 'freehand-canvas';
    _fhCanvas.width     = newWrapper.offsetWidth;
    _fhCanvas.height    = newWrapper.offsetHeight;
    _fhCanvas.style.cssText = `
        position:absolute; left:0; top:0;
        width:100%; height:100%;
        z-index:150; cursor:crosshair;
        pointer-events:auto;
        touch-action:none;
    `;
    newWrapper.appendChild(_fhCanvas);
    _fhCtx = _fhCanvas.getContext('2d');
    _fhRedraw();
};

/**
 * Renders all committed freehand paths for the current page as a static
 * transparent PNG image overlay — used when the pencil tool is not active
 * so undone/redone strokes stay visible on screen without needing the tool open.
 */
function _fhRenderStaticPaths(wrapper) {
    const paths = _fhPaths.filter(p => p.page === currentPageNum);
    if (paths.length === 0) return;

    // Re-use existing static canvas if already present
    let staticCanvas = wrapper.querySelector('.fh-static-canvas');
    if (!staticCanvas) {
        staticCanvas = document.createElement('canvas');
        staticCanvas.className = 'fh-static-canvas';
        staticCanvas.style.cssText = `
            position:absolute; left:0; top:0;
            width:100%; height:100%;
            z-index:30; pointer-events:none;
        `;
        wrapper.appendChild(staticCanvas);
    }
    staticCanvas.width  = wrapper.offsetWidth;
    staticCanvas.height = wrapper.offsetHeight;

    const ctx = staticCanvas.getContext('2d');
    ctx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
    paths.forEach(path => {
        if (path.pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path.pts[0].x, path.pts[0].y);
        path.pts.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.strokeStyle = path.color;
        ctx.lineWidth   = path.size;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
    });
}


// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const btnFh = document.getElementById('btnFreehand');
    if (btnFh) {
        btnFh.addEventListener('click', () => {
            const pw = document.querySelector('.pdf-page-wrapper');
            if (pw) {
                if (_fhActive) {
                    stopFreehand(pw);
                    activeTool = 'select';
                    if (typeof updateToolUI === 'function') updateToolUI('btnSelect');
                } else {
                    deactivateAllTools();
                    activeTool = 'freehand';
                    startFreehand(pw);
                    if (typeof updateToolUI === 'function') updateToolUI('btnFreehand');
                }
            }
        });
    }

    const btnRed = document.getElementById('btnRedact');
    if (btnRed) {
        btnRed.addEventListener('click', () => {
            const pw = document.querySelector('.pdf-page-wrapper');
            if (pw) {
                if (_redactActive) {
                    stopRedactionMode();
                    activeTool = 'select';
                    if (typeof updateToolUI === 'function') updateToolUI('btnSelect');
                } else {
                    deactivateAllTools();
                    activeTool = 'redact';
                    startRedactionMode(pw);
                    if (typeof updateToolUI === 'function') updateToolUI('btnRedact');
                }
            }
        });
    }

    const btnHL = document.getElementById('btnHighlight');
    if (btnHL) {
        btnHL.addEventListener('click', () => {
            const pw = document.querySelector('.pdf-page-wrapper');
            if (pw) {
                if (_hlActive) {
                    stopHighlightMode();
                    activeTool = 'select';
                    if (typeof updateToolUI === 'function') updateToolUI('btnSelect');
                } else {
                    deactivateAllTools();
                    activeTool = 'highlight';
                    startHighlightMode(pw);
                    if (typeof updateToolUI === 'function') updateToolUI('btnHighlight');
                }
            }
        });
    }

    // Freehand color/size pickers
    const fhColor = document.getElementById('freehandColor');
    if (fhColor) fhColor.addEventListener('change', e => setFreehandColor(e.target.value));
    const fhSize = document.getElementById('freehandSize');
    if (fhSize) fhSize.addEventListener('input', e => setFreehandSize(e.target.value));

    // Highlight color picker
    const hlColor = document.getElementById('highlightColor');
    if (hlColor) hlColor.addEventListener('change', e => setHighlightColor(e.target.value));
});
