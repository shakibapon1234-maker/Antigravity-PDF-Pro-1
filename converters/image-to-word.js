// Antigravity PDF - Image to Word Converter
document.addEventListener('DOMContentLoaded', () => {

    async function convertImageToWord(file) {
        const statusEl    = document.getElementById('itwConversionStatus');
        const progressEl  = document.getElementById('itwConvProgress');
        const nameDisplay = document.getElementById('itwFileNameDisplay');
        const btnDownload = document.getElementById('btnDownloadItwWord');

        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        if (typeof docx === 'undefined') {
            alert('DOCX library not loaded. Please refresh the page.');
            return;
        }

        if (typeof Tesseract === 'undefined') {
            alert('Tesseract OCR library not loaded. Please refresh the page.');
            return;
        }

        nameDisplay.textContent = file.name;
        statusEl.classList.remove('d-none');
        progressEl.style.width = '10%';
        if (btnDownload) btnDownload.style.display = 'none';

        try {
            // Read image file as URL
            const imageUrl = URL.createObjectURL(file);
            progressEl.style.width = '30%';

            // Run OCR
            const result = await Tesseract.recognize(imageUrl, 'eng+ben', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressEl.style.width = `${30 + m.progress * 60}%`;
                    }
                }
            });

            progressEl.style.width = '90%';
            URL.revokeObjectURL(imageUrl);

            const ocrText = result.data.text;
            if (!ocrText || !ocrText.trim()) {
                alert('No text could be extracted from the image.');
                statusEl.classList.add('d-none');
                return;
            }

            // Create Word Doc
            const ocrLines = ocrText.split('\n').filter(l => l.trim());
            const ocrChildren = ocrLines.map(line => new docx.Paragraph({
                children: [new docx.TextRun({ text: line, size: 24 })]
            }));

            const docSections = [{ children: ocrChildren }];

            const doc  = new docx.Document({ sections: docSections });
            const blob = await docx.Packer.toBlob(doc);
            progressEl.style.width = '100%';

            // Auto-download immediately
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            saveAs(blob, baseName + '.docx');

            // Also show download button as backup
            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, baseName + '.docx');
            }

        } catch (err) {
            console.error('Image to Word conversion error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to convert Image: ' + err.message);
        }
    }

    // Expose for archive pull
    window.convertImageToWord = convertImageToWord;

    const converterInput = document.getElementById('itwInput');
    if (converterInput) {
        converterInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) convertImageToWord(file);
        };
    }

    const dropZone = document.getElementById('itwDropZone');
    if (dropZone) {
        dropZone.onclick = () => document.getElementById('itwInput').click();

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary)';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                convertImageToWord(file);
            } else {
                alert('Please drop a valid image file.');
            }
        });
    }
});
