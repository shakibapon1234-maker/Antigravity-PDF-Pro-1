// ─────────────────────────────────────────────
// editor/image-toolbar.js — Antigravity PDF Pro
// ইমেজ লেয়ার টুলবার ও টেক্সট কালার
// Redo system → core/undo.js এ সরানো হয়েছে
// নির্ভর করে: core/state.js, core/undo.js
// ─────────────────────────────────────────────



// ════════════════════════════════════════════════════════════════════════════
// SECTION B — TEXT COLOR  (applies to floating editor + committed spans)
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const colorPicker = document.getElementById('textColor');
    if (!colorPicker) return;

    // We REPLACE the existing listener with one that also handles selection.
    // (The old listener in app.js calls applyToActiveOrSelected which does NOT
    //  handle 'color' selection-aware — it just sets whole-editor color.)
    // We clone-replace to remove old listeners, then add the full handler.
    const newPicker = colorPicker.cloneNode(true);
    colorPicker.parentNode.replaceChild(newPicker, colorPicker);

    newPicker.addEventListener('input', (e) => {
        const color = e.target.value;

        // Update global style
        if (typeof currentStyle !== 'undefined') currentStyle.color = color;

        // 1. Floating editor open?
        const ae = document.querySelector('.floating-editor');
        if (ae) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ae.contains(sel.anchorNode)) {
                // Apply to selection only (like Ctrl+A → color)
                document.execCommand('foreColor', false, color);
            } else {
                // No selection — apply to whole editor
                ae.style.color = color;
            }
            return;
        }

        // 2. Committed span selected?
        if (typeof selectedTextItem !== 'undefined' && selectedTextItem) {
            if (!selectedTextItem.classList.contains('pdf-shape-element') &&
                !selectedTextItem.classList.contains('pdf-image-wrapper')) {
                selectedTextItem.style.color = color;
                if (typeof syncEditData === 'function') {
                    syncEditData(selectedTextItem, { color });
                }
            }
        }
    });
});


// ════════════════════════════════════════════════════════════════════════════
// SECTION C — IMAGE TOOLBAR  (attachImageLayerToolbar)
// ════════════════════════════════════════════════════════════════════════════

// _imgZCounter → core/state.js

/**
 * Attach a floating toolbar + resize handle to a .pdf-image-wrapper element.
 * Called from addImageToPdf() in app.js.
 *
 * @param {HTMLElement} wrap      — the .pdf-image-wrapper div
 * @param {string}      imageId  — the unique image id (matches imageEdits entry)
 */
