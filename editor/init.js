// ─────────────────────────────────────────────
// editor/init.js — Antigravity PDF Pro
// সব event listener ও অ্যাপ ইনিশিয়ালাইজেশন
// নির্ভর করে: core/state.js, core/utils.js,
//   core/renderer.js, core/undo.js,
//   editor/text-editor.js, editor/save-pdf.js
// ─────────────────────────────────────────────

// ── pdf.js worker ────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ════════════════════════════════════════════
// DOM লোড হওয়ার পরে সব ইনিট
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    try {
        safeCreateIcons();
        initEventListeners();
        setTimeout(safeCreateIcons, 300);
    } catch (err) {
        console.error('Initialization error:', err);
    }
});

function initEventListeners() {

    // ── ফন্ট ও স্টাইল কন্ট্রোল ─────────────────────────────────────────

    document.getElementById('fontFamily').addEventListener('change', (e) => {
        currentStyle.fontFamily = e.target.value;
        let fn = currentStyle.fontFamily || 'Helvetica';
        if (fn.includes(' ') && !fn.includes("'")) fn = `'${fn}'`;
        applyToActiveOrSelected('fontFamily', currentStyle.fontFamily,
            el => { el.style.fontFamily = fn; },
            ed => ({ font: currentStyle.fontFamily })
        );
    });

    document.getElementById('fontSize').addEventListener('input', (e) => {
        currentStyle.fontSize = parseInt(e.target.value) || 14;
        applyFontSize();
    });

    document.getElementById('btnIncreaseFont').addEventListener('click', () => {
        currentStyle.fontSize += 1;
        document.getElementById('fontSize').value = currentStyle.fontSize;
        applyFontSize();
    });

    document.getElementById('btnDecreaseFont').addEventListener('click', () => {
        if (currentStyle.fontSize > 1) {
            currentStyle.fontSize -= 1;
            document.getElementById('fontSize').value = currentStyle.fontSize;
            applyFontSize();
        }
    });

    document.getElementById('textColor').addEventListener('input', (e) => {
        currentStyle.color = e.target.value;
        applyToActiveOrSelected('color', currentStyle.color,
            el => { el.style.color = currentStyle.color; },
            ed => ({ color: currentStyle.color })
        );
    });

    document.getElementById('bgColor').addEventListener('input', (e) => {
        currentStyle.bgColor = e.target.value;
        const rc = hexToRgb(currentStyle.bgColor);
        const ae = document.querySelector('.floating-editor');
        if (ae) {
            ae.style.backgroundColor = currentStyle.bgColor;
            ae.style.backgroundImage = 'none';
            ae.dataset.bgHex = currentStyle.bgColor;
            ae.dataset.bgR   = rc.r;
            ae.dataset.bgG   = rc.g;
            ae.dataset.bgB   = rc.b;
            delete ae.dataset.patch;
            return;
        }
        if (selectedTextItem) {
            if (selectedTextItem.classList.contains('pdf-shape-element')) {
                const inner = selectedTextItem.querySelector('div:first-child');
                if (inner) inner.style.backgroundColor = currentStyle.bgColor;
            } else {
                selectedTextItem.style.backgroundColor = currentStyle.bgColor;
            }
            syncEditData(selectedTextItem, { bgHex: currentStyle.bgColor, bgR: rc.r, bgG: rc.g, bgB: rc.b });
        }
    });

    document.getElementById('btnBold').addEventListener('click', function () {
        const ae = document.querySelector('.floating-editor');
        if (ae && hasEditorSelection()) { applyStyleToSelection('fontWeight', ''); return; }
        currentStyle.isBold = !currentStyle.isBold;
        this.classList.toggle('active', currentStyle.isBold);
        applyToActiveOrSelected('bold', currentStyle.isBold,
            el => { el.style.fontWeight = currentStyle.isBold ? 'bold' : 'normal'; },
            ed => ({ isBold: currentStyle.isBold })
        );
    });

    document.getElementById('btnItalic').addEventListener('click', function () {
        const ae = document.querySelector('.floating-editor');
        if (ae && hasEditorSelection()) { applyStyleToSelection('fontStyle', ''); return; }
        currentStyle.isItalic = !currentStyle.isItalic;
        this.classList.toggle('active', currentStyle.isItalic);
        applyToActiveOrSelected('italic', currentStyle.isItalic,
            el => { el.style.fontStyle = currentStyle.isItalic ? 'italic' : 'normal'; },
            ed => ({ isItalic: currentStyle.isItalic })
        );
    });

    document.getElementById('btnUnderline').addEventListener('click', function () {
        const ae = document.querySelector('.floating-editor');
        if (ae && hasEditorSelection()) { applyStyleToSelection('textDecoration', ''); return; }
        currentStyle.isUnderline = !currentStyle.isUnderline;
        this.classList.toggle('active', currentStyle.isUnderline);
        applyToActiveOrSelected('underline', currentStyle.isUnderline,
            el => { el.style.textDecoration = currentStyle.isUnderline ? 'underline' : 'none'; },
            ed => ({ isUnderline: currentStyle.isUnderline })
        );
    });

    // ── টেক্সট কেস ──────────────────────────────────────────────────────
    document.getElementById('btnUppercase').addEventListener('click', () => transformEditorText('upper'));
    document.getElementById('btnLowercase').addEventListener('click', () => transformEditorText('lower'));

    // ── এডিট ক্লিয়ার ────────────────────────────────────────────────────
    document.getElementById('btnClearEdits').addEventListener('click', () => {
        if (confirm('Clear all edits on this document?')) {
            textEdits    = [];
            clearStrokes = [];
            imageEdits   = [];
            undoHistory  = [];
            document.querySelectorAll('.pdf-image-wrapper, .pdf-image-element').forEach(el => el.remove());
            document.querySelectorAll('.clear-patch').forEach(el => el.remove());
            updateUndoButtonState();
            renderPage(currentPdfObj, currentPageNum);
        }
    });

    // ── Undo বাটন (core/undo.js তে ওয়্যার করা, এখানে backup) ──────────
    const _undoBtn = document.getElementById('btnUndo');
    if (_undoBtn && !_undoBtn._wired) {
        _undoBtn.addEventListener('click', () => performUndo());
        _undoBtn._wired = true;
    }

    // ── Eraser cursor dot ────────────────────────────────────────────────
    const eraserDot = document.createElement('div');
    eraserDot.className    = 'eraser-cursor-dot';
    eraserDot.style.display = 'none';
    document.body.appendChild(eraserDot);

    document.addEventListener('mousemove', (e) => {
        if (activeTool === 'clear') {
            if (eraserMode === 'brush') {
                eraserDot.style.display = 'block';
                eraserDot.style.left    = e.clientX + 'px';
                eraserDot.style.top     = e.clientY + 'px';
            } else {
                eraserDot.style.display = 'none';
            }
        }
    });
    document.addEventListener('mouseleave', () => { eraserDot.style.display = 'none'; });

    // ── টুল বাটন ────────────────────────────────────────────────────────
    document.getElementById('btnSelect').addEventListener('click', () => {
        activeTool = 'select';
        updateToolUI('btnSelect');
        document.body.classList.remove('eraser-active');
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'default';
        eraserDot.style.display = 'none';
    });

    document.getElementById('btnTypeText').addEventListener('click', () => {
        activeTool = 'text';
        updateToolUI('btnTypeText');
        document.body.classList.remove('eraser-active');
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
        eraserDot.style.display = 'none';
    });

    document.getElementById('btnClearText').addEventListener('click', () => {
        activeTool = 'clearText';
        updateToolUI('btnClearText');
        document.body.classList.remove('eraser-active');
        eraserDot.style.display = 'none';
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
    });

    // ── ইমেজ ইন্সার্ট ───────────────────────────────────────────────────
    document.getElementById('btnInsertImage').addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type   = 'file';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => addImageToPdf(ev.target.result, file.name);
                reader.readAsDataURL(file);
            }
            document.body.removeChild(inp);
        };
        inp.click();
    });

    // ── Move Area বাটন ──────────────────────────────────────────────────
    document.getElementById('btnMoveArea').addEventListener('click', () => {
        activeTool = 'moveArea';
        updateToolUI('btnMoveArea');
        document.body.classList.remove('eraser-active');
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
    });

    // ── Create Table বাটন ──────────────────────────────────────────────
    document.getElementById('btnCreateTable').addEventListener('click', () => {
        const modal = document.getElementById('tableModal');
        if (modal) modal.style.display = 'flex';
    });

    // ── টেবিল মডাল ইভেন্ট ─────────────────────────────────────────────
    const tableModal = document.getElementById('tableModal');
    if (tableModal) {
        document.getElementById('btnCloseTableModal').addEventListener('click', () => {
            tableModal.style.display = 'none';
        });

        document.getElementById('btnCancelTable').addEventListener('click', () => {
            tableModal.style.display = 'none';
        });

        document.getElementById('btnCreateTableConfirm').addEventListener('click', () => {
            const columns = parseInt(document.getElementById('tableColumns').value) || 3;
            const rows = parseInt(document.getElementById('tableRows').value) || 3;
            const cellWidth = parseInt(document.getElementById('tableCellWidth').value) || 80;
            const cellHeight = parseInt(document.getElementById('tableCellHeight').value) || 50;

            const container = document.querySelector('.pdf-page-wrapper');
            if (!container) {
                alert('Please load a PDF first');
                return;
            }

            // টেবিল তৈরি করুন
            const tableEl = createTable(columns, rows, cellWidth, cellHeight, container);
            
            // টেবিল কন্টেইনারে যোগ করুন
            tableEl.style.left = '50px';
            tableEl.style.top = '50px';
            container.appendChild(tableEl);

            tableModal.style.display = 'none';
            
            // স্টাইল আপডেট করুন
            updateToolUI('btnCreateTable');

            // Table object store করুন (PDF save এর সময় প্রয়োজন হবে)
            if (!window.createdTables) window.createdTables = [];
            window.createdTables.push({
                page: currentPageNum,
                html: tableEl.innerHTML,
                x: 50,
                y: 50
            });
        });

        // মডাল বন্ধ করতে ESC কী
        tableModal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') tableModal.style.display = 'none';
        });
    }

    // ── কীবোর্ড শর্টকাট ─────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return;
        const k = e.key.toLowerCase();
        if (e.ctrlKey && k === 'z') { e.preventDefault(); performUndo(); return; }
        if (k === 'v') document.getElementById('btnSelect').click();
        else if (k === 't') document.getElementById('btnTypeText').click();
        else if (k === 'e') document.getElementById('btnClearText').click();
        else if (e.ctrlKey && k === 'b') { e.preventDefault(); document.getElementById('btnBold').click(); }
        else if (e.ctrlKey && k === 'i') { e.preventDefault(); document.getElementById('btnItalic').click(); }
        else if (e.ctrlKey && k === 'u') { e.preventDefault(); document.getElementById('btnUnderline').click(); }
        else if (k === 'delete' || k === 'backspace') {
            if (selectedTextItem && activeTool === 'select') {
                const id = selectedTextItem.dataset.editId;
                if (id) textEdits = textEdits.filter(ed =>
                    (ed.id || `${ed.page}-${ed.originalX}-${ed.originalY}`) !== id);
                selectedTextItem.remove();
                selectedTextItem = null;
            }
        }
    });

    // ── Toolbar mousedown focus fix ──────────────────────────────────────
    document.querySelectorAll('.btn-tool, .color-picker-wrapper, #btnIncreaseFont, #btnDecreaseFont, #fontFamily, #fontSize').forEach(el => {
        el.addEventListener('mousedown', (e) => {
            if (el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
            const noPreventList = ['btnSelect','btnTypeText','btnClearText','btnInsertImage','btnUndo','btnClearEdits','btnShapeMenu','btnMoveArea','btnCreateTable'];
            if (noPreventList.includes(el.id)) return;
            e.preventDefault();
        });
    });

    // ── Global commit (floating editor বাইরে ক্লিক) ─────────────────────
    document.addEventListener('mousedown', (e) => {
        const ae = document.querySelector('.floating-editor');
        if (!ae || !ae._commit) return;
        const toolbar   = document.querySelector('.toolbar-editor');
        const wrap      = ae._wrapEl;
        const inEditor  = ae.contains(e.target) || (wrap && wrap.contains(e.target));
        const inToolbar = toolbar && toolbar.contains(e.target);
        if (!inEditor && !inToolbar) ae._commit();
    }, true);

    // ── Move Area Global Drag Handlers ───────────────────────────────────
    document.addEventListener('mousemove', (e) => {
        // Table Drag Handling
        if (activeTableDrag) {
            const deltaX = e.clientX - activeTableDrag.startX;
            const deltaY = e.clientY - activeTableDrag.startY;
            activeTableDrag.element.style.left = `${activeTableDrag.origLeft + deltaX}px`;
            activeTableDrag.element.style.top = `${activeTableDrag.origTop + deltaY}px`;
        }
        
        // Cell Resize Handling
        if (activeCellResize) {
            const deltaX = e.clientX - activeCellResize.startX;
            const deltaY = e.clientY - activeCellResize.startY;
            const newWidth = Math.max(50, activeCellResize.origWidth + deltaX);
            const newHeight = Math.max(30, activeCellResize.origHeight + deltaY);
            activeCellResize.cell.style.width = `${newWidth}px`;
            activeCellResize.cell.style.height = `${newHeight}px`;
        }
        
        // Move Area Handling
        if (moveAreaDragging && moveAreaRect) {
            const deltaX = e.clientX - moveAreaDragStartX;
            const deltaY = e.clientY - moveAreaDragStartY;
            moveAreaRect.style.left = `${moveAreaOrigLeft + deltaX}px`;
            moveAreaRect.style.top = `${moveAreaOrigTop + deltaY}px`;
            if (moveAreaSelection) {
                moveAreaSelection.left = moveAreaOrigLeft + deltaX;
                moveAreaSelection.top = moveAreaOrigTop + deltaY;
            }
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        // Table Drag End
        if (activeTableDrag) {
            activeTableDrag.handle.style.cursor = 'grab';
            activeTableDrag = null;
        }
        
        // Cell Resize End
        if (activeCellResize) {
            activeCellResize = null;
        }
        
        // Move Area End
        if (moveAreaDragging) {
            moveAreaDragging = false;
            if (moveAreaRect) {
                moveAreaRect.style.cursor = 'grab';
            }
            if (moveAreaSelection) {
                applyMoveArea(moveAreaSelection, moveAreaSelection.container);
            }
        }
    });

    // ── Escape key ───────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const ae = document.querySelector('.floating-editor');
        if (ae && ae._commit) ae._commit();
        else if (ae && ae._wrapEl) ae._wrapEl.remove();
        deselectTextItem();
        if (eraserRectEl)   { eraserRectEl.remove();   eraserRectEl = null; }
        if (clearTextRectEl){ clearTextRectEl.remove(); clearTextRectEl = null; }
        if (_clearTextDocMouseMove) { document.removeEventListener('mousemove', _clearTextDocMouseMove); _clearTextDocMouseMove = null; }
        if (_clearTextDocMouseUp)   { document.removeEventListener('mouseup',   _clearTextDocMouseUp);   _clearTextDocMouseUp   = null; }
        clearTextContainer = null;
        isSelecting = false;
        document.querySelectorAll('.shape-resize-handle').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.shape-toolbar').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.pdf-shape-element').forEach(el => el.style.outline = 'none');
        if (selectedTextItem) { selectedTextItem.style.outline = ''; selectedTextItem = null; }
    });

    // ── Nav ট্যাব ────────────────────────────────────────────────────────
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
    });

    // ── PDF আপলোড ────────────────────────────────────────────────────────
    document.getElementById('btnUploadEditor').onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.pdf'; inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.onchange = (e) => {
            const file = e.target.files[0];
            if (file) { currentPdfFile = file; loadAndRenderPDF(file); }
            document.body.removeChild(inp);
        };
        inp.value = '';
        inp.click();
    };

    const editorEmptyState = document.getElementById('editorEmptyState');
    if (editorEmptyState) {
        editorEmptyState.style.cursor = 'pointer';
        editorEmptyState.addEventListener('click', () => document.getElementById('btnUploadEditor').click());
    }

    // ── Drag & Drop (editor workspace) ──────────────────────────────────
    const editorWorkspace = document.querySelector('.editor-workspace');
    if (editorWorkspace) {
        editorWorkspace.addEventListener('dragover', (e) => {
            e.preventDefault(); editorWorkspace.style.borderColor = 'var(--primary)';
        });
        editorWorkspace.addEventListener('dragleave', () => { editorWorkspace.style.borderColor = ''; });
        editorWorkspace.addEventListener('drop', (e) => {
            e.preventDefault(); editorWorkspace.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.name.toLowerCase().endsWith('.pdf')) {
                switchTab('editor'); currentPdfFile = file; loadAndRenderPDF(file);
            } else if (file) { alert('Please drop a PDF file.'); }
        });
    }

    // ── সেভ বাটন ─────────────────────────────────────────────────────────
    document.getElementById('btnSavePdf').onclick = savePdfChanges;

    // ── পেজ নেভিগেশন ────────────────────────────────────────────────────
    document.getElementById('prevPage').onclick = () => {
        if (currentPageNum > 1 && currentPdfObj) { currentPageNum--; renderPage(currentPdfObj, currentPageNum); }
    };
    document.getElementById('nextPage').onclick = () => {
        if (currentPageNum < totalPages && currentPdfObj) { currentPageNum++; renderPage(currentPdfObj, currentPageNum); }
    };

    // ── জুম কন্ট্রোল ─────────────────────────────────────────────────────
    document.getElementById('btnZoomFit').onclick = async () => {
        if (!currentPdfObj) return;
        const _aeF = document.querySelector('.floating-editor');
        if (_aeF && _aeF._commit) _aeF._commit();
        const cont = document.getElementById('canvasWrapper');
        const avail = cont.clientWidth - 80;
        const page  = await currentPdfObj.getPage(currentPageNum);
        const vp    = page.getViewport({ scale: 1.0 });
        pdfScale    = avail / vp.width;
        renderPage(currentPdfObj, currentPageNum);
    };

    document.getElementById('btnZoomIn').onclick = () => {
        if (!currentPdfObj) return;
        const _ae = document.querySelector('.floating-editor');
        if (_ae && _ae._commit) _ae._commit();
        pdfScale += 0.25;
        renderPage(currentPdfObj, currentPageNum);
        updatePageIndicator();
    };

    document.getElementById('btnZoomOut').onclick = () => {
        if (!currentPdfObj || pdfScale <= 0.5) return;
        const _ae = document.querySelector('.floating-editor');
        if (_ae && _ae._commit) _ae._commit();
        pdfScale -= 0.25;
        renderPage(currentPdfObj, currentPageNum);
        updatePageIndicator();
    };

    // ── Converter drop zone ──────────────────────────────────────────────
    const dropZone = document.getElementById('converterDropZone');
    if (dropZone) {
        document.getElementById('converterInput').onchange = (e) => {
            const file = e.target.files[0];
            if (file) convertToWord(file);
        };
        dropZone.onclick = () => document.getElementById('converterInput').click();
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); dropZone.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.name.toLowerCase().endsWith('.pdf')) convertToWord(file);
            else alert('Please drop a PDF file.');
        });
    }

    console.log('Antigravity PDF Editor ready.');

} // end initEventListeners
