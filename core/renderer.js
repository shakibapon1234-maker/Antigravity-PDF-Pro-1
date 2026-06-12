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

async function decryptPdf(file, password = '') {
    const fd = new FormData();
    fd.append('file', file);
    if (password) fd.append('password', password);

    const res = await fetch('/api/tools/decrypt-pdf', {
        method: 'POST',
        body: fd
    });
    if (!res.ok) {
        let errText = 'Decryption failed';
        try {
            const errData = await res.json();
            errText = errData.error || errText;
        } catch (e) {}
        throw new Error(errText);
    }
    const blob = await res.blob();
    return new File([blob], file.name, { type: 'application/pdf' });
}

async function loadAndRenderPDF(file, password = '') {
    // Check if PDF is encrypted using PDF-lib
    let isEncrypted = false;
    try {
        const arrayBuffer = await file.arrayBuffer();
        await PDFLib.PDFDocument.load(arrayBuffer);
    } catch (e) {
        if (e.message.includes('encrypted') || e.name === 'EncryptedPDFError') {
            isEncrypted = true;
        }
    }

    if (isEncrypted) {
        try {
            const decryptedFile = await decryptPdf(file, password);
            file = decryptedFile;
            currentPdfFile = file; // Update global reference
        } catch (err) {
            // Prompt for password if decryption fails
            const userPassword = prompt(err.message + '\n\nPlease enter the PDF password:');
            if (userPassword === null) {
                // User cancelled, reset global file reference if needed
                currentPdfFile = null;
                return;
            }
            return loadAndRenderPDF(file, userPassword);
        }
    }

    console.log('[renderer] loadAndRenderPDF started for file:', file.name, 'isEncrypted:', isEncrypted);

    const reader = new FileReader();
    reader.onload = async function () {
        try {
            console.log('[renderer] FileReader onload triggered. Parsing PDF array buffer...');
            const arrayBufferCopy = this.result.slice(0); // Copy before it gets detached by PDF.js parser
            const typedarray  = new Uint8Array(this.result);
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            currentPdfObj = await loadingTask.promise;
            totalPages    = currentPdfObj.numPages;
            console.log('[renderer] PDF parsed successfully. Total pages:', totalPages);

            document.getElementById('editorEmptyState').classList.add('d-none');
            document.getElementById('pdfEditorContainer').classList.remove('d-none');
            document.getElementById('pdfEditorContainer').style.display = 'flex';

            // Reset edit state for fresh PDF load
            textEdits    = [];
            shapeEdits   = [];
            clearStrokes = [];
            if (typeof imageEdits !== 'undefined') imageEdits = [];
            window.hyperlinks = [];
            undoHistory  = [];
            redoHistory  = [];

            currentPageNum = 1;
            console.log('[renderer] Rendering page:', currentPageNum);
            await renderPage(currentPdfObj, currentPageNum);
            console.log('[renderer] Finished initial page render.');

            // ── Initial snapshot: Undo cannot go before this point ──────────
            // This ensures Undo always steps back ONE action at a time and
            // never reverts to a blank/empty state.
            if (typeof captureUndoSnapshot === 'function') {
                captureUndoSnapshot('Initial state');
            }
            if (typeof window.loadPageNumbersPdf === 'function') {
                window.loadPageNumbersPdf(file);
            }

            // ── Phase 4: Hook thumbnail sidebar & multi-export ──────────────
            window._currentPdfDoc = currentPdfObj;
            window._currentFileObj = { name: file.name, arrayBuffer: arrayBufferCopy };
            if (typeof ThumbnailSidebar !== 'undefined') {
                ThumbnailSidebar.loadDocument(currentPdfObj);
            }
            if (typeof FindReplace !== 'undefined') {
                FindReplace.setDocument(currentPdfObj);
            }
            if (typeof MultiExport !== 'undefined') {
                MultiExport.setFile(window._currentFileObj);
            }
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
        console.log('[renderer] renderPage called. Fetching page:', pageNum);
        // Invalidate bg canvas cache — new page means new background
        if (typeof invalidateBgCanvas === 'function') invalidateBgCanvas();
        const page     = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: pdfScale });

        // Store unscaled page dimensions (in PDF user-space points) globally
        // so shapes.js and save-pdf.js can use the exact coordinate space.
        const naturalViewport = page.getViewport({ scale: 1.0 });
        window._pdfPageNaturalSize = {
            width:  naturalViewport.width,
            height: naturalViewport.height
        };

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

        console.log('[renderer] Rendering PDF page content onto canvas...');
        await page.render({ canvasContext: context, viewport }).promise;
        console.log('[renderer] PDF page canvas render complete. Setting up text layer...');
        await setupTextLayer(page, viewport, pageWrapper);
        console.log('[renderer] Text layer setup complete.');

        // ── নতুন যোগ করা টেক্সট আইটেম পুনরুদ্ধার ──────────────────────
        textEdits
            .filter(ed => ed.isNew && ed.page === pageNum && ed.text && ed.text.trim())
            .forEach(ed => {
                const span = document.createElement('span');
                span.className = 'editable-text-unit modified draggable';
                span.style.position = 'absolute';
                const tx = pdfjsLib.Util.transform(viewport.transform, [1, 0, 0, 1, ed.x, ed.y]);
                span.style.left     = `${tx[4]}px`;
                span.style.top      = `${tx[5] - ed.size * viewport.scale}px`;
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
                    pointer-events:none; z-index:50;
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

        // ── Form Fields পুনরুদ্ধার ───────────────────────────────────────
        if (typeof restoreFormFieldsToDom === 'function') {
            restoreFormFieldsToDom(pageWrapper);
        }

        // ── Hyperlinks পুনরুদ্ধার ─────────────────────────────────────────
        if (typeof restoreHyperlinksToDom === 'function') {
            console.log('[renderer] Restoring hyperlinks...');
            restoreHyperlinksToDom(pageWrapper);
            console.log('[renderer] Hyperlinks restored.');
        }

        // bg canvas cache রিসেট
        _bgCanvasCache = null;



        // Mouse events
        pageWrapper.addEventListener('mousedown', (e) => handlePageMouseDown(e, pageWrapper, viewport, page));
        pageWrapper.addEventListener('mousemove', (e) => handlePageMouseMove(e, pageWrapper));
        pageWrapper.addEventListener('mouseup',   (e) => handlePageMouseUp(e, pageWrapper));

        if (window.lucide) safeCreateIcons();
        console.log('[renderer] renderPage successfully completed all steps.');

    } catch (err) {
        console.error('[renderer] Render error:', err);
    }
}

// ════════════════════════════════════════════
// টেক্সট লেয়ার সেটআপ (Merges split text lines for seamless editing & whiteout)
// ════════════════════════════════════════════

function mergeTextItems(items) {
    if (!items || items.length === 0) return [];

    // Group items into horizontal rows based on Y coordinate
    const rows = [];
    items.forEach(item => {
        if (!item.str || !item.str.trim()) return;

        const y = item.transform[5];
        let foundRow = rows.find(r => Math.abs(r.y - y) < 4);
        if (foundRow) {
            foundRow.items.push(item);
        } else {
            rows.push({ y, items: [item] });
        }
    });

    const mergedItems = [];

    rows.forEach(row => {
        // Sort items in the row from left to right
        row.items.sort((a, b) => a.transform[4] - b.transform[4]);

        let currentItem = null;

        row.items.forEach(item => {
            if (!currentItem) {
                currentItem = {
                    ...item,
                    transform: [...item.transform],
                };
                return;
            }

            const currentEndX = currentItem.transform[4] + currentItem.width;
            const itemStartX = item.transform[4];
            const gap = itemStartX - currentEndX;

            // Merging threshold: if gap is small (e.g. < 15 points)
            if (gap >= -5 && gap < 15) {
                const needsSpace = gap > 1.5 && 
                                   !currentItem.str.endsWith(' ') && 
                                   !item.str.startsWith(' ');
                
                currentItem.str += (needsSpace ? ' ' : '') + item.str;
                currentItem.width = (item.transform[4] + item.width) - currentItem.transform[4];
                currentItem.height = Math.max(currentItem.height, item.height);
            } else {
                mergedItems.push(currentItem);
                currentItem = {
                    ...item,
                    transform: [...item.transform],
                };
            }
        });

        if (currentItem) {
            mergedItems.push(currentItem);
        }
    });

    return mergedItems;
}

async function setupTextLayer(page, viewport, container) {
    const textContent = await page.getTextContent();
    const mergedItems = mergeTextItems(textContent.items);

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

    mergedItems.forEach(item => {
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
        if (edit) {
            restoreEditOnSpan(textItem, edit, viewport);

            // Draw cover patch at the original position to hide the canvas text
            const coverPatch = document.createElement('div');
            coverPatch.className = 'clear-patch text-cover-patch';

            // Convert original PDF coordinates to viewport pixels
            const txOriginal = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const origLeft   = txOriginal[4];
            const origTop    = txOriginal[5] - (edit.originalHeight || item.height || 12) * viewport.scale;
            const origWidth  = (edit.originalWidth  || item.width  || 40) * viewport.scale;
            const origHeight = (edit.originalHeight || item.height || 12) * viewport.scale;

            // ── Background colour for the cover patch ──────────────────────
            // IMPORTANT: Do NOT call generateInpaintedPatch here.
            // It captures the canvas at the text position which *includes* the
            // rendered dark text, producing a "black shadow" artifact.
            // Instead, determine the background colour by:
            //   1. Using a pre-computed patch stored on the edit (eraser tool).
            //   2. Sampling the page background from a margin point (above the
            //      text line) so we read the paper colour, not the glyph pixels.
            //   3. Falling back to explicit bgHex / coverBgHex on the edit.
            //   4. Final fallback: white.
            let patchDataUrl = edit.patch || null; // only use if eraser pre-computed it

            let coverBgHex = edit.coverBgHex ||
                ((edit.bgHex && edit.bgHex !== 'transparent') ? edit.bgHex : null);

            if (!coverBgHex) {
                // Sample from just above the text line (in the left margin)
                // to avoid reading glyph pixels and get the true paper colour.
                const sampleX = Math.max(0, origLeft - 4);
                const sampleY = Math.max(0, origTop  - 4);
                const bg = typeof sampleBackgroundColor === 'function'
                    ? sampleBackgroundColor(sampleX, sampleY)
                    : null;
                coverBgHex = (bg && bg.hex) ? bg.hex : '#ffffff';
            }

            coverPatch.style.cssText = `
                position: absolute;
                left: ${origLeft - 1}px;
                top:  ${origTop  - 1}px;
                width: ${origWidth  + 2}px;
                height: ${origHeight + 2}px;
                background-color: ${coverBgHex};
                ${patchDataUrl ? `background-image:url(${patchDataUrl});background-size:100% 100%;background-repeat:no-repeat;` : ''}
                pointer-events: none;
                z-index: 8;
            `;
            textItem._coverPatch = coverPatch;
            container.appendChild(coverPatch);
        }


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
                originalWidth: item.width || 40, originalHeight: item.height || 12,
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
                originalWidth: item.width || (renderedW / pdfScale),
                originalHeight: item.height || (renderedH / pdfScale),
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
    const tx = pdfjsLib.Util.transform(viewport.transform, [1, 0, 0, 1, edit.x, edit.y]);
    el.style.color  = edit.color;
    el.style.left   = `${tx[4]}px`;
    el.style.top    = `${tx[5] - edit.size * viewport.scale}px`;
    el.style.fontSize = `${edit.size * viewport.scale}px`;

    let fontName = edit.font || 'Helvetica';
    if (fontName && fontName.includes(' ') && !fontName.includes("'")) fontName = `'${fontName}'`;
    el.style.fontFamily     = fontName;
    el.style.fontWeight     = edit.isBold      ? 'bold'      : 'normal';
    el.style.fontStyle      = edit.isItalic    ? 'italic'    : 'normal';
    el.style.textDecoration = edit.isUnderline ? 'underline' : 'none';
    el.style.backgroundColor = (!edit.text || !edit.text.trim()) ? (edit.coverBgHex || edit.bgHex || 'white') : 'transparent';
    el.style.backgroundImage = 'none';
    el.style.display    = 'inline-block';
    el.style.minWidth   = `${(edit.width  || 10) * viewport.scale}px`;
    el.style.minHeight  = `${(edit.height || edit.size) * viewport.scale}px`;
    el.classList.add('modified', 'draggable');
    el.dataset.editId = edit.id || `${edit.page}-${edit.originalX}-${edit.originalY}`;
    el.style.transform = 'none';
}

// ════════════════════════════════════════════
// পেজ ইন্ডিকেটর আপডেট
// ════════════════════════════════════════════

function updatePageIndicator() {
    const pi = document.getElementById('pageIndicator');
    const zi = document.getElementById('zoomIndicator');
    if (pi) pi.textContent = `Page ${currentPageNum} of ${totalPages}`;
    if (zi) zi.textContent = `${Math.round(pdfScale * 100)}%`;

    // Phase 4: Update thumbnail sidebar active state
    if (typeof ThumbnailSidebar !== 'undefined') {
        ThumbnailSidebar.onEditorPageChange(currentPageNum);
    }
    // Phase 4: Dispatch page change event
    document.dispatchEvent(new CustomEvent('editor:pageChanged', { detail: { page: currentPageNum } }));
}
