document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const btnUploadPti = document.getElementById('btnUploadPdfToImage');
    const ptiFileInput = document.getElementById('ptiFileInput');
    const ptiEmptyState = document.getElementById('ptiEmptyState');
    const ptiWorkspace = document.getElementById('ptiWorkspace');
    const ptiPreview = document.getElementById('ptiPreview');
    const btnConvertPti = document.getElementById('btnConvertPdfToImage');
    const ptiFormatRadios = document.getElementsByName('ptiFormat');

    let currentPdfDoc = null;
    let pdfFileName = '';

    // Initialize pdf.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } else {
        console.warn('[pdf-to-image.js] pdfjsLib is undefined during DOMContentLoaded.');
    }

    // Event Listeners
    if(btnUploadPti) {
        btnUploadPti.addEventListener('click', () => {
            ptiFileInput.click();
        });
    }

    if(ptiFileInput) {
        ptiFileInput.addEventListener('change', handlePdfUpload);
    }

    if(btnConvertPti) {
        btnConvertPti.addEventListener('click', downloadImagesAsZip);
    }

    async function handlePdfUpload(e) {
        const file = e.target.files[0];
        if (file) loadPdfToImageForArchive(file);
    }

    async function loadPdfToImageForArchive(file) {
        // Handle files from archive that may not have type set
        const fileType = file.type || (file.name && file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null);
        if (!file || (file.type && file.type !== 'application/pdf') && !fileType) {
            alert('Please select a valid PDF file.');
            return;
        }

        pdfFileName = file.name.replace(/\.[^/.]+$/, ""); // remove extension
        ptiEmptyState.classList.add('d-none');
        ptiWorkspace.classList.remove('d-none');
        ptiPreview.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 40px;">Loading pages...</div>';

        try {
            const arrayBuffer = await file.arrayBuffer();
            currentPdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            renderPreviews();
        } catch (error) {
            console.error("Error loading PDF:", error);
            ptiPreview.innerHTML = '<div style="color: #ff4d4d; grid-column: 1 / -1;">Error loading PDF document.</div>';
        }
    }

    window.loadPdfToImage = loadPdfToImageForArchive;

    async function renderPreviews() {
        if (!currentPdfDoc) return;
        
        ptiPreview.innerHTML = ''; // clear loading state
        
        // Render a keyframe animation for spinner if not exists
        if (!document.getElementById('spin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spin-keyframes';
            style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        const numPages = currentPdfDoc.numPages;
        for (let i = 1; i <= numPages; i++) {
            const page = await currentPdfDoc.getPage(i);
            // Smaller scale for preview
            const viewport = page.getViewport({ scale: 0.5 });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Fill white background to support transparent PDF pages
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            const previewItem = document.createElement('div');
            previewItem.style.cssText = 'background: #1e1e1e; padding: 10px; border-radius: 6px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; flex-direction: column; align-items: center;';
            
            canvas.style.cssText = 'max-width: 100%; height: auto; border: 1px solid #333; border-radius: 4px; background: white;';
            const label = document.createElement('span');
            label.textContent = `Page ${i}`;
            label.style.cssText = 'margin-top: 8px; font-size: 0.9rem; color: #aaa;';
            
            previewItem.appendChild(canvas);
            previewItem.appendChild(label);
            ptiPreview.appendChild(previewItem);
        }
    }

    async function downloadImagesAsZip() {
        if (!currentPdfDoc) return;

        // Get selected format
        let format = 'png';
        for (const radio of ptiFormatRadios) {
            if (radio.checked) {
                format = radio.value;
                break;
            }
        }

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        
        // Show loading state on button
        const originalBtnHtml = btnConvertPti.innerHTML;
        btnConvertPti.innerHTML = '<i class="bi bi-arrow-repeat spin" style="display:inline-block; animation: spin 2s linear infinite;"></i> Processing...';
        btnConvertPti.disabled = true;

        try {
            const zip = new JSZip();
            const numPages = currentPdfDoc.numPages;

            for (let i = 1; i <= numPages; i++) {
                const page = await currentPdfDoc.getPage(i);
                // Default scale (e.g., 2.0 for decent quality)
                const viewport = page.getViewport({ scale: 2.0 });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Fill white background to support transparent PDF pages
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;

                // get data url
                const dataUrl = canvas.toDataURL(mimeType, 0.9); // 0.9 quality for jpeg
                // remove data:image/png;base64,
                const base64Data = dataUrl.split(',')[1];
                
                zip.file(`${pdfFileName}_page_${i}.${format}`, base64Data, {base64: true});
            }

            const content = await zip.generateAsync({type: "blob"});
            window.saveAs(content, `${pdfFileName}_images.zip`);

        } catch (error) {
            console.error("Error creating zip:", error);
            alert("An error occurred while generating images.");
        } finally {
            btnConvertPti.innerHTML = originalBtnHtml;
            btnConvertPti.disabled = false;
        }
    }
});
