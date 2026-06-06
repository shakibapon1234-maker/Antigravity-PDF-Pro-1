// Antigravity PDF - Compress PDF Logic (FIXED: Real image re-compression)
document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btnUploadCompress');
    const compressEmptyState = document.getElementById('compressEmptyState');
    const compressWorkspace = document.getElementById('compressWorkspace');
    const compressFileName = document.getElementById('compressFileName');
    const compressFileSize = document.getElementById('compressFileSize');
    const btnCompressPdf = document.getElementById('btnCompressPdf');

    let currentPdfBytes = null;
    let originalFileName = '';
    let originalSizeBytes = 0;

    // Size display element — inject below the file info
    let sizeResultEl = document.getElementById('compressSizeResult');
    if (!sizeResultEl) {
        sizeResultEl = document.createElement('div');
        sizeResultEl.id = 'compressSizeResult';
        sizeResultEl.style.cssText = 'margin-top:14px; font-size:14px; color:var(--accent-cyan); text-align:center; font-weight:600; display:none;';
        const workspace = document.getElementById('compressWorkspace');
        if (workspace) workspace.appendChild(sizeResultEl);
    }

    async function loadCompressPdf(file) {
        if (file) {
            originalFileName = file.name.replace(/\.pdf$/i, '');
            originalSizeBytes = file.size;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            compressFileName.textContent = file.name;
            compressFileSize.textContent = `${sizeMB} MB`;
            currentPdfBytes = await file.arrayBuffer();
            sizeResultEl.style.display = 'none';
            showCompressWorkspace();
        }
    }

    if (btnUpload) {
        btnUpload.addEventListener('click', () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.pdf';
            inp.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) loadCompressPdf(file);
            };
            inp.click();
        });
    }

    function showCompressWorkspace() {
        compressEmptyState.classList.add('d-none');
        compressWorkspace.classList.remove('d-none');
    }

    // Get compression quality from selected radio button
    function getCompressionQuality() {
        const selected = document.querySelector('input[name="compressLevel"]:checked');
        const val = selected ? parseFloat(selected.value) : 0.1;
        // value 0.1 = Low (best quality), 0.5 = Medium, 0.9 = High (most compressed)
        // Map to JPEG quality: Low → 0.92, Medium → 0.72, High → 0.45
        if (val <= 0.1) return 0.92;
        if (val <= 0.5) return 0.72;
        return 0.45;
    }

    async function compressAndDownload() {
        if (!currentPdfBytes) return;

        btnCompressPdf.disabled = true;
        const originalBtnHtml = btnCompressPdf.innerHTML;
        btnCompressPdf.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Compressing...';
        sizeResultEl.style.display = 'none';

        try {
            const jpegQuality = getCompressionQuality();
            const { PDFDocument } = PDFLib;

            // Load original with pdfjsLib to render each page
            const loadingTask = pdfjsLib.getDocument({ data: currentPdfBytes.slice(0) });
            const pdfJs = await loadingTask.promise;
            const totalPages = pdfJs.numPages;

            // Create new PDF document
            const newPdf = await PDFDocument.create();

            for (let i = 1; i <= totalPages; i++) {
                btnCompressPdf.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Compressing page ${i}/${totalPages}...`;

                const page = await pdfJs.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                // Fill white background to support transparent PDF pages and avoid black background after JPEG conversion
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;

                // Convert canvas to JPEG with selected quality
                const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
                const base64 = dataUrl.split(',')[1];
                const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

                // Embed JPEG into new PDF
                const jpegImage = await newPdf.embedJpg(imgBytes);
                const newPage = newPdf.addPage([viewport.width / 1.5, viewport.height / 1.5]);
                newPage.drawImage(jpegImage, {
                    x: 0,
                    y: 0,
                    width: viewport.width / 1.5,
                    height: viewport.height / 1.5,
                });
            }

            const compressedPdfBytes = await newPdf.save({ useObjectStreams: true });

            // Show before/after size
            const beforeKB = (originalSizeBytes / 1024).toFixed(1);
            const afterKB = (compressedPdfBytes.byteLength / 1024).toFixed(1);
            const reduction = (((originalSizeBytes - compressedPdfBytes.byteLength) / originalSizeBytes) * 100).toFixed(1);
            sizeResultEl.innerHTML = `📦 Before: <b>${beforeKB} KB</b> → After: <b>${afterKB} KB</b> &nbsp;|&nbsp; 🎉 Reduced by <b>${reduction}%</b>`;
            sizeResultEl.style.display = 'block';

            const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
            saveAs(blob, `${originalFileName}_compressed.pdf`);

        } catch (err) {
            console.error('Error compressing PDF:', err);
            alert('Failed to compress PDF: ' + err.message);
        } finally {
            btnCompressPdf.disabled = false;
            btnCompressPdf.innerHTML = originalBtnHtml;
            if (window.lucide) lucide.createIcons();
        }
    }

    if (btnCompressPdf) {
        btnCompressPdf.addEventListener('click', compressAndDownload);
    }

    window.loadCompressPdf = loadCompressPdf;
});
