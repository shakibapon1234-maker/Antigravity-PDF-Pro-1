// Antigravity PDF - Flatten PDF Tool
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('flattenInput');
    const dropZone = document.getElementById('flattenDropZone');
    const statusEl = document.getElementById('conversionStatusFlatten');
    const progressEl = document.getElementById('convProgressFlatten');
    const nameDisplay = document.getElementById('fileNameDisplayFlatten');
    const btnDownload = document.getElementById('btnDownloadFlatten');

    if (!fileInput) return;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) flattenPdfFile(file);
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
                flattenPdfFile(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }

    async function flattenPdfFile(file) {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a valid PDF file.');
            return;
        }

        if (typeof PDFLib === 'undefined') {
            alert('PDF-lib is not loaded. Please refresh the page.');
            return;
        }

        nameDisplay.textContent = file.name;
        statusEl.classList.remove('d-none');
        progressEl.style.width = '20%';
        if (btnDownload) btnDownload.style.display = 'none';

        try {
            const arrayBuffer = await file.arrayBuffer();
            progressEl.style.width = '40%';

            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            progressEl.style.width = '60%';

            // Flatten form fields
            const form = pdfDoc.getForm();
            form.flatten();
            progressEl.style.width = '80%';

            const pdfBytes = await pdfDoc.save();
            progressEl.style.width = '95%';

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            progressEl.style.width = '100%';

            const baseName = file.name.replace(/\.pdf$/i, '');
            const outputName = baseName + '_flattened.pdf';
            saveAs(blob, outputName);

            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, outputName);
            }

        } catch (err) {
            console.error('Flatten PDF error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to flatten PDF: ' + err.message);
        }
    }
});
