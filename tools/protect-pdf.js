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
            const formData = new FormData();
            formData.append('file', currentFile);
            formData.append('password', password);

            const response = await fetch('/api/tools/protect-pdf', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error occurred');
            }

            const blob = await response.blob();
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
