<<<<<<< Updated upstream
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
=======
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const btnUploadItw = document.getElementById('btnUploadImageToWord');
    const itwFileInput = document.getElementById('itwFileInput');
    const itwEmptyState = document.getElementById('itwEmptyState');
    const itwWorkspace = document.getElementById('itwWorkspace');
    const itwPreview = document.getElementById('itwPreview');
    const btnConvertItw = document.getElementById('btnConvertImageToWord');
    const itwLangSelect = document.getElementById('itwLangSelect');
    
    const itwProgressWrapper = document.getElementById('itwProgressWrapper');
    const itwProgress = document.getElementById('itwProgress');
    const itwProgressText = document.getElementById('itwProgressText');

    let uploadedImages = []; // Store file objects

    if (btnUploadItw) {
        btnUploadItw.addEventListener('click', () => {
            itwFileInput.click();
        });
    }

    if (itwFileInput) {
        itwFileInput.addEventListener('change', handleImagesUpload);
    }

    if (btnConvertItw) {
        btnConvertItw.addEventListener('click', generateWordFromImages);
    }

    function handleImagesUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Append to existing images array
        uploadedImages = uploadedImages.concat(files);
        
        itwEmptyState.classList.add('d-none');
        itwWorkspace.classList.remove('d-none');
        
        renderImagePreviews();
        
        // Reset file input in case same files are selected again
        itwFileInput.value = "";
    }

    function renderImagePreviews() {
        itwPreview.innerHTML = '';
        
        uploadedImages.forEach((file, index) => {
            const reader = new FileReader();
            
            const previewItem = document.createElement('div');
            previewItem.style.cssText = 'background: #1e1e1e; padding: 10px; border-radius: 6px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; display: flex; flex-direction: column; align-items: center;';
            
            const img = document.createElement('img');
            img.style.cssText = 'max-width: 100%; height: 120px; object-fit: contain; border-radius: 4px; background: #2a2a2a; margin-bottom: 8px;';
            
            const label = document.createElement('span');
            label.style.cssText = 'font-size: 0.8rem; color: #aaa; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; display: block;';
            label.textContent = file.name;
            
            const btnRemove = document.createElement('button');
            btnRemove.innerHTML = '&times;';
            btnRemove.title = "Remove image";
            btnRemove.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;';
            btnRemove.onclick = () => {
                uploadedImages.splice(index, 1);
                if (uploadedImages.length === 0) {
                    itwEmptyState.classList.remove('d-none');
                    itwWorkspace.classList.add('d-none');
                } else {
                    renderImagePreviews();
                }
            };
            
            previewItem.appendChild(img);
            previewItem.appendChild(label);
            previewItem.appendChild(btnRemove);
            itwPreview.appendChild(previewItem);
            
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function generateWordFromImages() {
        if (uploadedImages.length === 0) return;

        const lang = itwLangSelect.value;
        const originalBtnHtml = btnConvertItw.innerHTML;
        
        btnConvertItw.innerHTML = '<i class="bi bi-arrow-repeat spin" style="display:inline-block; animation: spin 2s linear infinite;"></i> Processing...';
        btnConvertItw.disabled = true;
        
        itwProgressWrapper.classList.remove('d-none');
        itwProgress.style.width = '0%';
        itwProgressText.textContent = 'Initializing OCR Engine...';

        try {
            let fullText = "";
            
            for (let i = 0; i < uploadedImages.length; i++) {
                const file = uploadedImages[i];
                itwProgressText.textContent = `Processing image ${i + 1} of ${uploadedImages.length}...`;
                
                // OCR Process
                const { data: { text } } = await Tesseract.recognize(
                    file,
                    lang,
                    { 
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                const baseProgress = (i / uploadedImages.length) * 100;
                                const currentProgress = m.progress * (100 / uploadedImages.length);
                                itwProgress.style.width = `${baseProgress + currentProgress}%`;
                            }
                        }
                    }
                );
                
                fullText += text + "\n\n--- Page Break ---\n\n";
            }
            
            itwProgressText.textContent = 'Generating Word Document...';
            itwProgress.style.width = '100%';

            // Create Word Document using docx
            const { Document, Packer, Paragraph, TextRun } = docx;

            const paragraphs = fullText.split('\n').map(line => {
                return new Paragraph({
                    children: [new TextRun(line)],
                });
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs,
                }],
            });

            const blob = await Packer.toBlob(doc);
            
            const finalName = uploadedImages.length === 1 
                ? `${uploadedImages[0].name.replace(/\.[^/.]+$/, "")}_converted.docx`
                : 'images_to_word.docx';
                
            window.saveAs(blob, finalName);
            
            setTimeout(() => {
                itwProgressWrapper.classList.add('d-none');
            }, 3000);

        } catch (error) {
            console.error("Error creating Word document:", error);
            alert("An error occurred while generating the Word document. Check console for details.");
            itwProgressWrapper.classList.add('d-none');
        } finally {
            btnConvertItw.innerHTML = originalBtnHtml;
            btnConvertItw.disabled = false;
        }
    }
>>>>>>> Stashed changes
});
