// ─── Shapes Logic for Antigravity PDF Editor ─────────────────────────────────
// Fixes:
//   1. Shape click no longer opens text box (proper stopPropagation)
//   2. Shapes draggable in ALL tool modes (not just 'select')
//   3. Shapes saved correctly in PDF on download
//   4. Undo is step-by-step (snapshot captured at right moments)
//   5. Z-order (bring forward/back) buttons work correctly
//   6. Text tool works ON TOP of shapes (click shape → type text over it)

// _shapeZCounter → core/state.js

// ─── Helper: capture undo snapshot safely (avoid double-capture) ──────────────
function _shapeCaptureUndo(label) {
    if (typeof captureUndoSnapshot === 'function') {
        captureUndoSnapshot(label);
    }
}

// ─── Create a shape DOM node and attach all interaction logic ─────────────────
function createShapeNode(edit, container) {
    const wpx = edit.width  * pdfScale;
    const hpx = edit.height * pdfScale;
    const xpx = edit.x      * pdfScale;
    const ypx = container.offsetHeight - (edit.y * pdfScale) - hpx;

    const wrapper = document.createElement('div');
    wrapper.dataset.editId  = edit.id;
    wrapper.dataset.shapeId = edit.id;
    wrapper.dataset.color   = edit.bgHex || edit.color;

    const zIdx = edit.zIndex || 60;
    wrapper.style.cssText = `
        position: absolute;
        left: ${xpx}px;
        top:  ${ypx}px;
        width: ${wpx}px;
        height: ${hpx}px;
        cursor: move;
        z-index: ${zIdx};
        box-sizing: border-box;
        user-select: none;
    `;
    wrapper.className = 'pdf-shape-element';

    // ── Inner visual ──────────────────────────────────────────────────────────
    const innerShape = document.createElement('div');
    innerShape.className = 'shape-inner';
    innerShape.style.cssText = `
        width: 100%; height: 100%; pointer-events: none;
        background-color: ${edit.bgHex || edit.color};
        opacity: ${edit.opacity !== undefined ? edit.opacity : 1};
        transition: background-color 0.2s, opacity 0.2s;
    `;
    if (edit.type === 'circle')     innerShape.style.borderRadius = '50%';
    if (edit.type === 'round-rect') innerShape.style.borderRadius = '12px';
    if (edit.type === 'triangle') {
        innerShape.style.clipPath = 'polygon(50% 0%, 100% 100%, 0% 100%)';
        innerShape.style.webkitClipPath = 'polygon(50% 0%, 100% 100%, 0% 100%)';
    }
    if (edit.type === 'star') {
        const sp = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        innerShape.style.clipPath = sp;
        innerShape.style.webkitClipPath = sp;
    }
    if (edit.type === 'line') {
        innerShape.style.clipPath = 'polygon(0% 40%, 100% 40%, 100% 60%, 0% 60%)';
        innerShape.style.webkitClipPath = 'polygon(0% 40%, 100% 40%, 100% 60%, 0% 60%)';
    }
    wrapper.appendChild(innerShape);

    // ── Resize handle ─────────────────────────────────────────────────────────
    const hs = 14;
    const handle = document.createElement('div');
    handle.className = 'shape-resize-handle';
    handle.title = 'Resize';
    handle.style.cssText = `
        position: absolute; right: -${hs/2}px; bottom: -${hs/2}px;
        width: ${hs}px; height: ${hs}px;
        background: #7c3aed; border: 2px solid white;
        border-radius: 50%; cursor: nwse-resize; z-index: 2;
        display: none; box-shadow: 0 0 5px rgba(0,0,0,0.4);
    `;
    wrapper.appendChild(handle);

    // ── Floating toolbar ──────────────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.className = 'shape-toolbar';
    toolbar.style.cssText = `
        position: absolute; top: -38px; left: 0;
        display: none; flex-direction: row; gap: 3px; align-items: center;
        background: #1e1e2e; border: 1px solid #7c3aed;
        border-radius: 6px; padding: 3px 6px;
        z-index: 9999; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    `;

    function tbBtn(label, title, bg) {
        const b = document.createElement('button');
        b.textContent = label; b.title = title;
        b.style.cssText = `
            background:${bg || '#2a2a3e'}; color:#fff; border:none;
            border-radius:4px; padding:2px 7px; cursor:pointer;
            font-size:12px; line-height:20px;
        `;
        return b;
    }

    const btnRotShape = tbBtn('↻', 'Rotate 90°');
    const btnToFront  = tbBtn('⬆', 'Bring to Front');
    const btnUp       = tbBtn('▲', 'Bring Forward');
    const btnDown     = tbBtn('▼', 'Send Backward');
    const btnToBack   = tbBtn('⬇', 'Send to Back');
    const btnAddText  = tbBtn('T', 'Type Text on Shape', '#1a6b3a');
    const btnDel      = tbBtn('✕', 'Delete', '#c0392b');

    const opLabel = document.createElement('span');
    opLabel.textContent = 'α:';
    opLabel.style.cssText = 'color:#aaa;font-size:11px;padding:0 2px;';

    const opSlider = document.createElement('input');
    opSlider.type = 'range'; opSlider.min = '0.05'; opSlider.max = '1'; opSlider.step = '0.05';
    opSlider.value = edit.opacity !== undefined ? edit.opacity : 1;
    opSlider.style.cssText = 'width:55px;cursor:pointer;accent-color:#7c3aed;';
    opSlider.title = 'Opacity';

    // ── Text Color picker (for text typed on shapes) ──────────────────────────
    const tcLabel = document.createElement('span');
    tcLabel.textContent = 'T:';
    tcLabel.title = 'Text Color';
    tcLabel.style.cssText = 'color:#aaa;font-size:11px;padding:0 2px;';

    const tcPicker = document.createElement('input');
    tcPicker.type = 'color';
    tcPicker.value = '#000000';
    tcPicker.title = 'Text Color on Shape';
    tcPicker.style.cssText = `
        width:24px; height:24px; padding:0; border:none; border-radius:4px;
        cursor:pointer; background:transparent; vertical-align:middle;
    `;
    tcPicker.addEventListener('mousedown', e => e.stopPropagation());
    tcPicker.addEventListener('input', (e) => {
        e.stopPropagation();
        const color = e.target.value;
        // Apply to floating editor if open inside this shape area
        const ae = document.querySelector('.floating-editor');
        if (ae) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ae.contains(sel.anchorNode)) {
                document.execCommand('foreColor', false, color);
            } else {
                ae.style.color = color;
            }
            if (typeof currentStyle !== 'undefined') currentStyle.color = color;
            const mainPicker = document.getElementById('textColor');
            if (mainPicker) mainPicker.value = color;
            return;
        }
        // Apply to selected text span
        if (typeof selectedTextItem !== 'undefined' && selectedTextItem &&
            !selectedTextItem.classList.contains('pdf-shape-element') &&
            !selectedTextItem.classList.contains('pdf-image-wrapper')) {
            selectedTextItem.style.color = color;
            if (typeof syncEditData === 'function') syncEditData(selectedTextItem, { color });
        }
        if (typeof currentStyle !== 'undefined') currentStyle.color = color;
        const mainPicker = document.getElementById('textColor');
        if (mainPicker) mainPicker.value = color;
    });

    [btnRotShape, btnToFront, btnUp, btnDown, btnToBack, btnAddText, opLabel, opSlider, tcLabel, tcPicker, btnDel]
        .forEach(el => toolbar.appendChild(el));
    wrapper.appendChild(toolbar);

    // ── Rotation state ────────────────────────────────────────────────────────
    let shapeRotation = edit.rotation || 0;
    if (shapeRotation) innerShape.style.transform = `rotate(${shapeRotation}deg)`;
    btnRotShape.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnRotShape.addEventListener('click', stopDo(() => {
        _shapeCaptureUndo('Rotate shape');
        shapeRotation = (shapeRotation + 90) % 360;
        innerShape.style.transform = `rotate(${shapeRotation}deg)`;
        const ed = shapeEdits.find(s => s.id === edit.id);
        if (ed) ed.rotation = shapeRotation;
    }));

    // ── Select helper ─────────────────────────────────────────────────────────
    function selectThisShape() {
        // Deselect all other shapes
        document.querySelectorAll('.pdf-shape-element').forEach(el => {
            el.style.outline = 'none';
            const h = el.querySelector('.shape-resize-handle');
            const t = el.querySelector('.shape-toolbar');
            if (h) h.style.display = 'none';
            if (t) t.style.display = 'none';
        });

        // Select this one
        if (typeof selectedTextItem !== 'undefined') selectedTextItem = wrapper;
        wrapper.style.outline = '2px solid #7c3aed';
        handle.style.display  = 'block';
        toolbar.style.display = 'flex';

        // Sync color picker
        const ed = shapeEdits.find(s => s.id === edit.id);
        const picker = document.getElementById('bgColor');
        if (picker && ed) picker.value = ed.bgHex || ed.color || '#7c3aed';
    }

    // ── Z-order buttons ───────────────────────────────────────────────────────
    function stopDo(fn) {
        return (e) => { e.stopPropagation(); e.preventDefault(); fn(); };
    }

    btnToFront.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnToFront.addEventListener('click', stopDo(() => {
        _shapeCaptureUndo('Bring shape to front');
        _shapeZCounter += 10;
        wrapper.style.zIndex = _shapeZCounter;
        const ed = shapeEdits.find(s => s.id === edit.id);
        if (ed) ed.zIndex = _shapeZCounter;
    }));

    btnUp.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnUp.addEventListener('click', stopDo(() => {
        _shapeCaptureUndo('Bring shape forward');
        const cur = parseInt(wrapper.style.zIndex) || 60;
        const nz = cur + 5;
        wrapper.style.zIndex = nz;
        const ed = shapeEdits.find(s => s.id === edit.id);
        if (ed) ed.zIndex = nz;
    }));

    btnDown.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnDown.addEventListener('click', stopDo(() => {
        _shapeCaptureUndo('Send shape backward');
        const cur = parseInt(wrapper.style.zIndex) || 60;
        const nz = Math.max(5, cur - 5);
        wrapper.style.zIndex = nz;
        const ed = shapeEdits.find(s => s.id === edit.id);
        if (ed) ed.zIndex = nz;
    }));

    btnToBack.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnToBack.addEventListener('click', stopDo(() => {
        _shapeCaptureUndo('Send shape to back');
        wrapper.style.zIndex = 5;
        const ed = shapeEdits.find(s => s.id === edit.id);
        if (ed) ed.zIndex = 5;
    }));

    // ── Add text ON TOP of shape ──────────────────────────────────────────────
    btnAddText.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnAddText.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Switch to text tool
        const btnTypeText = document.getElementById('btnTypeText');
        if (btnTypeText) btnTypeText.click();

        // Calculate center of shape relative to the page wrapper
        const cont = wrapper.closest('.pdf-page-wrapper');
        if (!cont) return;

        const shapeCenterX = parseFloat(wrapper.style.left) + wrapper.offsetWidth  / 2;
        const shapeCenterY = parseFloat(wrapper.style.top)  + wrapper.offsetHeight / 2;

        // Get shape's background color to pass to addNewText
        const ed = shapeEdits.find(s => s.id === edit.id);
        const shapeBgColor = ed ? (ed.bgHex || ed.color || '#7c3aed') : '#7c3aed';
        if (ed) {
            // Sync bgColor picker with shape color
            const picker = document.getElementById('bgColor');
            if (picker) picker.value = shapeBgColor;
            if (typeof currentStyle !== 'undefined') {
                currentStyle.bgColor = shapeBgColor;
            }
        }

        // Trigger addNewText at the center of the shape, passing shape bg color
        if (typeof addNewText === 'function' && typeof currentPdfObj !== 'undefined') {
            currentPdfObj.getPage(currentPageNum).then(page => {
                const viewport = page.getViewport({ scale: pdfScale });
                addNewText(shapeCenterX, shapeCenterY, viewport, page, cont, shapeBgColor);
            });
        }
    });

    // ── Delete ────────────────────────────────────────────────────────────────
    btnDel.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    btnDel.addEventListener('click', stopDo(() => {
        _shapeCaptureUndo('Delete shape');
        const idx = shapeEdits.findIndex(s => s.id === edit.id);
        if (idx > -1) shapeEdits.splice(idx, 1);
        if (typeof selectedTextItem !== 'undefined' && selectedTextItem === wrapper) {
            selectedTextItem = null;
        }
        wrapper.remove();
    }));

    // ── Opacity slider ────────────────────────────────────────────────────────
    opSlider.addEventListener('mousedown', (e) => e.stopPropagation());
    opSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseFloat(opSlider.value);
        innerShape.style.opacity = val;
        const ed = shapeEdits.find(s => s.id === edit.id);
        if (ed) ed.opacity = val;
    });
    opSlider.addEventListener('change', () => {
        _shapeCaptureUndo('Change shape opacity');
    });

    // ── Resize logic ──────────────────────────────────────────────────────────
    let isResizing = false;
    let resStartW, resStartH, resStartX, resStartY;

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        resStartW = parseFloat(wrapper.style.width);
        resStartH = parseFloat(wrapper.style.height);
        resStartX = e.clientX;
        resStartY = e.clientY;
        _shapeCaptureUndo('Resize shape');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newW = Math.max(10, resStartW + (e.clientX - resStartX));
        const newH = Math.max(10, resStartH + (e.clientY - resStartY));
        wrapper.style.width  = newW + 'px';
        wrapper.style.height = newH + 'px';
        const ev = shapeEdits.find(ed => ed.id === edit.id);
        if (ev) {
            ev.width  = newW / pdfScale;
            ev.height = newH / pdfScale;
            const cont = wrapper.closest('.pdf-page-wrapper');
            if (cont) {
                ev.y = (cont.offsetHeight - parseFloat(wrapper.style.top) - newH) / pdfScale;
            }
        }
    });

    document.addEventListener('mouseup', () => { isResizing = false; });

    // ── Drag (works in ALL tool modes) ────────────────────────────────────────
    let isDraggingShape = false;
    let dragSX = 0, dragSY = 0, dragOrigL = 0, dragOrigT = 0;

    wrapper.addEventListener('mousedown', (e) => {
        // Don't drag when clicking resize handle or toolbar buttons
        if (e.target === handle) return;
        if (toolbar.contains(e.target)) return;

        // TEXT TOOL: Type tool active হলে shape-এর উপরে text editor open করো
        if (typeof activeTool !== 'undefined' && activeTool === 'text') {
            e.stopPropagation();
            e.preventDefault();
            // Open text editor at shape center
            const cont = wrapper.closest('.pdf-page-wrapper');
            if (cont && typeof addNewText === 'function' && typeof currentPdfObj !== 'undefined') {
                const shapeCenterX = parseFloat(wrapper.style.left) + wrapper.offsetWidth / 2;
                const shapeCenterY = parseFloat(wrapper.style.top) + wrapper.offsetHeight / 2;
                const ed = shapeEdits.find(s => s.id === edit.id);
                const shapeBgColor = ed ? (ed.bgHex || ed.color || '#7c3aed') : '#7c3aed';
                // Commit any existing floating editor first
                document.querySelectorAll('.floating-editor').forEach(fe => {
                    if (fe._commit) fe._commit();
                });
                currentPdfObj.getPage(currentPageNum).then(page => {
                    const viewport = page.getViewport({ scale: pdfScale });
                    addNewText(shapeCenterX, shapeCenterY, viewport, page, cont, shapeBgColor);
                });
            }
            return;
        }

        // CRITICAL: stop propagation so the page's mousedown doesn't
        // create a new text box or trigger other tools
        e.stopPropagation();
        e.preventDefault();

        // Select this shape
        selectThisShape();

        // Start drag
        isDraggingShape = true;
        dragSX    = e.clientX;
        dragSY    = e.clientY;
        dragOrigL = parseFloat(wrapper.style.left) || 0;
        dragOrigT = parseFloat(wrapper.style.top)  || 0;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingShape) return;
        const newL = dragOrigL + (e.clientX - dragSX);
        const newT = dragOrigT + (e.clientY - dragSY);
        wrapper.style.left = newL + 'px';
        wrapper.style.top  = newT + 'px';

        // Sync edit data in real-time
        const ev = shapeEdits.find(ed => ed.id === edit.id);
        if (ev) {
            ev.x = newL / pdfScale;
            const cont = wrapper.closest('.pdf-page-wrapper');
            if (cont) {
                ev.y = (cont.offsetHeight - newT - parseFloat(wrapper.style.height)) / pdfScale;
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDraggingShape) {
            isDraggingShape = false;
            // Capture undo after drag ends
            _shapeCaptureUndo('Move shape');
        }
    });

    container.appendChild(wrapper);
    return wrapper;
}

