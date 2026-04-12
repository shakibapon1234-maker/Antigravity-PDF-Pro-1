// Antigravity PDF - Unlock PDF Logic
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
        if (!file || file.type !== 'application/pdf') {
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
            const { PDFDocument } = PDFLib;
            let pdfDoc;
            
            try {
                pdfDoc = await PDFDocument.load(currentFileData, { 
                    password: password,
                    ignoreEncryption: false 
                });
            } catch (err) {
                if (err.message.includes('password') || err.name === 'PasswordError') {
                    alert('Incorrect password. Please try again.');
                    applyBtn.disabled = false;
                    applyBtn.innerHTML = '<i data-lucide="unlock"></i> Remove Password & Download';
                    if (window.lucide) lucide.createIcons();
                    return;
                }
                throw err;
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            saveAs(blob, currentFile.name.replace('.pdf', '_unlocked.pdf'));

            alert('PDF successfully unlocked and downloaded!');
        } catch (err) {
            console.error(err);
            alert('Error unlocking PDF: ' + err.message);
        } finally {
            applyBtn.disabled = false;
            applyBtn.innerHTML = '<i data-lucide="unlock"></i> Remove Password & Download';
            if (window.lucide) lucide.createIcons();
        }
    });
});
