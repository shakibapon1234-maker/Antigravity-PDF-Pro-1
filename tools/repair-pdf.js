// Antigravity PDF - Repair PDF Tool
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('repairInput');
    const dropZone = document.getElementById('repairDropZone');
    const statusEl = document.getElementById('conversionStatusRepair');
    const progressEl = document.getElementById('convProgressRepair');
    const nameDisplay = document.getElementById('fileNameDisplayRepair');
    const btnDownload = document.getElementById('btnDownloadRepair');

    if (!fileInput) return;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) repairPdfFile(file);
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
                repairPdfFile(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }

    async function repairPdfFile(file) {
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
            progressEl.style.width = '50%';

            const { PDFDocument } = PDFLib;
            
            // Reconstruct cross-reference table and rebuild structure
            const pdfDoc = await PDFDocument.load(arrayBuffer, {
                ignoreEncryption: true
            });
            progressEl.style.width = '80%';

            const pdfBytes = await pdfDoc.save();
            progressEl.style.width = '95%';

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            progressEl.style.width = '100%';

            const baseName = file.name.replace(/\.pdf$/i, '');
            const outputName = baseName + '_repaired.pdf';
            saveAs(blob, outputName);

            alert("PDF structure successfully reconstructed and repaired!");

            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, outputName);
            }

        } catch (err) {
            console.error('Repair PDF error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to repair PDF (file may be completely unreadable): ' + err.message);
        }
    }
});
