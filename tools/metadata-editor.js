// ─────────────────────────────────────────────────────────────
// tools/metadata-editor.js — Antigravity PDF Pro
// PDF Metadata Editor: View and Edit PDF Document Properties
// ─────────────────────────────────────────────────────────────

(function () {
    let loadedFile = null;
    let loadedPdfDoc = null;
    let loadedArrayBuffer = null;

    // DOM Elements
    const getEl = (id) => document.getElementById(id);

    const uploadBtn = getEl('btnUploadMetadata');
    const fileInput = getEl('metadataFileInput');
    const emptyState = getEl('metadataEmptyState');
    const workspace = getEl('metadataWorkspace');
    const loadCurrentBtn = getEl('btnLoadCurrentEditorPdf');

    const fileNameEl = getEl('metadataFileName');
    const fileSizeEl = getEl('metadataFileSize');

    const inputTitle = getEl('metaTitle');
    const inputAuthor = getEl('metaAuthor');
    const inputSubject = getEl('metaSubject');
    const inputKeywords = getEl('metaKeywords');
    const inputCreator = getEl('metaCreator');
    const inputProducer = getEl('metaProducer');

    const pageCountEl = getEl('metaPageCount');
    const modDateEl = getEl('metaModDate');

    const saveBtn = getEl('btnSaveMetadata');
    const resetBtn = getEl('btnResetMetadata');

    // Initialize Event Listeners
    function init() {
        if (!uploadBtn) return; // safety check

        // File upload actions
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);

        // Reset
        resetBtn.addEventListener('click', resetTool);

        // Save metadata
        saveBtn.addEventListener('click', saveMetadataChanges);

        // Load current editor PDF button
        loadCurrentBtn.addEventListener('click', loadCurrentEditorFile);

        // Drag & Drop on Empty State
        if (emptyState) {
            emptyState.addEventListener('dragover', (e) => {
                e.preventDefault();
                emptyState.style.borderColor = 'var(--primary)';
                emptyState.style.backgroundColor = 'rgba(184, 41, 249, 0.05)';
            });
            emptyState.addEventListener('dragleave', () => {
                emptyState.style.borderColor = '';
                emptyState.style.backgroundColor = '';
            });
            emptyState.addEventListener('drop', (e) => {
                e.preventDefault();
                emptyState.style.borderColor = '';
                emptyState.style.backgroundColor = '';
                const file = e.dataTransfer.files[0];
                if (file && file.name.toLowerCase().endsWith('.pdf')) {
                    loadPdf(file);
                } else if (file) {
                    alert('দয়া করে একটি সঠিক PDF ফাইল ড্রপ করুন।');
                }
            });
            emptyState.addEventListener('click', () => fileInput.click());
        }

        // Listen for tab changes to show/hide "Load Current Editor PDF" button
        document.addEventListener('click', checkActiveTab);
    }

    function checkActiveTab() {
        // Find if metadata-editor is active
        const isTabActive = getEl('metadata-editor')?.classList.contains('active');
        if (isTabActive && loadCurrentBtn) {
            if (window.currentPdfFile) {
                loadCurrentBtn.style.display = 'inline-flex';
            } else {
                loadCurrentBtn.style.display = 'none';
            }
        }
    }

    async function loadCurrentEditorFile(e) {
        if (e) e.stopPropagation();
        if (window.currentPdfFile) {
            await loadPdf(window.currentPdfFile);
        }
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) loadPdf(file);
    }

    async function loadPdf(file) {
        if (!file) return;
        loadedFile = file;

        // Show progress/loader if needed
        if (window.showProgressBar) window.showProgressBar(30, 'পিডিএফ মেটাডেটা পড়া হচ্ছে...');

        try {
            loadedArrayBuffer = await file.arrayBuffer();
            // Load PDF document using pdf-lib
            loadedPdfDoc = await PDFLib.PDFDocument.load(loadedArrayBuffer, { ignoreEncryption: true });

            if (window.showProgressBar) window.showProgressBar(70, 'বিশ্লেষণ করা হচ্ছে...');

            // Populate file info
            fileNameEl.textContent = file.name;
            fileSizeEl.textContent = formatBytes(file.size);

            // Extract Metadata properties
            inputTitle.value = loadedPdfDoc.getTitle() || '';
            inputAuthor.value = loadedPdfDoc.getAuthor() || '';
            inputSubject.value = loadedPdfDoc.getSubject() || '';
            inputKeywords.value = loadedPdfDoc.getKeywords() || '';
            inputCreator.value = loadedPdfDoc.getCreator() || 'N/A';
            inputProducer.value = loadedPdfDoc.getProducer() || 'N/A';

            pageCountEl.textContent = `Pages: ${loadedPdfDoc.getPageCount()}`;
            
            const modDate = loadedPdfDoc.getModificationDate();
            modDateEl.textContent = `Modified: ${modDate ? modDate.toLocaleDateString() : 'N/A'}`;

            // Show workspace, hide empty state
            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');
            workspace.style.display = 'block';

            if (window.showProgressBar) window.showProgressBar(100, 'সম্পন্ন হয়েছে!');
            setTimeout(() => { if (window.hideProgressBar) window.hideProgressBar(); }, 500);

        } catch (err) {
            console.error('Metadata Editor load error:', err);
            if (window.hideProgressBar) window.hideProgressBar();
            alert('PDF মেটাডেটা লোড করতে ব্যর্থ হয়েছে: ' + err.message);
            resetTool();
        }
    }

    async function saveMetadataChanges() {
        if (!loadedPdfDoc) return;

        if (window.showProgressBar) window.showProgressBar(40, 'মেটাডেটা আপডেট করা হচ্ছে...');

        try {
            // Apply fields to PDF document
            loadedPdfDoc.setTitle(inputTitle.value.trim());
            loadedPdfDoc.setAuthor(inputAuthor.value.trim());
            loadedPdfDoc.setSubject(inputSubject.value.trim());

            // Keywords string to array
            const kwArray = inputKeywords.value
                .split(',')
                .map(k => k.trim())
                .filter(Boolean);
            loadedPdfDoc.setKeywords(kwArray);

            // Update modification date
            loadedPdfDoc.setModificationDate(new Date());

            if (window.showProgressBar) window.showProgressBar(85, 'নতুন ফাইল জেনারেট হচ্ছে...');

            // Save PDF bytes
            const pdfBytes = await loadedPdfDoc.save();

            // Trigger file download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const outputName = loadedFile.name.replace('.pdf', '_meta.pdf');
            
            saveAs(blob, outputName);

            if (window.showProgressBar) window.showProgressBar(100, 'ডাউনলোড সম্পন্ন!');
            setTimeout(() => { if (window.hideProgressBar) window.hideProgressBar(); }, 600);

            if (window.showToast) {
                const currentLang = localStorage.getItem('appLanguage') || 'en';
                const successMsg = currentLang === 'bn' 
                    ? 'মেটাডেটা সফলভাবে আপডেট করা হয়েছে এবং ফাইলটি ডাউনলোড শুরু হয়েছে!'
                    : 'Metadata updated successfully! Download started.';
                window.showToast(successMsg, 'success');
            }

        } catch (err) {
            console.error('Metadata save error:', err);
            if (window.hideProgressBar) window.hideProgressBar();
            alert('মেটাডেটা পরিবর্তন করতে ব্যর্থ হয়েছে: ' + err.message);
        }
    }

    function resetTool() {
        loadedFile = null;
        loadedPdfDoc = null;
        loadedArrayBuffer = null;
        fileInput.value = '';

        // Clear forms
        inputTitle.value = '';
        inputAuthor.value = '';
        inputSubject.value = '';
        inputKeywords.value = '';
        inputCreator.value = '';
        inputProducer.value = '';

        // Hide workspace, show empty state
        workspace.classList.add('d-none');
        workspace.style.display = 'none';
        emptyState.classList.remove('d-none');

        checkActiveTab();
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
})();
