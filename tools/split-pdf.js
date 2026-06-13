document.addEventListener('DOMContentLoaded', () => {
    const { PDFDocument } = window.PDFLib;
    
    let splitPdfFile = null;
    let splitPdfDoc = null;       // pdf-lib doc (for download/save)
    let splitPdfJsDoc = null;     // pdf.js doc (for thumbnail rendering)
    let splitArrayBuffer = null;  // raw bytes – kept for re-use
    let splitTotalPages = 0;
    let selectedPageNumbers = new Set();

    const btnUploadSplit = document.getElementById('btnUploadSplit');
    if (btnUploadSplit) {
        btnUploadSplit.onclick = () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.pdf';
            inp.style.display = 'none';
            document.body.appendChild(inp);
            inp.onchange = (e) => {
                const file = e.target.files[0];
                if (file) loadSplitPdf(file);
                document.body.removeChild(inp);
                inp.value = '';
            };
            inp.click();
        };
    }

    // Expose globally so the file-drop modal in index.html can call it
    window.loadSplitPdf = loadSplitPdf;

    async function loadSplitPdf(file) {
        try {
            splitPdfFile = file;

            // Read once → keep the raw bytes so we can reload without re-reading
            splitArrayBuffer = await file.arrayBuffer();

            // pdf-lib: used for page extraction / download
            splitPdfDoc = await PDFDocument.load(splitArrayBuffer.slice(), { ignoreEncryption: true });
            splitTotalPages = splitPdfDoc.getPageCount();

            // pdf.js: used for thumbnail rendering in the sidebar
            if (window.pdfjsLib) {
                try {
                    const loadingTask = pdfjsLib.getDocument({ data: splitArrayBuffer.slice() });
                    splitPdfJsDoc = await loadingTask.promise;
                    if (typeof ThumbnailSidebar !== 'undefined') {
                        ThumbnailSidebar.loadDocument(splitPdfJsDoc);
                    }
                } catch (thumbErr) {
                    console.warn('[split] Thumbnail sidebar skipped:', thumbErr);
                }
            }

            document.getElementById('splitEmptyState').classList.add('d-none');
            document.getElementById('splitWorkspace').classList.remove('d-none');

            // Reset selection on new file
            selectedPageNumbers.clear();
            renderSplitPreview();
        } catch (err) {
            alert('Failed to load PDF: ' + err.message);
        }
    }

    function renderSplitPreview() {
        const previewContainer = document.getElementById('splitPreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        for (let i = 1; i <= splitTotalPages; i++) {
            const isSelected = selectedPageNumbers.has(i);

            const item = document.createElement('div');
            item.className = 'split-page-item' + (isSelected ? ' selected' : '');
            item.dataset.page = i;

            // Canvas thumbnail placeholder
            const canvasWrap = document.createElement('div');
            canvasWrap.className = 'split-thumb-wrap';

            const canvas = document.createElement('canvas');
            canvas.className = 'split-thumb-canvas';
            canvas.id = `split-thumb-${i}`;
            canvasWrap.appendChild(canvas);

            // Spinner overlay (shown while rendering)
            const spinner = document.createElement('div');
            spinner.className = 'split-thumb-spinner';
            spinner.id = `split-spinner-${i}`;
            canvasWrap.appendChild(spinner);

            item.appendChild(canvasWrap);

            const pageNumDiv = document.createElement('div');
            pageNumDiv.className = 'page-number';
            pageNumDiv.textContent = i;
            item.appendChild(pageNumDiv);

            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'page-checkbox';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = isSelected;
            cb.addEventListener('change', () => togglePageSelection(i));
            checkboxDiv.appendChild(cb);
            item.appendChild(checkboxDiv);

            // Click on the card (not just checkbox) toggles selection
            item.addEventListener('click', (e) => {
                if (e.target !== cb) {
                    cb.checked = !cb.checked;
                    togglePageSelection(i);
                }
            });

            previewContainer.appendChild(item);
        }

        updateSelectedPagesDisplay();

        // Render thumbnails asynchronously
        if (splitPdfJsDoc) {
            renderAllSplitThumbnails();
        }
    }

    async function renderAllSplitThumbnails() {
        if (!splitPdfJsDoc) return;
        const SCALE = 0.22;

        for (let i = 1; i <= splitTotalPages; i++) {
            try {
                const page = await splitPdfJsDoc.getPage(i);
                const viewport = page.getViewport({ scale: SCALE });

                const canvas = document.getElementById(`split-thumb-${i}`);
                const spinner = document.getElementById(`split-spinner-${i}`);
                if (!canvas) continue;

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                if (spinner) spinner.style.display = 'none';
            } catch (e) {
                console.warn(`[split] thumb error page ${i}:`, e);
            }
        }
    }

    function togglePageSelection(pageNum) {
        if (selectedPageNumbers.has(pageNum)) {
            selectedPageNumbers.delete(pageNum);
        } else {
            selectedPageNumbers.add(pageNum);
        }
        // Update just the visual state of the clicked card without full re-render
        const item = document.querySelector(`.split-page-item[data-page="${pageNum}"]`);
        if (item) {
            const isNowSelected = selectedPageNumbers.has(pageNum);
            item.classList.toggle('selected', isNowSelected);
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = isNowSelected;
        }
        updateSelectedPagesDisplay();
    }
    window.togglePageSelection = togglePageSelection;

    function updateSelectedPagesDisplay() {
        const display = document.getElementById('selectedPagesDisplay');
        if (!display) return;
        
        const count = selectedPageNumbers.size;
        
        if (count === 0) {
            display.querySelector('span').textContent = 'Selected: None';
        } else {
            const sortedPages = Array.from(selectedPageNumbers).sort((a, b) => a - b);
            const pageText = formatPageRange(sortedPages);
            display.querySelector('span').textContent = `Selected: ${count} page(s) (${pageText})`;
        }
    }

    function formatPageRange(pages) {
        if (pages.length === 0) return '';
        if (pages.length === 1) return pages[0].toString();
        
        let ranges = [];
        let start = pages[0];
        let end = pages[0];
        
        for (let i = 1; i < pages.length; i++) {
            if (pages[i] === end + 1) {
                end = pages[i];
            } else {
                ranges.push(start === end ? start.toString() : `${start}-${end}`);
                start = pages[i];
                end = pages[i];
            }
        }
        ranges.push(start === end ? start.toString() : `${start}-${end}`);
        
        return ranges.join(', ');
    }

    const pageRangeInput = document.getElementById('pageRangeInput');
    if (pageRangeInput) {
        pageRangeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btnSelectRange').click();
            }
        });
        
        pageRangeInput.addEventListener('change', () => {
            const input = pageRangeInput.value.trim();
            if (!input) return;
            
            const pages = parsePageRange(input);
            if (pages.length > 0) {
                pages.forEach(p => {
                    if (p >= 1 && p <= splitTotalPages) {
                        selectedPageNumbers.add(p);
                    }
                });
                renderSplitPreview();
            }
        });
    }

    const btnSelectRange = document.getElementById('btnSelectRange');
    if (btnSelectRange) {
        btnSelectRange.onclick = () => {
            const input = document.getElementById('pageRangeInput').value.trim();
            if (!input) return;
            
            const pages = parsePageRange(input);
            if (pages.length === 0) {
                alert('Invalid page range. Use format: 1-3, 5, 7-10');
                return;
            }
            
            pages.forEach(p => {
                if (p >= 1 && p <= splitTotalPages) {
                    selectedPageNumbers.add(p);
                }
            });
            
            renderSplitPreview();
            document.getElementById('pageRangeInput').value = '';
        };
    }

    function parsePageRange(input) {
        const sanitized = input.replace(/[^0-9\-,\s]/g, '');
        const pages = new Set();
        const parts = sanitized.split(',');
        
        parts.forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        pages.add(i);
                    }
                }
            } else {
                const p = parseInt(part);
                if (!isNaN(p)) {
                    pages.add(p);
                }
            }
        });
        
        return Array.from(pages);
    }

    const btnSelectAllSplit = document.getElementById('btnSelectAllSplit');
    if (btnSelectAllSplit) {
        btnSelectAllSplit.onclick = () => {
            for (let i = 1; i <= splitTotalPages; i++) {
                selectedPageNumbers.add(i);
            }
            renderSplitPreview();
        };
    }

    const btnClearSelectionSplit = document.getElementById('btnClearSelectionSplit');
    if (btnClearSelectionSplit) {
        btnClearSelectionSplit.onclick = () => {
            selectedPageNumbers.clear();
            renderSplitPreview();
        };
    }

    const btnDownloadSplit = document.getElementById('btnDownloadSplit');
    if (btnDownloadSplit) {
        btnDownloadSplit.onclick = async () => {
            // Apply any typed page range first
            if (pageRangeInput && pageRangeInput.value.trim()) {
                const input = pageRangeInput.value.trim();
                const pages = parsePageRange(input);
                if (pages.length === 0) {
                    alert('Invalid page range. Use format: 1-3, 5, 7-10');
                    return;
                }
                pages.forEach(p => {
                    if (p >= 1 && p <= splitTotalPages) {
                        selectedPageNumbers.add(p);
                    }
                });
            }

            if (selectedPageNumbers.size === 0) {
                alert('Please select at least one page.');
                return;
            }

            if (!splitArrayBuffer) {
                alert('No PDF file loaded.');
                return;
            }

            // Update button UI
            const origHtml = btnDownloadSplit.innerHTML;
            btnDownloadSplit.disabled = true;
            btnDownloadSplit.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Processing...';
            if (window.lucide) lucide.createIcons();

            try {
                const splitModeNode = document.querySelector('input[name="splitMode"]:checked');
                const splitMode = splitModeNode ? splitModeNode.value : 'extract';

                // Build the list of page indices to work with (0-based)
                const allIndices = Array.from({ length: splitTotalPages }, (_, i) => i);
                const selectedSet = new Set(Array.from(selectedPageNumbers).map(n => n - 1));

                let targetIndices; // 0-based page indices for the output PDF
                if (splitMode === 'extract') {
                    targetIndices = Array.from(selectedSet).sort((a, b) => a - b);
                } else {
                    // remove mode: keep everything EXCEPT selected
                    targetIndices = allIndices.filter(i => !selectedSet.has(i));
                    if (targetIndices.length === 0) {
                        alert('Cannot remove all pages — at least one page must remain.');
                        btnDownloadSplit.disabled = false;
                        btnDownloadSplit.innerHTML = origHtml;
                        if (window.lucide) lucide.createIcons();
                        return;
                    }
                }

                // ── Stage 1: Try pdf-lib copyPages (fast, keeps text searchable) ──
                let pdfBytes = null;
                try {
                    const freshDoc = await PDFDocument.load(splitArrayBuffer.slice(), { ignoreEncryption: true });
                    const newPdf = await PDFDocument.create();
                    const copiedPages = await newPdf.copyPages(freshDoc, targetIndices);
                    copiedPages.forEach(page => newPdf.addPage(page));
                    const candidate = await newPdf.save();

                    // Heuristic: if output is suspiciously small relative to input
                    // (< 5 % of original per page on average), assume blank pages
                    const avgBytesPerPage = candidate.byteLength / targetIndices.length;
                    const BLANK_THRESHOLD = 1500; // bytes – a truly blank page is ~800 B
                    if (avgBytesPerPage > BLANK_THRESHOLD) {
                        pdfBytes = candidate; // looks good
                    } else {
                        console.warn('[split] copyPages produced suspiciously small output, switching to canvas render');
                    }
                } catch (copyErr) {
                    console.warn('[split] copyPages failed, switching to canvas render:', copyErr);
                }

                // ── Stage 2: Canvas fallback — guaranteed content (uses pdf.js) ──
                if (!pdfBytes) {
                    // Make sure we have a pdf.js doc
                    if (!splitPdfJsDoc) {
                        const loadingTask = pdfjsLib.getDocument({ data: splitArrayBuffer.slice() });
                        splitPdfJsDoc = await loadingTask.promise;
                    }

                    const RENDER_SCALE = 2.0; // 2× for crisp output
                    const newPdf = await PDFDocument.create();

                    for (let idx = 0; idx < targetIndices.length; idx++) {
                        const pageNum = targetIndices[idx] + 1; // 1-based for pdf.js
                        btnDownloadSplit.innerHTML =
                            `<i data-lucide="loader-2" class="spin"></i> Rendering ${idx + 1}/${targetIndices.length}...`;
                        if (window.lucide) lucide.createIcons();

                        const pdfJsPage = await splitPdfJsDoc.getPage(pageNum);
                        const viewport = pdfJsPage.getViewport({ scale: RENDER_SCALE });

                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext('2d');

                        // White background (prevents black bg on JPEG conversion)
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        await pdfJsPage.render({ canvasContext: ctx, viewport }).promise;

                        // High-quality JPEG
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                        const base64 = dataUrl.split(',')[1];
                        const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                        const jpegImg = await newPdf.embedJpg(imgBytes);

                        // Use original page dimensions (un-scaled)
                        const nativeW = viewport.width / RENDER_SCALE;
                        const nativeH = viewport.height / RENDER_SCALE;
                        const newPage = newPdf.addPage([nativeW, nativeH]);
                        newPage.drawImage(jpegImg, { x: 0, y: 0, width: nativeW, height: nativeH });
                    }

                    pdfBytes = await newPdf.save();
                }

                // ── Download ──────────────────────────────────────────────────
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const baseName = splitPdfFile.name.replace(/\.pdf$/i, '');
                window.saveAs(blob, `${baseName}_split.pdf`);
                if (window.AGProgress) AGProgress.done();
                if (window.AGToast) AGToast.success('✓ Split সম্পন্ন! ফাইল ডাউনলোড হয়েছে।');

            } catch (err) {
                console.error(err);
                if (window.AGProgress) AGProgress.error();
                if (window.AGToast) AGToast.error('Split ব্যর্থ: ' + err.message);
                else alert('Failed to split PDF: ' + err.message);
            } finally {
                btnDownloadSplit.disabled = false;
                btnDownloadSplit.innerHTML = origHtml;
                if (window.lucide) lucide.createIcons();
            }
        };
    }
});
