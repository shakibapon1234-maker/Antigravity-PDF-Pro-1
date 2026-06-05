// Antigravity PDF - HTML to PDF Logic (FIXED: Better error handling, CSS embed, validation)
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
        };
        reader.readAsText(file);
    };

    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function() {
                htmlContentInput.value = this.result;
            };
            reader.readAsText(file);
        });
    }

    if (convertBtn) {
        convertBtn.addEventListener('click', async () => {
            let htmlContent = htmlContentInput.value.trim();
            if (!htmlContent) {
                alert('Please enter or upload HTML content first.');
                return;
            }

            // Check if html2pdf library loaded
            if (typeof html2pdf === 'undefined') {
                alert('html2pdf library not loaded. Please check your internet connection and refresh.');
                return;
            }

            // Wrap bare HTML content (no DOCTYPE) in a proper document with basic CSS
            if (!htmlContent.toLowerCase().includes('<!doctype') && !htmlContent.toLowerCase().includes('<html')) {
                htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; padding: 0; color: #222; }
  h1, h2, h3 { color: #1a1a2e; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 8px; }
  img { max-width: 100%; }
  pre, code { background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>${htmlContent}</body>
</html>`;
            }

            convertBtn.disabled = true;
            convertBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Converting...';
            if (window.lucide) lucide.createIcons();

            try {
                const pageSize = pageSizeSelect ? pageSizeSelect.value : 'a4';
                const margin = parseInt(marginInput ? marginInput.value : 10) || 10;

                // Create a hidden parent wrapper to hide the content from view
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'position: absolute; left: -9999px; top: -9999px; z-index: -9999;';

                // Create a temporary container element with fixed width and white background
                const container = document.createElement('div');
                container.innerHTML = htmlContent;
                const containerW = pageSize === 'letter' || pageSize === 'legal' ? 816 : 794;
                container.style.cssText = `width: ${containerW}px; background: #ffffff; min-height: 100px; display: block;`;

                wrapper.appendChild(container);
                document.body.appendChild(wrapper);

                const opt = {
                    margin:      [margin, margin, margin, margin],
                    filename:    'antigravity_html_export.pdf',
                    image:       { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        letterRendering: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        scrollX: 0,
                        scrollY: 0
                    },
                    jsPDF:       { unit: 'mm', format: pageSize, orientation: 'portrait' },
                    pagebreak:   { mode: ['avoid-all', 'css', 'legacy'] }
                };

                await html2pdf().set(opt).from(container).save();
                document.body.removeChild(wrapper);

                // Success feedback
                convertBtn.innerHTML = '<i data-lucide="check-circle"></i> Converted!';
                setTimeout(() => {
                    convertBtn.innerHTML = '<i data-lucide="file-check"></i> Convert & Download PDF';
                    if (window.lucide) lucide.createIcons();
                }, 2000);

            } catch (err) {
                console.error('HTML to PDF error:', err);
                let msg = 'Error converting HTML to PDF.';
                if (err.message) msg += '\n\nDetails: ' + err.message;
                if (err.message && err.message.includes('CORS')) {
                    msg += '\n\nNote: External images/fonts may fail due to CORS restrictions. Try removing external resources.';
                }
                alert(msg);
            } finally {
                convertBtn.disabled = false;
                if (!convertBtn.innerHTML.includes('check')) {
                    convertBtn.innerHTML = '<i data-lucide="file-check"></i> Convert & Download PDF';
                }
                if (window.lucide) lucide.createIcons();
            }
        });
    }
});
