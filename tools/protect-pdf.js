// Antigravity PDF - Protect PDF Logic (FIXED: jsPDF encryption — truly works)
// PDF-lib does NOT support encryption. jsPDF does.
// Strategy: Render each page with pdf.js → add as image to jsPDF with encryption
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
    let currentFileBytes = null; // Uint8Array — safe from detach

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
        if (password.length < 1) {
            alert('Password is too short.');
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

        // Check jsPDF availability
        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            alert('jsPDF library not loaded. Please refresh the page and ensure you have internet connection.');
            return;
        }

        btnApplyProtect.disabled = true;
        btnApplyProtect.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Protecting...';
        if (window.lucide) lucide.createIcons();

        try {
            // Step 1: Load PDF with pdf.js to render pages
            const pdfJsDoc = await pdfjsLib.getDocument({ data: currentFileBytes.slice(0) }).promise;
            const totalPages = pdfJsDoc.numPages;

            // Step 2: Render first page to determine orientation
            const firstPage = await pdfJsDoc.getPage(1);
            const firstViewport = firstPage.getViewport({ scale: 1.0 });
            const isLandscape = firstViewport.width > firstViewport.height;

            // Step 3: Create jsPDF with encryption
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'pt',
                format: [firstViewport.width, firstViewport.height],
                encryption: {
                    userPassword: password,
                    ownerPassword: password + '_antigravity_owner',
                    userPermissions: []  // No permissions = maximum restriction
                }
            });

            // Step 4: Render each page and add to jsPDF
            for (let i = 1; i <= totalPages; i++) {
                btnApplyProtect.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Page ${i}/${totalPages}...`;

                const page = await pdfJsDoc.getPage(i);
                const scale = 2.0; // High quality render
                const viewport = page.getViewport({ scale });
                const pageW = page.getViewport({ scale: 1.0 }).width;
                const pageH = page.getViewport({ scale: 1.0 }).height;

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                await page.render({ canvasContext: ctx, viewport }).promise;

                const imgData = canvas.toDataURL('image/jpeg', 0.92);

                if (i > 1) {
                    // Add a new page with the correct size
                    const pageIsLandscape = pageW > pageH;
                    doc.addPage([pageW, pageH], pageIsLandscape ? 'landscape' : 'portrait');
                }

                doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
            }

            // Step 5: Save and download
            doc.save(`protected_${currentFile.name}`);

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
            alert('Failed to protect PDF: ' + err.message);
            btnApplyProtect.innerHTML = '<i data-lucide="lock"></i> Protect & Download';
        } finally {
            btnApplyProtect.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    });

    window.loadProtectPdf = loadProtectPdf;
});
