document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btnUploadCompress');
    const compressEmptyState = document.getElementById('compressEmptyState');
    const compressWorkspace = document.getElementById('compressWorkspace');
    const compressFileName = document.getElementById('compressFileName');
    const compressFileSize = document.getElementById('compressFileSize');
    const btnCompressPdf = document.getElementById('btnCompressPdf');
    
    let currentPdfBytes = null;
    let originalFileName = '';

    async function loadCompressPdf(file) {
        if (file) {
            originalFileName = file.name.replace('.pdf', '');
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            compressFileName.textContent = file.name;
            compressFileSize.textContent = `${sizeMB} MB`;
            currentPdfBytes = await file.arrayBuffer();
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

    async function compressAndDownload() {
        if (!currentPdfBytes) return;

        btnCompressPdf.disabled = true;
        const originalBtnHtml = btnCompressPdf.innerHTML;
        btnCompressPdf.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Compressing...';

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes);
            const compressedPdfBytes = await pdfDoc.save({ 
                useObjectStreams: true,
                addDefaultPage: false,
                updateMetadata: false
            });

            const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
            saveAs(blob, `${originalFileName}_compressed.pdf`);
            
        } catch (err) {
            console.error('Error compressing PDF:', err);
            alert('Failed to compress PDF. Please check the file.');
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
