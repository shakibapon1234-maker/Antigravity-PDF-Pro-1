// ─────────────────────────────────────────────
// editor/text-editor.js — Antigravity PDF Pro
// টেক্সট এডিটিং: startEditing, addNewText,
// drag, mouse handlers, transformEditorText
// নির্ভর করে: core/state.js, core/utils.js,
//              core/renderer.js, core/undo.js
// ─────────────────────────────────────────────

function startEditing(e, originalItem, transform, viewport, page) {
    const el        = e.target.closest('.editable-text-unit') || e.target;
    // Always resolve to the pdf-page-wrapper, regardless of which child was clicked
    const container = el.closest('.pdf-page-wrapper');
    if (!container) return;
    const isNewItem = originalItem.isNew || false;

    // store the absolute position for the wrapper (editWrap will be absolute)
    // Use getBoundingClientRect — reliable regardless of el's parent/wrapper state
    const _elRect  = el.getBoundingClientRect();
    const _cRect   = container.getBoundingClientRect();
    const _inputAbsLeftNum = _elRect.left - _cRect.left;
    const _inputAbsTopNum  = _elRect.top  - _cRect.top;
    const _inputAbsLeft = `${_inputAbsLeftNum}px`;
    const _inputAbsTop  = `${_inputAbsTopNum}px`;

    // Calculate center for background sampling
    const cx = _inputAbsLeftNum + _elRect.width / 2;
    const cy = _inputAbsTopNum  + _elRect.height / 2;

    // Capture background patch from the canvas (the real background)
    let patchData, patchWidth, patchHeight;
    const padding = 2;

    if (isNewItem) {
        patchWidth  = originalItem.width;
        patchHeight = originalItem.height;
        patchData   = originalItem.patch;
    } else {
        patchWidth  = (originalItem.originalWidth || originalItem.width  || el.offsetWidth  / pdfScale);
        patchHeight = (originalItem.originalHeight || originalItem.height || el.offsetHeight / pdfScale);

        if (transform) {
            // Sample the actual background pixels from the canvas
            patchData = sampleBackgroundPatch(
                _inputAbsLeftNum / pdfScale - padding,
                _inputAbsTopNum / pdfScale - padding,
                patchWidth, patchHeight, pdfScale
            );
        }
    }

    let bgColor;
    if (isNewItem) {
        const hex = originalItem.bgHex || 'transparent';
        bgColor = { hex, ...(hex === 'transparent' ? {r:1,g:1,b:1} : hexToRgb(hex)) };
    } else if (transform) {
        bgColor = sampleBackgroundColor(cx, cy);
    } else {
        const existingEdit = textEdits.find(ed => ed.id === originalItem.id);
        const hex = existingEdit?.bgHex || 'transparent';
        bgColor = { hex, ...(hex === 'transparent' ? {r:1,g:1,b:1} : hexToRgb(hex)) };
    }

    const mc  = container.querySelector('canvas');
    const csx = mc ? mc.width  / container.offsetWidth  : 1;
    const csy = mc ? mc.height / container.offsetHeight : 1;

    // Immediately create cover patch at the original position of the original text item
    if (!isNewItem) {
        if (el._coverPatch && el._coverPatch.parentNode) {
            el._coverPatch.parentNode.removeChild(el._coverPatch);
            el._coverPatch = null;
        }

        const origX = originalItem.transform ? originalItem.transform[4] : originalItem.originalX;
        const origY = originalItem.transform ? originalItem.transform[5] : originalItem.originalY;
        const origH = originalItem.transform
            ? (originalItem.height || el.offsetHeight / viewport.scale)
            : (originalItem.originalHeight || originalItem.height || originalItem.size || 12);
        const origW = originalItem.transform
            ? (originalItem.width || el.offsetWidth / viewport.scale)
            : (originalItem.originalWidth || originalItem.width || 40);

        const txOriginal = pdfjsLib.Util.transform(viewport.transform, [1, 0, 0, 1, origX, origY]);
        const origLeft = txOriginal[4];
        const origTop = txOriginal[5] - origH * viewport.scale;
        const origWidth = origW * viewport.scale;
        const origHeight = origH * viewport.scale;

        const _cpBgHex = (bgColor.hex && bgColor.hex !== 'transparent') ? bgColor.hex : '#ffffff';

        // ── Generate inpainted patch for cover patch ──
        const cpPatchUrl = typeof generateInpaintedPatch === 'function'
            ? generateInpaintedPatch(
                Math.round(origLeft * csx), Math.round(origTop * csy),
                Math.round(origWidth * csx), Math.round(origHeight * csy),
                true // forceCoons
              )
            : null;

        const coverPatch = document.createElement('div');
        coverPatch.className = 'clear-patch text-cover-patch';
        coverPatch.style.cssText = `
            position: absolute;
            left: ${origLeft}px;
            top:  ${origTop}px;
            width: ${origWidth}px;
            height: ${origHeight}px;
            background-color: ${_cpBgHex};
            ${cpPatchUrl ? `background-image:url(${cpPatchUrl});background-size:100% 100%;background-repeat:no-repeat;` : ''}
            pointer-events: none;
            z-index: 8;
        `;
        el._coverPatch = coverPatch;
        container.appendChild(coverPatch);
    }

    // Create the floating editor div
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
        input.dataset.patch = patchData;
    }

    // Use inpainted background patch if editing existing text on gradient background
    const editW_css = patchWidth * pdfScale;
    const editH_css = patchHeight * pdfScale;
    const inpaintedPatchUrl = (!isNewItem && typeof generateInpaintedPatch === 'function')
        ? generateInpaintedPatch(
            Math.round(_inputAbsLeftNum * csx), Math.round(_inputAbsTopNum * csy),
            Math.round(editW_css * csx), Math.round(editH_css * csy),
            true // forceCoons
          )
        : null;

    if (inpaintedPatchUrl) {
        input.style.backgroundImage = `url(${inpaintedPatchUrl})`;
        input.style.backgroundSize = '100% 100%';
        input.style.backgroundRepeat = 'no-repeat';
        input.style.backgroundColor = 'transparent';
    } else {
        input.style.backgroundImage = 'none';
        const editorBg = (bgColor.hex && bgColor.hex !== 'transparent') ? bgColor.hex : '#ffffff';
        input.style.backgroundColor = editorBg;
    }

    input.dataset.bgHex = bgColor.hex;
    input.dataset.bgR   = bgColor.r;
    input.dataset.bgG   = bgColor.g;
    input.dataset.bgB   = bgColor.b;

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
        
        // Extract style from the clicked element (el)
        if (el) {
            const fsPx = parseFloat(el.style.fontSize);
            if (!isNaN(fsPx) && fsPx > 0) {
                currentStyle.fontSize = Math.round(fsPx / pdfScale);
                const fsInput = document.getElementById('fontSize');
                if (fsInput) fsInput.value = currentStyle.fontSize;
            }
            
            if (el.style.fontFamily) {
                const ff = el.style.fontFamily.replace(/['"]/g, '');
                currentStyle.fontFamily = getStandardFontName(ff);
                const ffSelect = document.getElementById('fontFamily');
                if (ffSelect) ffSelect.value = currentStyle.fontFamily;
            }
            
            // Check bold / italic / underline from styles
            currentStyle.isBold = el.style.fontWeight === 'bold' || el.style.fontWeight === '700';
            currentStyle.isItalic = el.style.fontStyle === 'italic';
            currentStyle.isUnderline = el.style.textDecoration && el.style.textDecoration.includes('underline');
            
            const btnBold = document.getElementById('btnBold');
            if (btnBold) btnBold.classList.toggle('active', currentStyle.isBold);
            const btnItalic = document.getElementById('btnItalic');
            if (btnItalic) btnItalic.classList.toggle('active', currentStyle.isItalic);
            const btnUnderline = document.getElementById('btnUnderline');
            if (btnUnderline) btnUnderline.classList.toggle('active', currentStyle.isUnderline);
        }
    }

    input.style.fontSize       = `${currentStyle.fontSize * viewport.scale}px`;
    input.style.lineHeight     = '1';
    input.style.padding        = '0';
    input.style.margin         = '0';
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

            // Re-sample background color at the dropped location
            const btnTransBg = document.getElementById('btnTransparentBg');
            if (!input.dataset.overrideBgHex && input.dataset.overrideBgHex !== 'transparent') {
                if (!(btnTransBg && btnTransBg.classList.contains('active'))) {
                    const wrap = input._wrapEl || input;
                    const newL = parseFloat(wrap.style.left) || 0;
                    const newT = parseFloat(wrap.style.top)  || 0;
                    const w = wrap.offsetWidth || 100;
                    const h = wrap.offsetHeight || 20;
                    const newBg = sampleBackgroundColor(newL + w / 2, newT + h / 2);
                    if (newBg) {
                        input.dataset.bgHex = newBg.hex;
                        const rc = hexToRgb(newBg.hex);
                        input.dataset.bgR = rc.r;
                        input.dataset.bgG = rc.g;
                        input.dataset.bgB = rc.b;
                        delete input.dataset.patch;
                        input.style.backgroundImage = 'none';
                        input.style.backgroundColor = newBg.hex;
                    }
                } else {
                    input.dataset.bgHex = 'transparent';
                    delete input.dataset.patch;
                    input.style.backgroundImage = 'none';
                    input.style.backgroundColor = 'transparent';
                }
            }
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
    // FIXED BUG 2: z-index must be above eraser clear-patch (z:5) and text layer
    editWrap.style.cssText = 'position:absolute;z-index:9999;';
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

        // Calculate true dimensions before removing input
        const finalWidth  = Math.max(parseFloat(input.style.minWidth || '0'), input.scrollWidth, input.offsetWidth) / pdfScale;
        const finalHeight = Math.max(parseFloat(input.style.height || '0'), input.scrollHeight, input.offsetHeight) / pdfScale;

        // Remove wrapper (contains handle + editor) or just input
        if (wrap2 && wrap2.parentNode) wrap2.remove();
        else input.remove();

        // ── Cleanup: remove any existing cover-patch from a previous edit of this span ──
        if (el._coverPatch && el._coverPatch.parentNode) {
            el._coverPatch.parentNode.removeChild(el._coverPatch);
            el._coverPatch = null;
        }

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
            if (isNewItem) {
                // New item cleared -> just clean up and exit
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
                return;
            }
        }

        const origX = isNewItem
            ? originalItem.originalX
            : (originalItem.transform ? originalItem.transform[4] : originalItem.originalX);
        const origY = isNewItem
            ? originalItem.originalY
            : (originalItem.transform ? originalItem.transform[5] : originalItem.originalY);

        const currentPdfX = edit ? edit.x : origX;
        const currentPdfY = edit ? edit.y : origY;

        // Calculate exact PDF coordinates using delta from current position
        const deltaX = wrapLeft2 - _inputAbsLeftNum;
        const deltaY = wrapTop2 - _inputAbsTopNum;
        const trueX = currentPdfX + (deltaX / pdfScale);
        const trueY = currentPdfY - (deltaY / pdfScale);

        // Pre-calculate cover patch coordinates relative to viewport
        const _tl = el.closest('.text-layer');
        const _tlOffL = _tl ? _tl.offsetLeft : 0;
        const _tlOffT = _tl ? _tl.offsetTop  : 0;

        let cpLeft, cpTop, cpWidth, cpHeight;
        if (isNewItem) {
            cpLeft = wrapLeft2 - _tlOffL;
            cpTop = wrapTop2 - _tlOffT;
            cpWidth = Math.max(finalWidth * viewport.scale, el.offsetWidth || 40);
            cpHeight = Math.max(finalHeight * viewport.scale, el.offsetHeight || 20);
        } else {
            const origH = originalItem.transform ? (originalItem.height || 12) : (originalItem.originalHeight || originalItem.height || originalItem.size || 12);
            const origW = originalItem.transform ? (originalItem.width || 40) : (originalItem.originalWidth || originalItem.width || 40);

            const txOriginal = pdfjsLib.Util.transform(viewport.transform, [1, 0, 0, 1, origX, origY]);
            cpLeft = txOriginal[4];
            cpTop = txOriginal[5] - origH * viewport.scale;
            cpWidth = origW * viewport.scale;
            cpHeight = origH * viewport.scale;
        }

        const mc  = container.querySelector('canvas');
        const csx = mc ? mc.width  / container.offsetWidth  : 1;
        const csy = mc ? mc.height / container.offsetHeight : 1;

        const committedCpPatchUrl = (!isNewItem && typeof generateInpaintedPatch === 'function')
            ? generateInpaintedPatch(
                Math.round(cpLeft * csx), Math.round(cpTop * csy),
                Math.round(cpWidth * csx), Math.round(cpHeight * csy),
                true // forceCoons
              )
            : null;

        const btnTransBg = document.getElementById('btnTransparentBg');
        const isTransparent = btnTransBg && btnTransBg.classList.contains('active');
        const finalBgHex = isTransparent ? 'transparent' : (input.dataset.bgHex || '#ffffff');
        const coverBgHex = input.dataset.bgHex || '#ffffff';

        const editData = {
            id: isNewItem
                ? originalItem.id
                : (originalItem.transform
                    ? `${currentPageNum}-${originalItem.transform[4]}-${originalItem.transform[5]}`
                    : originalItem.id),
            page:      currentPageNum,
            isNew:     isNewItem,
            originalX: origX,
            originalY: origY,
            originalWidth: edit ? edit.originalWidth : (isNewItem ? finalWidth : (originalItem.transform ? (originalItem.width || 40) : (originalItem.originalWidth || originalItem.width || 40))),
            originalHeight: edit ? edit.originalHeight : (isNewItem ? finalHeight : (originalItem.transform ? (originalItem.height || 12) : (originalItem.originalHeight || originalItem.height || 12))),
            x:     trueX,
            y:     trueY,
            text:  newText,
            html:  newText ? (editorHTML || newText) : '',
            size:  currentStyle.fontSize,
            color: newText ? currentStyle.color : 'transparent',
            // Store clean inpainted/Coons patch directly for PDF-lib embedding in save-pdf.js
            patch: committedCpPatchUrl || input.dataset.patch,
            bgHex: finalBgHex,
            bgR:   finalBgHex === 'transparent' ? 1 : parseFloat(input.dataset.bgR),
            bgG:   finalBgHex === 'transparent' ? 1 : parseFloat(input.dataset.bgG),
            bgB:   finalBgHex === 'transparent' ? 1 : parseFloat(input.dataset.bgB),
            coverBgHex: coverBgHex,
            font:  currentStyle.fontFamily,
            isBold:      currentStyle.isBold,
            isItalic:    currentStyle.isItalic,
            isUnderline: currentStyle.isUnderline,
            width:  finalWidth,
            height: finalHeight
        };

        const idx = textEdits.findIndex(ed => ed.id === editData.id);
        if (idx > -1) textEdits[idx] = editData;
        else textEdits.push(editData);

        // Update the span in place — preserve innerHTML (bold/italic/size spans) from editor
        // Use innerHTML to keep any styled child spans (bold, italic, fontSize wraps)
        el.innerHTML = newText ? (editorHTML || newText) : '';
        // Apply styles without overwriting innerHTML (restoreEditOnSpan would use textContent)
        el.style.color           = editData.color;
        el.style.left            = `${wrapLeft2 - _tlOffL}px`;
        el.style.top             = `${wrapTop2  - _tlOffT}px`;
        el.style.fontSize        = `${editData.size * viewport.scale}px`;
        el.style.lineHeight      = '1';
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
        el.style.zIndex          = '9999';
        el.style.transform       = 'none';

        // ── FIX: Insert cover-patch BEHIND el using sampled bgHex color ──
        // Uses solid color or inpainted background patch.
        // This correctly handles PDFs with any background color.
        const _coverPatch = document.createElement('div');
        _coverPatch.className = 'clear-patch text-cover-patch';
        
        let _cpBgHex = input.dataset.bgHex || '#ffffff';
        if (!isNewItem && _cpBgHex === 'transparent') {
            _cpBgHex = '#ffffff';
        }

        _coverPatch.style.cssText = `
            position: absolute;
            left: ${cpLeft}px;
            top:  ${cpTop}px;
            width: ${cpWidth}px;
            height: ${cpHeight}px;
            background-color: ${_cpBgHex};
            ${committedCpPatchUrl ? `background-image:url(${committedCpPatchUrl});background-size:100% 100%;background-repeat:no-repeat;` : ''}
            pointer-events: none;
            z-index: 8;
        `;
        // Store ref so eraser can hide it if text is cleared
        el._coverPatch = _coverPatch;
        const _tlParentSE = container; // ALWAYS append to container to allow z-index 9999 to beat images
        if (el.parentNode && el.parentNode !== container) {
            container.appendChild(el); // Move to container if it wasn't there
        }
        _tlParentSE.appendChild(_coverPatch);

        // ── Sync cover-patch size to el's actual rendered size (after layout) ──
        // Handles cases where typed text is wider than the initial patch estimate (only for destination covers).
        if (isNewItem) {
            requestAnimationFrame(() => {
                if (!_coverPatch.parentNode) return;
                const _actualW = Math.max(el.offsetWidth  || cpWidth, cpWidth);
                const _actualH = Math.max(el.offsetHeight || cpHeight, cpHeight);
                _coverPatch.style.width  = `${_actualW}px`;
                _coverPatch.style.height = `${_actualH}px`;
            });
        }
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
            !e.target.closest('.editable-text-unit') &&
            !e.target.classList.contains('floating-editor') &&
            !e.target.closest('.floating-editor') &&
            !e.target.closest('.floating-editor-handle') &&
            !e.target.closest('.created-table')) {
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
            !e.target.closest('.editable-text-unit') &&
            !e.target.classList.contains('floating-editor') &&
            !e.target.closest('.floating-editor') &&
            !e.target.closest('.created-table')) {
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
    } else if (activeTool === 'cloneArea') {
        isSelecting = true;
        e.preventDefault();
        startCloneAreaStroke(x, y, container);
    } else if (activeTool === 'moveArea') {
        // Move Area টুল - এরিয়া সিলেক্ট করতে শুরু করুন
        if (!e.target.classList.contains('move-area-selection') &&
            !e.target.closest('.move-area-selection')) {
            startMoveAreaSelection(e, container);
            isSelecting = true;
        }
    } else if (activeTool === 'highlight') {
        if (typeof handleHighlightMouseDown === 'function') {
            handleHighlightMouseDown(e, container);
        }
    } else if (activeTool === 'redact') {
        if (typeof handleRedactMouseDown === 'function') {
            handleRedactMouseDown(e, container);
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
        if (!window._dragSnapshotCaptured) {
            window._dragSnapshotCaptured = true;
            if (typeof captureUndoSnapshot === 'function') {
                captureUndoSnapshot('Move text');
            }
        }
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
    // Guard: if there's already an open floating editor, don't create another
    const existingEditor = container.querySelector('.floating-editor');
    if (existingEditor) return;

    // Guard: if click point overlaps an existing committed text span, edit it instead
    if (!overrideBgHex) {
        const contRect = container.getBoundingClientRect();
        const allSpans = container.querySelectorAll('.editable-text-unit');
        for (const sp of allSpans) {
            if (sp.classList.contains('floating-editor')) continue;
            if (sp._cleared || sp._textCleared) continue;
            const sr = sp.getBoundingClientRect();
            const sl = sr.left - contRect.left;
            const st = sr.top  - contRect.top;
            if (x >= sl && x <= sl + sr.width && y >= st && y <= st + sr.height) {
                // Click is on existing span — trigger edit instead
                const editId = sp.dataset.editId;
                const editData = textEdits.find(ed => ed.id === editId);
                if (editData) {
                    startEditing({ target: sp }, editData, null, viewport, page);
                    return;
                }
            }
        }
    }

    const patchWidth  = 120 / pdfScale;
    const patchHeight = currentStyle.fontSize;

    let patchData = null;
    let bgColor;

    if (overrideBgHex) {
        // Override mode: text placed on shape/image — skip canvas sampling
        if (overrideBgHex === 'transparent') {
            bgColor = { hex: 'transparent', r: 1, g: 1, b: 1 };
        } else {
            const orc = hexToRgb(overrideBgHex);
            bgColor = { hex: overrideBgHex, r: orc.r, g: orc.g, b: orc.b };
        }
        currentStyle.bgColor = bgColor.hex === 'transparent' ? '#ffffff' : bgColor.hex;
        document.getElementById('bgColor').value = currentStyle.bgColor;
    } else {
        patchData = sampleBackgroundPatch(
            x / pdfScale,
            y / pdfScale - patchHeight / 2,
            patchWidth, patchHeight, pdfScale
        );
        const btnTransBg = document.getElementById('btnTransparentBg');
        if (btnTransBg && btnTransBg.classList.contains('active')) {
            bgColor = { hex: 'transparent', r: 1, g: 1, b: 1 };
        } else {
            bgColor = sampleBackgroundColor(x, y);
            currentStyle.bgColor = bgColor.hex;
            document.getElementById('bgColor').value = bgColor.hex;
        }
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
        input.dataset.bgHex = 'transparent';
    } else if (overrideBgHex) {
        // Solid override (e.g. shape bg color)
        input.style.backgroundColor = overrideBgHex;
        input.style.backgroundImage = 'none';
        input.dataset.bgHex = overrideBgHex;
        const rc = hexToRgb(overrideBgHex);
        input.dataset.bgR = rc.r; input.dataset.bgG = rc.g; input.dataset.bgB = rc.b;
    } else {
        // Store patch data for PDF export
        if (patchData) {
            input.dataset.patch = patchData;
        }
        input.style.backgroundImage = 'none';
        // FIXED: Use the sampled background color instead of hardcoded white
        // This makes the editor match the actual PDF background color
        const editorBg = (bgColor.hex && bgColor.hex !== 'transparent') ? bgColor.hex : '#ffffff';
        input.style.backgroundColor = editorBg;
        input.dataset.bgHex = bgColor.hex;
        input.dataset.bgR = bgColor.r;
        input.dataset.bgG = bgColor.g;
        input.dataset.bgB = bgColor.b;
    }

    input.style.fontSize       = `${currentStyle.fontSize * viewport.scale}px`;
    input.style.lineHeight     = '1';
    input.style.padding        = '0';
    input.style.margin         = '0';
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
            
            // Re-sample background color at the dropped location
            const btnTransBg = document.getElementById('btnTransparentBg');
            if (!overrideBgHex && !(btnTransBg && btnTransBg.classList.contains('active'))) {
                const wrap = input._wrapEl || input;
                const newL = parseFloat(wrap.style.left) || 0;
                const newT = parseFloat(wrap.style.top)  || 0;
                const w = wrap.offsetWidth || 100;
                const h = wrap.offsetHeight || 20;
                const newBg = sampleBackgroundColor(newL + w / 2, newT + h / 2);
                if (newBg) {
                    input.dataset.bgHex = newBg.hex;
                    const rc = hexToRgb(newBg.hex);
                    input.dataset.bgR = rc.r;
                    input.dataset.bgG = rc.g;
                    input.dataset.bgB = rc.b;
                    delete input.dataset.patch;
                    input.style.backgroundImage = 'none';
                    input.style.backgroundColor = newBg.hex;
                }
            } else if (!overrideBgHex && btnTransBg && btnTransBg.classList.contains('active')) {
                input.dataset.bgHex = 'transparent';
                delete input.dataset.patch;
                input.style.backgroundImage = 'none';
                input.style.backgroundColor = 'transparent';
            }
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
    // FIXED BUG 2: Always use z-index 9999 so text editor always appears
    // above eraser patches (z:5), canvas, and all other page elements
    editorWrap.style.cssText = `position:absolute;z-index:9999;`;
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

        // Read dimensions from input before cloning/removing
        const finalWidth  = Math.max(parseFloat(input.style.minWidth || '0'), input.scrollWidth, input.offsetWidth) / pdfScale || patchWidth;
        const finalHeight = Math.max(parseFloat(input.style.height || '0'), input.scrollHeight, input.offsetHeight) / pdfScale || patchHeight;

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

        const btnTransBg = document.getElementById('btnTransparentBg');
        const isTransparent = btnTransBg && btnTransBg.classList.contains('active');
        const finalBgHex = isTransparent ? 'transparent' : (input.dataset.bgHex || '#ffffff');

        const editData = {
            id: 'new-' + Date.now(),
            page:  currentPageNum,
            isNew: true,
            originalX: x / pdfScale,
            originalY: (container.offsetHeight - y) / pdfScale - currentStyle.fontSize,
            originalWidth: finalWidth,
            originalHeight: finalHeight,
            x:     wrapLeft / pdfScale,
            y:     (container.offsetHeight - wrapTop) / pdfScale - currentStyle.fontSize,
            text:  newText,
            size:  currentStyle.fontSize,
            color: currentStyle.color,
            patch: input.dataset.patch,
            bgHex: finalBgHex,
            bgR:   finalBgHex === 'transparent' ? 1 : parseFloat(input.dataset.bgR),
            bgG:   finalBgHex === 'transparent' ? 1 : parseFloat(input.dataset.bgG),
            bgB:   finalBgHex === 'transparent' ? 1 : parseFloat(input.dataset.bgB),
            font:  currentStyle.fontFamily,
            isBold:      currentStyle.isBold,
            isItalic:    currentStyle.isItalic,
            isUnderline: currentStyle.isUnderline,
            width:  finalWidth,
            height: finalHeight
        };

        textEdits.push(editData);

        const textItem = document.createElement('span');
        textItem.className    = 'editable-text-unit modified draggable';
        textItem.textContent  = newText;
        textItem.style.position        = 'absolute';
        textItem.style.left            = `${wrapLeft}px`;
        textItem.style.top             = `${wrapTop}px`;
        textItem.style.fontSize        = input.style.fontSize;
        textItem.style.lineHeight      = '1';
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
        // FIXED BUG 2: Always use z-index 9999 so committed text spans always
        // render above eraser clear-patch elements (which use z-index: 5)
        textItem.style.zIndex          = '9999';

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
        // Append directly to container so z-index 9999 puts it above images/shapes
        const tlParent = container;

        // ── FIX: Cover-patch using sampled bgHex color ──
        // Uses solid color instead of patchData image to avoid duplicating adjacent text.
        // Correctly handles any background color in the PDF.
        const coverPatch = document.createElement('div');
        coverPatch.className = 'clear-patch text-cover-patch';
        const _newBgHex = input.dataset.bgHex || '#ffffff';

        coverPatch.style.cssText = `
            position: absolute;
            left: ${wrapLeft}px;
            top:  ${wrapTop}px;
            min-width: ${editData.width  * pdfScale}px;
            height: ${editData.height * pdfScale}px;
            background-color: ${_newBgHex};
            pointer-events: none;
            z-index: 8;
        `;
        textItem._coverPatch = coverPatch;
        tlParent.appendChild(coverPatch);  // insert BEFORE textItem so it's behind in z-order
        tlParent.appendChild(textItem);
        tlParent.appendChild(spanHandle); // sibling, not child of textItem

        // ── Sync cover-patch size to textItem's actual rendered size (after layout) ──
        // Typed text may be wider than the initial patchWidth estimate.
        requestAnimationFrame(() => {
            if (!coverPatch.parentNode) return;
            const _aw = Math.max(textItem.offsetWidth  || editData.width  * pdfScale, editData.width  * pdfScale);
            const _ah = Math.max(textItem.offsetHeight || editData.height * pdfScale, editData.height * pdfScale);
            coverPatch.style.minWidth = `${_aw}px`;
            coverPatch.style.height   = `${_ah}px`;
        });

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
    window._dragSnapshotCaptured = false;
    e.stopPropagation();
}

function finalizeDragging() {
    if (!dragTarget) return;
    const id   = dragTarget.dataset.editId;
    const edit = textEdits.find(ed =>
        ed.id === id || `${ed.page}-${ed.originalX}-${ed.originalY}` === id);
    if (edit) {
        const cont = dragTarget.closest('.pdf-page-wrapper');
        const newLeft = parseFloat(dragTarget.style.left);
        const newTop = parseFloat(dragTarget.style.top);
        
        edit.x = newLeft / pdfScale;
        edit.y = (cont.offsetHeight / pdfScale) - (newTop / pdfScale) - edit.size;

        // Re-sample background color if it's not transparent/overridden
        const btnTransBg = document.getElementById('btnTransparentBg');
        if (dragTarget.dataset.bgHex !== 'transparent' && dragTarget.dataset.overrideBgHex !== 'transparent') {
            if (!(btnTransBg && btnTransBg.classList.contains('active'))) {
                const w = dragTarget.offsetWidth || 100;
                const h = dragTarget.offsetHeight || 20;
                const newBg = sampleBackgroundColor(newLeft + w / 2, newTop + h / 2);
                if (newBg) {
                    const newHex = newBg.hex;
                    dragTarget.dataset.bgHex = newHex;
                    edit.bgHex = newHex;
                    edit.bgR = newBg.r;
                    edit.bgG = newBg.g;
                    edit.bgB = newBg.b;
                    delete dragTarget.dataset.patch;
                    delete edit.patch;
                    
                    if (dragTarget._coverPatch) {
                        dragTarget._coverPatch.style.backgroundImage = 'none';
                        dragTarget._coverPatch.style.backgroundColor = newHex;
                    }
                }
            } else {
                dragTarget.dataset.bgHex = 'transparent';
                edit.bgHex = 'transparent';
                delete dragTarget.dataset.patch;
                delete edit.patch;
                if (dragTarget._coverPatch) {
                    dragTarget._coverPatch.style.backgroundImage = 'none';
                    dragTarget._coverPatch.style.backgroundColor = 'transparent';
                }
            }
        }
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

            // ── Visual patch: use real background image if available, else solid color ──
            // FIXED BUG 2: z-index kept at 5 (below text at 9999) so new text typed
            // on top of an erased area always appears above the eraser patch.
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
    return null;
}

// Simple cache for inpainted patches to avoid duplicate heavy computations
const inpaintedPatchCache = new Map();

// Call this whenever page changes so cache is refreshed
function invalidateBgCanvas() {
    _bgCanvasCache = null;
    inpaintedPatchCache.clear();
}

// ── generateInpaintedPatch ───────────────────────────────────────────────────
// Returns a dataURL of the background patch at (x,y,width,height) in CANVAS
// pixel coordinates. Uses the background canvas cache for pixel-perfect results.
// Falls back to Coons-patch edge interpolation if re-render is not ready yet.
function generateInpaintedPatch(x, y, width, height, forceCoons = false) {
    try {
        const pageWrapper = document.querySelector('.pdf-page-wrapper');
        const mainCanvas  = pageWrapper?.querySelector('canvas');
        if (!mainCanvas) return null;

        const pw = Math.max(2, Math.round(width));
        const ph = Math.max(2, Math.round(height));
        const px = Math.max(0, Math.round(x));
        const py = Math.max(0, Math.round(y));

        // Cache key includes page number, coordinates and dimensions
        const cacheKey = `${currentPageNum}_${px}_${py}_${pw}_${ph}`;
        if (inpaintedPatchCache.has(cacheKey)) {
            return inpaintedPatchCache.get(cacheKey);
        }

        // Always use synchronous Coons Patch edge interpolation.
        // This is extremely fast (only processes the bounding box) and avoids locking the main thread.
        const result = _coonsPatchFromMainCanvas(mainCanvas, pageWrapper, px, py, pw, ph);
        if (result) {
            inpaintedPatchCache.set(cacheKey, result);
        }
        return result;
    } catch (err) {
        console.error("Error generating inpainted patch:", err);
        return null;
    }
}

function _coonsPatchFromMainCanvas(mainCanvas, pageWrapper, px, py, pw, ph) {
    // Clamp offset to avoid sampling other lines of text or elements
    const offset = Math.max(10, Math.min(25, Math.round(Math.max(pw, ph) * 0.15)));
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

    // Small-radius median filter — radius fixed to 2
    // to filter out noise, while avoiding astronomical complexity
    function getCleanEdgeColor(cx, cy) {
        const radius = 2;
        const rArr = [], gArr = [], bArr = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const p = getPix(cx + dx, cy + dy);
                rArr.push(p.r); gArr.push(p.g); bArr.push(p.b);
            }
        }
        rArr.sort((a, b) => a - b);
        gArr.sort((a, b) => a - b);
        bArr.sort((a, b) => a - b);
        const mid = rArr.length >> 1;
        return { r: rArr[mid], g: gArr[mid], b: bArr[mid] };
    }

    // Calculate exact text position relative to temp canvas
    const textLeft = px - ex;
    const textTop  = py - ey;

    // Sample edges from the middle of the buffer zone to be far away from any text strokes
    const sampleLeft  = Math.max(2, Math.min(ew - 3, Math.round(textLeft * 0.5)));
    const sampleRight = Math.max(2, Math.min(ew - 3, Math.round(textLeft + pw + (ew - textLeft - pw) * 0.5)));
    const sampleTop   = Math.max(2, Math.min(eh - 3, Math.round(textTop * 0.5)));
    const sampleBot   = Math.max(2, Math.min(eh - 3, Math.round(textTop + ph + (eh - textTop - ph) * 0.5)));

    const leftEdgeRaw = [], rightEdgeRaw = [], topEdgeRaw = [], bottomEdgeRaw = [];
    for (let cy = 0; cy < ph; cy++) {
        leftEdgeRaw.push(getCleanEdgeColor(sampleLeft,  textTop + cy));
        rightEdgeRaw.push(getCleanEdgeColor(sampleRight, textTop + cy));
    }
    for (let cx = 0; cx < pw; cx++) {
        topEdgeRaw.push(getCleanEdgeColor(textLeft + cx, sampleTop));
        bottomEdgeRaw.push(getCleanEdgeColor(textLeft + cx, sampleBot));
    }

    // Extrapolate/interpolate raw samples to the actual boundaries of the text box (to fit gradient backgrounds perfectly)
    const L_est = [], R_est = [], T_est = [], B_est = [];

    // X interpolation parameters
    const xDenom = (sampleRight - sampleLeft) || 1;
    const t_L = (textLeft - sampleLeft) / xDenom;
    const t_R = (textLeft + pw - 1 - sampleLeft) / xDenom;

    for (let cy = 0; cy < ph; cy++) {
        const L_raw = leftEdgeRaw[cy];
        const R_raw = rightEdgeRaw[cy];
        L_est.push({
            r: L_raw.r * (1 - t_L) + R_raw.r * t_L,
            g: L_raw.g * (1 - t_L) + R_raw.g * t_L,
            b: L_raw.b * (1 - t_L) + R_raw.b * t_L
        });
        R_est.push({
            r: L_raw.r * (1 - t_R) + R_raw.r * t_R,
            g: L_raw.g * (1 - t_R) + R_raw.g * t_R,
            b: L_raw.b * (1 - t_R) + R_raw.b * t_R
        });
    }

    // Y interpolation parameters
    const yDenom = (sampleBot - sampleTop) || 1;
    const s_T = (textTop - sampleTop) / yDenom;
    const s_B = (textTop + ph - 1 - sampleTop) / yDenom;

    for (let cx = 0; cx < pw; cx++) {
        const T_raw = topEdgeRaw[cx];
        const B_raw = bottomEdgeRaw[cx];
        T_est.push({
            r: T_raw.r * (1 - s_T) + B_raw.r * s_T,
            g: T_raw.g * (1 - s_T) + B_raw.g * s_T,
            b: T_raw.b * (1 - s_T) + B_raw.b * s_T
        });
        B_est.push({
            r: T_raw.r * (1 - s_B) + B_raw.r * s_B,
            g: T_raw.g * (1 - s_B) + B_raw.g * s_B,
            b: T_raw.b * (1 - s_B) + B_raw.b * s_B
        });
    }

    // Blend corners consistently
    const TL = {
        r: (L_est[0].r + T_est[0].r) / 2,
        g: (L_est[0].g + T_est[0].g) / 2,
        b: (L_est[0].b + T_est[0].b) / 2
    };
    const TR = {
        r: (R_est[0].r + T_est[pw - 1].r) / 2,
        g: (R_est[0].g + T_est[pw - 1].g) / 2,
        b: (R_est[0].b + T_est[pw - 1].b) / 2
    };
    const BL = {
        r: (L_est[ph - 1].r + B_est[0].r) / 2,
        g: (L_est[ph - 1].g + B_est[0].g) / 2,
        b: (L_est[ph - 1].b + B_est[0].b) / 2
    };
    const BR = {
        r: (R_est[ph - 1].r + B_est[pw - 1].r) / 2,
        g: (R_est[ph - 1].g + B_est[pw - 1].g) / 2,
        b: (R_est[ph - 1].b + B_est[pw - 1].b) / 2
    };

    const outCv = document.createElement('canvas');
    outCv.width = pw; outCv.height = ph;
    const oCtx  = outCv.getContext('2d');
    const outImg = oCtx.createImageData(pw, ph);
    const data   = outImg.data;

    for (let cy = 0; cy < ph; cy++) {
        for (let cx = 0; cx < pw; cx++) {
            const u = pw > 1 ? cx / (pw - 1) : 0.5;
            const v = ph > 1 ? cy / (ph - 1) : 0.5;
            const L = L_est[cy], R = R_est[cy];
            const T = T_est[cx], B = B_est[cx];
            const wTL = (1 - u) * (1 - v);
            const wTR = u * (1 - v);
            const wBL = (1 - u) * v;
            const wBR = u * v;
            const i = (cy * pw + cx) * 4;
            data[i]   = Math.max(0, Math.min(255, L.r * (1 - u) + R.r * u + T.r * (1 - v) + B.r * v - (TL.r * wTL + TR.r * wTR + BL.r * wBL + BR.r * wBR)));
            data[i+1] = Math.max(0, Math.min(255, L.g * (1 - u) + R.g * u + T.g * (1 - v) + B.g * v - (TL.g * wTL + TR.g * wTR + BL.g * wBL + BR.g * wBR)));
            data[i+2] = Math.max(0, Math.min(255, L.b * (1 - u) + R.b * u + T.b * (1 - v) + B.b * v - (TL.b * wTL + TR.b * wTR + BL.b * wBL + BR.b * wBR)));
            data[i+3] = 255;
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

    const mc  = container.querySelector('canvas');
    const csx = mc ? mc.width  / container.offsetWidth  : 1;
    const csy = mc ? mc.height / container.offsetHeight : 1;

    // 1. Generate inpainted patch for EXACTLY the dragged area
    const patchDataUrl = typeof generateInpaintedPatch === 'function'
        ? generateInpaintedPatch(
            Math.round(l * csx), Math.round(t * csy),
            Math.round(w * csx), Math.round(h * csy))
        : null;

    const bgSample = typeof sampleBackgroundColor === 'function'
        ? sampleBackgroundColor(l + w / 2, t + h / 2)
        : { r: 1, g: 1, b: 1, hex: '#ffffff' };

    // 2. Create ONE visual patch covering EXACTLY the dragged area
    // z-index:50 ensures patch appears above text layer spans (z-index ~2-10)
    const patchEl = document.createElement('div');
    patchEl.className = 'clear-patch';
    patchEl.style.cssText = `
        position:absolute; left:${l}px; top:${t}px;
        width:${w}px; height:${h}px;
        background-color:${bgSample.hex};
        ${patchDataUrl ? `background-image:url(${patchDataUrl});background-size:100% 100%;background-repeat:no-repeat;` : ''}
        pointer-events:none; z-index:50;
    `;
    container.appendChild(patchEl);

    // 3. Save stroke to clearStrokes for PDF export
    let pe = clearStrokes.find(s => s.page === currentPageNum);
    if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
    pe.rects.push({
        x: l / pdfScale,
        y: (container.offsetHeight - t - h) / pdfScale,
        w: w / pdfScale,
        h: h / pdfScale,
        r: bgSample.r, g: bgSample.g, b: bgSample.b,
        patch: patchDataUrl || null,
        isTextClear: true
    });

    // 4a. Hide user-added editable text spans that overlap the selection rectangle
    container.querySelectorAll('.editable-text-unit').forEach(span => {
        if (span.classList.contains('floating-editor')) return;
        if (span.classList.contains('span-drag-handle')) return;
        if (span._textCleared || span._cleared) return;

        const sr = span.getBoundingClientRect();
        if (sr.width === 0 && sr.height === 0) return;
        const sl = sr.left - contRect.left;
        const st = sr.top  - contRect.top;
        const sw = sr.width  || 10;
        const sh = sr.height || 10;

        if (!(sl < l + w && sl + sw > l && st < t + h && st + sh > t)) return;

        clearedCount++;

        span._cleared = true;
        span._textCleared = true;
        span.textContent = '';
        span.style.color = 'transparent';
        span.style.backgroundColor = 'transparent';
        span.style.backgroundImage = 'none';

        // Record in textEdits as transparent so renderer doesn't bring back the selectable text
        const editId = span.dataset.editId || `ct-${currentPageNum}-${Math.round(sl)}-${Math.round(st)}`;
        const clearEntry = {
            id: editId, page: currentPageNum, isNew: false,
            originalX: sl / pdfScale, originalY: (container.offsetHeight - st - sh) / pdfScale,
            originalWidth: sw / pdfScale, originalHeight: sh / pdfScale,
            x: sl / pdfScale, y: (container.offsetHeight - st - sh) / pdfScale,
            text: '', size: parseFloat(span.style.fontSize) / pdfScale || 12,
            color: 'transparent', bgHex: 'transparent',
            bgR: 1, bgG: 1, bgB: 1,
            font: 'Helvetica', isBold: false, isItalic: false, isUnderline: false,
            width: sw / pdfScale, height: sh / pdfScale
        };
        const existingIdx = textEdits.findIndex(ed => ed.id === editId);
        if (existingIdx > -1) textEdits[existingIdx] = clearEntry;
        else textEdits.push(clearEntry);
    });

    // 4b. Also visually hide native PDF text-layer spans within the rectangle
    // (the patch already covers them visually, but hiding prevents selection cursor showing through)
    container.querySelectorAll('.text-layer span, .textLayer span').forEach(span => {
        if (span._textCleared) return;
        const sr = span.getBoundingClientRect();
        if (sr.width === 0 && sr.height === 0) return;
        const sl = sr.left - contRect.left;
        const st = sr.top  - contRect.top;
        const sw = sr.width  || 10;
        const sh = sr.height || 10;
        if (!(sl < l + w && sl + sw > l && st < t + h && st + sh > t)) return;
        span._textCleared = true;
        span.style.color = 'transparent';
        span.style.visibility = 'hidden';
        clearedCount++;
    });

    if (clearedCount > 0) {
        // Show subtle visual indicator that text was cleared
        const indicator = document.createElement('div');
        indicator.className = 'clear-text-indicator';
        indicator.style.cssText = `
            position:absolute; left:${l}px; top:${t}px;
            width:${w}px; height:${h}px;
            border: 2px dashed rgba(0,200,100,0.6);
            background: rgba(0,200,100,0.1);
            pointer-events:none; z-index:51;
            transition: opacity 2s ease;
        `;
        container.appendChild(indicator);
        setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
        setTimeout(() => { indicator.remove(); }, 4000);
    } else {
        // No spans found but patch was still applied (gradient/image background case)
        // Keep the undo snapshot — the background patch itself is a meaningful change
        // Only pop undo if the selection was truly too tiny to matter (w<3||h<3 guard above)
    }

    clearTextContainer = null;
}

// ────────────────────────────────────────────────────────────
// Clone Area - সিলেক্টেড এরিয়ার ইমেজ ক্লোন করা
// ────────────────────────────────────────────────────────────
let cloneAreaRectStart = null;
let cloneAreaRectEl = null;
let cloneAreaContainer = null;

function startCloneAreaStroke(x, y, container) {
    cloneAreaRectStart = { x, y };
    cloneAreaContainer = container;
    cloneAreaRectEl = document.createElement('div');
    cloneAreaRectEl.className = 'clone-area-rect-preview';
    cloneAreaRectEl.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;width:0;height:0;
        border:2px dashed #6366f1; background:rgba(99,102,241,0.2);
        pointer-events:none;z-index:200;
    `;
    container.appendChild(cloneAreaRectEl);

    const onMove = (e) => {
        if (!isSelecting) return;
        const r = container.getBoundingClientRect();
        continueCloneAreaStroke(e.clientX - r.left, e.clientY - r.top);
    };
    const onUp = () => {
        if (isSelecting) {
            endCloneAreaStroke(container);
            isSelecting = false;
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function continueCloneAreaStroke(x, y) {
    if (!cloneAreaRectEl) return;
    const l = Math.min(cloneAreaRectStart.x, x);
    const t = Math.min(cloneAreaRectStart.y, y);
    cloneAreaRectEl.style.left   = `${l}px`;
    cloneAreaRectEl.style.top    = `${t}px`;
    cloneAreaRectEl.style.width  = `${Math.abs(x - cloneAreaRectStart.x)}px`;
    cloneAreaRectEl.style.height = `${Math.abs(y - cloneAreaRectStart.y)}px`;
}

function endCloneAreaStroke(container) {
    if (!cloneAreaRectEl) { cloneAreaContainer = null; return; }
    const l = parseFloat(cloneAreaRectEl.style.left)   || 0;
    const t = parseFloat(cloneAreaRectEl.style.top)    || 0;
    const w = parseFloat(cloneAreaRectEl.style.width)  || 0;
    const h = parseFloat(cloneAreaRectEl.style.height) || 0;

    cloneAreaRectEl.remove();
    cloneAreaRectEl = null;

    if (w < 3 || h < 3) { cloneAreaContainer = null; return; }

    const mc  = container.querySelector('canvas');
    if (mc && typeof addImageToPdf === 'function') {
        const scaleX = mc.width / container.offsetWidth;
        const scaleY = mc.height / container.offsetHeight;

        const tempCv = document.createElement('canvas');
        tempCv.width = w * scaleX;
        tempCv.height = h * scaleY;
        const tCtx = tempCv.getContext('2d', { willReadFrequently: true });

        // We only clone the base PDF content (the canvas).
        // Overlays are separate DOM elements, so canvas drawing ignores them.
        tCtx.drawImage(mc, l * scaleX, t * scaleY, w * scaleX, h * scaleY, 0, 0, tempCv.width, tempCv.height);

        const dataUrl = tempCv.toDataURL('image/png');
        
        // Spawn the cloned image slightly offset so the user sees it
        addImageToPdf(dataUrl, 'cloned-area', { l: l + 10, t: t + 10, w: w, h: h });
        
        // Switch to select tool so they can immediately drag it
        const btnSelect = document.getElementById('btnSelect');
        if (btnSelect) btnSelect.click();
    }

    cloneAreaContainer = null;
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
    
    // Remove any previous selection
    if (moveAreaRect && moveAreaRect.parentNode) moveAreaRect.remove();
    
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
        pointer-events: none;
        box-sizing: border-box;
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
    
    if (width < 10 || height < 10) {
        moveAreaActive = false;
        if (moveAreaRect && moveAreaRect.parentNode) moveAreaRect.remove();
        moveAreaRect = null;
        moveAreaStart = null;
        return;
    }

    const mainCanvas = container.querySelector('canvas');
    if (!mainCanvas) {
        moveAreaActive = false;
        if (moveAreaRect.parentNode) moveAreaRect.remove();
        moveAreaRect = null;
        return;
    }

    captureUndoSnapshot('Move area');

    // Capture the pixels from the canvas at the selection area
    const ctx = mainCanvas.getContext('2d');
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = Math.round(width);
    captureCanvas.height = Math.round(height);
    const captureCtx = captureCanvas.getContext('2d');
    captureCtx.drawImage(mainCanvas, 
        Math.round(left), Math.round(top), Math.round(width), Math.round(height),
        0, 0, Math.round(width), Math.round(height)
    );

    // White-out the original area on the canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(left), Math.round(top), Math.round(width), Math.round(height));

    // Hide text-layer spans in the original area
    const contRect = container.getBoundingClientRect();
    const textLayer = container.querySelector('.text-layer');
    if (textLayer) {
        textLayer.querySelectorAll('span').forEach(span => {
            const sr = span.getBoundingClientRect();
            const sl = sr.left - contRect.left;
            const st = sr.top - contRect.top;
            if (sl < left + width && sl + sr.width > left && st < top + height && st + sr.height > top) {
                span.style.visibility = 'hidden';
                span.style.color = 'transparent';
            }
        });
    }

    // Replace the selection rect with a draggable image
    moveAreaRect.style.backgroundImage = `url(${captureCanvas.toDataURL()})`;
    moveAreaRect.style.backgroundSize = '100% 100%';
    moveAreaRect.style.backgroundColor = 'transparent';
    moveAreaRect.style.border = '2px solid #b829f9';
    moveAreaRect.style.cursor = 'grab';
    moveAreaRect.style.pointerEvents = 'auto';
    moveAreaRect.style.boxShadow = '0 4px 15px rgba(184,41,249,0.3)';

    // Store for multiple drags
    moveAreaSelection = { left, top, width, height, container, captureCanvas, ctx };
    
    const selRect = moveAreaRect;
    
    // Allow MULTIPLE drags — don't finalize until Escape
    selRect.addEventListener('mousedown', function onDragStart(ev) {
        if (ev.button !== 0) return;
        moveAreaDragging = true;
        moveAreaDragStartX = ev.clientX;
        moveAreaDragStartY = ev.clientY;
        moveAreaOrigLeft = parseFloat(selRect.style.left);
        moveAreaOrigTop = parseFloat(selRect.style.top);
        selRect.style.cursor = 'grabbing';
        selRect.style.opacity = '0.85';
        ev.stopPropagation();
        ev.preventDefault();

        function onDragMove(em) {
            if (!moveAreaDragging) return;
            const dx = em.clientX - moveAreaDragStartX;
            const dy = em.clientY - moveAreaDragStartY;
            selRect.style.left = `${moveAreaOrigLeft + dx}px`;
            selRect.style.top = `${moveAreaOrigTop + dy}px`;
        }

        function onDragEnd() {
            if (!moveAreaDragging) return;
            moveAreaDragging = false;
            selRect.style.cursor = 'grab';
            selRect.style.opacity = '1';
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            // DON'T finalize here — keep floating until Escape
        }

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    });
}

// Finalize Move Area — called by Escape key or tool switch
function finalizeMoveArea() {
    if (!moveAreaRect || !moveAreaSelection) return;
    const { ctx, captureCanvas, container, left: origLeft, top: origTop, width, height } = moveAreaSelection;
    const newLeft = parseFloat(moveAreaRect.style.left);
    const newTop = parseFloat(moveAreaRect.style.top);
    
    // Draw the captured image at the final position on the canvas
    if (ctx && captureCanvas) {
        ctx.drawImage(captureCanvas, Math.round(newLeft), Math.round(newTop));
    }

    // Save state for PDF download
    // 1. Clear the original area
    let pe = clearStrokes.find(s => s.page === currentPageNum);
    if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
    pe.rects.push({
        x: origLeft / pdfScale, 
        y: (container.offsetHeight - origTop - height) / pdfScale,
        w: width / pdfScale, 
        h: height / pdfScale,
        r: 1, g: 1, b: 1, // Whiteout
        patch: null
    });

    // 2. Add the moved area as an image
    imageEdits.push({
        id: 'move-area-' + Date.now(),
        page: currentPageNum,
        dataUrl: captureCanvas.toDataURL('image/png'),
        x: newLeft / pdfScale,
        y: (container.offsetHeight - newTop - height) / pdfScale,
        width: width / pdfScale,
        height: height / pdfScale,
        opacity: 1,
        rotation: 0
    });

    // Clean up
    if (moveAreaRect.parentNode) moveAreaRect.remove();
    moveAreaActive = false;
    moveAreaRect = null;
    moveAreaSelection = null;
    moveAreaStart = null;
    moveAreaDragging = false;
}

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
    
    // Stop mousedown from bubbling to page wrapper to prevent spawning text boxes
    tableContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
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
        
        cellContent.addEventListener('mousedown', (e) => {
            e.stopPropagation();
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

window.finalizeTables = async function() {
    const tables = document.querySelectorAll('.created-table');
    if (tables.length === 0) return;
    
    // load html2canvas if not present
    if (typeof html2canvas === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const container = document.querySelector('.pdf-page-wrapper');
    if (!container) return;

    for (const table of Array.from(tables)) {
        // Hide the drag handle before capturing
        const handle = table.querySelector('div[style*="top: -20px"]');
        if (handle) handle.style.display = 'none';

        // ensure no resize handles are visible
        table.querySelectorAll('.cell-resize-handle').forEach(h => h.style.display = 'none');

        try {
            const canvas = await html2canvas(table, { backgroundColor: null, scale: 2 });
            const dataUrl = canvas.toDataURL('image/png');
            
            const w = table.offsetWidth;
            const h = table.offsetHeight;
            const l = parseFloat(table.style.left) || 0;
            const t = parseFloat(table.style.top) || 0;
            
            // Remove the HTML table
            table.remove();
            
            // Convert to an image edit
            if (typeof addImageToPdf === 'function') {
                addImageToPdf(dataUrl, 'table', { l, t, w, h });
            }
        } catch (err) {
            console.error('Failed to capture table', err);
            if (handle) handle.style.display = '';
        }
    }
};

// ── Listen for find & replace event ──
document.addEventListener('findreplace:replace', (e) => {
    const { result, results, replaceWith, replaceAll } = e.detail;

    if (typeof captureUndoSnapshot === 'function') {
        captureUndoSnapshot(replaceAll ? 'Replace All' : 'Replace Text');
    }

    const itemsToReplace = replaceAll ? results : [result];

    itemsToReplace.forEach(r => {
        const origText = r.context;
        const start = r.matchStart;
        const end = r.matchEnd;
        const newText = origText.substring(0, start) + replaceWith + origText.substring(end);

        console.log('[findreplace:replace debug]', { fontName: r.fontName, newText, x: r.x, originalY: r.originalY });

        const editId = `${r.page}-${r.x}-${r.originalY}`;
        const editData = {
            id: editId,
            page: r.page,
            isNew: false,
            originalX: r.x,
            originalY: r.originalY,
            originalWidth: r.width,
            originalHeight: r.height,
            x: r.x,
            y: r.originalY,
            text: newText,
            size: r.height,
            color: '#000000',
            bgHex: 'transparent',
            bgR: 1, bgG: 1, bgB: 1,
            font: getStandardFontName(r.fontName),
            isBold: false,
            isItalic: false,
            isUnderline: false,
            width: r.width,
            height: r.height
        };

        const idx = textEdits.findIndex(ed => ed.id === editId);
        if (idx > -1) {
            textEdits[idx].text = newText;
            textEdits[idx].font = getStandardFontName(r.fontName);
        } else {
            textEdits.push(editData);
        }
    });

    // Re-render current page to apply edits instantly
    if (typeof renderPage === 'function' && typeof currentPdfObj !== 'undefined') {
        renderPage(currentPdfObj, currentPageNum);
    }
});

