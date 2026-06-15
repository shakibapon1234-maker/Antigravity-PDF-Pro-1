// Antigravity PDF - Smart Auto-Redaction Tool
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('redactInput');
    const dropZone = document.getElementById('redactDropZone');
    const configEl = document.getElementById('redactConfig');
    const statusEl = document.getElementById('conversionStatusRedact');
    const progressEl = document.getElementById('convProgressRedact');
    const nameDisplay = document.getElementById('fileNameDisplayRedact');
    const btnDownload = document.getElementById('btnDownloadRedact');
    const btnRunRedact = document.getElementById('btnRunRedact');

    let currentFile = null;
    let currentFileData = null;

    if (!fileInput) return;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleRedactFile(file);
    };

    if (dropZone) {
        dropZone.onclick = () => fileInput.click();

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
                handleRedactFile(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }

    async function handleRedactFile(file) {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        nameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function() {
            currentFileData = new Uint8Array(this.result);
            configEl.classList.remove('d-none');
            statusEl.classList.add('d-none');
            if (btnDownload) btnDownload.style.display = 'none';
        };
        reader.readAsArrayBuffer(file);
    }

    btnRunRedact.onclick = async () => {
        if (!currentFileData || !currentFile) return;

        if (typeof PDFLib === 'undefined' || typeof pdfjsLib === 'undefined') {
            alert('Required libraries are not fully loaded. Please refresh the page.');
            return;
        }

        const doEmail = document.getElementById('redactEmail').checked;
        const doPhone = document.getElementById('redactPhone').checked;
        const customText = document.getElementById('redactCustomText').value.trim();

        if (!doEmail && !doPhone && !customText) {
            alert('Please select at least one redaction option.');
            return;
        }

        configEl.classList.add('d-none');
        statusEl.classList.remove('d-none');
        progressEl.style.width = '10%';

        try {
            // Load file in pdf.js to scan coordinates
            const pdfJsDoc = await pdfjsLib.getDocument({ data: currentFileData }).promise;
            const numPages = pdfJsDoc.numPages;
            progressEl.style.width = '30%';

            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
            const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

            // Map of page index (0-indexed) -> array of boxes to redact { x, y, width, height }
            const redactionMap = {};

            for (let pageIdx = 1; pageIdx <= numPages; pageIdx++) {
                progressEl.style.width = `${30 + (pageIdx / numPages) * 30}%`;

                const page = await pdfJsDoc.getPage(pageIdx);
                const content = await page.getTextContent();

                if (content.items.length === 0) continue;

                let fullText = "";
                let itemRanges = []; // { startIdx, endIdx, item }

                content.items.forEach(item => {
                    const start = fullText.length;
                    fullText += item.str;
                    const end = fullText.length;
                    itemRanges.push({ start, end, item });
                });

                const matches = [];
                let match;

                if (doEmail) {
                    emailRegex.lastIndex = 0;
                    while ((match = emailRegex.exec(fullText)) !== null) {
                        matches.push({ start: match.index, end: match.index + match[0].length });
                    }
                }

                if (doPhone) {
                    phoneRegex.lastIndex = 0;
                    while ((match = phoneRegex.exec(fullText)) !== null) {
                        matches.push({ start: match.index, end: match.index + match[0].length });
                    }
                }

                if (customText) {
                    let startPos = 0;
                    while (true) {
                        const idx = fullText.toLowerCase().indexOf(customText.toLowerCase(), startPos);
                        if (idx === -1) break;
                        matches.push({ start: idx, end: idx + customText.length });
                        startPos = idx + customText.length;
                    }
                }

                const pageBoxes = [];

                matches.forEach(m => {
                    const overlappingItems = itemRanges.filter(r => {
                        return r.start < m.end && r.end > m.start;
                    });

                    overlappingItems.forEach(range => {
                        const item = range.item;
                        const x = item.transform[4];
                        const y = item.transform[5];
                        const fontSize = Math.round(Math.sqrt(item.transform[0]*item.transform[0] + item.transform[1]*item.transform[1]));
                        const width = item.width || (item.str.length * fontSize * 0.5);
                        const height = fontSize;

                        pageBoxes.push({
                            x,
                            y: y - 1.5,
                            width: width + 2,
                            height: height + 3
                        });
                    });
                });

                if (pageBoxes.length > 0) {
                    redactionMap[pageIdx - 1] = pageBoxes;
                }
            }

            progressEl.style.width = '65%';

            // Load in pdf-lib to apply solid black cover-ups
            const { PDFDocument, rgb } = PDFLib;
            const pdfDoc = await PDFDocument.load(currentFileData);
            const libPages = pdfDoc.getPages();
            
            let redactCount = 0;

            Object.keys(redactionMap).forEach(pIdx => {
                const boxes = redactionMap[pIdx];
                const page = libPages[parseInt(pIdx)];
                
                boxes.forEach(box => {
                    page.drawRectangle({
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height,
                        color: rgb(0, 0, 0) // Solid black
                    });
                    redactCount++;
                });
            });

            progressEl.style.width = '85%';
            const pdfBytes = await pdfDoc.save();
            progressEl.style.width = '95%';

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            progressEl.style.width = '100%';

            const baseName = currentFile.name.replace(/\.pdf$/i, '');
            const outputName = baseName + '_redacted.pdf';
            
            // Show alert of findings
            if (redactCount > 0) {
                alert(`Successfully scanned! Automatically redacted ${redactCount} sensitive items.`);
            } else {
                alert("No matches found for sensitive data. Downloaded copy remains unchanged.");
            }
            
            saveAs(blob, outputName);

            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, outputName);
            }

        } catch (err) {
            console.error('Auto Redaction error:', err);
            statusEl.classList.add('d-none');
            configEl.classList.remove('d-none');
            alert('Failed to redact PDF: ' + err.message);
        }
    };
});
