// Antigravity PDF - Unlock PDF Logic (FIXED: pdf.js password verify + PDF-lib copy)
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('unlockFileInput');
    const uploadBtn = document.getElementById('btnUploadUnlock');
    const applyBtn = document.getElementById('btnApplyUnlock');
    const workspace = document.getElementById('unlockWorkspace');
    const emptyState = document.getElementById('unlockEmptyState');
    const passwordInput = document.getElementById('unlockPasswordInput');
    const fileNameDisplay = document.getElementById('unlockFileName');
    const fileSizeDisplay = document.getElementById('unlockFileSize');

    let currentFile = null;
    let currentFileData = null;

    if (!fileInput) return;

    window.loadUnlockPdf = function(file) {
        if (!file) return;
        handleUnlockFile(file);
    };

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) handleUnlockFile(file);
    });

    function handleUnlockFile(file) {
        // Handle files from archive that may not have type set
        const fileType = file.type || (file.name && file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null);
        if (!file || (file.type && file.type !== 'application/pdf') && !fileType) {
            alert('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = (file.size / 1024).toFixed(1) + ' KB';

        const reader = new FileReader();
        reader.onload = function() {
            currentFileData = new Uint8Array(this.result);
            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');
            passwordInput.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    applyBtn.addEventListener('click', async () => {
        if (!currentFileData) return;

        const password = passwordInput.value;
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Unlocking...';
        if (window.lucide) lucide.createIcons();

        try {
            // STEP 1: Use pdf.js to verify the password
            // pdf.js properly handles encrypted PDFs
            let pdfJsDoc;
            try {
                pdfJsDoc = await pdfjsLib.getDocument({
                    data: currentFileData.slice(0),
                    password: password
                }).promise;
            } catch (pdfJsErr) {
                // pdf.js will throw PasswordException for wrong/missing password
                if (pdfJsErr.name === 'PasswordException' ||
                    pdfJsErr.message.includes('password') ||
                    pdfJsErr.message.includes('Password')) {
                    if (!password) {
                        alert('This PDF is password protected. Please enter the password.');
                    } else {
                        alert('Incorrect password. Please try again.');
                    }
                    applyBtn.disabled = false;
                    applyBtn.innerHTML = '<i data-lucide="unlock"></i> Remove Password & Download';
                    if (window.lucide) lucide.createIcons();
                    return;
                }
                throw pdfJsErr;
            }

            // STEP 2: Password verified! Now use PDF-lib to create an unlocked copy
            // Load with ignoreEncryption: true to bypass encryption
            const { PDFDocument } = PDFLib;

            let unlockedDoc;
            try {
                // Try with password first
                unlockedDoc = await PDFDocument.load(currentFileData, {
                    password: password,
                    ignoreEncryption: false
                });
            } catch (pdfLibErr) {
                // If PDF-lib can't decrypt (some encryption types), use page-by-page copy via pdf.js
                unlockedDoc = await rebuildFromPdfJs(pdfJsDoc);
            }

            const pdfBytes = await unlockedDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            saveAs(blob, currentFile.name.replace(/\.pdf$/i, '_unlocked.pdf'));

            applyBtn.innerHTML = '<i data-lucide="check-circle"></i> Unlocked!';
            applyBtn.style.background = 'linear-gradient(135deg, #00c851, #007e33)';
            setTimeout(() => {
                applyBtn.innerHTML = '<i data-lucide="unlock"></i> Remove Password & Download';
                applyBtn.style.background = '';
                if (window.lucide) lucide.createIcons();
            }, 2500);

        } catch (err) {
            console.error('Unlock error:', err);
            alert('Error unlocking PDF: ' + err.message);
        } finally {
            applyBtn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    });

    // Fallback: rebuild PDF page by page using pdf.js rendering
    async function rebuildFromPdfJs(pdfJsDoc) {
        const { PDFDocument } = PDFLib;
        const newDoc = await PDFDocument.create();

        for (let i = 1; i <= pdfJsDoc.numPages; i++) {
            const page = await pdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            // Fill white background to support transparent PDF pages and avoid black background after JPEG conversion
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const base64 = jpegDataUrl.split(',')[1];
            const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const jpegImg = await newDoc.embedJpg(imgBytes);

            const newPage = newDoc.addPage([viewport.width / 2, viewport.height / 2]);
            newPage.drawImage(jpegImg, { x: 0, y: 0, width: viewport.width / 2, height: viewport.height / 2 });
        }
        return newDoc;
    }
});
