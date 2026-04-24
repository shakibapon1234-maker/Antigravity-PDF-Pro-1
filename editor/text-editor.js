// ─────────────────────────────────────────────
// editor/text-editor.js — Antigravity PDF Pro
// টেক্সট এডিটিং: startEditing, addNewText,
// drag, mouse handlers, transformEditorText
// নির্ভর করে: core/state.js, core/utils.js,
//              core/renderer.js, core/undo.js
// ─────────────────────────────────────────────

function startEditing(e, originalItem, transform, viewport, page) {
    const el        = e.target;
    // Always resolve to the pdf-page-wrapper, regardless of which child was clicked
    const container = el.closest('.pdf-page-wrapper');
    if (!container) return;
    const isNewItem = originalItem.isNew || false;

    // Capture background patch from the canvas (the real background)
    let patchData, patchWidth, patchHeight;
    const padding = 2;

    if (isNewItem) {
        patchWidth  = originalItem.width;
        patchHeight = originalItem.height;
        patchData   = originalItem.patch;
    } else {
        patchWidth  = (originalItem.width  || el.offsetWidth  / pdfScale) + padding * 2;
        patchHeight = (originalItem.height || el.offsetHeight / pdfScale) + padding * 2;

        if (transform) {
            // Sample the actual background pixels from the canvas
            patchData = sampleBackgroundPatch(
                transform[4] / pdfScale - padding,
                transform[5] / pdfScale - padding,
                patchWidth, patchHeight, pdfScale
            );
        }
    }

    let bgColor;
    if (isNewItem) {
        bgColor = { hex: originalItem.bgHex || '#ffffff', ...hexToRgb(originalItem.bgHex || '#ffffff') };
    } else if (transform) {
        bgColor = sampleBackgroundColor(transform[4], transform[5]);
    } else {
        // Re-editing a new item without transform â€” use stored bg
        const existingEdit = textEdits.find(ed => ed.id === originalItem.id);
        const hex = existingEdit?.bgHex || '#ffffff';
        bgColor = { hex, ...hexToRgb(hex) };
    }

    // â”€â”€ Create the floating editor div â”€â”€
    // Store the absolute position for the wrapper (editWrap will be absolute)
    // Use getBoundingClientRect — reliable regardless of el's parent/wrapper state
    const _elRect  = el.getBoundingClientRect();
    const _cRect   = container.getBoundingClientRect();
    const _inputAbsLeft = `${(_elRect.left - _cRect.left) - padding * pdfScale}px`;
    const _inputAbsTop  = `${(_elRect.top  - _cRect.top)  - padding * pdfScale}px`;

    const input = document.createElement('div');
    input.contentEditable = 'true';
    input.className       = 'floating-editor';
    input.style.left   = _inputAbsLeft;
    input.style.top    = _inputAbsTop;
    input.style.width  = `${patchWidth  * pdfScale}px`;
    input.style.height = `${patchHeight * pdfScale}px`;

    // ---- KEY: set overflow explicitly on the DOM element too ----
    input.style.overflow     = 'visible';
    input.style.textOverflow = 'clip';
    input.style.whiteSpace   = 'pre';
    input.style.maxWidth     = 'none';
    input.style.width        = 'auto';
    input.style.minWidth     = `${patchWidth * pdfScale}px`;

    if (patchData) {
        // Show the real PDF background while editing â€” helps user see context
        input.style.backgroundImage = `url(${patchData})`;
        input.style.backgroundSize  = '100% 100%';
        input.dataset.patch = patchData;
    } else {
        // Subtle highlight so user knows they're editing, not an opaque box
        input.style.backgroundColor = bgColor.hex;
    }
    // Store for PDF save but editing visual is just outlined, not filled
    // (the box-shadow on .floating-editor in CSS gives enough visual cue)

    // Sync toolbar from existing edit or current style
    const edit = textEdits.find(ed =>
        isNewItem
            ? ed.id === originalItem.id
            : ed.page === currentPageNum &&
              ed.originalX === originalItem.transform[4] &&
              ed.originalY === originalItem.transform[5]
    );

    if (edit) {
        currentStyle.fontFamily  = edit.font;
        currentStyle.fontSize    = edit.size;
        currentStyle.color       = edit.color;
        currentStyle.bgColor     = edit.bgHex;
        currentStyle.isBold      = edit.isBold;
        currentStyle.isItalic    = edit.isItalic;
        currentStyle.isUnderline = edit.isUnderline;
        document.getElementById('fontFamily').value = edit.font;
        document.getElementById('fontSize').value   = edit.size;
        document.getElementById('textColor').value  = edit.color;
        document.getElementById('bgColor').value    = edit.bgHex;
        document.getElementById('btnBold').classList.toggle('active',      edit.isBold);
        document.getElementById('btnItalic').classList.toggle('active',    edit.isItalic);
        document.getElementById('btnUnderline').classList.toggle('active', edit.isUnderline);
    } else {
        currentStyle.bgColor = bgColor.hex;
        document.getElementById('bgColor').value = bgColor.hex;
    }

    input.style.fontSize       = `${currentStyle.fontSize * viewport.scale}px`;
    let fnEdit = (currentStyle.fontFamily || 'Helvetica');
    if (fnEdit.includes(' ') && !fnEdit.includes("'")) fnEdit = "'" + fnEdit + "'";
    input.style.fontFamily     = fnEdit;
    input.style.color          = currentStyle.color;
    input.style.fontWeight     = currentStyle.isBold    ? 'bold'      : 'normal';
    input.style.fontStyle      = currentStyle.isItalic  ? 'italic'    : 'normal';
    input.style.textDecoration = currentStyle.isUnderline ? 'underline' : 'none';

    // Use saved edit text/html — NOT el.textContent/innerHTML which may include
    // the span-drag-handle symbol (✥/⠿) as garbled chars if the handle is a child.
    if (edit && edit.html && edit.html !== edit.text) {
        input.innerHTML = edit.html;
    } else if (edit && edit.text) {
        input.textContent = edit.text;
    } else {
        // Fallback: strip any child elements (drag handles) before reading text
        const cleanText = Array.from(el.childNodes)
            .filter(n => !(n.nodeType === Node.ELEMENT_NODE &&
                          (n.classList.contains('span-drag-handle') ||
                           n.classList.contains('floating-editor-handle'))))
            .map(n => n.textContent || '')
            .join('');
        input.textContent = cleanText;
    }

    input.dataset.bgHex = bgColor.hex;
    input.dataset.bgR   = bgColor.r || hexToRgb(bgColor.hex).r;
    input.dataset.bgG   = bgColor.g || hexToRgb(bgColor.hex).g;
    input.dataset.bgB   = bgColor.b || hexToRgb(bgColor.hex).b;

    input.addEventListener('mousedown', ev => ev.stopPropagation());
    input.addEventListener('click',     ev => ev.stopPropagation());
    // Clicks on wrapper (but outside input) should not propagate to page
    // (will be set after editWrap is created)

    // â”€â”€ Drag handle for floating editor (edit mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dragHandle2 = document.createElement('div');
    dragHandle2.className = 'floating-editor-handle';
    dragHandle2.title = 'Drag to move';
    dragHandle2.innerHTML = 'â ¿';
    dragHandle2.style.cssText = `
        position: absolute;
        top: -18px; left: 0;
        background: var(--primary, #7c3aed);
        color: #fff;
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 4px 4px 0 0;
        cursor: grab;
        user-select: none;
        z-index: 10;
        line-height: 16px;
    `;
    let _h2Dragging = false, _h2StartX = 0, _h2StartY = 0, _h2OrigL = 0, _h2OrigT = 0;

    function _onHandle2Move(ev) {
        if (!_h2Dragging) return;
        const w2 = input._wrapEl || input;
        w2.style.left = `${_h2OrigL + (ev.clientX - _h2StartX)}px`;
        w2.style.top  = `${_h2OrigT + (ev.clientY - _h2StartY)}px`;
    }
    function _onHandle2Up() {
        if (_h2Dragging) {
            _h2Dragging = false;
            dragHandle2.style.cursor = 'grab';
            document.removeEventListener('mousemove', _onHandle2Move);
            document.removeEventListener('mouseup',   _onHandle2Up);
        }
    }
    dragHandle2.addEventListener('mousedown', (ev) => {
        _h2Dragging = true;
        _h2StartX = ev.clientX; _h2StartY = ev.clientY;
        const w2 = input._wrapEl || input;
        _h2OrigL  = parseFloat(w2.style.left) || 0;
        _h2OrigT  = parseFloat(w2.style.top)  || 0;
        dragHandle2.style.cursor = 'grabbing';
        document.addEventListener('mousemove', _onHandle2Move);
        document.addEventListener('mouseup',   _onHandle2Up);
        ev.preventDefault(); ev.stopPropagation();
    });
    // Place drag handle OUTSIDE the contentEditable div so caret works correctly
    const editWrap = document.createElement('div');
    editWrap.style.cssText = 'position:absolute;z-index:100;';
    editWrap.style.left = _inputAbsLeft;
    editWrap.style.top  = _inputAbsTop;
    input.style.left = '0';
    input.style.top  = '0';
    input.style.position = 'relative';
    input.style.zIndex   = '';

    dragHandle2.style.position = 'absolute';
    dragHandle2.style.top  = '-20px';
    dragHandle2.style.left = '0';
    editWrap.appendChild(dragHandle2);
    editWrap.appendChild(input);
    input._wrapEl = editWrap;
    // Prevent wrapper clicks from bubbling to page (would create new text)
    editWrap.addEventListener('mousedown', ev => ev.stopPropagation());
    editWrap.addEventListener('click',     ev => ev.stopPropagation());

    // Append wrapper to page-wrapper
    container.appendChild(editWrap);
    el.style.opacity       = '0';
    el.style.pointerEvents = 'none'; // prevent interaction with hidden original

    setTimeout(() => {
        input.focus();
        // Place cursor at end â€” drag handle is now outside so no interference
        try {
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch(e) {}
    }, 20);

    // â”€â”€ Commit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    input._commit = () => {
        if (input._committed) return;
        input._committed = true;

        // Get plain text — strip drag handle element text before reading
        // (handle symbol leaks into innerText if handle is a child of input)
        const _cleanInput = input.cloneNode(true);
        _cleanInput.querySelectorAll('.span-drag-handle, .floating-editor-handle').forEach(h => h.remove());
        const newText = (_cleanInput.innerText || _cleanInput.textContent || '').replace(/\n{2,}/g, '\n').trim();

        // Capture undo snapshot before applying changes
        captureUndoSnapshot(newText ? 'Edit text' : 'Clear text');

        // Read wrapper position BEFORE removing (drag may have moved the wrapper)
        const wrap2 = input._wrapEl;
        const wrapLeft2 = wrap2 ? parseFloat(wrap2.style.left) : parseFloat(input.style.left);
        const wrapTop2  = wrap2 ? parseFloat(wrap2.style.top)  : parseFloat(input.style.top);

        // Capture HTML BEFORE removing wrapper — but strip any drag-handle elements
        // that may have leaked into the editor div's innerHTML.
        const _tmpDiv = document.createElement('div');
        _tmpDiv.innerHTML = input.innerHTML || '';
        _tmpDiv.querySelectorAll('.span-drag-handle, .floating-editor-handle').forEach(h => h.remove());
        const editorHTML = _tmpDiv.innerHTML;

        // Remove wrapper (contains handle + editor) or just input
        if (wrap2 && wrap2.parentNode) wrap2.remove();
        else input.remove();

        // Always restore the original span visibility & interactivity
        el.style.opacity       = '1';
        el.style.display       = '';
        el.style.visibility    = '';
        el.style.pointerEvents = 'auto';
        el.style.position      = 'absolute'; // ensure absolute even if changed
        // CRITICAL FIX: clear any background so no ash/grey box remains
        el.style.backgroundColor = 'transparent';
        el.style.backgroundImage = 'none';

        if (!newText) {
            // User cleared the text â€” hide the span visually, no background
            el.style.color           = 'transparent';
            el.style.backgroundColor = 'transparent';
            el.textContent           = '';
            return;
        }

        const editData = {
            id: isNewItem
                ? originalItem.id
                : `${currentPageNum}-${originalItem.transform[4]}-${originalItem.transform[5]}`,
            page:      currentPageNum,
            isNew:     isNewItem,
            originalX: isNewItem ? originalItem.originalX : originalItem.transform[4],
            originalY: isNewItem ? originalItem.originalY : originalItem.transform[5],
            x:     wrapLeft2 / pdfScale,
            y:     (container.offsetHeight - wrapTop2) / pdfScale - currentStyle.fontSize,
            text:  newText,
            html:  editorHTML || newText,
            size:  currentStyle.fontSize,
            color: currentStyle.color,
            // Store bgHex only for PDF save (whiteout rect), NOT for visual display
            patch: input.dataset.patch,
            bgHex: input.dataset.bgHex,
            bgR:   parseFloat(input.dataset.bgR),
            bgG:   parseFloat(input.dataset.bgG),
            bgB:   parseFloat(input.dataset.bgB),
            font:  currentStyle.fontFamily,
            isBold:      currentStyle.isBold,
            isItalic:    currentStyle.isItalic,
            isUnderline: currentStyle.isUnderline,
            width:  parseFloat(input.style.minWidth || input.style.width || '0') / pdfScale,
            height: parseFloat(input.style.height) / pdfScale
        };

        const idx = textEdits.findIndex(ed => ed.id === editData.id);
        if (idx > -1) textEdits[idx] = editData;
        else textEdits.push(editData);

        // Update the span in place â€” preserve innerHTML (bold/italic/size spans) from editor
        // Use innerHTML to keep any styled child spans (bold, italic, fontSize wraps)
        el.innerHTML = editorHTML || newText;
        // Apply styles without overwriting innerHTML (restoreEditOnSpan would use textContent)
        el.style.color           = editData.color;
        // wrapLeft2/wrapTop2 are container-relative; el may be in a text-layer with its own offset
        const _tl = el.closest('.text-layer');
        const _tlOffL = _tl ? _tl.offsetLeft : 0;
        const _tlOffT = _tl ? _tl.offsetTop  : 0;
        el.style.left            = `${wrapLeft2 - _tlOffL}px`;
        el.style.top             = `${wrapTop2  - _tlOffT}px`;
        el.style.fontSize        = `${editData.size * viewport.scale}px`;
        el.style.fontFamily      = editData.font || 'Helvetica';
        el.style.fontWeight      = editData.isBold    ? 'bold'      : 'normal';
        el.style.fontStyle       = editData.isItalic  ? 'italic'    : 'normal';
        el.style.textDecoration  = editData.isUnderline ? 'underline' : 'none';
        el.style.backgroundColor = 'transparent';
        el.style.backgroundImage = 'none';
        el.style.display         = 'inline-block';
        el.style.minWidth        = `${(editData.width  || 10) * viewport.scale}px`;
        el.style.minHeight       = `${(editData.height || editData.size) * viewport.scale}px`;
        el.classList.add('modified', 'draggable');
        el.dataset.editId        = editData.id;
    };
}