// ─── Apply color from bgColor picker to the selected shape ───────────────────
function applyColorToSelectedShape(hexColor) {
    if (!selectedTextItem || !selectedTextItem.classList.contains('pdf-shape-element')) return;
    const inner = selectedTextItem.querySelector('.shape-inner');
    if (inner) inner.style.backgroundColor = hexColor;
    const sid = selectedTextItem.dataset.shapeId;
    const ed  = shapeEdits.find(s => s.id === sid);
    if (ed) { ed.bgHex = hexColor; ed.color = hexColor; }
}

// ─── Restore shapes after page re-render (undo / page navigation) ────────────
function restoreShapesToDom(container) {
    if (typeof shapeEdits === 'undefined') return;
    shapeEdits
        .filter(s => s.page === currentPageNum)
        .forEach(edit => createShapeNode(edit, container));
}

// ─── Add a new shape ──────────────────────────────────────────────────────────
function addShapeToPdf(type) {
    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    if (!pageWrapper) {
        alert('Please upload a PDF first.');
        return;
    }

    // Capture undo BEFORE adding
    _shapeCaptureUndo(`Add ${type} shape`);

    const shapeId = 'shape-' + Date.now();
    let width  = 120;
    let height = (['circle', 'star', 'triangle'].includes(type)) ? 120 : 80;
    if (type === 'round-rect') { width = 140; height = 100; }
    if (type === 'line')       { width = 150; height = 20;  }

    const offset = (shapeEdits.filter(e => e.page === currentPageNum).length % 6) * 20;
    const cxPx = pageWrapper.offsetWidth  / 2 - (width  / 2) + offset;
    const cyPx = pageWrapper.offsetHeight / 2 - (height / 2) + offset;

    const bgPicker = document.getElementById('bgColor');
    const defColor = (bgPicker && bgPicker.value) ? bgPicker.value : '#7c3aed';
    _shapeZCounter += 5;

    const shapeEdit = {
        id:      shapeId,
        page:    currentPageNum,
        type,
        color:   defColor,
        bgHex:   defColor,
        opacity: 1,
        zIndex:  _shapeZCounter,
        x:       cxPx / pdfScale,
        y:       (pageWrapper.offsetHeight - cyPx - height) / pdfScale,
        width,
        height
    };

    shapeEdits.push(shapeEdit);

    const shapeEl = createShapeNode(shapeEdit, pageWrapper);

    // Auto-select the new shape
    document.querySelectorAll('.pdf-shape-element').forEach(el => {
        el.style.outline = 'none';
        const h = el.querySelector('.shape-resize-handle');
        const t = el.querySelector('.shape-toolbar');
        if (h) h.style.display = 'none';
        if (t) t.style.display = 'none';
    });
    if (typeof selectedTextItem !== 'undefined') selectedTextItem = shapeEl;
    shapeEl.style.outline = '2px solid #7c3aed';
    const newHandle = shapeEl.querySelector('.shape-resize-handle');
    const newToolbar = shapeEl.querySelector('.shape-toolbar');
    if (newHandle)  newHandle.style.display  = 'block';
    if (newToolbar) newToolbar.style.display = 'flex';

    // Close shape menu
    const menu = document.getElementById('shapeDropdownMenu');
    if (menu) menu.style.display = 'none';
}

