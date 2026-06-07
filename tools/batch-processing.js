document.addEventListener('DOMContentLoaded', () => {
    const { PDFDocument } = window.PDFLib;

    let batchFiles = [];
    let currentMode = 'merge';

    const btnAddBatchFiles = document.getElementById('btnAddBatchFiles');
    const btnClearBatchQueue = document.getElementById('btnClearBatchQueue');
    const btnStartBatch = document.getElementById('btnStartBatch');
    const batchFileList = document.getElementById('batchFileList');
    const batchModeSelect = document.getElementById('batchModeSelect');
    const batchActionHint = document.getElementById('batchActionHint');

    if (!btnAddBatchFiles || !btnClearBatchQueue || !btnStartBatch || !batchFileList || !batchModeSelect) {
        return;
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    function sanitizeMode(mode) {
        return mode === 'images-to-pdf' ? 'images-to-pdf' : 'merge';
    }

    function createFileItem(file) {
        return {
            file,
            name: file.name,
            size: file.size,
            type: file.type || '',
            status: 'Queued',
            progress: 0,
            error: null,
        };
    }

    function updateHint() {
        if (currentMode === 'merge') {
            batchActionHint.textContent = 'Add multiple PDF files to merge into a single output document.';
        } else {
            batchActionHint.textContent = 'Add multiple image files and convert them together into one PDF.';
        }
    }

    function renderBatchQueue() {
        if (batchFiles.length === 0) {
            batchFileList.innerHTML = `
                <div class="batch-empty-state">
                    <i data-lucide="layers" class="large-icon"></i>
                    <h3>No Batch Files Added</h3>
                    <p>Select multiple files above to run merge or image conversion as a batch operation.</p>
                </div>
            `;
            if (window.safeCreateIcons) window.safeCreateIcons();
            return;
        }

        batchFileList.innerHTML = batchFiles.map((item, index) => `
            <div class="batch-file-item" data-index="${index}">
                <div class="batch-file-meta">
                    <div class="batch-file-name">${item.name}</div>
                    <div class="batch-file-details">
                        <span>${item.type || 'Unknown type'}</span>
                        <span>${formatBytes(item.size)}</span>
                        <span class="batch-file-status">${item.status}${item.error ? ' — ' + item.error : ''}</span>
                    </div>
                    <div class="batch-progress-bar">
                        <div class="batch-progress-inner" style="width: ${item.progress}%"></div>
                    </div>
                </div>
                <div class="batch-file-actions">
                    <button class="btn btn-outline" type="button" data-action="remove" data-index="${index}">Remove</button>
                </div>
            </div>
        `).join('');

        if (window.safeCreateIcons) window.safeCreateIcons();
    }

    function addFiles(files) {
        const added = [];
        const supportedPDF = currentMode === 'merge';
        const supportedImages = currentMode === 'images-to-pdf';

        Array.from(files).forEach((file) => {
            const nameLower = file.name.toLowerCase();
            if (supportedPDF && nameLower.endsWith('.pdf')) {
                batchFiles.push(createFileItem(file));
                added.push(file.name);
            } else if (supportedImages && /\.(png|jpe?g)$/i.test(nameLower)) {
                batchFiles.push(createFileItem(file));
                added.push(file.name);
            }
        });

        if (added.length === 0) {
            const message = supportedPDF
                ? 'Only PDF files can be added in Merge mode.'
                : 'Only PNG/JPG files can be added in Images → PDF mode.';
            window.AGToast.error(message);
        }

        renderBatchQueue();
    }

    btnAddBatchFiles.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        if (currentMode === 'merge') {
            input.accept = '.pdf';
        } else {
            input.accept = 'image/png,image/jpeg,image/jpg';
        }
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', (event) => {
            if (event.target.files) {
                addFiles(event.target.files);
            }
            document.body.removeChild(input);
        });
        input.click();
    });

    batchFileList.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action="remove"]');
        if (!button) return;
        const index = Number(button.dataset.index);
        if (!Number.isNaN(index) && batchFiles[index]) {
            batchFiles.splice(index, 1);
            renderBatchQueue();
        }
    });

    btnClearBatchQueue.addEventListener('click', () => {
        batchFiles = [];
        renderBatchQueue();
        window.AGToast.info('Batch queue cleared.');
    });

    batchModeSelect.addEventListener('change', (event) => {
        currentMode = sanitizeMode(event.target.value);
        batchFiles = [];
        updateHint();
        renderBatchQueue();
    });

    async function processMerge() {
        const mergedPdf = await PDFDocument.create();
        const total = batchFiles.length;

        for (let i = 0; i < total; i += 1) {
            const item = batchFiles[i];
            try {
                item.status = 'Loading';
                item.progress = 5;
                renderBatchQueue();

                const bytes = await item.file.arrayBuffer();
                const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
                const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));

                item.status = 'Added';
                item.progress = 100;
                renderBatchQueue();
                window.AGProgress.set(Math.round(((i + 1) / total) * 80), 'Merging files', `${i + 1} of ${total}`);
            } catch (error) {
                console.error('Batch merge error', error, item.name);
                item.status = 'Error';
                item.error = error.message || 'Load failed';
                item.progress = 100;
                renderBatchQueue();
                window.AGProgress.error();
                window.AGToast.error(`Failed to merge ${item.name}`);
                return false;
            }
        }

        try {
            const mergedBytes = await mergedPdf.save();
            const blob = new Blob([mergedBytes], { type: 'application/pdf' });
            window.saveAs(blob, 'batch-merged.pdf');
            window.AGProgress.set(100, 'Batch complete', 'Download ready');
            window.AGToast.success('Batch merge complete. Download started.');
            batchFiles.forEach((item) => { item.status = 'Done'; item.progress = 100; });
            renderBatchQueue();
            return true;
        } catch (error) {
            console.error('Batch merge save failed', error);
            window.AGProgress.error();
            window.AGToast.error('Batch merge failed while saving.');
            return false;
        }
    }

    async function processImagesToPdf() {
        const pdfDoc = await PDFDocument.create();
        const total = batchFiles.length;

        for (let i = 0; i < total; i += 1) {
            const item = batchFiles[i];
            try {
                item.status = 'Embedding';
                item.progress = 10;
                renderBatchQueue();

                const bytes = await item.file.arrayBuffer();
                const isPng = item.name.toLowerCase().endsWith('.png');
                const embeddedImage = isPng
                    ? await pdfDoc.embedPng(bytes)
                    : await pdfDoc.embedJpg(bytes);

                const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
                page.drawImage(embeddedImage, {
                    x: 0,
                    y: 0,
                    width: embeddedImage.width,
                    height: embeddedImage.height,
                });

                item.status = 'Converted';
                item.progress = 100;
                renderBatchQueue();
                window.AGProgress.set(Math.round(((i + 1) / total) * 80), 'Converting images', `${i + 1} of ${total}`);
            } catch (error) {
                console.error('Batch image conversion error', error, item.name);
                item.status = 'Error';
                item.error = error.message || 'Convert failed';
                item.progress = 100;
                renderBatchQueue();
                window.AGProgress.error();
                window.AGToast.error(`Failed to convert ${item.name}`);
                return false;
            }
        }

        try {
            const outputBytes = await pdfDoc.save();
            const blob = new Blob([outputBytes], { type: 'application/pdf' });
            window.saveAs(blob, 'batch-images.pdf');
            window.AGProgress.set(100, 'Batch complete', 'Download ready');
            window.AGToast.success('Batch image conversion complete. Download started.');
            batchFiles.forEach((item) => { item.status = 'Done'; item.progress = 100; });
            renderBatchQueue();
            return true;
        } catch (error) {
            console.error('Batch image save failed', error);
            window.AGProgress.error();
            window.AGToast.error('Batch image conversion failed while saving.');
            return false;
        }
    }

    btnStartBatch.addEventListener('click', async () => {
        if (batchFiles.length === 0) {
            window.AGToast.warning('Add files to the batch queue first.');
            return;
        }

        btnStartBatch.disabled = true;
        btnAddBatchFiles.disabled = true;
        btnClearBatchQueue.disabled = true;

        window.AGProgress.start('Starting batch...', currentMode === 'merge' ? 'Merging PDFs' : 'Converting images');

        if (currentMode === 'merge') {
            await processMerge();
        } else {
            await processImagesToPdf();
        }

        window.AGProgress.done();
        btnStartBatch.disabled = false;
        btnAddBatchFiles.disabled = false;
        btnClearBatchQueue.disabled = false;
    });

    updateHint();
    renderBatchQueue();
});
