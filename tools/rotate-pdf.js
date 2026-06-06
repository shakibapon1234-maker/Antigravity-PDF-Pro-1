document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btnUploadRotate');
    const rotateEmptyState = document.getElementById('rotateEmptyState');
    const rotateWorkspace = document.getElementById('rotateWorkspace');
    const rotatePreview = document.getElementById('rotatePreview');
    const btnRotatePdf = document.getElementById('btnRotatePdf');
    const pageRangeInput = document.getElementById('rotatePageRangeInput');
    
    let currentPdfBytes = null;
    let originalFileName = '';

    async function loadRotatePdf(file) {
        if (file) {
            originalFileName = file.name.replace('.pdf', '');
            currentPdfBytes = new Uint8Array(await file.arrayBuffer());
            showRotateWorkspace();
            renderRotatePreview();
        }
    }

    window.loadRotatePdf = loadRotatePdf;

    if (btnUpload) {
        btnUpload.addEventListener('click', () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.pdf';
            inp.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    originalFileName = file.name.replace('.pdf', '');
                    currentPdfBytes = new Uint8Array(await file.arrayBuffer());
                    showRotateWorkspace();
                    renderRotatePreview();
                }
            };
            inp.click();
        });
    }

    function showRotateWorkspace() {
        rotateEmptyState.classList.add('d-none');
        rotateWorkspace.classList.remove('d-none');
    }

    async function renderRotatePreview() {
        if (!currentPdfBytes) return;
        rotatePreview.innerHTML = '';
        try {
            const loadingTask = pdfjsLib.getDocument({ data: currentPdfBytes.slice() });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Fill white background to support transparent PDF pages and avoid black-on-black invisibility in preview
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            await page.render({ canvasContext: context, viewport }).promise;
            rotatePreview.appendChild(canvas);
        } catch (err) {
            console.error('Error rendering preview:', err);
        }
    }

    btnRotatePdf.addEventListener('click', async () => {
        if (!currentPdfBytes) return;

        btnRotatePdf.disabled = true;
        btnRotatePdf.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processing...';

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes.slice());
            const pages = pdfDoc.getPages();
            
            const angleVal = parseInt(document.querySelector('input[name="rotateAngle"]:checked').value);
            const direction = document.querySelector('input[name="rotateDirection"]:checked').value;
            const finalAngle = direction === 'clockwise' ? angleVal : -angleVal;
            
            const rawRangeStr = pageRangeInput.value.trim();
            const rangeStr = rawRangeStr.replace(/[^0-9\-,\s]/g, '');
            let pagesToRotate = [];
            
            if (!rangeStr) {
                // All pages
                pagesToRotate = pages.map((_, i) => i);
            } else {
                // Parse range: e.g. 1-3, 5, 7-10
                const parts = rangeStr.split(',');
                parts.forEach(part => {
                    if (part.includes('-')) {
                        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                        for (let i = start; i <= end; i++) {
                            if (i > 0 && i <= pages.length) pagesToRotate.push(i - 1);
                        }
                    } else {
                        const pageNum = parseInt(part.trim());
                        if (pageNum > 0 && pageNum <= pages.length) pagesToRotate.push(pageNum - 1);
                    }
                });
            }
            
            // Remove duplicates and sort
            pagesToRotate = [...new Set(pagesToRotate)].sort((a, b) => a - b);
            
            pagesToRotate.forEach(index => {
                const page = pages[index];
                const currentRotation = page.getRotation().angle;
                page.setRotation(PDFLib.degrees(currentRotation + finalAngle));
            });

            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            saveAs(blob, `${originalFileName}_rotated.pdf`);
            
        } catch (err) {
            console.error('Error rotating PDF:', err);
            alert('Failed to rotate PDF. Please check the file.');
        } finally {
            btnRotatePdf.disabled = false;
            btnRotatePdf.innerHTML = '<i data-lucide="rotate-cw"></i> Rotate & Download';
            if (window.lucide) lucide.createIcons();
        }
    });
});