function handlePageMouseDown(e, container, viewport, page) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // If a floating editor is open and we click away from it, commit it first
    const existingEditor = container.querySelector('.floating-editor');
    if (existingEditor && existingEditor._commit &&
        !existingEditor.contains(e.target)) {
        existingEditor._commit();
    }

    if (activeTool === 'text') {
        // Check if target is NOT an editable text unit or floating editor (blank area)
        if (!e.target.classList.contains('editable-text-unit') && 
            !e.target.classList.contains('floating-editor') &&
            !e.target.closest('.floating-editor') &&
            !e.target.closest('.floating-editor-handle') &&
            !e.target.closest('.text-layer')) {
            deselectTextItem();
            // FIX: যেকোনো open floating-editor আগে commit করো
            // শুধু এই container নয়, পুরো document-এ
            document.querySelectorAll('.floating-editor').forEach(fe => {
                if (fe._commit) fe._commit();
            });
            addNewText(x, y, viewport, page, container);
        }
    } else if (activeTool === 'select') {
        if (!e.target.classList.contains('editable-text-unit') &&
            !e.target.classList.contains('floating-editor')) {
            deselectTextItem();
        }
    } else if (activeTool === 'clear') {
        isSelecting = true;
        startClearStroke(x, y, container);
    } else if (activeTool === 'clearText') {
        isSelecting = true;
        e.preventDefault(); // prevent text-selection from blocking rect-drag
        startClearTextStroke(x, y, container);
        // Note: clearText uses document-level mouseup â€” isSelecting cleared there
    } else if (activeTool === 'moveArea') {
        // Move Area টুল - এরিয়া সিলেক্ট করতে শুরু করুন
        if (!e.target.classList.contains('move-area-selection') &&
            !e.target.closest('.move-area-selection')) {
            startMoveAreaSelection(e, container);
            isSelecting = true;
        }
    }
}

function handlePageMouseMove(e, container) {
    if (isSelecting && activeTool === 'clear') {
        const rect = container.getBoundingClientRect();
        continueClearStroke(e.clientX - rect.left, e.clientY - rect.top, container);
    } else if (isSelecting && activeTool === 'clearText') {
        // handled by document-level listener in startClearTextStroke
    } else if (isSelecting && activeTool === 'moveArea') {
        const rect = container.getBoundingClientRect();
        continueMoveAreaSelection(e, container);
    } else if (isDragging && dragTarget) {
        const rect = container.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        dragTarget.style.left = `${parseFloat(dragTarget.style.left) + (cx - dragStartX)}px`;
        dragTarget.style.top  = `${parseFloat(dragTarget.style.top)  + (cy - dragStartY)}px`;
        dragStartX = cx;
        dragStartY = cy;
    }
}

function handlePageMouseUp(e, container) {
    if (isSelecting && activeTool === 'clear') {
        endClearStroke(container);
        isSelecting = false;
    } else if (isSelecting && activeTool === 'moveArea') {
        endMoveAreaSelection(container);
        isSelecting = false;
    }
    // clearText mouseup is handled at document level in startClearTextStroke
    if (isDragging) {
        finalizeDragging();
        isDragging = false;
        dragTarget = null;
    }
}

