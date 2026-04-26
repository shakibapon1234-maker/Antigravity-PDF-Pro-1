// ─────────────────────────────────────────────
// core/renderer.js — Antigravity PDF Pro
// PDF লোড, পেজ রেন্ডার, টেক্সট লেয়ার সেটআপ
// নির্ভর করে: core/state.js, core/undo.js
// ─────────────────────────────────────────────

// ── Background Canvas Cache (eraser-এর জন্য) ──
let _bgCanvasCache = null;

// ════════════════════════════════════════════
// PDF লোড
// ════════════════════════════════════════════

async function loadAndRenderPDF(file) {
    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const typedarray  = new Uint8Array(this.result);
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            currentPdfObj = await loadingTask.promise;
            totalPages    = currentPdfObj.numPages;

            document.getElementById('editorEmptyState').classList.add('d-none');
            document.getElementById('pdfEditorContainer').classList.remove('d-none');
            document.getElementById('pdfEditorContainer').style.display = 'flex';

            currentPageNum = 1;
            renderPage(currentPdfObj, currentPageNum);
        } catch (err) {
            alert('Could not load PDF: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ════════════════════════════════════════════
// পেজ রেন্ডার
// ════════════════════════════════════════════

async function renderPage(pdf, pageNum) {
    try {
        // Invalidate bg canvas cache — new page means new background
        if (typeof invalidateBgCanvas === 'function') invalidateBgCanvas();
        const page     = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: pdfScale });

        const canvas  = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width  = viewport.width;

        const container = document.getElementById('canvasWrapper');
        container.innerHTML = '';

        const pageWrapper = document.createElement('div');
        pageWrapper.className        = 'pdf-page-wrapper';
        pageWrapper.style.width      = `${viewport.width}px`;
        pageWrapper.style.height     = `${viewport.height}px`;
        pageWrapper.style.backgroundColor = 'white';

        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);

        await page.render({ canvasContext: context, viewport }).promise;
        await setupTextLayer(page, viewport, pageWrapper);

        // ── নতুন যোগ করা টেক্সট আইটেম পুনরুদ্ধার ──────────────────────
        textEdits
            .filter(ed => ed.isNew && ed.page === pageNum && ed.text && ed.text.trim())
            .forEach(ed => {
                const span = document.createElement('span');
                span.className = 'editable-text-unit modified draggable';
                span.style.position = 'absolute';
                span.style.left     = `${ed.x * viewport.scale}px`;
                span.style.top      = `${(viewport.height / viewport.scale - ed.y) * viewport.scale - ed.size * viewport.scale}px`;
                span.style.fontSize = `${ed.size * viewport.scale}px`;

                let fn = ed.font || 'Helvetica';
                if (fn.includes(' ') && !fn.includes("'")) fn = `'${fn}'`;
                span.style.fontFamily     = fn;
                span.style.fontWeight     = ed.isBold      ? 'bold'      : 'normal';
                span.style.fontStyle      = ed.isItalic    ? 'italic'    : 'normal';
                span.style.textDecoration = ed.isUnderline ? 'underline' : 'none';
                span.style.color          = ed.color || '#000000';
                span.style.backgroundColor = 'transparent';
                span.style.backgroundImage = 'none';
                span.style.display    = 'inline-block';
                span.style.whiteSpace = 'pre';
                span.style.overflow   = 'visible';
                span.style.minWidth   = `${(ed.width  || 10) * viewport.scale}px`;
                span.style.minHeight  = `${(ed.height || ed.size) * viewport.scale}px`;
                span.style.cursor     = 'move';
                span.dataset.editId      = ed.id;
                span.dataset.isOriginal  = 'false';

                if (ed.html && ed.html !== ed.text) {
                    span.innerHTML = ed.html;
                } else {
                    span.textContent = ed.text;
                }

                span.addEventListener('click', (ev) => {
                    if (activeTool === 'text') {
                        deselectTextItem();
                        const existingEd = pageWrapper.querySelector('.floating-editor');
                        if (existingEd && existingEd._commit) existingEd._commit();
                        startEditing(ev, ed, null, viewport, page);
                        ev.stopPropagation();
                    } else if (activeTool === 'select' && !isDragging) {
                        selectTextItem(span);
                        ev.stopPropagation();
                    }
                });
                span.addEventListener('dblclick', (ev) => {
                    deselectTextItem();
                    const existingEd = pageWrapper.querySelector('.floating-editor');
                    if (existingEd && existingEd._commit) existingEd._commit();
                    startEditing(ev, ed, null, viewport, page);
                    ev.stopPropagation();
                });
                span.addEventListener('mousedown', (ev) => {
                    if (activeTool === 'select') {
                        selectTextItem(span);
                        startDragging(ev, span);
                        ev.stopPropagation();
                    } else if (activeTool === 'text') {
                        ev.stopPropagation();
                    }
                });

                const tl = pageWrapper.querySelector('.text-layer');
                if (tl) tl.appendChild(span);
                else pageWrapper.appendChild(span);
            });

        // ── Clear patches পুনরুদ্ধার ────────────────────────────────────
        clearStrokes
            .filter(s => s.page === pageNum)
            .forEach(s => s.rects.forEach(r => {
                const patchEl = document.createElement('div');
                patchEl.className = 'clear-patch';
                const l = r.x * viewport.scale;
                const t = (viewport.height / viewport.scale - r.y - r.h) * viewport.scale;
                const w = r.w * viewport.scale;
                const h = r.h * viewport.scale;
                patchEl.style.cssText = `
                    position:absolute; left:${l}px; top:${t}px;
                    width:${w}px; height:${h}px;
                    background-color:rgb(${Math.round(r.r*255)},${Math.round(r.g*255)},${Math.round(r.b*255)});
                    ${r.patch ? `background-image:url(${r.patch});background-size:100% 100%;background-repeat:no-repeat;` : ''}
                    pointer-events:none; z-index:5;
                `;
                pageWrapper.appendChild(patchEl);
            }));

        // ── Shapes পুনরুদ্ধার ────────────────────────────────────────────
        if (typeof restoreShapesToDom === 'function') {
            restoreShapesToDom(pageWrapper);
        }

        // ── Images পুনরুদ্ধার ────────────────────────────────────────────
        if (typeof window.restoreImagesToDom === 'function') {
            window.restoreImagesToDom(pageWrapper);
        }

        // bg canvas cache রিসেট
        _bgCanvasCache = null;

        // Pre-warm the inpainted background canvas so sampleBackgroundColor
        // can use it immediately when the user activates the text tool.
        if (typeof ensureBgCanvas === 'function') {
            ensureBgCanvas().catch(() => {});
        }

        // Mouse events
        pageWrapper.addEventListener('mousedown', (e) => handlePageMouseDown(e, pageWrapper, viewport, page));
        pageWrapper.addEventListener('mousemove', (e) => handlePageMouseMove(e, pageWrapper));
        pageWrapper.addEventListener('mouseup',   (e) => handlePageMouseUp(e, pageWrapper));

        if (window.lucide) safeCreateIcons();

    } catch (err) {
        console.error('Render error:', err);
    }
}

