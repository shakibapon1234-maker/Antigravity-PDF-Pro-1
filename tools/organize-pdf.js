document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btnUploadOrganize');
    const fileInput = document.getElementById('orgFileInput');
    const emptyState = document.getElementById('orgEmptyState');
    const workspace = document.getElementById('orgWorkspace');
    const previewContainer = document.getElementById('orgPreview');
    const btnSave = document.getElementById('btnSaveOrganizedPdf');
    const pageCountDisplay = document.getElementById('orgPageCount');

    let currentPdfDoc = null;
    let originalFileName = '';
    let pagesData = []; // Array to track { id, originalIndex, rotation, deleted }
    let sortableInstance = null;

    if (btnUpload) {
        btnUpload.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', handlePdfUpload);
    }

    if (btnSave) {
        btnSave.addEventListener('click', saveOrganizedPdf);
    }

    async function loadOrganizePdf(file) {
        if (!file) return;

        originalFileName = file.name.replace(/\.[^/.]+$/, "");
        emptyState.classList.add('d-none');
        workspace.classList.remove('d-none');
        previewContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 40px;">Generating thumbnails... This may take a moment.</div>';

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Use PDFLib to get the full document for later saving.
            // But use pdf.js to render the thumbnails just like in text editor.
            currentPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            
            const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            await renderThumbnails(pdfjsDoc);
            
        } catch (error) {
            console.error("Error loading PDF for organization:", error);
            previewContainer.innerHTML = '<div style="color: #ff4d4d; grid-column: 1 / -1;">Error loading PDF document.</div>';
        }
    }

    async function handlePdfUpload(e) {
        const file = e.target.files[0];
        if (file) {
            await loadOrganizePdf(file);
            fileInput.value = '';
        }
    }

    async function renderThumbnails(pdfjsDoc) {
        previewContainer.innerHTML = '';
        pagesData = [];
        const numPages = pdfjsDoc.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfjsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 }); // Thumbnail size
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            const pageId = `page-${i}`;
            pagesData.push({
                id: pageId,
                originalIndex: i - 1, // 0-indexed for PDFLib
                rotation: 0,
                deleted: false
            });

            const item = document.createElement('div');
            item.className = 'org-page-item';
            item.dataset.id = pageId;
            item.style.cssText = 'background: #1e1e1e; padding: 10px; border-radius: 6px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2); position: relative; cursor: grab; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s;';
            
            // Image wrapper to handle rotation visually independent of the container
            const imgWrapper = document.createElement('div');
            imgWrapper.style.cssText = 'width: 100%; display: flex; justify-content: center; align-items: center; margin-bottom: 10px; overflow: hidden;';
            
            canvas.style.cssText = 'max-width: 100%; height: auto; border: 1px solid #333; border-radius: 4px; background: white; transition: transform 0.3s ease;';
            imgWrapper.appendChild(canvas);

            const label = document.createElement('span');
            label.className = 'org-page-label';
            label.textContent = `Page ${i}`;
            label.style.cssText = 'font-size: 0.9rem; color: #aaa; font-weight: 500;';

            // Controls overlay
            const controls = document.createElement('div');
            controls.style.cssText = 'position: absolute; top: 15px; right: 15px; display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s;';
            
            const btnRotate = document.createElement('button');
            btnRotate.innerHTML = '<i data-lucide="rotate-cw"></i>';
            btnRotate.style.cssText = 'background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center;';
            
            const btnDelete = document.createElement('button');
            btnDelete.innerHTML = '<i data-lucide="trash-2"></i>';
            // Wait until attached to DOM to convert string icons if lucide is used, or just text:
            btnDelete.style.cssText = 'background: #ff4d4d; color: white; border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center;';

            controls.appendChild(btnRotate);
            controls.appendChild(btnDelete);

            item.appendChild(imgWrapper);
            item.appendChild(label);
            item.appendChild(controls);
            previewContainer.appendChild(item);

            // Hover effects
            item.addEventListener('mouseenter', () => controls.style.opacity = '1');
            item.addEventListener('mouseleave', () => controls.style.opacity = '0');

            // Interactive logic
            btnRotate.addEventListener('click', (e) => {
                e.stopPropagation();
                const data = pagesData.find(pd => pd.id === pageId);
                data.rotation = (data.rotation + 90) % 360;
                canvas.style.transform = `rotate(${data.rotation}deg)`;
            });

            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                const data = pagesData.find(pd => pd.id === pageId);
                data.deleted = true;
                item.style.display = 'none';
                updatePageCount();
            });

            // Parse icons inside this newly added block
            if (window.lucide) {
                // simple hack, wait briefly to ensure lucide can replace
                setTimeout(() => lucide.createIcons({root: item}), 0);
            }
        }

        updatePageCount();

        // Initialize Sortable
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(previewContainer, {
            animation: 150,
            ghostClass: 'org-ghost',
            onEnd: () => {
                updateLabels();
            }
        });
        
        // Add a style tag for ghost class if not present
        if(!document.getElementById('org-styles')) {
            const style = document.createElement('style');
            style.id = 'org-styles';
            style.innerHTML = '.org-ghost { opacity: 0.4; } .org-page-item:active { cursor: grabbing !important; }';
            document.head.appendChild(style);
        }
    }

    function updatePageCount() {
        const visiblePages = pagesData.filter(pd => !pd.deleted).length;
        pageCountDisplay.textContent = `${visiblePages} page${visiblePages !== 1 ? 's' : ''}`;
        btnSave.disabled = visiblePages === 0;
    }

    function updateLabels() {
        // Renumber pages visually based on DOM order, ignoring deleted ones
        const items = previewContainer.querySelectorAll('.org-page-item');
        let counter = 1;
        items.forEach(item => {
            const data = pagesData.find(pd => pd.id === item.dataset.id);
            if (!data.deleted) {
                const label = item.querySelector('.org-page-label');
                if (label) label.textContent = `Page ${counter}`;
                counter++;
            }
        });
    }

    async function saveOrganizedPdf() {
        if (!currentPdfDoc) return;
        
        const originalBtnHtml = btnSave.innerHTML;
        btnSave.innerHTML = '<i class="bi bi-arrow-repeat spin" style="display:inline-block; animation: spin 2s linear infinite;"></i> Saving...';
        btnSave.disabled = true;

        try {
            const newPdfDoc = await PDFLib.PDFDocument.create();
            
            // Get order from DOM
            const domItems = previewContainer.querySelectorAll('.org-page-item');
            
            for (const item of domItems) {
                const data = pagesData.find(pd => pd.id === item.dataset.id);
                if (data && !data.deleted) {
                    // Copy page from original to new
                    const [copiedPage] = await newPdfDoc.copyPages(currentPdfDoc, [data.originalIndex]);
                    
                    // Apply rotation if any
                    if (data.rotation > 0) {
                        const currentRotation = copiedPage.getRotation().angle;
                        copiedPage.setRotation(PDFLib.degrees(currentRotation + data.rotation));
                    }
                    
                    newPdfDoc.addPage(copiedPage);
                }
            }

            const pdfBytes = await newPdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            window.saveAs(blob, `${originalFileName}_organized.pdf`);

        } catch (error) {
            console.error("Error saving organized PDF:", error);
            alert("An error occurred while saving the PDF.");
        } finally {
            btnSave.innerHTML = originalBtnHtml;
            btnSave.disabled = false;
        }
    }
    window.loadOrganizePdf = loadOrganizePdf;
});
