// Antigravity PDF - PDF to Word Converter (FIXED: Smart heading/body detection + auto-download)
document.addEventListener('DOMContentLoaded', () => {

    async function convertToWord(file) {
        const statusEl    = document.getElementById('conversionStatus');
        const progressEl  = document.getElementById('convProgress');
        const nameDisplay = document.getElementById('fileNameDisplay');
        const btnDownload = document.getElementById('btnDownloadWord');

        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
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
        if (btnDownload) btnDownload.style.display = 'none';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            if (pdf.numPages === 0) {
                alert('This PDF has no pages.');
                return;
            }

            const docSections = [];
            const tesseractReady = typeof Tesseract !== 'undefined';

            for (let pageIdx = 1; pageIdx <= pdf.numPages; pageIdx++) {
                progressEl.style.width = `${10 + ((pageIdx - 1) / pdf.numPages) * 70}%`;

                const page = await pdf.getPage(pageIdx);
                const content = await page.getTextContent();

                if (content.items.length > 0) {
                    // Group text items by Y position (same line = same Y within tolerance)
                    const lineMap = {};
                    let allFontSizes = [];

                    content.items.forEach(item => {
                        if (!item.str || !item.str.trim()) return;
                        // font size from transform matrix: scale = sqrt(a²+b²)
                        const a = item.transform[0];
                        const b = item.transform[1];
                        const fontSize = Math.round(Math.sqrt(a * a + b * b));
                        const y = Math.round(item.transform[5]);

                        if (!lineMap[y]) lineMap[y] = [];
                        lineMap[y].push({ str: item.str, x: item.transform[4], fontSize, fontName: item.fontName || '' });
                        allFontSizes.push(fontSize);
                    });

                    // Find median font size to distinguish headings from body
                    allFontSizes.sort((a, b) => a - b);
                    const medianSize = allFontSizes[Math.floor(allFontSizes.length / 2)] || 12;
                    const h1Threshold = medianSize * 1.8;
                    const h2Threshold = medianSize * 1.4;

                    // Sort lines top-to-bottom (PDF y=0 is bottom, so desc order)
                    const sortedY = Object.keys(lineMap).sort((a, b) => b - a);

                    const pageChildren = [];

                    sortedY.forEach(y => {
                        const items = lineMap[y].sort((a, b) => a.x - b.x);
                        const lineText = items.map(it => it.str).join(' ').trim();
                        if (!lineText) return;

                        // Determine max font size on this line
                        const maxFontSize = Math.max(...items.map(it => it.fontSize));
                        const isBold = items.some(it => it.fontName && it.fontName.toLowerCase().includes('bold'));

                        let paragraph;

                        if (maxFontSize >= h1Threshold) {
                            // Heading 1
                            paragraph = new docx.Paragraph({
                                heading: docx.HeadingLevel.HEADING_1,
                                children: [new docx.TextRun({
                                    text: lineText,
                                    bold: true,
                                    size: Math.min(Math.round(maxFontSize * 2), 72),
                                })]
                            });
                        } else if (maxFontSize >= h2Threshold || (isBold && maxFontSize > medianSize)) {
                            // Heading 2
                            paragraph = new docx.Paragraph({
                                heading: docx.HeadingLevel.HEADING_2,
                                children: [new docx.TextRun({
                                    text: lineText,
                                    bold: true,
                                    size: Math.min(Math.round(maxFontSize * 2), 56),
                                })]
                            });
                        } else {
                            // Body paragraph
                            paragraph = new docx.Paragraph({
                                children: [new docx.TextRun({
                                    text: lineText,
                                    bold: isBold,
                                    size: Math.max(Math.round(medianSize * 2), 20),
                                })]
                            });
                        }

                        pageChildren.push(paragraph);
                    });

                    // Add page break between pages (except last)
                    if (pageIdx < pdf.numPages && pageChildren.length > 0) {
                        pageChildren.push(new docx.Paragraph({
                            children: [],
                            pageBreakBefore: true,
                        }));
                    }

                    if (pageChildren.length > 0) {
                        docSections.push({ children: pageChildren });
                    }

                } else if (tesseractReady) {
                    // Image-based page — use OCR
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    // Fill white background to support transparent PDF pages and optimize for OCR
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    const imageData = canvas.toDataURL('image/png');

                    try {
                        const result = await Tesseract.recognize(imageData, 'eng+ben', {
                            logger: () => {}
                        });
                        const ocrLines = result.data.text.split('\n').filter(l => l.trim());
                        const ocrChildren = ocrLines.map(line => new docx.Paragraph({
                            children: [new docx.TextRun({ text: line, size: 24 })]
                        }));
                        if (ocrChildren.length > 0) docSections.push({ children: ocrChildren });
                    } catch (ocrErr) {
                        console.warn('OCR failed for page', pageIdx, ocrErr);
                        docSections.push({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: '[Image page — OCR failed]', italics: true, size: 24 })] })] });
                    }
                } else {
                    docSections.push({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: '[Image page — no text found]', italics: true, size: 24 })] })] });
                }
            }

            progressEl.style.width = '90%';

            if (docSections.length === 0) {
                alert('No content found in PDF.');
                statusEl.classList.add('d-none');
                return;
            }

            const doc  = new docx.Document({ sections: docSections });
            const blob = await docx.Packer.toBlob(doc);
            progressEl.style.width = '100%';

            // Auto-download immediately
            const baseName = file.name.replace(/\.pdf$/i, '');
            saveAs(blob, baseName + '.docx');

            // Also show download button as backup
            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, baseName + '.docx');
            }

        } catch (err) {
            console.error('PDF to Word conversion error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to convert PDF: ' + err.message);
        }
    }

    // Expose for archive pull
    window.convertToWord = convertToWord;

    const converterInput = document.getElementById('converterInput');
    if (converterInput) {
        converterInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) convertToWord(file);
        };
    }

    const dropZone = document.getElementById('converterDropZone');
    if (dropZone) {
        dropZone.onclick = () => document.getElementById('converterInput').click();

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