function addNewText(x, y, viewport, page, container, overrideBgHex) {
    const patchWidth  = 120 / pdfScale;
    const patchHeight = currentStyle.fontSize + 12;

    let patchData = null;
    let bgColor;

    if (overrideBgHex) {
        // Override mode: text placed on shape/image — skip canvas sampling
        if (overrideBgHex === 'transparent') {
            bgColor = { hex: '#ffffff', r: 1, g: 1, b: 1 };
        } else {
            const orc = hexToRgb(overrideBgHex);
            bgColor = { hex: overrideBgHex, r: orc.r, g: orc.g, b: orc.b };
        }
        currentStyle.bgColor = bgColor.hex;
        document.getElementById('bgColor').value = bgColor.hex;
    } else {
        patchData = sampleBackgroundPatch(
            x / pdfScale,
            y / pdfScale - patchHeight / 2,
            patchWidth, patchHeight, pdfScale
        );
        bgColor = sampleBackgroundColor(x, y);
        currentStyle.bgColor = bgColor.hex;
        document.getElementById('bgColor').value = bgColor.hex;
    }

    const input = document.createElement('div');
    input.contentEditable = 'true';
    input.className       = 'floating-editor';
    input.style.left   = `${x}px`;
    input.style.top    = `${y - currentStyle.fontSize * pdfScale}px`;
    input.style.width  = `${patchWidth * pdfScale}px`;
    input.style.height = `${patchHeight * pdfScale}px`;

    // Force no clipping â€” let the editor grow with typed text
    input.style.overflow     = 'visible';
    input.style.textOverflow = 'clip';
    input.style.whiteSpace   = 'pre';
    input.style.maxWidth     = 'none';
    input.style.width        = 'auto';
    input.style.minWidth     = `${patchWidth * pdfScale}px`;

    if (overrideBgHex === 'transparent') {
        // Transparent bg so image/content beneath shows through
        input.style.backgroundColor = 'transparent';
        input.style.backgroundImage = 'none';
    } else if (overrideBgHex) {
        // Solid override (e.g. shape bg color)
        input.style.backgroundColor = overrideBgHex;
        input.style.backgroundImage = 'none';
    } else if (patchData) {
        input.style.backgroundImage = `url(${patchData})`;
        input.style.backgroundSize  = 'cover';
        input.dataset.patch = patchData;
    } else {
        input.style.backgroundColor = bgColor.hex;
    }

    input.style.fontSize       = `${currentStyle.fontSize * viewport.scale}px`;
    let fnAdd = (currentStyle.fontFamily || 'Helvetica');
    if (fnAdd.includes(' ') && !fnAdd.includes("'")) fnAdd = "'" + fnAdd + "'";
    input.style.fontFamily     = fnAdd;
    input.style.color          = currentStyle.color;
    input.style.fontWeight     = currentStyle.isBold    ? 'bold'      : 'normal';
    input.style.fontStyle      = currentStyle.isItalic  ? 'italic'    : 'normal';
    input.style.textDecoration = currentStyle.isUnderline ? 'underline' : 'none';
    input.textContent = '';

    const rc = hexToRgb(bgColor.hex);
    input.dataset.bgHex = bgColor.hex;
    input.dataset.bgR   = rc.r;
    input.dataset.bgG   = rc.g;
    input.dataset.bgB   = rc.b;

    input.addEventListener('mousedown', ev => ev.stopPropagation());
    input.addEventListener('click',     ev => ev.stopPropagation());

    // â”€â”€ Drag handle for floating editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dragHandle = document.createElement('div');
    dragHandle.className = 'floating-editor-handle';
    dragHandle.title = 'Drag to move';
    dragHandle.innerHTML = 'â ¿';
    dragHandle.style.cssText = `
        position: absolute;
        top: -18px; left: 0;
        background: var(--primary, #7c3aed);
        color: #fff;
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 4px 4px 0 0;
        cursor: grab;
        user-select: none;
        z-index: 10;
        line-height: 16px;
    `;
    let _hDragging = false, _hStartX = 0, _hStartY = 0, _hOrigL = 0, _hOrigT = 0;

    function _onHandleMove(ev) {
        if (!_hDragging) return;
        // Move the wrapper (editorWrap is defined after this function)
        const wrap = input._wrapEl || input;
        wrap.style.left = `${_hOrigL + (ev.clientX - _hStartX)}px`;
        wrap.style.top  = `${_hOrigT + (ev.clientY - _hStartY)}px`;
    }
    function _onHandleUp() {
        if (_hDragging) {
            _hDragging = false;
            dragHandle.style.cursor = 'grab';
            document.removeEventListener('mousemove', _onHandleMove);
            document.removeEventListener('mouseup',   _onHandleUp);
        }
    }
    dragHandle.addEventListener('mousedown', (ev) => {
        _hDragging = true;
        _hStartX = ev.clientX; _hStartY = ev.clientY;
        const wrap = input._wrapEl || input;
        _hOrigL  = parseFloat(wrap.style.left) || 0;
        _hOrigT  = parseFloat(wrap.style.top)  || 0;
        dragHandle.style.cursor = 'grabbing';
        document.addEventListener('mousemove', _onHandleMove);
        document.addEventListener('mouseup',   _onHandleUp);
        ev.preventDefault(); ev.stopPropagation();
    });
    // Place drag handle as a sibling wrapper so it doesn't interfere with contentEditable caret
    const editorWrap = document.createElement('div');
    editorWrap.style.cssText = 'position:absolute;z-index:200;';
    editorWrap.style.left = input.style.left;
    editorWrap.style.top  = input.style.top;
    // Remove position from input since wrapper handles it
    input.style.left = '0';
    input.style.top  = '0';
    input.style.position = 'relative';
    input.style.zIndex = '';

    // Keep drag handle in wrapper above input
    dragHandle.style.position = 'absolute';
    dragHandle.style.top  = '-20px';
    dragHandle.style.left = '0';
    editorWrap.appendChild(dragHandle);
    editorWrap.appendChild(input);

    // Update drag handle move to move the wrapper
    // Override _onHandleMove to move editorWrap instead
    const _origOnHandleMove = _onHandleMove;

    // Prevent wrapper clicks from bubbling to page (would create new text box)
    editorWrap.addEventListener('mousedown', ev => ev.stopPropagation());
    editorWrap.addEventListener('click',     ev => ev.stopPropagation());

    // Append wrapper to page-wrapper
    container.appendChild(editorWrap);

    // Sync input._commit to read wrapper position on commit
    input._wrapEl = editorWrap;

    setTimeout(() => {
        input.focus();
        // Place cursor at end
        try {
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch(e) {}
    }, 20);

    input._commit = () => {
        if (input._committed) return;
        input._committed = true;

        // Get plain text — strip any drag handle elements that may be children of input
        const _cn = input.cloneNode(true);
        _cn.querySelectorAll('.span-drag-handle, .floating-editor-handle').forEach(h => h.remove());
        const newText = (_cn.innerText || _cn.textContent || '').trim();
        const wrap = input._wrapEl;
        // Remove the wrapper (contains both handle + editor)
        if (wrap && wrap.parentNode) wrap.remove();
        else input.remove();

        if (!newText.trim()) { return; }

        // Capture undo snapshot before applying
        captureUndoSnapshot('Add text');

        // Use wrapper position for accurate x/y after drag
        const wrapLeft = wrap ? parseFloat(wrap.style.left) : x;
        const wrapTop  = wrap ? parseFloat(wrap.style.top)  : (y - currentStyle.fontSize * pdfScale);

        const editData = {
            id: 'new-' + Date.now(),
            page:  currentPageNum,
            isNew: true,
            originalX: x / pdfScale,
            originalY: (container.offsetHeight - y) / pdfScale - currentStyle.fontSize,
            x:     wrapLeft / pdfScale,
            y:     (container.offsetHeight - wrapTop) / pdfScale - currentStyle.fontSize,
            text:  newText,
            size:  currentStyle.fontSize,
            color: currentStyle.color,
            patch: input.dataset.patch,
            bgHex: input.dataset.bgHex,
            bgR:   parseFloat(input.dataset.bgR),
            bgG:   parseFloat(input.dataset.bgG),
            bgB:   parseFloat(input.dataset.bgB),
            font:  currentStyle.fontFamily,
            isBold:      currentStyle.isBold,
            isItalic:    currentStyle.isItalic,
            isUnderline: currentStyle.isUnderline,
            width:  patchWidth,
            height: patchHeight
        };

        textEdits.push(editData);

        const textItem = document.createElement('span');
        textItem.className    = 'editable-text-unit modified draggable';
        textItem.textContent  = newText;
        textItem.style.position        = 'absolute';
        textItem.style.left            = `${wrapLeft}px`;
        textItem.style.top             = `${wrapTop}px`;
        textItem.style.fontSize        = input.style.fontSize;
        textItem.style.fontFamily      = input.style.fontFamily;
        textItem.style.fontWeight      = input.style.fontWeight;
        textItem.style.fontStyle       = input.style.fontStyle;
        textItem.style.textDecoration  = input.style.textDecoration;
        textItem.style.color           = input.style.color;
        // FIXED: transparent background â€” no ash/grey box after commit
        textItem.style.backgroundColor = 'transparent';
        textItem.style.backgroundImage = 'none';
        textItem.style.display         = 'inline-block';
        textItem.style.pointerEvents   = 'auto';
        textItem.style.overflow        = 'visible';
        textItem.style.whiteSpace      = 'pre';
        textItem.style.minWidth        = `${editData.width  * pdfScale}px`;
        textItem.style.minHeight       = `${editData.height * pdfScale}px`;
        textItem.dataset.editId        = editData.id;
        textItem.dataset.isOriginal    = 'false';
        textItem.style.cursor          = 'move';
        textItem.style.zIndex          = '200';

        // â”€â”€ Drag handle badge (visible on hover, works in any tool mode) â”€â”€
        // ── Drag handle ─────────────────────────────────────────────────────
        // CRITICAL: spanHandle must NOT be a child of textItem.
        // If inside the span, its symbol leaks into innerHTML/textContent
        // and appears as garbled characters on subsequent edits.
        // Appended as a sibling to textItem in the text-layer, positioned via sync.
        const spanHandle = document.createElement('div');
        spanHandle.className = 'span-drag-handle';
        spanHandle.setAttribute('data-drag-handle', 'true');
        spanHandle.title = 'Drag to move';
        spanHandle.textContent = '\u2725'; // ✥ as unicode escape, never garbles
        spanHandle.style.cssText = `
            position: absolute;
            background: var(--primary, #7c3aed);
            color: #fff;
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 3px 3px 0 0;
            cursor: grab;
            user-select: none;
            z-index: 120;
            opacity: 0;
            transition: opacity 0.15s;
            pointer-events: auto;
            line-height: 14px;
            white-space: nowrap;
        `;

        // Sync handle position to sit just above textItem
        function syncHandlePos() {
            const cont2 = textItem.closest('.pdf-page-wrapper') || container;
            const pRect = cont2.getBoundingClientRect();
            const tRect = textItem.getBoundingClientRect();
            spanHandle.style.left = (tRect.left - pRect.left) + 'px';
            spanHandle.style.top  = (tRect.top  - pRect.top - 18) + 'px';
        }

        textItem.addEventListener('mouseenter', () => { syncHandlePos(); spanHandle.style.opacity = '1'; });
        textItem.addEventListener('mouseleave', () => { spanHandle.style.opacity = '0'; });
        spanHandle.addEventListener('mouseenter', () => { spanHandle.style.opacity = '1'; });
        spanHandle.addEventListener('mouseleave', () => { spanHandle.style.opacity = '0'; });

        let _shDrag = false, _shStartX = 0, _shStartY = 0, _shOrigL = 0, _shOrigT = 0;
        spanHandle.addEventListener('mousedown', (ev) => {
            _shDrag = true;
            _shStartX = ev.clientX; _shStartY = ev.clientY;
            _shOrigL = parseFloat(textItem.style.left) || 0;
            _shOrigT = parseFloat(textItem.style.top)  || 0;
            spanHandle.style.cursor = 'grabbing';
            ev.preventDefault(); ev.stopPropagation();
            function _onShMove(em) {
                if (!_shDrag) return;
                textItem.style.left = (_shOrigL + (em.clientX - _shStartX)) + 'px';
                textItem.style.top  = (_shOrigT + (em.clientY - _shStartY)) + 'px';
                syncHandlePos();
            }
            function _onShUp() {
                if (_shDrag) {
                    _shDrag = false;
                    spanHandle.style.cursor = 'grab';
                    const cont2 = textItem.closest('.pdf-page-wrapper');
                    if (cont2) {
                        const edIdx = textEdits.findIndex(ed => ed.id === editData.id);
                        if (edIdx > -1) {
                            textEdits[edIdx].x = parseFloat(textItem.style.left) / pdfScale;
                            textEdits[edIdx].y = (cont2.offsetHeight - parseFloat(textItem.style.top)) / pdfScale - textEdits[edIdx].size;
                        }
                    }
                    document.removeEventListener('mousemove', _onShMove);
                    document.removeEventListener('mouseup', _onShUp);
                }
            }
            document.addEventListener('mousemove', _onShMove);
            document.addEventListener('mouseup', _onShUp);
        });

        // Attach _triggerClearTextOnly to new textItem so rect-drag clearText also works
        textItem._triggerClearTextOnly = () => {
            if (textItem._cleared) return;
            textItem._cleared = true;
            const existingIdx = textEdits.findIndex(ed => ed.id === editData.id);
            if (existingIdx > -1) {
                textEdits[existingIdx].text = '';
                textEdits[existingIdx].color = 'transparent';
            }
            textItem.textContent = '';
            textItem.style.color = 'transparent';
        };

        textItem.addEventListener('mousedown', (ev) => {
            if (activeTool === 'clear') {
                // New items: clear text and background
                textItem._cleared = true;
                textItem.textContent = '';
                textItem.style.color = 'transparent';
                textItem.style.backgroundColor = 'transparent';
                const existingIdx = textEdits.findIndex(ed => ed.id === editData.id);
                if (existingIdx > -1) {
                    textEdits[existingIdx].text = '';
                    textEdits[existingIdx].color = 'transparent';
                }
                ev.stopPropagation();
                return;
            }
            if (activeTool === 'clearText') {
                // Clear this specific item on click!
                textItem._cleared = true;
                textItem._textCleared = true;
                textItem.textContent = '';
                textItem.style.color = 'transparent';
                textItem.style.backgroundColor = 'transparent';
                textItem.style.backgroundImage = 'none';
                textItem.style.pointerEvents = 'none';
                const existingIdx = textEdits.findIndex(ed => ed.id === editData.id || `${ed.page}-${ed.originalX}-${ed.originalY}` === ed.id);
                if (existingIdx > -1) {
                    textEdits[existingIdx].text = '';
                    textEdits[existingIdx].color = 'transparent';
                }
                captureUndoSnapshot('Clear single text');
                // Don't stop propagation completely, so drag-select can start if they drag
            }
            if (activeTool === 'text') {
                ev.stopPropagation(); // let click handle it
                return;
            }
            if (activeTool === 'select') {
                selectTextItem(textItem); startDragging(ev, textItem); ev.stopPropagation();
            }
        });
        textItem.addEventListener('click', (ev) => {
            if (activeTool === 'text') {
                deselectTextItem();
                // FIX: সব open floating-editor commit করো আগে
                document.querySelectorAll('.floating-editor').forEach(fe => {
                    if (fe._commit) fe._commit();
                });
                startEditing(ev, editData, null, viewport, page);
                ev.stopPropagation();
                return;
            }
            if (activeTool === 'select' && !isDragging) selectTextItem(textItem);
            ev.stopPropagation();
        });
        textItem.addEventListener('dblclick', (ev) => {
            deselectTextItem();
            // FIX: সব open floating-editor commit করো
            document.querySelectorAll('.floating-editor').forEach(fe => {
                if (fe._commit) fe._commit();
            });
            startEditing(ev, editData, null, viewport, page);
            ev.stopPropagation();
        });

        input.remove();
        // Append textItem to text-layer; append spanHandle as a sibling (NOT inside textItem)
        // This prevents handle symbol from ever leaking into textContent/innerHTML
        const tl = container.querySelector('.text-layer');
        const tlParent = tl || container;
        tlParent.appendChild(textItem);
        tlParent.appendChild(spanHandle); // sibling, not child of textItem

        // â”€â”€ FIX: In text mode, allow dragging committed spans by holding mousedown â”€â”€
        let _dragPending = false, _dragMoved = false, _pdx = 0, _pdy = 0;
        textItem.addEventListener('mousedown', (ev) => {
            if (activeTool === 'clear') {
                textItem._cleared = true;
                textItem.textContent = '';
                textItem.style.color = 'transparent';
                textItem.style.backgroundColor = 'transparent';
                const existingIdx2 = textEdits.findIndex(ed => ed.id === editData.id);
                if (existingIdx2 > -1) { textEdits[existingIdx2].text = ''; textEdits[existingIdx2].color = 'transparent'; }
                ev.stopPropagation();
                return;
            }
            if (activeTool === 'clearText') {
                textItem._cleared = true;
                textItem._textCleared = true;
                textItem.textContent = '';
                textItem.style.color = 'transparent';
                textItem.style.backgroundColor = 'transparent';
                textItem.style.backgroundImage = 'none';
                textItem.style.pointerEvents = 'none';
                const existingIdx2 = textEdits.findIndex(ed => ed.id === editData.id || `${ed.page}-${ed.originalX}-${ed.originalY}` === ed.id);
                if (existingIdx2 > -1) {
                    textEdits[existingIdx2].text = '';
                    textEdits[existingIdx2].color = 'transparent';
                }
                captureUndoSnapshot('Clear single text');
                return;
            }
            if (activeTool === 'select') {
                selectTextItem(textItem); startDragging(ev, textItem); ev.stopPropagation();
                return;
            }
            if (activeTool === 'text') {
                // Start a pending drag â€” if mouse moves it's a drag, if mouseup quickly it's a click-to-edit
                _dragPending = true;
                _dragMoved   = false;
                _pdx = ev.clientX;
                _pdy = ev.clientY;
                ev.stopPropagation();
            }
        });
        textItem.addEventListener('mousemove', (ev) => {
            if (_dragPending && activeTool === 'text') {
                const dx = Math.abs(ev.clientX - _pdx);
                const dy = Math.abs(ev.clientY - _pdy);
                if (!_dragMoved && (dx > 4 || dy > 4)) {
                    _dragMoved = true;
                    selectTextItem(textItem);
                    startDragging({ clientX: _pdx, clientY: _pdy }, textItem);
                }
                if (_dragMoved) {
                    const cont2 = textItem.closest('.pdf-page-wrapper');
                    const r2 = cont2.getBoundingClientRect();
                    const cx = ev.clientX - r2.left;
                    const cy = ev.clientY - r2.top;
                    textItem.style.left = `${parseFloat(textItem.style.left) + (cx - dragStartX)}px`;
                    textItem.style.top  = `${parseFloat(textItem.style.top)  + (cy - dragStartY)}px`;
                    dragStartX = cx;
                    dragStartY = cy;
                    ev.stopPropagation();
                }
            }
        });
        textItem.addEventListener('mouseup', (ev) => {
            if (_dragPending) {
                if (_dragMoved) {
                    finalizeDragging();
                    isDragging = false; dragTarget = null;
                }
                _dragPending = false; _dragMoved = false;
                ev.stopPropagation();
            }
        });
    };
}

function startDragging(e, target) {
    isDragging  = true;
    dragTarget  = target;
    const cont  = target.closest('.pdf-page-wrapper');
    const rect  = cont.getBoundingClientRect();
    dragStartX  = e.clientX - rect.left;
    dragStartY  = e.clientY - rect.top;
    e.stopPropagation();
}

function finalizeDragging() {
    if (!dragTarget) return;
    const id   = dragTarget.dataset.editId;
    const edit = textEdits.find(ed =>
        ed.id === id || `${ed.page}-${ed.originalX}-${ed.originalY}` === id);
    if (edit) {
        const cont = dragTarget.closest('.pdf-page-wrapper');
        edit.x = parseFloat(dragTarget.style.left) / pdfScale;
        edit.y = (cont.offsetHeight / pdfScale) -
                 (parseFloat(dragTarget.style.top) / pdfScale) - edit.size;
    }
}

function startClearStroke(x, y, container) {
    activeClearContainer = container;
    if (eraserMode === 'brush') {
        let ov = container.querySelector('.clear-overlay');
        if (!ov) {
            ov = document.createElement('canvas');
            ov.className = 'clear-overlay';
            const bc = container.querySelector('canvas');
            ov.width = bc.width; ov.height = bc.height;
            ov.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:50;';
            container.appendChild(ov);
        }
        let pe = clearStrokes.find(s => s.page === currentPageNum);
        if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
        paintBrush(x, y, pe, container);
    } else {
        eraserRectStart = { x, y };
        eraserRectEl = document.createElement('div');
        eraserRectEl.className = 'eraser-rect-preview';
        eraserRectEl.style.cssText =
            `position:absolute;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;z-index:200;`;
        container.appendChild(eraserRectEl);
    }
}

function paintBrush(x, y, pageEntry, container) {
    const half = brushSize / 2;
    const cont = container || activeClearContainer;
    if (!cont) return;
    const contRect = cont.getBoundingClientRect();

    cont.querySelectorAll('.editable-text-unit').forEach(span => {
        // Skip already-cleared spans
        if (span.style.color === 'transparent' && !span.textContent.trim()) return;
        // Skip floating editor
        if (span.classList.contains('floating-editor')) return;

        // Use getBoundingClientRect for accurate hit-test, convert to container-relative coords
        const sr = span.getBoundingClientRect();
        const sl = sr.left - contRect.left;
        const st = sr.top  - contRect.top;
        const sw = sr.width  || span.offsetWidth  || 10;
        const sh = sr.height || span.offsetHeight || 10;

        // x,y are already container-relative (from mousemove handler)
        const hit = sl < x + half && sl + sw > x - half &&
                    st < y + half && st + sh > y - half;

        if (hit && span._triggerClear) span._triggerClear();
    });
}

function continueClearStroke(x, y, container) {
    if (eraserMode === 'brush') {
        const pe = clearStrokes.find(s => s.page === currentPageNum);
        if (pe) paintBrush(x, y, pe, container);
    } else if (eraserRectEl) {
        const l = Math.min(eraserRectStart.x, x);
        const t = Math.min(eraserRectStart.y, y);
        eraserRectEl.style.left   = `${l}px`;
        eraserRectEl.style.top    = `${t}px`;
        eraserRectEl.style.width  = `${Math.abs(x - eraserRectStart.x)}px`;
        eraserRectEl.style.height = `${Math.abs(y - eraserRectStart.y)}px`;
    }
}

function endClearStroke(container) {
    if (eraserMode === 'rect' && eraserRectEl) {
        const l = parseFloat(eraserRectEl.style.left),
              t = parseFloat(eraserRectEl.style.top),
              w = parseFloat(eraserRectEl.style.width)  || 0,
              h = parseFloat(eraserRectEl.style.height) || 0;
        if (w > 2 && h > 2) {
            // Capture undo before making changes
            captureUndoSnapshot('Erase area');
            const contRect = container.getBoundingClientRect();

            // â”€â”€ FIX: Sample actual background pixels (image-aware) â”€â”€
            // sampleBackgroundPatch captures the real canvas pixels (including images)
            const patchDataUrl = sampleBackgroundPatch(
                l / pdfScale,
                t / pdfScale,
                w / pdfScale,
                h / pdfScale,
                pdfScale
            );
            // Fallback: average color (for solid-white PDFs or if canvas sampling fails)
            const bgSample = sampleBackgroundColor(l + w / 2, t + h / 2);

            // Clear ALL text spans that intersect the rect
            container.querySelectorAll('.editable-text-unit').forEach(span => {
                if (span.classList.contains('floating-editor')) return;
                const sr = span.getBoundingClientRect();
                const sl = sr.left - contRect.left;
                const st = sr.top  - contRect.top;
                const sw = sr.width  || span.offsetWidth  || 10;
                const sh = sr.height || span.offsetHeight || 10;
                if (sl < l + w && sl + sw > l && st < t + h && st + sh > t) {
                    span.textContent = '';
                    span.style.color = 'transparent';
                    span.style.backgroundColor = 'transparent';
                    span.style.backgroundImage = 'none';
                    span._cleared = true;
                }
            });

            // â”€â”€ Visual patch: use real background image if available, else solid color â”€â”€
            const patchEl = document.createElement('div');
            patchEl.className = 'clear-patch';
            if (patchDataUrl) {
                // Real pixel-accurate background (works on images too)
                patchEl.style.cssText = `
                    position: absolute;
                    left: ${l}px; top: ${t}px;
                    width: ${w}px; height: ${h}px;
                    background-image: url(${patchDataUrl});
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    pointer-events: none;
                    z-index: 5;
                `;
            } else {
                patchEl.style.cssText = `
                    position: absolute;
                    left: ${l}px; top: ${t}px;
                    width: ${w}px; height: ${h}px;
                    background-color: ${bgSample.hex};
                    pointer-events: none;
                    z-index: 5;
                `;
            }
            container.appendChild(patchEl);

            // Save for PDF export â€” use average bg color for the whiteout rect
            // (PDF-lib can't embed arbitrary image patches inline easily)
            let pe = clearStrokes.find(s => s.page === currentPageNum);
            if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
            pe.rects.push({
                x: l / pdfScale,
                y: (container.offsetHeight - t - h) / pdfScale,
                w: w / pdfScale,
                h: h / pdfScale,
                r: bgSample.r,
                g: bgSample.g,
                b: bgSample.b,
                // Store patch for PDF embed if needed in future
                patch: patchDataUrl || null
            });
        }
        eraserRectEl.remove();
        eraserRectEl = null;
    }
    activeClearContainer = null;
}

// â”€â”€ Clear Text Only (rect drag â€” no background change) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function startClearTextStroke(x, y, container) {
    clearTextContainer = container;
    clearTextRectStart = { x, y };
    clearTextRectEl = document.createElement('div');
    clearTextRectEl.style.cssText =
        `position:absolute;left:${x}px;top:${y}px;width:0;height:0;
         border:3px dashed #ff1493;background:rgba(255,20,147,0.15);
         pointer-events:none;z-index:99999;box-sizing:border-box;`;
    container.appendChild(clearTextRectEl);

    // Attach document-level move/up so drag works even outside the page wrapper
    _clearTextDocMouseMove = (e) => {
        if (!clearTextRectEl || !clearTextContainer) return;
        const contRect = clearTextContainer.getBoundingClientRect();
        const cx = e.clientX - contRect.left;
        const cy = e.clientY - contRect.top;
        continueClearTextStroke(cx, cy);
    };
    _clearTextDocMouseUp = (e) => {
        if (!clearTextContainer) return;
        const contRect = clearTextContainer.getBoundingClientRect();
        const cx = e.clientX - contRect.left;
        const cy = e.clientY - contRect.top;
        continueClearTextStroke(cx, cy); // finalize rect size
        endClearTextStroke(clearTextContainer);
        isSelecting = false;
        document.removeEventListener('mousemove', _clearTextDocMouseMove);
        document.removeEventListener('mouseup',   _clearTextDocMouseUp);
        _clearTextDocMouseMove = null;
        _clearTextDocMouseUp   = null;
    };
    document.addEventListener('mousemove', _clearTextDocMouseMove);
    document.addEventListener('mouseup',   _clearTextDocMouseUp);
}

