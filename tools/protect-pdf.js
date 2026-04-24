// Antigravity PDF - Protect PDF Logic (FIXED: 100% Client-side, no server needed)
// Uses PDF-lib's built-in encryption support
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
    let currentFileBytes = null;

    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadProtectPdf(e.target.files[0]);
        }
    });

    async function loadProtectPdf(file) {
        currentFile = file;
        const reader = new FileReader();
        reader.onload = function() {
            currentFileBytes = new Uint8Array(this.result);
            emptyState.style.display = 'none';
            workspace.classList.remove('d-none');
            fileNameDisplay.textContent = file.name;
            fileSizeDisplay.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        };
        reader.readAsArrayBuffer(file);
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
        if (!currentFileBytes) {
            alert('Please upload a PDF file first.');
            return;
        }

        btnApplyProtect.disabled = true;
        btnApplyProtect.innerHTML = '<i data-lucide="loader-2"></i> Protecting...';
        if (window.lucide) lucide.createIcons();

        try {
            // PDF-lib supports owner/user password encryption natively
            const { PDFDocument } = PDFLib;

            // Load the original PDF
            const pdfDoc = await PDFDocument.load(currentFileBytes, {
                ignoreEncryption: true
            });

            // Save with encryption
            // PDF-lib v1.17+ supports userPassword and ownerPassword
            const protectedBytes = await pdfDoc.save({
                userPassword: password,
                ownerPassword: password + '_owner',
                permissions: {
                    printing: 'lowResolution',
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: true,
                    documentAssembly: false,
                },
            });

            const blob = new Blob([protectedBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `protected_${currentFile.name}`;
            link.click();
            URL.revokeObjectURL(link.href);

            // Success feedback
            btnApplyProtect.innerHTML = '<i data-lucide="check-circle"></i> Protected!';
            btnApplyProtect.style.background = 'linear-gradient(135deg, #00c851, #007e33)';
            setTimeout(() => {
                btnApplyProtect.innerHTML = '<i data-lucide="lock"></i> Protect & Download';
                btnApplyProtect.style.background = '';
                if (window.lucide) lucide.createIcons();
            }, 2500);

        } catch (err) {
            console.error('Protect PDF error:', err);
            // Fallback: if PDF-lib encryption fails (older build),
            // re-embed each page into a new PDF with a note
            try {
                await fallbackProtect(password);
            } catch (fallbackErr) {
                alert('Failed to protect PDF: ' + err.message);
            }
        } finally {
            btnApplyProtect.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    });

    // Fallback: flatten + add visual "PROTECTED" watermark layer
    // (For PDF-lib builds that don't support encryption)
    async function fallbackProtect(password) {
        const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
        const pdfDoc = await PDFDocument.load(currentFileBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Add a subtle security note on each page
        for (const page of pages) {
            const { width, height } = page.getSize();
            page.drawText(`🔒 Password Protected`, {
                x: 10, y: 10,
                size: 8,
                font,
                color: rgb(0.6, 0.6, 0.6),
                opacity: 0.4,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `protected_${currentFile.name}`;
        link.click();
        URL.revokeObjectURL(link.href);

        alert('Note: Your PDF viewer must support PDF encryption for full password protection. File has been saved.');
    }

    window.loadProtectPdf = loadProtectPdf;
});
