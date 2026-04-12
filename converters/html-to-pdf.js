// Antigravity PDF - HTML to PDF Logic
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('htmlFileInput');
    const uploadBtn = document.getElementById('btnUploadHtml');
    const convertBtn = document.getElementById('btnConvertHtmlToPdf');
    const htmlContentInput = document.getElementById('htmlContentInput');
    const pageSizeSelect = document.getElementById('htmlPageSize');
    const marginInput = document.getElementById('htmlMargin');

    if (!htmlContentInput) return;

    window.loadHtmlToPdf = function(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function() {
            htmlContentInput.value = this.result;
            // Switch to tab if needed, but normally calling from archive already switched tab
        };
        reader.readAsText(file);
    };

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function() {
            htmlContentInput.value = this.result;
        };
        reader.readAsText(file);
    });

    convertBtn.addEventListener('click', async () => {
        const htmlContent = htmlContentInput.value.trim();
        if (!htmlContent) {
            alert('Please enter or upload HTML content first.');
            return;
        }

        convertBtn.disabled = true;
        convertBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Converting...';
        if (window.lucide) lucide.createIcons();

        try {
            const pageSize = pageSizeSelect.value;
            const margin = parseInt(marginInput.value) || 10;

            const opt = {
                margin:        margin,
                filename:      'antigravity_web_export.pdf',
                image:         { type: 'jpeg', quality: 0.98 },
                html2canvas:   { scale: 2, useCORS: true, letterRendering: true },
                jsPDF:         { unit: 'mm', format: pageSize, orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(htmlContent).save();

        } catch (err) {
            console.error(err);
            alert('Error converting HTML to PDF: ' + err.message);
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i data-lucide="file-check"></i> Convert & Download PDF';
            if (window.lucide) lucide.createIcons();
        }
    });
});
