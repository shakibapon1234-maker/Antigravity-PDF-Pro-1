// Antigravity PDF - Page Numbers Logic
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('pageNumbersFileInput');
    const uploadBtn = document.getElementById('btnUploadPageNumbers');
    const applyBtn = document.getElementById('btnApplyPageNumbers');
    const workspace = document.getElementById('pageNumbersWorkspace');
    const emptyState = document.getElementById('pageNumbersEmptyState');
    const previewContainer = document.getElementById('pageNumbersPreview');
    
    // Controls
    const pnFormat = document.getElementById('pnFormat');
    const pnSize = document.getElementById('pnSize');
    const pnColor = document.getElementById('pnColor');
    const posButtons = document.querySelectorAll('.pn-controls .pos-grid .btn');

    let currentFile = null;
    let currentFileData = null;
    let selectedPos = 'BL'; // Default Bottom Left

    if (!fileInput) return;

    window.loadPageNumbersPdf = function(file) {
        if (!file) return;
        handlePageNumbersFile(file);
    };

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) handlePageNumbersFile(file);
    });

    function handlePageNumbersFile(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        const reader = new FileReader();
        reader.onload = function() {
            currentFileData = new Uint8Array(this.result);
            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');
            workspace.style.display = 'flex';
            renderPreview();
        };
        reader.readAsArrayBuffer(file);
    }

    posButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            posButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPos = btn.dataset.pos;
            renderPreview();
        });
    });

    [pnFormat, pnSize, pnColor].forEach(el => {
        el.addEventListener('input', renderPreview);
    });

    async function renderPreview() {
        if (!currentFileData) return;

        try {
            const loadingTask = pdfjsLib.getDocument({ data: currentFileData });
            const pdf = await loadingTask.promise;
            const total = pdf.numPages;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.8 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            // Draw Page Number Preview on Canvas
            context.fillStyle = pnColor.value;
            context.font = `${pnSize.value * 0.8}px Outfit`;
            
            const text = pnFormat.value.replace('{n}', '1').replace('{total}', total);
            const textWidth = context.measureText(text).width;
            const margin = 15;

            let x, y;
            if (selectedPos === 'TL') { x = margin; y = margin + pnSize.value * 0.8; }
            else if (selectedPos === 'TC') { x = canvas.width / 2 - textWidth / 2; y = margin + pnSize.value * 0.8; }
            else if (selectedPos === 'TR') { x = canvas.width - textWidth - margin; y = margin + pnSize.value * 0.8; }
            else if (selectedPos === 'BL') { x = margin; y = canvas.height - margin; }
            else if (selectedPos === 'BC') { x = canvas.width / 2 - textWidth / 2; y = canvas.height - margin; }
            else if (selectedPos === 'BR') { x = canvas.width - textWidth - margin; y = canvas.height - margin; }

            context.fillText(text, x, y);

            previewContainer.innerHTML = '';
            previewContainer.appendChild(canvas);
        } catch (err) {
            console.error('Preview error:', err);
        }
    }

    applyBtn.addEventListener('click', async () => {
        if (!currentFileData) return;

        applyBtn.disabled = true;
        applyBtn.textContent = 'Processing...';

        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.load(currentFileData);
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const pages = pdfDoc.getPages();
            const total = pages.length;

            for (let i = 0; i < total; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                const text = pnFormat.value.replace('{n}', (i + 1).toString()).replace('{total}', total.toString());
                const size = parseInt(pnSize.value);
                const textWidth = helveticaFont.widthOfTextAtSize(text, size);
                const margin = 25;

                let x, y;
                if (selectedPos === 'TL') { x = margin; y = height - margin - size; }
                else if (selectedPos === 'TC') { x = width / 2 - textWidth / 2; y = height - margin - size; }
                else if (selectedPos === 'TR') { x = width - textWidth - margin; y = height - margin - size; }
                else if (selectedPos === 'BL') { x = margin; y = margin; }
                else if (selectedPos === 'BC') { x = width / 2 - textWidth / 2; y = margin; }
                else if (selectedPos === 'BR') { x = width - textWidth - margin; y = margin; }

                page.drawText(text, {
                    x: x,
                    y: y,
                    size: size,
                    font: helveticaFont,
                    color: hexToRgbLib(pnColor.value, rgb),
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            saveAs(blob, currentFile.name.replace('.pdf', '_numbered.pdf'));

        } catch (err) {
            console.error(err);
            alert('Error adding page numbers: ' + err.message);
        } finally {
            applyBtn.disabled = false;
            applyBtn.textContent = 'Add Numbers & Download';
        }
    });

    function hexToRgbLib(hex, rgbFunc) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return rgbFunc(r, g, b);
    }
});
