// ════════════════════════════════════════════════════
// Antigravity PDF Pro — OCR: PDF to Text
// Scanned PDF → Tesseract OCR → Extract Bengali/English text
// ════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // ─── DOM References ────────────────────────────────────────
    const btnUpload       = document.getElementById('btnUploadOcrPdf');
    const fileInput       = document.getElementById('ocrPdfFileInput');
    const emptyState      = document.getElementById('ocrEmptyState');
    const workspace       = document.getElementById('ocrWorkspace');

    const langSelect      = document.getElementById('ocrLangSelect');
    const scaleSelect     = document.getElementById('ocrScaleSelect');
    const btnConvert      = document.getElementById('btnStartOcr');

    const progressSection = document.getElementById('ocrProgressSection');
    const progressBar     = document.getElementById('ocrProgressBar');
    const progressText    = document.getElementById('ocrProgressText');
    const pageStatus      = document.getElementById('ocrPageStatus');

    const resultSection   = document.getElementById('ocrResultSection');
    const outputText      = document.getElementById('ocrOutputText');
    const wordCount       = document.getElementById('ocrWordCount');
    const charCount       = document.getElementById('ocrCharCount');
    const pageCountResult = document.getElementById('ocrPageCountResult');
    const btnCopy         = document.getElementById('btnCopyOcrText');
    const btnDownloadTxt  = document.getElementById('btnDownloadOcrTxt');
    const btnDownloadDocx = document.getElementById('btnDownloadOcrDocx');
    const btnReset        = document.getElementById('btnResetOcr');

    // ─── State ────────────────────────────────────────────────
    let currentPdfDoc = null;
    let pdfFileName   = 'document';
    let extractedText = '';
    let isProcessing  = false;

    // Initialize PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // ─── Upload Handling ───────────────────────────────────────
    if (btnUpload) {
        btnUpload.addEventListener('click', () => fileInput && fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileChange);
    }

    // Drag & Drop on empty state
    if (emptyState) {
        emptyState.addEventListener('dragover', e => {
            e.preventDefault();
            emptyState.classList.add('drag-over');
        });
        emptyState.addEventListener('dragleave', () => {
            emptyState.classList.remove('drag-over');
        });
        emptyState.addEventListener('drop', e => {
            e.preventDefault();
            emptyState.classList.remove('drag-over');
            const f = e.dataTransfer.files[0];
            const fileType = f.type || (f.name && f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null);
            if (f && (f.type === 'application/pdf' || fileType)) loadFile(f);
            else alert('Please drop a PDF file.');
        });
        emptyState.addEventListener('click', () => fileInput && fileInput.click());
    }

    async function handleFileChange(e) {
        const f = e.target.files[0];
        if (!f) return;
        await loadFile(f);
    }

    async function loadFile(f) {
        // Handle files from archive that may not have type set
        const fileType = f.type || (f.name && f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null);
        if (!f || (f.type && f.type !== 'application/pdf') && !fileType) {
            alert('Please select a valid PDF file.');
            return;
        }
        pdfFileName = f.name.replace(/\.[^/.]+$/, '');

        // Reset state
        extractedText = '';
        hideResults();
        hideProgress();

        try {
            const ab = await f.arrayBuffer();
            currentPdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;

            // Show workspace
            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');

            // Update file info
            const fileInfo = document.getElementById('ocrFileInfo');
            if (fileInfo) {
                const sizeText = f.size ? ` · ${(f.size/1024).toFixed(1)} KB` : '';
                fileInfo.innerHTML =
                    `<i data-lucide="file-scan" style="width:20px;height:20px;color:var(--accent-cyan);vertical-align:middle;margin-right:8px;"></i>` +
                    `<strong style="color:#fff;">${f.name}</strong>` +
                    `<span style="color:var(--text-dim);margin-left:10px;">${currentPdfDoc.numPages} pages${sizeText}</span>`;
                if (window.lucide) lucide.createIcons();
            }

        } catch (err) {
            console.error('OCR PDF load error:', err);
            alert('Failed to load PDF: ' + err.message);
        }
    }

    // ─── Start OCR ────────────────────────────────────────────
    if (btnConvert) {
        btnConvert.addEventListener('click', startOcr);
    }

    async function startOcr() {
        if (!currentPdfDoc) {
            alert('Please upload a PDF file first.');
            return;
        }
        if (isProcessing) return;
        if (typeof Tesseract === 'undefined') {
            alert('Tesseract OCR library not loaded. Please refresh the page.');
            return;
        }

        isProcessing = true;
        btnConvert.disabled = true;
        btnConvert.innerHTML = `<i data-lucide="loader-2" style="animation:spin 1s linear infinite;display:inline-block;"></i> Processing...`;

        const lang     = langSelect  ? langSelect.value  : 'eng+ben';
        const scale    = scaleSelect ? parseFloat(scaleSelect.value) : 2.0;
        const numPages = currentPdfDoc.numPages;

        hideResults();
        showProgress();

        const allText = [];

        try {
            for (let i = 1; i <= numPages; i++) {

                // Update page status
                if (pageStatus) pageStatus.textContent = `Page ${i} of ${numPages}`;
                setProgressBar(((i - 1) / numPages) * 100);

                // Render page to canvas
                const page     = await currentPdfDoc.getPage(i);
                const viewport = page.getViewport({ scale });
                const canvas   = document.createElement('canvas');
                const ctx      = canvas.getContext('2d');
                canvas.width   = viewport.width;
                canvas.height  = viewport.height;
                
                // Fill white background to support transparent PDF pages and optimize for OCR
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                await page.render({ canvasContext: ctx, viewport }).promise;

                // Run Tesseract on canvas
                const result = await Tesseract.recognize(canvas, lang, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const base = ((i - 1) / numPages) * 100;
                            const inc  = (m.progress / numPages) * 100;
                            setProgressBar(base + inc);
                            if (progressText) {
                                progressText.textContent =
                                    `Page ${i}/${numPages} — ${Math.round(m.progress * 100)}% recognized`;
                            }
                        }
                    }
                });

                const pageText = result.data.text.trim();
                if (pageText) allText.push(`─── Page ${i} ───\n${pageText}`);

                // Partial update
                extractedText = allText.join('\n\n');
                if (outputText) outputText.value = extractedText;
            }

            setProgressBar(100);
            if (progressText) progressText.textContent = 'OCR Complete!';

            // Show results
            extractedText = allText.join('\n\n');
            showResults(numPages);

        } catch (err) {
            console.error('OCR error:', err);
            alert('OCR failed: ' + err.message);
            hideProgress();
        } finally {
            isProcessing = false;
            btnConvert.disabled = false;
            btnConvert.innerHTML = `<i data-lucide="scan-text"></i> Start OCR`;
            if (window.lucide) lucide.createIcons();
        }
    }

    // ─── Progress helpers ──────────────────────────────────────
    function showProgress() {
        if (progressSection) progressSection.classList.remove('d-none');
    }
    function hideProgress() {
        if (progressSection) progressSection.classList.add('d-none');
    }
    function setProgressBar(pct) {
        if (progressBar) progressBar.style.width = Math.min(100, pct) + '%';
    }

    // ─── Result helpers ────────────────────────────────────────
    function showResults(numPages) {
        if (!resultSection) return;
        resultSection.classList.remove('d-none');

        if (outputText) outputText.value = extractedText;

        const words = extractedText.trim().split(/\s+/).filter(Boolean).length;
        const chars = extractedText.length;

        if (wordCount)       wordCount.textContent       = words.toLocaleString();
        if (charCount)       charCount.textContent       = chars.toLocaleString();
        if (pageCountResult) pageCountResult.textContent = numPages;
    }

    function hideResults() {
        if (resultSection) resultSection.classList.add('d-none');
    }

    // ─── Copy to clipboard ─────────────────────────────────────
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            if (!extractedText) return;
            navigator.clipboard.writeText(extractedText).then(() => {
                const orig = btnCopy.innerHTML;
                btnCopy.innerHTML = `<i data-lucide="check"></i> Copied!`;
                btnCopy.style.background = 'rgba(0,255,136,0.2)';
                if (window.lucide) lucide.createIcons();
                setTimeout(() => {
                    btnCopy.innerHTML = orig;
                    btnCopy.style.background = '';
                    if (window.lucide) lucide.createIcons();
                }, 2000);
            }).catch(() => {
                // fallback
                outputText && outputText.select();
                document.execCommand('copy');
            });
        });
    }

    // ─── Download as .txt ──────────────────────────────────────
    if (btnDownloadTxt) {
        btnDownloadTxt.addEventListener('click', () => {
            if (!extractedText) return;
            const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, pdfFileName + '_ocr.txt');
        });
    }

    // ─── Download as .docx ─────────────────────────────────────
    if (btnDownloadDocx) {
        btnDownloadDocx.addEventListener('click', async () => {
            if (!extractedText || typeof docx === 'undefined') {
                alert('DOCX library not loaded. Try .txt download.');
                return;
            }

            const lines    = extractedText.split('\n');
            const children = lines.map(line => {
                const isHeader = line.startsWith('─── Page');
                return new docx.Paragraph({
                    children: [new docx.TextRun({
                        text: line,
                        size: isHeader ? 28 : 24,
                        bold: isHeader,
                        color: isHeader ? '00D4FF' : '000000'
                    })],
                    spacing: { after: isHeader ? 200 : 100 }
                });
            });

            const doc  = new docx.Document({ sections: [{ children }] });
            const blob = await docx.Packer.toBlob(doc);
            saveAs(blob, pdfFileName + '_ocr.docx');
        });
    }

    // ─── Reset ────────────────────────────────────────────────
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            currentPdfDoc = null;
            pdfFileName   = 'document';
            extractedText = '';
            if (fileInput) fileInput.value = '';
            hideResults();
            hideProgress();
            workspace.classList.add('d-none');
            emptyState.classList.remove('d-none');
            if (outputText) outputText.value = '';
        });
    }

    // ─── Expose global for archive pull ──────────────────────
    window.loadOcrPdf = loadFile;

});
