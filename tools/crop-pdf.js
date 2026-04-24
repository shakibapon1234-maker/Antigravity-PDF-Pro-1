document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btnUploadCropPdf');
    const fileInput = document.getElementById('cropFileInput');
    const emptyState = document.getElementById('cropEmptyState');
    const workspace = document.getElementById('cropWorkspace');
    const canvas = document.getElementById('cropCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('cropPreviewContainer');
    const selectionBox = document.getElementById('cropSelectionBox');
    const btnApplyCrop = document.getElementById('btnApplyCrop');
    const radios = document.getElementsByName('cropMode');

    let currentPdfBytes = null;
    let originalFileName = '';
    let pdfDocInfo = { width: 0, height: 0, scale: 1 };
    
    // Crop variables
    let isDrawing = false;
    let startX = 0, startY = 0;
    let cropRect = { x: 0, y: 0, w: 0, h: 0 };

    if (btnUpload) btnUpload.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleUpload);
    if (btnApplyCrop) btnApplyCrop.addEventListener('click', applyCrop);

    async function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        originalFileName = file.name.replace(/\.[^/.]+$/, "");
        emptyState.classList.add('d-none');
        workspace.classList.remove('d-none');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        selectionBox.style.display = 'none';
        cropRect = { x: 0, y: 0, w: 0, h: 0 };
        btnApplyCrop.disabled = true;

        try {
            currentPdfBytes = await file.arrayBuffer();
            
            // Render first page with pdf.js to show preview
            const pdfjsDoc = await pdfjsLib.getDocument({ data: currentPdfBytes }).promise;
            const page = await pdfjsDoc.getPage(1);
            
            // Limit width for preview
            const viewportForScale = page.getViewport({ scale: 1.0 });
            const maxPreviewWidth = 800; 
            const scale = viewportForScale.width > maxPreviewWidth ? maxPreviewWidth / viewportForScale.width : 1.5;
            
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            pdfDocInfo = { 
                width: viewportForScale.width, 
                height: viewportForScale.height,
                scale: scale 
            };

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;
            
        } catch (err) {
            console.error("Error loading PDF for crop:", err);
            alert("Could not load PDF for cropping.");
            emptyState.classList.remove('d-none');
            workspace.classList.add('d-none');
        }
        
        fileInput.value = '';
    }

    // --- Drawing the Crop Rectangle ---
    container.addEventListener('mousedown', (e) => {
        if (!currentPdfBytes) return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        
        // CSS offsets inside container
        const contRect = container.getBoundingClientRect();
        const offsetX = rect.left - contRect.left;
        const offsetY = rect.top - contRect.top;
        
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        // Ensure starting point is inside canvas bounds
        if(startX < 0 || startY < 0 || startX > canvas.offsetWidth || startY > canvas.offsetHeight) {
            isDrawing = false;
            return;
        }

        selectionBox.style.display = 'block';
        selectionBox.style.left = (startX + offsetX) + 'px';
        selectionBox.style.top = (startY + offsetY) + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        
        cropRect = { x: startX, y: startY, w: 0, h: 0 };
        btnApplyCrop.disabled = true;
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        
        // Calculate canvas bounds bounds
        let currentX = e.clientX - rect.left;
        let currentY = e.clientY - rect.top;
        
        // Constrain to canvas
        currentX = Math.max(0, Math.min(currentX, canvas.offsetWidth));
        currentY = Math.max(0, Math.min(currentY, canvas.offsetHeight));

        const w = currentX - startX;
        const h = currentY - startY;

        const contRect = container.getBoundingClientRect();
        const offsetX = rect.left - contRect.left;
        const offsetY = rect.top - contRect.top;

        selectionBox.style.left = (w < 0 ? currentX + offsetX : startX + offsetX) + 'px';
        selectionBox.style.top  = (h < 0 ? currentY + offsetY : startY + offsetY) + 'px';
        selectionBox.style.width  = Math.abs(w) + 'px';
        selectionBox.style.height = Math.abs(h) + 'px';
        
        cropRect = {
            x: w < 0 ? currentX : startX,
            y: h < 0 ? currentY : startY,
            w: Math.abs(w),
            h: Math.abs(h)
        };
    });

    container.addEventListener('mouseup', () => {
        if (!isDrawing) return;
        isDrawing = false;
        if (cropRect.w > 20 && cropRect.h > 20) {
            btnApplyCrop.disabled = false;
        } else {
            selectionBox.style.display = 'none';
        }
    });

    async function applyCrop() {
        if (!currentPdfBytes || cropRect.w === 0 || cropRect.h === 0) return;

        const originalBtnHtml = btnApplyCrop.innerHTML;
        btnApplyCrop.innerHTML = '<i class="bi bi-arrow-repeat spin" style="display:inline-block; animation: spin 2s linear infinite;"></i> Cropping...';
        btnApplyCrop.disabled = true;

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes, { ignoreEncryption: true });
            const pages = pdfDoc.getPages();

            let cropMode = 'all';
            for (const radio of radios) {
                if (radio.checked) cropMode = radio.value;
            }

            // --- DPR-AWARE COORDINATE CALCULATION (FIXED) ---
            // Use getBoundingClientRect() for the actual displayed CSS size
            // This avoids bugs from offsetWidth/offsetHeight ignoring CSS transforms
            const canvasRect = canvas.getBoundingClientRect();
            const displayedW = canvasRect.width;   // actual CSS pixels displayed
            const displayedH = canvasRect.height;

            // Ratio: how many PDF points per CSS pixel
            const ratioX = pdfDocInfo.width  / displayedW;
            const ratioY = pdfDocInfo.height / displayedH;

            // cropRect is in CSS pixels relative to the canvas top-left
            const pdfCropX = cropRect.x * ratioX;
            const pdfCropW = cropRect.w * ratioX;
            const pdfCropH = cropRect.h * ratioY;

            // PDF coordinate origin is bottom-left, canvas is top-left — flip Y
            const bottomY = (displayedH - (cropRect.y + cropRect.h)) * ratioY;

            const pagesToCrop = cropMode === 'all' ? pages : [pages[0]];

            for (const page of pagesToCrop) {
                // Set both CropBox and MediaBox so all viewers respect the crop
                page.setCropBox(pdfCropX, bottomY, pdfCropW, pdfCropH);
                page.setMediaBox(pdfCropX, bottomY, pdfCropW, pdfCropH);
            }

            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            window.saveAs(blob, `${originalFileName}_cropped.pdf`);

        } catch (err) {
            console.error('Error applying crop:', err);
            alert('Error cropping the PDF: ' + err.message);
        } finally {
            btnApplyCrop.innerHTML = originalBtnHtml;
            btnApplyCrop.disabled = false;
        }
    }
});