// ════════════════════════════════════════════
// টেক্সট লেয়ার সেটআপ
// ════════════════════════════════════════════

async function setupTextLayer(page, viewport, container) {
    const textContent = await page.getTextContent();

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className           = 'text-layer';
    textLayerDiv.style.width         = `${viewport.width}px`;
    textLayerDiv.style.height        = `${viewport.height}px`;
    textLayerDiv.style.position      = 'absolute';
    textLayerDiv.style.top           = '0';
    textLayerDiv.style.left          = '0';
    textLayerDiv.style.overflow      = 'visible';
    textLayerDiv.style.pointerEvents = 'none'; // div itself doesn't catch events
    textLayerDiv.style.zIndex        = '10';

    textContent.items.forEach(item => {
        if (!item.str || !item.str.trim()) return;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

        const textItem = document.createElement('span');
        textItem.textContent    = item.str;
        textItem.style.position = 'absolute';
        textItem.style.left     = `${tx[4]}px`;
        textItem.style.top      = `${tx[5] - item.height * viewport.scale}px`;
        textItem.style.fontSize = `${item.height * viewport.scale}px`;
        textItem.style.whiteSpace      = 'pre';
        textItem.style.transformOrigin = 'left bottom';
        textItem.style.color           = 'transparent'; // invisible but selectable
        textItem.style.backgroundColor = 'transparent';
        textItem.style.lineHeight      = '1';
        textItem.style.zIndex          = '10';

        // Apply horizontal scale from the PDF transform matrix
        const scaleX = tx[0] / item.height;
        if (scaleX && Math.abs(scaleX - 1) > 0.01) {
            textItem.style.transform = `scaleX(${scaleX})`;
        }

        let fontName = item.fontName || 'Helvetica';
        if (fontName && fontName.includes(' ') && !fontName.includes("'")) fontName = `'${fontName}'`;
        textItem.style.fontFamily    = fontName;
        textItem.className           = 'editable-text-unit';
        textItem.style.pointerEvents = 'auto';

        // সেভ করা edit পুনরুদ্ধার
        const edit = textEdits.find(ed =>
            ed.page === currentPageNum &&
            Math.abs(ed.originalX - item.transform[4]) < 1 &&
            Math.abs(ed.originalY - item.transform[5]) < 1
        );
        if (edit) restoreEditOnSpan(textItem, edit, viewport);

        // Click handlers
        textItem.addEventListener('click', (e) => {
            if (activeTool === 'text') {
                if (textItem._textCleared || textItem._cleared) {
                    e.stopPropagation();
                    const pw = textItem.closest('.pdf-page-wrapper');
                    if (pw) {
                        const rect = pw.getBoundingClientRect();
                        addNewText(e.clientX - rect.left, e.clientY - rect.top, viewport, page, pw);
                    }
                    return;
                }
                deselectTextItem();
                const existingEditor = container.querySelector('.floating-editor');
                if (existingEditor && existingEditor._commit) existingEditor._commit();
                startEditing(e, item, tx, viewport, page);
                e.stopPropagation();
                return;
            }
            if (activeTool === 'select' && !isDragging) selectTextItem(textItem);
            e.stopPropagation();
        });

        textItem.addEventListener('dblclick', (e) => {
            if (activeTool === 'select' || activeTool === 'text') {
                deselectTextItem();
                const existingEditor = container.querySelector('.floating-editor');
                if (existingEditor && existingEditor._commit) existingEditor._commit();
                startEditing(e, item, tx, viewport, page);
                e.stopPropagation();
            }
        });

        textItem.addEventListener('mousedown', (e) => {
            if (activeTool === 'clear') {
                if (typeof textItem._triggerClear === 'function') textItem._triggerClear();
                e.stopPropagation();
                return;
            }
            if (activeTool === 'clearText') return; // bubble করতে দাও
            if (activeTool === 'text') { e.stopPropagation(); return; }
            if (activeTool === 'select' && textItem.classList.contains('modified')) {
                selectTextItem(textItem);
                startDragging(e, textItem);
                e.stopPropagation();
            }
        });

        // Clear triggers (eraser-এর জন্য)
        textItem._triggerClear = () => {
            if (textItem._cleared) return;
            textItem._cleared = true;
            const editId = `${currentPageNum}-${item.transform[4]}-${item.transform[5]}`;
            const editData = {
                id: editId, page: currentPageNum, isNew: false,
                originalX: item.transform[4], originalY: item.transform[5],
                x: 0, y: 0, text: '', size: item.height || 12,
                color: 'transparent', bgHex: 'transparent',
                bgR: 1, bgG: 1, bgB: 1, font: 'Helvetica',
                isBold: false, isItalic: false, isUnderline: false,
                width: 0, height: 0
            };
            const idx = textEdits.findIndex(ed => ed.id === editId);
            if (idx > -1) textEdits[idx] = editData; else textEdits.push(editData);
            textItem.textContent           = '';
            textItem.style.color           = 'transparent';
            textItem.style.backgroundColor = 'transparent';
            textItem.style.backgroundImage = 'none';
        };

        textItem._triggerClearTextOnly = () => {
            if (textItem._textCleared) return;
            textItem._textCleared = true;
            const editId = `${currentPageNum}-${item.transform[4]}-${item.transform[5]}`;
            const pw = textItem.closest('.pdf-page-wrapper') || container;
            const spanRect = textItem.getBoundingClientRect();
            const pageRect = pw.getBoundingClientRect();
            const relLeft  = spanRect.left - pageRect.left;
            const relTop   = spanRect.top  - pageRect.top;
            const renderedW = spanRect.width  || textItem.offsetWidth  || 60;
            const renderedH = spanRect.height || textItem.offsetHeight || (item.height * pdfScale);

            const mc   = pw.querySelector('canvas');
            const csx  = mc ? mc.width  / pw.offsetWidth  : 1;
            const csy  = mc ? mc.height / pw.offsetHeight : 1;
            const patchDataUrl = typeof generateInpaintedPatch === 'function'
                ? generateInpaintedPatch(
                    Math.round(relLeft   * csx), Math.round(relTop    * csy),
                    Math.round(renderedW * csx), Math.round(renderedH * csy))
                : null;
            const bgSample = typeof sampleBackgroundColor === 'function'
                ? sampleBackgroundColor(relLeft + renderedW / 2, relTop + renderedH / 2)
                : { r: 1, g: 1, b: 1, hex: '#ffffff' };

            const clearEntry = {
                id: editId, page: currentPageNum, isNew: false,
                originalX: item.transform[4], originalY: item.transform[5],
                x: relLeft / pdfScale,
                y: (pw.offsetHeight - relTop - renderedH) / pdfScale,
                text: '', size: item.height || 12,
                color: 'transparent', bgHex: 'transparent',
                bgR: 1, bgG: 1, bgB: 1, font: 'Helvetica',
                isBold: false, isItalic: false, isUnderline: false,
                width: renderedW / pdfScale, height: renderedH / pdfScale,
                patch: patchDataUrl || null
            };
            const existingIdx = textEdits.findIndex(ed => ed.id === editId);
            if (existingIdx > -1) textEdits[existingIdx] = clearEntry;
            else textEdits.push(clearEntry);

            let pe = clearStrokes.find(s => s.page === currentPageNum);
            if (!pe) { pe = { page: currentPageNum, rects: [] }; clearStrokes.push(pe); }
            pe.rects.push({
                x: relLeft / pdfScale, y: (pw.offsetHeight - relTop - renderedH) / pdfScale,
                w: renderedW / pdfScale, h: renderedH / pdfScale,
                r: bgSample.r, g: bgSample.g, b: bgSample.b,
                patch: patchDataUrl || null
            });

            Array.from(textItem.childNodes).forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.textContent = ''; });
            if (!textItem.querySelector('*')) textItem.textContent = '';
            textItem.style.color           = 'transparent';
            textItem.style.backgroundColor = 'transparent';
            textItem.style.backgroundImage = 'none';

            const patchEl = document.createElement('div');
            patchEl.className = 'clear-patch';
            patchEl.style.cssText = `
                position:absolute; left:${relLeft}px; top:${relTop}px;
                width:${renderedW}px; height:${renderedH}px;
                background-color:${bgSample.hex};
                background-image:${patchDataUrl ? `url(${patchDataUrl})` : 'none'};
                background-size:100% 100%; background-repeat:no-repeat;
                pointer-events:none; z-index:5;
            `;
            pw.appendChild(patchEl);
        };

        textItem.dataset.isOriginal = 'true';
        textLayerDiv.appendChild(textItem);
    });

    container.appendChild(textLayerDiv);
}

