// Antigravity PDF - PDF to PowerPoint Converter
document.addEventListener('DOMContentLoaded', () => {

    async function convertToPptx(file) {
        const statusEl    = document.getElementById('conversionStatusPptx');
        const progressEl  = document.getElementById('convProgressPptx');
        const nameDisplay = document.getElementById('fileNameDisplayPptx');
        const btnDownload = document.getElementById('btnDownloadPptx');

        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a PDF file.');
            return;
        }

        if (typeof PptxGenJS === 'undefined') {
            alert('PowerPoint library not loaded. Please refresh the page.');
            return;
        }

        nameDisplay.textContent = file.name;
        statusEl.classList.remove('d-none');
        progressEl.style.width = '10%';
        if (btnDownload) btnDownload.style.display = 'none';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            if (pdf.numPages === 0) {
                alert('This PDF has no pages.');
                statusEl.classList.add('d-none');
                return;
            }

            // Instantiate PptxGenJS
            const pptx = new PptxGenJS();

            // Define layout based on first page to match aspect ratio
            const firstPage = await pdf.getPage(1);
            const firstViewport = firstPage.getViewport({ scale: 1.0 });
            const slideWidth = firstViewport.width / 72;
            const slideHeight = firstViewport.height / 72;

            pptx.defineLayout({ name: 'pdf-page-size', width: slideWidth, height: slideHeight });
            pptx.layout = 'pdf-page-size';

            for (let pageIdx = 1; pageIdx <= pdf.numPages; pageIdx++) {
                progressEl.style.width = `${10 + ((pageIdx - 1) / pdf.numPages) * 70}%`;

                const page = await pdf.getPage(pageIdx);
                
                // Render page as image (scale 2.0 for high resolution)
                const scale = 2.0;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Fill white background to support transparency
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;
                const imgData = canvas.toDataURL('image/png');

                // Calculate fitting size on the slide (in case this page size is different from the first page)
                const pageWidth = viewport.width / scale / 72;
                const pageHeight = viewport.height / scale / 72;
                const pageRatio = pageWidth / pageHeight;
                const slideRatio = slideWidth / slideHeight;

                let w = slideWidth;
                let h = slideHeight;
                let x = 0;
                let y = 0;

                if (Math.abs(pageRatio - slideRatio) > 0.01) {
                    if (pageRatio > slideRatio) {
                        w = slideWidth;
                        h = slideWidth / pageRatio;
                        y = (slideHeight - h) / 2;
                    } else {
                        h = slideHeight;
                        w = slideHeight * pageRatio;
                        x = (slideWidth - w) / 2;
                    }
                }

                // Add slide and insert image
                const slide = pptx.addSlide();
                slide.addImage({
                    data: imgData,
                    x,
                    y,
                    w,
                    h
                });
            }

            progressEl.style.width = '90%';

            // Save PPTX
            const baseName = file.name.replace(/\.pdf$/i, '');
            
            progressEl.style.width = '95%';
            
            // Save using pptxgenjs write method to get a blob or download
            await pptx.writeFile({ fileName: baseName + '.pptx' });
            
            progressEl.style.width = '100%';

            // Show download button
            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = async () => {
                    await pptx.writeFile({ fileName: baseName + '.pptx' });
                };
            }

        } catch (err) {
            console.error('PDF to PPTX conversion error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to convert PDF: ' + err.message);
        }
    }

    // Expose globally
    window.convertToPptx = convertToPptx;

    // Set up event listeners
    const pptxInput = document.getElementById('pdfPptxInput');
    if (pptxInput) {
        pptxInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) convertToPptx(file);
        };
    }

    const dropZone = document.getElementById('pdfPptxDropZone');
    if (dropZone) {
        dropZone.onclick = () => document.getElementById('pdfPptxInput').click();

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary)';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.name.toLowerCase().endsWith('.pdf')) {
                convertToPptx(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }
});
