document.addEventListener('DOMContentLoaded', () => {
    async function convertToWord(file) {
        const statusEl    = document.getElementById('conversionStatus');
        const progressEl  = document.getElementById('convProgress');
        const nameDisplay = document.getElementById('fileNameDisplay');

        if (!file || (!file.name.toLowerCase().endsWith('.pdf'))) {
            alert('Please select a PDF file.');
            return;
        }

        if (typeof docx === 'undefined') {
            alert('DOCX library not loaded. Please refresh the page.');
            return;
        }

        nameDisplay.textContent = file.name;
        statusEl.classList.remove('d-none');
        progressEl.style.width = '10%';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            if (pdf.numPages === 0) {
                alert('This PDF has no pages.');
                return;
            }
            
            const docSections = [];
            const btnDownloadWord = document.getElementById('btnDownloadWord');
            const tesseractReady = typeof Tesseract !== 'undefined';
            
            if (!tesseractReady) {
                console.warn('Tesseract OCR not loaded. Image-based PDFs may not convert properly.');
            }
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const lines = {};

                content.items.forEach(item => {
                    if (!item.str || !item.str.trim()) return;
                    const y = Math.round(item.transform[5]);
                    if (!lines[y]) lines[y] = [];
                    lines[y].push(item);
                });

                const sortedY = Object.keys(lines).sort((a, b) => b - a);
                
                let pageChildren = [];
                
                if (sortedY.length > 0) {
                    pageChildren = sortedY.map(y => {
                        const lineText = lines[y]
                            .sort((a, b) => a.transform[4] - b.transform[4])
                            .map(it => it.str).join(' ');
                        return new docx.Paragraph({ 
                            children: [new docx.TextRun({
                                text: lineText,
                                size: 24
                            })]
                        });
                    });
                } else if (tesseractReady) {
                    const viewport = await page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    await page.render({
                        canvasContext: ctx,
                        viewport: viewport
                    }).promise;
                    
                    const imageData = canvas.toDataURL('image/png');
                    
                    try {
                        const result = await Tesseract.recognize(imageData, 'eng', {
                            logger: m => console.log(m)
                        });
                        
                        const ocrText = result.data.text;
                        const textLines = ocrText.split('\n').filter(line => line.trim());
                        
                        pageChildren = textLines.map(line => new docx.Paragraph({
                            children: [new docx.TextRun({
                                text: line,
                                size: 24
                            })]
                        }));
                    } catch (ocrErr) {
                        console.error('OCR failed for page', i, ocrErr);
                    }
                }
                
                if (pageChildren.length > 0) {
                    docSections.push({ children: pageChildren });
                } else {
                    docSections.push({ children: [new docx.Paragraph({ children: [] })] });
                }
                
                progressEl.style.width = `${10 + (i / pdf.numPages) * 75}%`;
            }

            if (docSections.length === 0) {
                alert('No text content found in PDF.');
                statusEl.classList.add('d-none');
                return;
            }

            const doc  = new docx.Document({ sections: docSections });
            const blob = await docx.Packer.toBlob(doc);
            progressEl.style.width = '100%';

            const baseName = file.name.replace(/\.pdf$/i, '') || file.name.replace('.pdf', '');
            const fileName = baseName + '.docx';
            
            btnDownloadWord.onclick = null;
            btnDownloadWord.onclick = () => {
                saveAs(blob, fileName);
            };
            
        } catch (err) {
            console.error('Conversion error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to convert PDF: ' + err.message);
        }
    }

    const converterInput = document.getElementById('converterInput');
    if (converterInput) {
        converterInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) convertToWord(file);
        };
    }

    const dropZone = document.getElementById('converterDropZone');
    if (dropZone) {
        dropZone.onclick = () => {
            document.getElementById('converterInput').click();
        };

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
            if (file && file.name.toLowerCase().endsWith('.pdf')) {
                convertToWord(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }
});