function continueClearTextStroke(x, y) {
    if (!clearTextRectEl) return;
    const l = Math.min(clearTextRectStart.x, x);
    const t = Math.min(clearTextRectStart.y, y);
    clearTextRectEl.style.left   = `${l}px`;
    clearTextRectEl.style.top    = `${t}px`;
    clearTextRectEl.style.width  = `${Math.abs(x - clearTextRectStart.x)}px`;
    clearTextRectEl.style.height = `${Math.abs(y - clearTextRectStart.y)}px`;
}

// ── Background Canvas Cache ──────────────────────────────────────────────────
// We keep a "clean" render of the current page (no text layer manipulation needed
// because PDF.js renders text INTO the canvas — we re-render on a hidden canvas
// that we keep as a background-only reference).
// _bgCanvasCache → core/renderer.js
let _bgRenderPromise = null;    // prevent concurrent renders

async function ensureBgCanvas() {
    // Return cached version if already built for this page
    if (_bgCanvasCache && _bgCanvasCache.pageNum === currentPageNum) {
        return _bgCanvasCache.canvas;
    }
    // Wait if a render is already in progress
    if (_bgRenderPromise) { await _bgRenderPromise; }
    if (_bgCanvasCache && _bgCanvasCache.pageNum === currentPageNum) {
        return _bgCanvasCache.canvas;
    }

    if (!currentPdfObj) return null;

    let resolve;
    _bgRenderPromise = new Promise(r => { resolve = r; });

    try {
        // ── Strategy: render the page with text rendering ops DISABLED ──
        // PDF.js supports a custom operatorList render via intentType / filterFactory.
        // The cleanest cross-browser approach is to use a background render task
        // that skips OPS.showText, OPS.showSpacedText, OPS.nextLineShowText,
        // OPS.nextLineSetSpacingShowText, OPS.setFont.
        const page     = await currentPdfObj.getPage(currentPageNum);
        const viewport = page.getViewport({ scale: pdfScale });

        const bgCv     = document.createElement('canvas');
        bgCv.width     = viewport.width;
        bgCv.height    = viewport.height;
        const bgCtx    = bgCv.getContext('2d', { willReadFrequently: true });

        // Try text-suppressed render first via operatorList interception
        let rendered = false;
        try {
            const opList = await page.getOperatorList();
            // Text-related OPS codes in PDF.js:
            // OPS.showText=45, OPS.showSpacedText=46, OPS.nextLineShowText=47,
            // OPS.nextLineSetSpacingShowText=48, OPS.setFont=27, OPS.beginText=39
            // We patch the operator list to replace text-painting ops with no-ops
            const TEXT_OPS = new Set([39, 40, 43, 44, 45, 46, 47, 48, 49, 50]);
            for (let i = 0; i < opList.fnArray.length; i++) {
                if (TEXT_OPS.has(opList.fnArray[i])) {
                    // Replace with OPS.save (1) which is effectively a no-op paint
                    // Actually replace with 0 so PDF.js just skips unknown fn
                    opList.fnArray[i] = 0;
                    opList.argsArray[i] = [];
                }
            }
            const gfx = new pdfjsLib.PDFPageProxy;
            // Fall back if this approach is not available
        } catch(_) {}

        // Most reliable method: render normally into bgCv, then
        // overlay the existing main canvas on top to grab only the visual background.
        // Since PDF.js renders BOTH graphics AND text into the same canvas,
        // the only way to get a clean background is to render a SECOND time
        // with text visibility hidden at the DOM level while sampling.
        // We do a full render here; the text gets covered by the inpainted patch anyway.
        await page.render({ canvasContext: bgCtx, viewport }).promise;

        // ── Post-process: remove text pixels by inpainting from edge samples ──
        // This improves gradient accuracy significantly vs. using the text-bearing canvas.
        // We detect text pixels (dark, high-contrast against local bg) and
        // replace them with interpolated background values.
        try {
            const idata = bgCtx.getImageData(0, 0, bgCv.width, bgCv.height);
            const d = idata.data;
            const W = bgCv.width, H = bgCv.height;
            const RADIUS = 4;
            const DARK_THRESH = 80; // pixels darker than this are likely text
            const CONTRAST_THRESH = 60; // local contrast threshold

            // Build a mask of "likely text" pixels
            const mask = new Uint8Array(W * H);
            for (let y = RADIUS; y < H - RADIUS; y++) {
                for (let x = RADIUS; x < W - RADIUS; x++) {
                    const i = (y * W + x) * 4;
                    const lum = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
                    if (lum < DARK_THRESH) {
                        // Check local contrast: compare to nearby pixels
                        let maxLum = 0;
                        for (let dy = -RADIUS; dy <= RADIUS; dy += 2) {
                            for (let dx = -RADIUS; dx <= RADIUS; dx += 2) {
                                const ni = ((y+dy)*W + (x+dx))*4;
                                const nl = d[ni]*0.299 + d[ni+1]*0.587 + d[ni+2]*0.114;
                                if (nl > maxLum) maxLum = nl;
                            }
                        }
                        if (maxLum - lum > CONTRAST_THRESH) mask[y*W+x] = 1;
                    }
                }
            }

            // Inpaint masked pixels using surrounding non-masked pixels (weighted average)
            const INPAINT_R = 6;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    if (!mask[y*W+x]) continue;
                    let sr=0,sg=0,sb=0,wt=0;
                    for (let dy = -INPAINT_R; dy <= INPAINT_R; dy++) {
                        for (let dx = -INPAINT_R; dx <= INPAINT_R; dx++) {
                            const ny=y+dy, nx=x+dx;
                            if (ny<0||ny>=H||nx<0||nx>=W) continue;
                            if (mask[ny*W+nx]) continue;
                            const ni=(ny*W+nx)*4;
                            const dist=Math.sqrt(dx*dx+dy*dy)||1;
                            const w=1/(dist*dist);
                            sr+=d[ni]*w; sg+=d[ni+1]*w; sb+=d[ni+2]*w; wt+=w;
                        }
                    }
                    if (wt>0) {
                        const i=(y*W+x)*4;
                        d[i]  =Math.round(sr/wt);
                        d[i+1]=Math.round(sg/wt);
                        d[i+2]=Math.round(sb/wt);
                    }
                }
            }
            bgCtx.putImageData(idata, 0, 0);
        } catch(inpaintErr) {
            // If pixel manipulation fails (e.g. cross-origin), keep the raw render
            console.warn('BgCanvas inpaint failed:', inpaintErr);
        }

        _bgCanvasCache = { pageNum: currentPageNum, canvas: bgCv };
        return bgCv;
    } catch (e) {
        console.warn('BgCanvas render failed:', e);
        return null;
    } finally {
        _bgRenderPromise = null;
        resolve && resolve();
    }
}

