// ─────────────────────────────────────────────
// editor/init.js — Antigravity PDF Pro
// সব event listener ও অ্যাপ ইনিশিয়ালাইজেশন
// নির্ভর করে: core/state.js, core/utils.js,
//   core/renderer.js, core/undo.js,
//   editor/text-editor.js, editor/save-pdf.js
// ─────────────────────────────────────────────

// ── pdf.js worker ────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'ui/libs/pdf.worker.min.js';
} else {
    console.warn('[init.js] pdfjsLib is undefined during script load.');
}

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
        const btnTransBg = document.getElementById('btnTransparentBg');
        if (btnTransBg) {
            btnTransBg.classList.remove('active');
            document.getElementById('bgColor').style.opacity = '1';
        }
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
            shapeEdits   = [];
            clearStrokes = [];
            if (typeof imageEdits !== 'undefined') imageEdits = [];
            window.hyperlinks = [];
            if (typeof window.formFields !== 'undefined') window.formFields = [];
            if (typeof window.createdTables !== 'undefined') window.createdTables = [];
            if (typeof _fhPaths !== 'undefined') _fhPaths = [];
            if (typeof _fhCurrentPts !== 'undefined') _fhCurrentPts = [];
            selectedTextItem = null;
            isDragging = false;
            dragTarget = null;
            _shapeZCounter = 60;
            _imgZCounter = 65;
            undoHistory  = [];
            redoHistory  = [];
            
            document.querySelectorAll('.pdf-image-wrapper, .pdf-image-element, .pdf-shape-element, .clear-patch, .hyperlink-patch, .created-table').forEach(el => el.remove());
            updateUndoButtonState();
            renderPage(currentPdfObj, currentPageNum);
        }
    });

    // ── Undo বাটন (core/undo.js তে ওয়্যার করা) ──────────────────────────

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
    // Helper: clearText / moveArea active হলে text spans-এ pointer-events বন্ধ করো
    // যাতে mousedown page wrapper পর্যন্ত পৌঁছায় (drag-select কাজ করে)
    function setTextLayerInteractivity(enable) {
        document.querySelectorAll('.editable-text-unit').forEach(s => {
            s.style.pointerEvents = enable ? 'auto' : 'none';
        });
    }

    document.getElementById('btnSelect').addEventListener('click', () => {
        deactivateAllTools();
        activeTool = 'select';
        updateToolUI('btnSelect');
        document.body.classList.remove('eraser-active');
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'default';
        eraserDot.style.display = 'none';
        setTextLayerInteractivity(true);

        const selectEscListener = (e) => {
            if (activeTool !== 'select') { document.removeEventListener('keydown', selectEscListener); return; }
            if (e.key === 'Escape' || e.key === 'Esc') {
                deselectTextItem();
                document.querySelectorAll('.shape-resize-handle').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.shape-toolbar').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.pdf-shape-element').forEach(el => el.style.outline = 'none');
                if (typeof selectedTextItem !== 'undefined' && selectedTextItem) { selectedTextItem.style.outline = ''; selectedTextItem = null; }
            }
        };
        document.addEventListener('keydown', selectEscListener);
    });

    document.getElementById('btnTypeText').addEventListener('click', () => {
        deactivateAllTools();
        activeTool = 'text';
        updateToolUI('btnTypeText');
        document.body.classList.remove('eraser-active');
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
        eraserDot.style.display = 'none';
        setTextLayerInteractivity(true);

        const textEscListener = (e) => {
            if (activeTool !== 'text') { document.removeEventListener('keydown', textEscListener); return; }
            if (e.key === 'Escape' || e.key === 'Esc') {
                document.querySelectorAll('.floating-editor').forEach(ae => {
                    if (ae._commit) ae._commit();
                    else if (ae._wrapEl) ae._wrapEl.remove();
                    else ae.remove();
                });
                deselectTextItem();
                const selectBtn = document.getElementById('btnSelect');
                if (selectBtn) selectBtn.click();
            }
        };
        document.addEventListener('keydown', textEscListener);
    });

    document.getElementById('btnClearText').addEventListener('click', () => {
        deactivateAllTools();
        activeTool = 'clearText';
        updateToolUI('btnClearText');
        document.body.classList.remove('eraser-active');
        eraserDot.style.display = 'none';
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
        setTextLayerInteractivity(false);

        const clearTextEscListener = (e) => {
            if (activeTool !== 'clearText') { document.removeEventListener('keydown', clearTextEscListener); return; }
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (typeof clearTextRectEl !== 'undefined' && clearTextRectEl) { clearTextRectEl.remove(); clearTextRectEl = null; }
                if (typeof _clearTextDocMouseMove !== 'undefined' && _clearTextDocMouseMove) { document.removeEventListener('mousemove', _clearTextDocMouseMove); _clearTextDocMouseMove = null; }
                if (typeof _clearTextDocMouseUp !== 'undefined' && _clearTextDocMouseUp)   { document.removeEventListener('mouseup',   _clearTextDocMouseUp);   _clearTextDocMouseUp   = null; }
                if (typeof clearTextContainer !== 'undefined') clearTextContainer = null;
                if (typeof isSelecting !== 'undefined') isSelecting = false;
                const selectBtn = document.getElementById('btnSelect');
                if (selectBtn) selectBtn.click();
            }
        };
        document.addEventListener('keydown', clearTextEscListener);
    });

    document.getElementById('btnCloneArea').addEventListener('click', () => {
        deactivateAllTools();
        activeTool = 'cloneArea';
        updateToolUI('btnCloneArea');
        document.body.classList.remove('eraser-active');
        eraserDot.style.display = 'none';
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
        setTextLayerInteractivity(false);

        const cloneAreaEscListener = (e) => {
            if (activeTool !== 'cloneArea') { document.removeEventListener('keydown', cloneAreaEscListener); return; }
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (typeof finalizeCloneArea === 'function') finalizeCloneArea();
                const selectBtn = document.getElementById('btnSelect');
                if (selectBtn) selectBtn.click();
            }
        };
        document.addEventListener('keydown', cloneAreaEscListener);
    });

    document.getElementById('btnTransparentBg').addEventListener('click', function() {
        this.classList.toggle('active');
        const isActive = this.classList.contains('active');
        if (isActive) {
            // Disable BG color picker visually
            document.getElementById('bgColor').style.opacity = '0.5';
        } else {
            document.getElementById('bgColor').style.opacity = '1';
        }

        // Apply transparency / solid bg to active floating editor or selected text item
        const ae = document.querySelector('.floating-editor');
        if (ae) {
            if (isActive) {
                ae.style.backgroundColor = 'transparent';
                ae.style.backgroundImage = 'none';
                ae.dataset.bgHex = 'transparent';
                ae.dataset.bgR   = 1;
                ae.dataset.bgG   = 1;
                ae.dataset.bgB   = 1;
            } else {
                const pickerVal = document.getElementById('bgColor').value || '#ffffff';
                const rc = hexToRgb(pickerVal);
                ae.style.backgroundColor = pickerVal;
                ae.style.backgroundImage = 'none';
                ae.dataset.bgHex = pickerVal;
                ae.dataset.bgR   = rc.r;
                ae.dataset.bgG   = rc.g;
                ae.dataset.bgB   = rc.b;
            }
            delete ae.dataset.patch;
        } else if (selectedTextItem) {
            const finalHex = isActive ? 'transparent' : (document.getElementById('bgColor').value || '#ffffff');
            const rc = hexToRgb(finalHex === 'transparent' ? '#ffffff' : finalHex);
            if (selectedTextItem.classList.contains('pdf-shape-element')) {
                const inner = selectedTextItem.querySelector('div:first-child');
                if (inner) inner.style.backgroundColor = finalHex;
            } else {
                selectedTextItem.style.backgroundColor = finalHex;
            }
            syncEditData(selectedTextItem, { bgHex: finalHex, bgR: rc.r, bgG: rc.g, bgB: rc.b });
        }
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
        deactivateAllTools();
        activeTool = 'moveArea';
        updateToolUI('btnMoveArea');
        document.body.classList.remove('eraser-active');
        const w = document.getElementById('canvasWrapper');
        if (w) w.style.cursor = 'crosshair';
        // text spans-এ pointer-events বন্ধ
        setTextLayerInteractivity(false);

        // ম্যানুয়ালি Escape লিসেনার যোগ করা হচ্ছে (ইউজারের নির্দেশ অনুযায়ী)
        const moveAreaEscListener = (e) => {
            if (activeTool !== 'moveArea') { document.removeEventListener('keydown', moveAreaEscListener); return; }
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (typeof finalizeMoveArea === 'function') finalizeMoveArea();
                const selectBtn = document.getElementById('btnSelect');
                if (selectBtn) selectBtn.click();
            }
        };
        document.addEventListener('keydown', moveAreaEscListener);
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

            // ম্যানুয়ালি Escape লিসেনার যোগ করা হচ্ছে (ইউজারের নির্দেশ অনুযায়ী)
            const tableEscListener = (e) => {
                if (e.key === 'Escape' || e.key === 'Esc') {
                    if (typeof window.finalizeTables === 'function') window.finalizeTables();
                    document.removeEventListener('keydown', tableEscListener);
                }
            };
            document.addEventListener('keydown', tableEscListener);
        });

        // মডাল বন্ধ করতে ESC কী
        tableModal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') tableModal.style.display = 'none';
        });
    }

    // ── কীবোর্ড শর্টকাট ─────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return;
        const k = e.key ? e.key.toLowerCase() : '';
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
            const noPreventList = ['btnSelect','btnTypeText','btnClearText','btnCloneArea','btnInsertImage','btnUndo','btnClearEdits','btnShapeMenu','btnMoveArea','btnCreateTable'];
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
        
        // Move Area is now self-contained in endMoveAreaSelection()

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
        
        // Move Area is now self-contained in endMoveAreaSelection()

    });

    // ── Escape key সরানো হলো (ইউজারের নির্দেশ অনুযায়ী) ──────────────────

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

    // ── প্রিন্ট বাটন ──────────────────────────────────────────────────────
    const printPdf = () => {
        if (currentPdfFile) {
            window.print();
        } else {
            alert('কোনো PDF লোড করা নেই।');
        }
    };
    const btnPrintPdf = document.getElementById('btnPrintPdf');
    if (btnPrintPdf) btnPrintPdf.onclick = printPdf;
    if (window.electronAPI?.onTriggerPrint) {
        window.electronAPI.onTriggerPrint(printPdf);
    }


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

    // ── Global Drag & Drop File Opening (DEV-11) ──────────────────────────────────
    let dragCounter = 0;
    const dragOverlay = document.getElementById('globalDragOverlay');

    if (dragOverlay) {
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            dragOverlay.style.opacity = '1';
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault(); // Required to allow drop!
            if (dragOverlay.style.opacity !== '1') {
                dragOverlay.style.opacity = '1';
            }
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dragOverlay.style.opacity = '0';
            }
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            dragOverlay.style.opacity = '0';

            const file = e.dataTransfer.files[0];
            if (!file) return;

            const name = file.name ? file.name.toLowerCase() : '';
            const ext = name.split('.').pop();

            if (ext === 'pdf') {
                // Determine destination tab
                const activeTab = document.querySelector('.tab-content.active');
                const tabId = activeTab ? activeTab.id : null;
                const pdfTabs = ['editor', 'converter', 'merge', 'split', 'compress', 'rotate', 'crop-pdf', 'organize-pdf', 'ocr-pdf', 'watermark-pdf', 'page-numbers-pdf', 'protect-pdf', 'unlock-pdf', 'pdf-to-image'];
                
                if (pdfTabs.includes(tabId)) {
                    // Load in place
                    const loadFns = {
                        'editor': window.loadAndRenderPDF,
                        'converter': window.convertToWord,
                        'merge': (f) => window.loadMergePdfs && window.loadMergePdfs([f]),
                        'split': window.loadSplitPdf,
                        'compress': window.loadCompressPdf,
                        'rotate': window.loadRotatePdf,
                        'crop-pdf': window.loadCropPdf,
                        'organize-pdf': window.loadOrganizePdf,
                        'ocr-pdf': window.loadOcrPdf,
                        'watermark-pdf': window.loadWatermarkPdf,
                        'page-numbers-pdf': window.loadPageNumbersPdf,
                        'protect-pdf': window.loadProtectPdf,
                        'unlock-pdf': window.loadUnlockPdf,
                        'pdf-to-image': window.loadPdfToImage
                    };
                    if (loadFns[tabId]) {
                        window.currentPdfFile = file;
                        loadFns[tabId](file);
                    }
                } else {
                    // Fallback: switch to editor and load
                    if (typeof window.switchTab === 'function') window.switchTab('editor');
                    window.currentPdfFile = file;
                    if (typeof window.loadAndRenderPDF === 'function') window.loadAndRenderPDF(file);
                }
            } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
                // Excel -> Switch to excel-to-pdf and load
                if (typeof window.switchTab === 'function') window.switchTab('excel-to-pdf');
                if (typeof window.loadExcelToPdf === 'function') window.loadExcelToPdf(file);
            } else if (['doc', 'docx'].includes(ext)) {
                // Word -> Switch to word-to-excel and load
                if (typeof window.switchTab === 'function') window.switchTab('word-to-excel');
                if (typeof window.loadWordToExcel === 'function') window.loadWordToExcel(file);
            } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
                // Image -> Determine target
                const activeTab = document.querySelector('.tab-content.active');
                const tabId = activeTab ? activeTab.id : null;
                if (tabId === 'image-converter' && typeof window.loadImageConverter === 'function') {
                    window.loadImageConverter(file);
                } else if (tabId === 'image-to-word' && typeof window.convertImageToWord === 'function') {
                    window.convertImageToWord(file);
                } else {
                    if (typeof window.switchTab === 'function') window.switchTab('image-to-pdf');
                    if (typeof window.loadImageToPdf === 'function') window.loadImageToPdf(file);
                }
            } else {
                alert('File type not supported for automatic loading: .' + ext.toUpperCase());
            }
        });
    }

    console.log('Antigravity PDF Editor ready.');

} // end initEventListeners

// ── Phase 4: Global goToPage — thumbnail sidebar uses this ───────────────────
window.goToPage = function(pageNum) {
    if (!currentPdfObj) return;
    if (pageNum < 1 || pageNum > totalPages) return;
    currentPageNum = pageNum;
    renderPage(currentPdfObj, currentPageNum);
};

// Listen for thumbnail click events
document.addEventListener('thumbnail:goToPage', (e) => {
    if (e.detail && e.detail.page) window.goToPage(e.detail.page);
});
