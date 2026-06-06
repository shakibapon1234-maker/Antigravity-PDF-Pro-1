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

    // Page navigation elements
    const btnCropPrevPage = document.getElementById('btnCropPrevPage');
    const btnCropNextPage = document.getElementById('btnCropNextPage');
    const cropPageIndicator = document.getElementById('cropPageIndicator');

    let currentPdfBytes = null;
    let originalFileName = '';
    let pdfDocInfo = { width: 0, height: 0, scale: 1 };
    
    // Crop variables
    let isDrawing = false;
    let startX = 0, startY = 0;
    let cropRect = { x: 0, y: 0, w: 0, h: 0 };

    // Navigation variables
    let cropCurrentPage = 1;
    let cropTotalPages = 1;
    let pdfjsDoc = null;

    if (btnUpload) btnUpload.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleUpload);
    if (btnApplyCrop) btnApplyCrop.addEventListener('click', applyCrop);

    if (btnCropPrevPage) {
        btnCropPrevPage.addEventListener('click', () => {
            if (cropCurrentPage > 1) {
                cropCurrentPage--;
                renderPagePreview(cropCurrentPage);
            }
        });
    }

    if (btnCropNextPage) {
        btnCropNextPage.addEventListener('click', () => {
            if (cropCurrentPage < cropTotalPages) {
                cropCurrentPage++;
                renderPagePreview(cropCurrentPage);
            }
        });
    }

    function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        originalFileName = file.name.replace(/\.[^/.]+$/, "");
        emptyState.classList.add('d-none');
        workspace.classList.remove('d-none');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        selectionBox.style.display = 'none';
        cropRect = { x: 0, y: 0, w: 0, h: 0 };
        btnApplyCrop.disabled = true;

        cropCurrentPage = 1;
        cropTotalPages = 1;
        pdfjsDoc = null;

        // Use FileReader instead of file.arrayBuffer() for better compatibility
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                currentPdfBytes = new Uint8Array(this.result);
                
                // Render first page with pdf.js — ALWAYS pass a copy
                pdfjsDoc = await pdfjsLib.getDocument({ data: currentPdfBytes.slice(0) }).promise;
                cropTotalPages = pdfjsDoc.numPages;
                
                await renderPagePreview(cropCurrentPage);
                
            } catch (err) {
                console.error("Error loading PDF for crop:", err);
                alert("Could not load PDF for cropping: " + err.message);
                emptyState.classList.remove('d-none');
                workspace.classList.add('d-none');
            }
        };
        reader.onerror = function() {
            alert("Could not read the file. Please try again.");
            emptyState.classList.remove('d-none');
            workspace.classList.add('d-none');
        };
        reader.readAsArrayBuffer(file);
        
        fileInput.value = '';
    }

    async function renderPagePreview(pageNum) {
        if (!pdfjsDoc) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        selectionBox.style.display = 'none';
        cropRect = { x: 0, y: 0, w: 0, h: 0 };
        btnApplyCrop.disabled = true;

        try {
            const page = await pdfjsDoc.getPage(pageNum);
            
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

            // Fill white background to support transparent PDF pages and avoid black-on-black invisibility in preview
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            if (cropPageIndicator) {
                cropPageIndicator.textContent = `Page ${pageNum} of ${cropTotalPages}`;
            }
            
        } catch (err) {
            console.error("Error rendering page preview:", err);
            alert("Error rendering page preview: " + err.message);
        }
    }

    // --- Drawing the Crop Rectangle ---
    container.addEventListener('mousedown', (e) => {
        if (!currentPdfBytes) return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        
        const contRect = container.getBoundingClientRect();
        const offsetX = rect.left - contRect.left;
        const offsetY = rect.top - contRect.top;
        
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
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

    window.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        
        let currentX = e.clientX - rect.left;
        let currentY = e.clientY - rect.top;
        
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

    window.addEventListener('mouseup', () => {
        if (!isDrawing) return;
        isDrawing = false;
        if (cropRect.w > 20 && cropRect.h > 20) {
            btnApplyCrop.disabled = false;
        } else {
            selectionBox.style.display = 'none';
        }
    });

    async function applyCrop() {
        if (!currentPdfBytes) return;
        if (cropRect.w === 0 || cropRect.h === 0) {
            alert('Please select a crop area by drawing a rectangle over the preview.');
            return;
        }

        const originalBtnHtml = btnApplyCrop.innerHTML;
        btnApplyCrop.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Cropping...';
        btnApplyCrop.disabled = true;
        if (window.lucide) lucide.createIcons();

        try {
            // Check for encryption by loading with ignoreEncryption: false
            let pdfDoc;
            try {
                pdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes.slice(0), { ignoreEncryption: false });
            } catch (err) {
                if (err.message.includes('encrypted') || err.message.includes('Encrypt') || err.message.includes('password')) {
                    alert("This PDF is encrypted or has editing restrictions. To crop it without corruption, please use the 'Unlock PDF' tool first to remove the protection, then crop the unlocked file.");
                    return;
                }
                throw err;
            }

            const pages = pdfDoc.getPages();

            let cropMode = 'all';
            for (const radio of radios) {
                if (radio.checked) cropMode = radio.value;
            }

            // DPR-aware coordinate calculation
            const canvasRect = canvas.getBoundingClientRect();
            const displayedW = canvasRect.width;
            const displayedH = canvasRect.height;

            const ratioX = pdfDocInfo.width  / displayedW;
            const ratioY = pdfDocInfo.height / displayedH;

            const pdfCropX = cropRect.x * ratioX;
            const pdfCropW = cropRect.w * ratioX;
            const pdfCropH = cropRect.h * ratioY;
            const bottomY = (displayedH - (cropRect.y + cropRect.h)) * ratioY;

            const pagesToCrop = cropMode === 'all' ? pages : [pages[cropCurrentPage - 1]];

            for (const page of pagesToCrop) {
                const mediaBox = page.getMediaBox();
                
                // Translate the relative crop coordinates to absolute coordinates of this page's MediaBox
                let absoluteCropX = mediaBox.x + pdfCropX;
                let absoluteBottomY = mediaBox.y + bottomY;
                
                // Clamp coordinates to page MediaBox boundaries to prevent negative/out-of-bounds values
                absoluteCropX = Math.max(mediaBox.x, Math.min(absoluteCropX, mediaBox.x + mediaBox.width));
                absoluteBottomY = Math.max(mediaBox.y, Math.min(absoluteBottomY, mediaBox.y + mediaBox.height));
                
                let absoluteCropW = Math.max(1, Math.min(pdfCropW, mediaBox.x + mediaBox.width - absoluteCropX));
                let absoluteCropH = Math.max(1, Math.min(pdfCropH, mediaBox.y + mediaBox.height - absoluteBottomY));
                
                page.setCropBox(absoluteCropX, absoluteBottomY, absoluteCropW, absoluteCropH);
                page.setMediaBox(absoluteCropX, absoluteBottomY, absoluteCropW, absoluteCropH);
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
            if (window.lucide) lucide.createIcons();
        }
    }
});