// Call this whenever page changes so cache is refreshed
function invalidateBgCanvas() {
    _bgCanvasCache = null;
}

// ── generateInpaintedPatch ───────────────────────────────────────────────────
// Returns a dataURL of the background patch at (x,y,width,height) in CANVAS
// pixel coordinates. Uses the background canvas cache for pixel-perfect results.
// Falls back to Coons-patch edge interpolation if re-render is not ready yet.
function generateInpaintedPatch(x, y, width, height) {
    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    const mainCanvas  = pageWrapper?.querySelector('canvas');
    if (!mainCanvas) return null;

    const pw = Math.max(2, Math.round(width));
    const ph = Math.max(2, Math.round(height));
    const px = Math.max(0, Math.round(x));
    const py = Math.max(0, Math.round(y));

    // ── Path A: use cached background canvas (pixel-perfect, async) ──────
    // We kick off the bg render immediately so it's ready next time.
    // For the CURRENT call we fall through to synchronous Coons Patch,
    // UNLESS the cache is already warm for this page.
    if (_bgCanvasCache && _bgCanvasCache.pageNum === currentPageNum) {
        const bgCv = _bgCanvasCache.canvas;
        const outCv = document.createElement('canvas');
        outCv.width = pw; outCv.height = ph;
        const oCtx = outCv.getContext('2d');
        try {
            oCtx.drawImage(bgCv, px, py, pw, ph, 0, 0, pw, ph);
            // Verify real pixels
            const check = oCtx.getImageData(0, 0, 1, 1).data;
            if (check[3] > 0) return outCv.toDataURL('image/png');
        } catch(e) { /* fall through */ }
    }

    // Kick off background render asynchronously so cache is warm for next call
    ensureBgCanvas().catch(() => {});

    // ── Path B: synchronous Coons Patch edge interpolation (fallback) ────
    // Works well for gradients by interpolating from clean edge pixels
    // that are far enough outside the text area.
    return _coonsPatchFromMainCanvas(mainCanvas, pageWrapper, px, py, pw, ph);
}