// ════════════════════════════════════════════
// Edit পুনরুদ্ধার (span-এ)
// ════════════════════════════════════════════

function restoreEditOnSpan(el, edit, viewport) {
    if (edit.html && edit.html !== edit.text) {
        el.innerHTML = edit.html;
    } else {
        el.textContent = edit.text || '';
    }
    el.style.color  = edit.color;
    el.style.left   = `${edit.x * viewport.scale}px`;
    el.style.top    = `${(viewport.height / viewport.scale - edit.y) * viewport.scale - edit.size * viewport.scale}px`;
    el.style.fontSize = `${edit.size * viewport.scale}px`;

    let fontName = edit.font || 'Helvetica';
    if (fontName && fontName.includes(' ') && !fontName.includes("'")) fontName = `'${fontName}'`;
    el.style.fontFamily     = fontName;
    el.style.fontWeight     = edit.isBold      ? 'bold'      : 'normal';
    el.style.fontStyle      = edit.isItalic    ? 'italic'    : 'normal';
    el.style.textDecoration = edit.isUnderline ? 'underline' : 'none';
    el.style.backgroundColor = (!edit.text || !edit.text.trim()) ? (edit.bgHex || 'white') : 'transparent';
    el.style.backgroundImage = 'none';
    el.style.display    = 'inline-block';
    el.style.minWidth   = `${(edit.width  || 10) * viewport.scale}px`;
    el.style.minHeight  = `${(edit.height || edit.size) * viewport.scale}px`;
    el.classList.add('modified', 'draggable');
    el.dataset.editId = edit.id || `${edit.page}-${edit.originalX}-${edit.originalY}`;
}

// ════════════════════════════════════════════
// পেজ ইন্ডিকেটর আপডেট
// ════════════════════════════════════════════

function updatePageIndicator() {
    const pi = document.getElementById('pageIndicator');
    const zi = document.getElementById('zoomIndicator');
    if (pi) pi.textContent = `Page ${currentPageNum} of ${totalPages}`;
    if (zi) zi.textContent = `${Math.round(pdfScale * 100)}%`;
}
