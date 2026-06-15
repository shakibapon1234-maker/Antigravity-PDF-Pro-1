// Antigravity PDF - Bates Numbering Tool
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('batesInput');
    const dropZone = document.getElementById('batesDropZone');
    const configEl = document.getElementById('batesConfig');
    const statusEl = document.getElementById('conversionStatusBates');
    const progressEl = document.getElementById('convProgressBates');
    const nameDisplay = document.getElementById('fileNameDisplayBates');
    const btnDownload = document.getElementById('btnDownloadBates');
    const btnRunBates = document.getElementById('btnRunBates');

    let currentFile = null;
    let currentFileData = null;

    if (!fileInput) return;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleBatesFile(file);
    };

    if (dropZone) {
        dropZone.onclick = () => fileInput.click();

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
                handleBatesFile(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }

    async function handleBatesFile(file) {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        nameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function() {
            currentFileData = new Uint8Array(this.result);
            configEl.classList.remove('d-none');
            statusEl.classList.add('d-none');
            if (btnDownload) btnDownload.style.display = 'none';
        };
        reader.readAsArrayBuffer(file);
    }

    btnRunBates.onclick = async () => {
        if (!currentFileData || !currentFile) return;

        if (typeof PDFLib === 'undefined') {
            alert('PDF-lib is not loaded. Please refresh the page.');
            return;
        }

        const prefix = document.getElementById('batesPrefix').value || '';
        const startNum = parseInt(document.getElementById('batesStart').value) || 1;
        const padding = parseInt(document.getElementById('batesPadding').value) || 6;
        const position = document.getElementById('batesPosition').value;

        configEl.classList.add('d-none');
        statusEl.classList.remove('d-none');
        progressEl.style.width = '10%';

        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.load(currentFileData);
            progressEl.style.width = '45%';

            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const pages = pdfDoc.getPages();
            const fontSize = 10;
            const margin = 20;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Generate Bates String
                const numStr = String(startNum + i).padStart(padding, '0');
                const batesStr = prefix + numStr;

                // Calculate Text Width
                const textWidth = helveticaFont.widthOfTextAtSize(batesStr, fontSize);

                // Determine X and Y based on position
                let x = margin;
                let y = margin;

                switch (position) {
                    case 'top-left':
                        x = margin;
                        y = height - margin - fontSize;
                        break;
                    case 'top-center':
                        x = (width - textWidth) / 2;
                        y = height - margin - fontSize;
                        break;
                    case 'top-right':
                        x = width - margin - textWidth;
                        y = height - margin - fontSize;
                        break;
                    case 'bottom-left':
                        x = margin;
                        y = margin;
                        break;
                    case 'bottom-center':
                        x = (width - textWidth) / 2;
                        y = margin;
                        break;
                    case 'bottom-right':
                    default:
                        x = width - margin - textWidth;
                        y = margin;
                        break;
                }

                // Draw Text
                page.drawText(batesStr, {
                    x,
                    y,
                    size: fontSize,
                    font: helveticaFont,
                    color: rgb(0.2, 0.2, 0.2)
                });
            }

            progressEl.style.width = '80%';
            const pdfBytes = await pdfDoc.save();
            progressEl.style.width = '95%';

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            progressEl.style.width = '100%';

            const baseName = currentFile.name.replace(/\.pdf$/i, '');
            const outputName = baseName + '_numbered.pdf';
            saveAs(blob, outputName);

            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, outputName);
            }

        } catch (err) {
            console.error('Bates Numbering error:', err);
            statusEl.classList.add('d-none');
            configEl.classList.remove('d-none');
            alert('Failed to add Bates Numbering: ' + err.message);
        }
    };
});