function _coonsPatchFromMainCanvas(mainCanvas, pageWrapper, px, py, pw, ph) {
    // Use a large offset so edge samples land well outside any text stroke
    const offset = Math.max(20, Math.round(Math.max(pw, ph) * 0.4));
    const ex = Math.max(0, px - offset);
    const ey = Math.max(0, py - offset);
    const ew = Math.min(mainCanvas.width  - ex, pw + 2 * offset);
    const eh = Math.min(mainCanvas.height - ey, ph + 2 * offset);
    if (ew <= 0 || eh <= 0) return null;

    const tempCv = document.createElement('canvas');
    tempCv.width = ew; tempCv.height = eh;
    const tx = tempCv.getContext('2d', { willReadFrequently: true });

    // Hide all DOM overlays (text-layer spans, patches) — these are on top of
    // the canvas but do NOT affect the canvas pixels themselves.
    const overlays = pageWrapper.querySelectorAll('.text-layer, .clear-overlay, .clear-patch');
    overlays.forEach(o => { o.style.visibility = 'hidden'; });
    tx.drawImage(mainCanvas, ex, ey, ew, eh, 0, 0, ew, eh);
    overlays.forEach(o => { o.style.visibility = ''; });

    const imgData = tx.getImageData(0, 0, ew, eh).data;

    function getPix(lx, ly) {
        lx = Math.max(0, Math.min(ew - 1, Math.round(lx)));
        ly = Math.max(0, Math.min(eh - 1, Math.round(ly)));
        const i = (ly * ew + lx) * 4;
        return { r: imgData[i], g: imgData[i+1], b: imgData[i+2] };
    }

    // Large-radius median filter — radius proportional to font size
    // so thick strokes don't pollute the edge sample
    function getCleanEdgeColor(cx, cy) {
        const radius = Math.max(8, Math.round(offset * 0.5));
        const rArr = [], gArr = [], bArr = [];
        for (let dy = -radius; dy <= radius; dy++)
            for (let dx = -radius; dx <= radius; dx++) {
                const p = getPix(cx + dx, cy + dy);
                rArr.push(p.r); gArr.push(p.g); bArr.push(p.b);
            }
        rArr.sort((a, b) => a - b);
        gArr.sort((a, b) => a - b);
        bArr.sort((a, b) => a - b);
        const mid = rArr.length >> 1;
        return { r: rArr[mid], g: gArr[mid], b: bArr[mid] };
    }

    // Sample edges from OUTSIDE the text bounding box (offset band)
    // Left/right: sample at x = offset-2 and x = offset+pw+2 (well outside text)
    const sampleLeft  = Math.max(2, offset - 4);
    const sampleRight = Math.min(ew - 3, offset + pw + 4);
    const sampleTop   = Math.max(2, offset - 4);
    const sampleBot   = Math.min(eh - 3, offset + ph + 4);

    const leftEdge = [], rightEdge = [], topEdge = [], bottomEdge = [];
    for (let cy = 0; cy < ph; cy++) {
        leftEdge.push(getCleanEdgeColor(sampleLeft,  offset + cy));
        rightEdge.push(getCleanEdgeColor(sampleRight, offset + cy));
    }
    for (let cx = 0; cx < pw; cx++) {
        topEdge.push(getCleanEdgeColor(offset + cx, sampleTop));
        bottomEdge.push(getCleanEdgeColor(offset + cx, sampleBot));
    }

    const TL = leftEdge[0], BL = leftEdge[ph-1];
    const TR = rightEdge[0], BR = rightEdge[ph-1];

    const outCv = document.createElement('canvas');
    outCv.width = pw; outCv.height = ph;
    const oCtx  = outCv.getContext('2d');
    const outImg = oCtx.createImageData(pw, ph);
    const data   = outImg.data;

    for (let cy = 0; cy < ph; cy++) {
        for (let cx = 0; cx < pw; cx++) {
            const u = pw > 1 ? cx / (pw - 1) : 0.5;
            const v = ph > 1 ? cy / (ph - 1) : 0.5;
            const L = leftEdge[cy], R = rightEdge[cy];
            const T = topEdge[cx],  B = bottomEdge[cx];
            const wTL=(1-u)*(1-v), wTR=u*(1-v), wBL=(1-u)*v, wBR=u*v;
            const i = (cy * pw + cx) * 4;
            data[i]  =Math.max(0,Math.min(255, L.r*(1-u)+R.r*u + T.r*(1-v)+B.r*v - (TL.r*wTL+TR.r*wTR+BL.r*wBL+BR.r*wBR)));
            data[i+1]=Math.max(0,Math.min(255, L.g*(1-u)+R.g*u + T.g*(1-v)+B.g*v - (TL.g*wTL+TR.g*wTR+BL.g*wBL+BR.g*wBR)));
            data[i+2]=Math.max(0,Math.min(255, L.b*(1-u)+R.b*u + T.b*(1-v)+B.b*v - (TL.b*wTL+TR.b*wTR+BL.b*wBL+BR.b*wBR)));
            data[i+3]=255;
        }
    }
    oCtx.putImageData(outImg, 0, 0);
    return outCv.toDataURL('image/png');
}