// ─── Init shape menu buttons ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('btnShapeMenu');
    const menu    = document.getElementById('shapeDropdownMenu');

    if (menuBtn && menu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.style.display === 'flex';
            menu.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen && window.lucide) lucide.createIcons();
        });
    }

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (menu && !menu.contains(e.target) && e.target !== menuBtn) {
            menu.style.display = 'none';
        }
    });

    // Shape type buttons
    const shapeButtons = {
        'btnShapeMenuRect':      'rect',
        'btnShapeMenuRoundRect': 'round-rect',
        'btnShapeMenuCircle':    'circle',
        'btnShapeMenuTriangle':  'triangle',
        'btnShapeMenuStar':      'star',
        'btnShapeMenuLine':      'line'
    };
    for (const [id, type] of Object.entries(shapeButtons)) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                addShapeToPdf(type);
            });
        }
    }

    // Live color sync: bgColor picker → selected shape
    const bgPicker = document.getElementById('bgColor');
    if (bgPicker) {
        bgPicker.addEventListener('input', () => applyColorToSelectedShape(bgPicker.value));
    }

    // Clicking on blank area deselects shapes
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.pdf-shape-element')) return;
        if (e.target.closest('.shape-toolbar'))    return;
        document.querySelectorAll('.pdf-shape-element').forEach(el => {
            el.style.outline = 'none';
            const h = el.querySelector('.shape-resize-handle');
            const t = el.querySelector('.shape-toolbar');
            if (h) h.style.display = 'none';
            if (t) t.style.display = 'none';
        });
    });
});
