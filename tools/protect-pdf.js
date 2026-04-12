document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btnUploadProtect');
    const fileInput = document.getElementById('protectFileInput');
    const emptyState = document.getElementById('protectEmptyState');
    const workspace = document.getElementById('protectWorkspace');
    const fileNameDisplay = document.getElementById('protectFileName');
    const fileSizeDisplay = document.getElementById('protectFileSize');
    const btnApplyProtect = document.getElementById('btnApplyProtect');
    const passwordInput = document.getElementById('protectPassword');
    const confirmPasswordInput = document.getElementById('protectConfirmPassword');

    if (!btnUpload) return;

    let currentFile = null;

    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadProtectPdf(e.target.files[0]);
        }
    });

    async function loadProtectPdf(file) {
        currentFile = file;
        emptyState.style.display = 'none';
        workspace.classList.remove('d-none');
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    }

    btnApplyProtect.addEventListener('click', async () => {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!password) {
            alert('Please enter a password.');
            return;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        if (!currentFile) return;

        btnApplyProtect.disabled = true;
        btnApplyProtect.innerHTML = '<i data-lucide="loader-2"></i> Protecting...';
        lucide.createIcons();

        try {
            const arrayBuffer = await currentFile.arrayBuffer();
            const { PDFDocument } = PDFLib;
            
            // Load the PDF. ignoreEncryption: true helps if the file has some existing metadata restrictions
            // or if it was previously saved with a library that adds minor encryption flags.
            let pdfDoc;
            try {
                pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            } catch (loadErr) {
                console.error("Load error:", loadErr);
                throw new Error("Could not load PDF. It might be corrupted or heavily restricted.");
            }
            
            const encryptedPdfBytes = await pdfDoc.encrypt({
                userPassword: password,
                ownerPassword: password,
                permissions: {
                    printing: 'highResolution',
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: false,
                    documentAssembly: false,
                },
            });

            const blob = new Blob([encryptedPdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `protected_${currentFile.name}`;
            link.click();
            URL.revokeObjectURL(link.href);
            
            alert('PDF protected successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to protect PDF: ' + err.message);
        } finally {
            btnApplyProtect.disabled = false;
            btnApplyProtect.innerHTML = '<i data-lucide="lock"></i> Protect & Download';
            lucide.createIcons();
        }
    });

    window.loadProtectPdf = loadProtectPdf;
});