function endClearTextStroke(container) {
    if (!clearTextRectEl) { clearTextContainer = null; return; }
    const l = parseFloat(clearTextRectEl.style.left)   || 0;
    const t = parseFloat(clearTextRectEl.style.top)    || 0;
    const w = parseFloat(clearTextRectEl.style.width)  || 0;
    const h = parseFloat(clearTextRectEl.style.height) || 0;

    clearTextRectEl.remove();
    clearTextRectEl = null;

    if (w < 3 || h < 3) { clearTextContainer = null; return; }

    captureUndoSnapshot('Clear text area');

    let clearedCount = 0;
    const contRect = container.getBoundingClientRect();

    // 1. Clear editable text units (user-added text) — text only, NO background change
    container.querySelectorAll('.editable-text-unit').forEach(span => {
        if (span.classList.contains('floating-editor')) return;

        const sr   = span.getBoundingClientRect();
        const sl   = sr.left - contRect.left;
        const st   = sr.top  - contRect.top;
        const sw   = sr.width  || span.offsetWidth  || 20;
        const sh   = sr.height || span.offsetHeight || 10;

        if (sl < l + w && sl + sw > l && st < t + h && st + sh > t) {
            clearedCount++;
            span._cleared = true;
            span._textCleared = true;
            
            // ✅ CRITICAL: Save original background BEFORE clearing text
            const originalBgColor = span.style.backgroundColor || 'transparent';
            const originalBgImage = span.style.backgroundImage || 'none';
            
            // Clear only the text content and color
            span.textContent = '';
            span.style.color = 'transparent';
            
            // ✅ PRESERVE background - do NOT change it
            span.style.backgroundColor = originalBgColor;
            span.style.backgroundImage = originalBgImage;
            span.style.pointerEvents = 'auto';

            const editId = span.dataset.editId || `ct-${currentPageNum}-${Math.round(sl)}-${Math.round(st)}`;
            const existingIdx = textEdits.findIndex(ed => ed.id === editId || `${ed.page}-${ed.originalX}-${ed.originalY}` === editId);
            const clearEntry = {
                id: editId, page: currentPageNum, isNew: false,
                originalX: sl / pdfScale, originalY: (container.offsetHeight - st - sh) / pdfScale,
                x: sl / pdfScale, y: (container.offsetHeight - st - sh) / pdfScale,
                text: '', size: parseFloat(span.style.fontSize) / pdfScale || 12,
                color: 'transparent', bgHex: 'transparent',
                bgR: 1, bgG: 1, bgB: 1,
                font: 'Helvetica', isBold: false, isItalic: false, isUnderline: false,
                width: sw / pdfScale, height: sh / pdfScale
            };
            if (existingIdx > -1) textEdits[existingIdx] = clearEntry;
            else textEdits.push(clearEntry);
        }
    });

    // 2. Clear PDF.js native text spans from .text-layer — text only, NO background change
    const textLayer = container.querySelector('.text-layer');
    if (textLayer) {
        textLayer.querySelectorAll('span').forEach(nativeSpan => {
            const sr   = nativeSpan.getBoundingClientRect();
            const sl   = sr.left - contRect.left;
            const st   = sr.top  - contRect.top;
            const sw   = sr.width  || nativeSpan.offsetWidth  || 20;
            const sh   = sr.height || nativeSpan.offsetHeight || 10;

            if (sl < l + w && sl + sw > l && st < t + h && st + sh > t) {
                clearedCount++;
                nativeSpan.style.color = 'transparent';
                nativeSpan.style.visibility = 'hidden';
                nativeSpan.textContent = '';
                // ✅ Do NOT touch background — leave PDF background completely intact
            }
        });
    }

    // 3. Store text-clear info for PDF rendering (transparent text, no background rect)
    // We store these as textEdits entries only — no clearStrokes background rect needed.
    // This ensures the PDF export only hides the text, not the background.

    if (clearedCount === 0) {
        // Nothing was cleared — pop the undo snapshot we just added
        undoHistory.pop();
    }

    // ✅ NO patch div created, NO background color sampled, NO background changed.
    // The background stays exactly as it was in the original PDF.

    clearTextContainer = null;
}