function attachImageLayerToolbar(wrap, imageId) {

    // ── Helper: small toolbar button ─────────────────────────────────────────
    function tbBtn(label, title, bg) {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = title;
        b.style.cssText = `
            background:${bg || '#2a2a3e'}; color:#fff; border:none;
            border-radius:4px; padding:2px 7px; cursor:pointer;
            font-size:12px; line-height:20px; flex-shrink:0;
        `;
        return b;
    }

    // ── Toolbar container ─────────────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.className = 'image-toolbar';
    toolbar.style.cssText = `
        position: absolute; top: -42px; left: 0;
        display: none; flex-direction: row; gap: 3px; align-items: center;
        background: #1e1e2e; border: 1px solid #7c3aed;
        border-radius: 6px; padding: 3px 6px;
        z-index: 9999; white-space: nowrap;
        box-shadow: 0 2px 12px rgba(0,0,0,0.6);
        pointer-events: auto;
    `;

    const btnRot     = tbBtn('↻',  'Rotate 90°');
    const btnToFront = tbBtn('⬆', 'Bring to Front');
    const btnUp      = tbBtn('▲', 'Bring Forward');
    const btnDown    = tbBtn('▼', 'Send Backward');
    const btnToBack  = tbBtn('⬇', 'Send to Back');
    const btnAddText = tbBtn('T', 'Type Text on Image', '#1a6b3a');

    // Opacity
    const opLabel = document.createElement('span');
    opLabel.textContent = 'α:';
    opLabel.style.cssText = 'color:#aaa;font-size:11px;padding:0 2px;flex-shrink:0;';

    const opSlider = document.createElement('input');
    opSlider.type = 'range'; opSlider.min = '0.05'; opSlider.max = '1'; opSlider.step = '0.05';
    opSlider.value = '1';
    opSlider.style.cssText = 'width:50px;cursor:pointer;accent-color:#7c3aed;flex-shrink:0;';
    opSlider.title = 'Opacity';

    // Text Color  (for text typed ON the image via the 'T' text tool)
    const tcLabel = document.createElement('span');
    tcLabel.textContent = 'T:';
    tcLabel.title = 'Text Color';
    tcLabel.style.cssText = 'color:#aaa;font-size:11px;padding:0 2px;flex-shrink:0;';

    const tcPicker = document.createElement('input');
    tcPicker.type  = 'color';
    tcPicker.value = '#000000';
    tcPicker.title = 'Text Color';
    tcPicker.style.cssText = `
        width:22px; height:22px; padding:0; border:none; border-radius:3px;
        cursor:pointer; background:transparent; vertical-align:middle; flex-shrink:0;
    `;

    const btnDel = tbBtn('✕', 'Delete Image', '#c0392b');

    [btnRot, btnToFront, btnUp, btnDown, btnToBack, btnAddText, opLabel, opSlider, tcLabel, tcPicker, btnDel]
        .forEach(el => toolbar.appendChild(el));
    wrap.appendChild(toolbar);

    // ── Resize handle (bottom-right) ──────────────────────────────────────────
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    resizeHandle.title = 'Resize';
    resizeHandle.style.cssText = `
        position: absolute; right: -7px; bottom: -7px;
        width: 14px; height: 14px;
        background: #7c3aed; border: 2px solid white;
        border-radius: 50%; cursor: nwse-resize; z-index: 2;
        display: none; box-shadow: 0 0 5px rgba(0,0,0,0.4);
    `;
    wrap.appendChild(resizeHandle);

    // ── Select / deselect ─────────────────────────────────────────────────────
    function selectThisImage() {
        // Deselect all other images
        document.querySelectorAll('.pdf-image-wrapper').forEach(el => {
            el.style.outline = 'none';
            const h = el.querySelector('.image-resize-handle');
            const t = el.querySelector('.image-toolbar');
            if (h) h.style.display = 'none';
            if (t) t.style.display = 'none';
        });
        // Deselect shapes
        document.querySelectorAll('.pdf-shape-element').forEach(el => {
            el.style.outline = 'none';
            const h = el.querySelector('.shape-resize-handle');
            const t = el.querySelector('.shape-toolbar');
            if (h) h.style.display = 'none';
            if (t) t.style.display = 'none';
        });

        wrap.style.outline = '2px solid #7c3aed';
        resizeHandle.style.display = 'block';
        toolbar.style.display = 'flex';

        if (typeof selectedTextItem !== 'undefined') selectedTextItem = wrap;
    }

    // Show toolbar when image is clicked / drag-started
    wrap.addEventListener('mousedown', (e) => {
        if (e.target === resizeHandle) return;
        if (toolbar.contains(e.target)) return;
        selectThisImage();
    });

    // ── stopDo helper ─────────────────────────────────────────────────────────
    function stopDo(fn) {
        return (e) => { e.stopPropagation(); e.preventDefault(); fn(); };
    }

    // ── Rotation ──────────────────────────────────────────────────────────────
    let imgRotation = 0;
    const imgEl = wrap.querySelector('img');

    btnRot.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnRot.addEventListener('click', stopDo(() => {
        imgRotation = (imgRotation + 90) % 360;
        if (imgEl) imgEl.style.transform = `rotate(${imgRotation}deg)`;
        if (typeof imageEdits !== 'undefined') {
            const ed = imageEdits.find(s => s.id === imageId);
            if (ed) ed.rotation = imgRotation;
        }
    }));

    // ── Z-order ───────────────────────────────────────────────────────────────
    function zSync(nz) {
        wrap.style.zIndex = nz;
        if (typeof imageEdits !== 'undefined') {
            const ed = imageEdits.find(s => s.id === imageId);
            if (ed) ed.zIndex = nz;
        }
    }

    btnToFront.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnToFront.addEventListener('click', stopDo(() => { _imgZCounter += 10; zSync(_imgZCounter); }));

    btnUp.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnUp.addEventListener('click', stopDo(() => { zSync((parseInt(wrap.style.zIndex) || 60) + 5); }));

    btnDown.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnDown.addEventListener('click', stopDo(() => { zSync(Math.max(5, (parseInt(wrap.style.zIndex) || 60) - 5)); }));

    btnToBack.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnToBack.addEventListener('click', stopDo(() => { zSync(5); }));

    // ── Opacity ───────────────────────────────────────────────────────────────
    opSlider.addEventListener('mousedown', (e) => e.stopPropagation());
    opSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseFloat(e.target.value);
        if (imgEl) imgEl.style.opacity = val;
        if (typeof imageEdits !== 'undefined') {
            const ed = imageEdits.find(s => s.id === imageId);
            if (ed) ed.opacity = val;
        }
    });

    // ── Add text ON TOP of image ──────────────────────────────────────────────
    btnAddText.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnAddText.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Switch to text tool
        const btnTypeText = document.getElementById('btnTypeText');
        if (btnTypeText) btnTypeText.click();

        // Calculate center of image relative to the page wrapper
        const cont = wrap.closest('.pdf-page-wrapper');
        if (!cont) return;

        const imgCenterX = parseFloat(wrap.style.left) + wrap.offsetWidth  / 2;
        const imgCenterY = parseFloat(wrap.style.top)  + wrap.offsetHeight / 2;

        // Trigger addNewText at the center of the image with transparent bg
        if (typeof addNewText === 'function' && typeof currentPdfObj !== 'undefined') {
            currentPdfObj.getPage(currentPageNum).then(page => {
                const viewport = page.getViewport({ scale: pdfScale });
                addNewText(imgCenterX, imgCenterY, viewport, page, cont, 'transparent');
            });
        }
    });

    // ── Text Color ────────────────────────────────────────────────────────────
    tcPicker.addEventListener('mousedown', (e) => e.stopPropagation());
    tcPicker.addEventListener('input', (e) => {
        e.stopPropagation();
        const color = e.target.value;

        if (typeof currentStyle !== 'undefined') currentStyle.color = color;
        const mainPicker = document.getElementById('textColor');
        if (mainPicker) mainPicker.value = color;

        const ae = document.querySelector('.floating-editor');
        if (ae) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ae.contains(sel.anchorNode)) {
                document.execCommand('foreColor', false, color);
            } else {
                ae.style.color = color;
            }
            return;
        }
        if (typeof selectedTextItem !== 'undefined' && selectedTextItem &&
            !selectedTextItem.classList.contains('pdf-shape-element') &&
            !selectedTextItem.classList.contains('pdf-image-wrapper')) {
            selectedTextItem.style.color = color;
            if (typeof syncEditData === 'function') syncEditData(selectedTextItem, { color });
        }
    });

    // ── Delete ────────────────────────────────────────────────────────────────
    btnDel.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnDel.addEventListener('click', stopDo(() => {
        if (typeof imageEdits !== 'undefined') {
            const idx = imageEdits.findIndex(ed => ed.id === imageId);
            if (idx > -1) imageEdits.splice(idx, 1);
        }
        if (typeof selectedTextItem !== 'undefined' && selectedTextItem === wrap) {
            selectedTextItem = null;
        }
        wrap.remove();
    }));

    // ── Resize (drag bottom-right handle) ────────────────────────────────────
    let isResizing = false, resStartX = 0, resStartY = 0, resOrigW = 0, resOrigH = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); e.preventDefault();
        isResizing = true;
        resStartX  = e.clientX; resStartY = e.clientY;
        resOrigW   = wrap.offsetWidth; resOrigH = wrap.offsetHeight;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newW = Math.max(30, resOrigW + (e.clientX - resStartX));
        const newH = Math.max(30, resOrigH + (e.clientY - resStartY));
        wrap.style.width  = newW + 'px';
        wrap.style.height = newH + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        if (typeof imageEdits !== 'undefined' && typeof pdfScale !== 'undefined') {
            const ed   = imageEdits.find(s => s.id === imageId);
            const cont = wrap.closest('.pdf-page-wrapper');
            if (ed && cont) {
                ed.width  = wrap.offsetWidth  / pdfScale;
                ed.height = wrap.offsetHeight / pdfScale;
                ed.x      = parseFloat(wrap.style.left) / pdfScale;
                ed.y      = (cont.offsetHeight - parseFloat(wrap.style.top)) / pdfScale - ed.height;
            }
        }
    });

    // ── Deselect when clicking elsewhere ─────────────────────────────────────
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest && e.target.closest('.pdf-image-wrapper')) return;
        if (e.target.closest && e.target.closest('.image-toolbar')) return;
        wrap.style.outline = 'none';
        resizeHandle.style.display = 'none';
        toolbar.style.display = 'none';
    });
}