// ────────────────────────────────────────────────────────────
// Move Area - সিলেক্টেড এরিয়া টেক্সট এবং ব্যাকগ্রাউন্ড সহ মুভ করা
// ────────────────────────────────────────────────────────────
let moveAreaActive = false;
let moveAreaStart = null;
let moveAreaSelection = null;
let moveAreaRect = null;
let moveAreaTarget = null;
let moveAreaOriginalPosition = null;
let moveAreaDragging = false;
let moveAreaDragStartX = 0;
let moveAreaDragStartY = 0;
let moveAreaOrigLeft = 0;
let moveAreaOrigTop = 0;
let activeTableDrag = null;  // টেবিল ড্র্যাগ স্টেট
let activeCellResize = null; // সেল রিসাইজ স্টেট

function startMoveAreaSelection(e, container) {
    moveAreaActive = true;
    const rect = container.getBoundingClientRect();
    moveAreaStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
    moveAreaRect = document.createElement('div');
    moveAreaRect.className = 'move-area-selection';
    moveAreaRect.style.cssText = `
        position: absolute;
        left: ${moveAreaStart.x}px;
        top: ${moveAreaStart.y}px;
        width: 0;
        height: 0;
        border: 2px dashed #00d4ff;
        background: rgba(0, 212, 255, 0.1);
        z-index: 150;
        cursor: crosshair;
    `;
    container.appendChild(moveAreaRect);
}

function continueMoveAreaSelection(e, container) {
    if (!moveAreaActive || !moveAreaStart || !moveAreaRect) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const left = Math.min(moveAreaStart.x, x);
    const top = Math.min(moveAreaStart.y, y);
    const width = Math.abs(x - moveAreaStart.x);
    const height = Math.abs(y - moveAreaStart.y);
    
    moveAreaRect.style.left = `${left}px`;
    moveAreaRect.style.top = `${top}px`;
    moveAreaRect.style.width = `${width}px`;
    moveAreaRect.style.height = `${height}px`;
}

function endMoveAreaSelection(container) {
    if (!moveAreaActive || !moveAreaStart || !moveAreaRect) return;
    
    const left = parseFloat(moveAreaRect.style.left);
    const top = parseFloat(moveAreaRect.style.top);
    const width = parseFloat(moveAreaRect.style.width);
    const height = parseFloat(moveAreaRect.style.height);
    
    if (width > 5 && height > 5) {
        // Store the selected area for dragging
        moveAreaSelection = { left, top, width, height, container };
        moveAreaRect.style.cursor = 'grab';
        moveAreaRect.style.borderColor = '#b829f9';
        moveAreaRect.style.pointerEvents = 'auto';
        
        // mousedown event - drag শুরু করুন
        moveAreaRect.addEventListener('mousedown', (e) => {
            moveAreaDragging = true;
            moveAreaDragStartX = e.clientX;
            moveAreaDragStartY = e.clientY;
            moveAreaOrigLeft = parseFloat(moveAreaRect.style.left);
            moveAreaOrigTop = parseFloat(moveAreaRect.style.top);
            moveAreaRect.style.cursor = 'grabbing';
            e.stopPropagation();
            e.preventDefault();
        });
    } else {
        moveAreaActive = false;
        if (moveAreaRect && moveAreaRect.parentNode) {
            moveAreaRect.remove();
        }
        moveAreaRect = null;
        moveAreaStart = null;
    }
}

function applyMoveArea(selection, container) {
    // সব টেক্সট আইটেম খুঁজুন যা সিলেকশনের মধ্যে আছে
    // Find all text items within the selection
    const textItems = container.querySelectorAll('.editable-text-unit');
    let movedItems = [];
    
    const selectionBounds = {
        left: selection.left,
        top: selection.top,
        right: selection.left + selection.width,
        bottom: selection.top + selection.height
    };
    
    textItems.forEach(item => {
        const itemRect = item.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const itemLeft = itemRect.left - containerRect.left;
        const itemTop = itemRect.top - containerRect.top;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;
        
        // Check if item is within selection
        if (itemLeft < selectionBounds.right &&
            itemRight > selectionBounds.left &&
            itemTop < selectionBounds.bottom &&
            itemBottom > selectionBounds.top) {
            movedItems.push({
                item: item,
                originalLeft: parseFloat(item.style.left) || itemLeft,
                originalTop: parseFloat(item.style.top) || itemTop
            });
        }
    });
    
    if (movedItems.length > 0) {
        captureUndoSnapshot('Move area');
        movedItems.forEach(moved => {
            const edit = textEdits.find(ed => ed.id === moved.item.dataset.editId);
            if (edit) {
                edit.x = parseFloat(moved.item.style.left) / pdfScale;
                edit.y = (container.offsetHeight - parseFloat(moved.item.style.top)) / pdfScale - edit.size;
            }
        });
    }
    
    // পরিষ্কার করুন
    if (moveAreaRect && moveAreaRect.parentNode) {
        moveAreaRect.remove();
    }
    moveAreaActive = false;
    moveAreaStart = null;
    moveAreaSelection = null;
    moveAreaRect = null;
    moveAreaDragging = false;
}

// ────────────────────────────────────────────────────────────
// Create Table - কাস্টমাইজেবল টেবিল তৈরি করা + রিসাইজ করা যায়
// ────────────────────────────────────────────────────────────

function createTable(columns, rows, cellWidth, cellHeight, container, viewport, page) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'created-table';
    tableContainer.style.cssText = `
        position: absolute;
        background: white;
        z-index: 100;
        border: 1px solid #555;
        box-shadow: 0 0 5px rgba(0,0,0,0.2);
    `;
    
    // টেবিল HTML তৈরি করুন
    let tableHTML = '<table style="width:100%; border-collapse: collapse; border: 1px solid #333;">';
    
    for (let r = 0; r < rows; r++) {
        tableHTML += '<tr>';
        for (let c = 0; c < columns; c++) {
            tableHTML += `<td class="table-cell" style="
                border: 1px solid #333;
                padding: 8px;
                width: ${cellWidth}px;
                height: ${cellHeight}px;
                text-align: left;
                vertical-align: top;
                background: white;
                color: #000;
                font-family: Helvetica;
                font-size: 12px;
                position: relative;
                overflow: hidden;
            "><div class="cell-content" style="width: 100%; height: 100%; cursor: text;"></div><div class="cell-resize-handle" style="position: absolute; bottom: 0; right: 0; width: 8px; height: 8px; background: #00d4ff; cursor: se-resize; opacity: 0; transition: opacity 0.2s;"></div></td>`;
        }
        tableHTML += '</tr>';
    }
    tableHTML += '</table>';
    
    tableContainer.innerHTML = tableHTML;
    
    // টেবিলকে ড্র্যাগযোগ্য করুন
    const handle = document.createElement('div');
    handle.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background: #7c3aed;
        color: white;
        padding: 4px 8px;
        cursor: grab;
        border-radius: 4px;
        font-size: 11px;
        user-select: none;
        z-index: 101;
    `;
    handle.textContent = '⋮ Drag Table';
    handle.title = 'Drag to move the table';
    
    tableContainer.appendChild(handle);
    
    // ড্র্যাগ হ্যান্ডলার সেটআপ (global state ব্যবহার করছি)
    handle.addEventListener('mousedown', (e) => {
        activeTableDrag = {
            element: tableContainer,
            startX: e.clientX,
            startY: e.clientY,
            origLeft: parseFloat(tableContainer.style.left) || 0,
            origTop: parseFloat(tableContainer.style.top) || 0,
            handle: handle
        };
        handle.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    });
    
    // টেবিল সেল সাথে ইন্টারঅ্যাক্ট করুন
    const cells = tableContainer.querySelectorAll('td.table-cell');
    cells.forEach((cell, idx) => {
        const cellContent = cell.querySelector('.cell-content');
        const resizeHandle = cell.querySelector('.cell-resize-handle');
        
        // সেল এডিটিং
        cellContent.addEventListener('click', (e) => {
            e.stopPropagation();
            cellContent.contentEditable = 'true';
            cellContent.focus();
        });
        
        cellContent.addEventListener('blur', () => {
            cellContent.contentEditable = 'false';
        });
        
        cellContent.addEventListener('dblclick', (e) => {
            cellContent.contentEditable = 'true';
            cellContent.focus();
            e.stopPropagation();
        });
        
        // মাউস hover এ রিসাইজ হ্যান্ডেল দেখান
        cell.addEventListener('mouseenter', () => {
            resizeHandle.style.opacity = '1';
        });
        
        cell.addEventListener('mouseleave', () => {
            resizeHandle.style.opacity = '0';
        });
        
        // সেল রিসাইজ হ্যান্ডলার (global state ব্যবহার করছি)
        resizeHandle.addEventListener('mousedown', (e) => {
            activeCellResize = {
                cell: cell,
                startX: e.clientX,
                startY: e.clientY,
                origWidth: cell.offsetWidth,
                origHeight: cell.offsetHeight
            };
            e.stopPropagation();
            e.preventDefault();
        });
    });
    
    return tableContainer;
}

