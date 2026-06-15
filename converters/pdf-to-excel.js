// Antigravity PDF - PDF to Excel Converter
document.addEventListener('DOMContentLoaded', () => {

    async function convertToExcel(file) {
        const statusEl    = document.getElementById('conversionStatusExcel');
        const progressEl  = document.getElementById('convProgressExcel');
        const nameDisplay = document.getElementById('fileNameDisplayExcel');
        const btnDownload = document.getElementById('btnDownloadExcel');

        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a PDF file.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('XLSX library not loaded. Please refresh the page.');
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
                statusEl.classList.add('d-none');
                return;
            }

            let combinedData = [];

            for (let pageIdx = 1; pageIdx <= pdf.numPages; pageIdx++) {
                progressEl.style.width = `${10 + ((pageIdx - 1) / pdf.numPages) * 70}%`;

                const page = await pdf.getPage(pageIdx);
                const content = await page.getTextContent();

                if (content.items.length > 0) {
                    // Group text items by Y position (within a tolerance, e.g., 8px)
                    const yTolerance = 8;
                    const rowsList = []; // Array of rows. Each row is { y: number, items: [...] }

                    content.items.forEach(item => {
                        if (!item.str || !item.str.trim()) return;
                        
                        const x = item.transform[4];
                        const y = item.transform[5];
                        const fontSize = Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]));
                        
                        // Find if there is an existing row within tolerance
                        let foundRow = rowsList.find(r => Math.abs(r.y - y) <= yTolerance);
                        const itemObj = { str: item.str, x, fontSize, width: item.width };
                        
                        if (foundRow) {
                            foundRow.items.push(itemObj);
                        } else {
                            rowsList.push({ y, items: [itemObj] });
                        }
                    });

                    // Sort rows vertically: PDF Y increases upwards, so sort in descending order (top to bottom)
                    rowsList.sort((a, b) => b.y - a.y);

                    // For each row: sort items horizontally (left to right) and split into columns
                    rowsList.forEach(row => {
                        row.items.sort((a, b) => a.x - b.x);

                        const rowCells = [];
                        let currentCellText = "";
                        let prevItem = null;

                        row.items.forEach(item => {
                            if (prevItem === null) {
                                currentCellText = item.str;
                            } else {
                                // Calculate distance from the end of the previous item to start of current item
                                const prevWidth = prevItem.width || (prevItem.str.length * prevItem.fontSize * 0.5);
                                const gap = item.x - (prevItem.x + prevWidth);

                                // If gap is large, treat as a new cell/column
                                if (gap > 20) {
                                    rowCells.push(currentCellText.trim());
                                    currentCellText = item.str;
                                } else {
                                    // Otherwise append to current cell
                                    currentCellText += " " + item.str;
                                }
                            }
                            prevItem = item;
                        });

                        if (currentCellText) {
                            rowCells.push(currentCellText.trim());
                        }

                        if (rowCells.length > 0) {
                            combinedData.push(rowCells);
                        }
                    });

                    // Add an empty row between pages
                    if (pageIdx < pdf.numPages) {
                        combinedData.push([]);
                    }
                }
            }

            progressEl.style.width = '90%';

            if (combinedData.length === 0) {
                alert('No content found in PDF.');
                statusEl.classList.add('d-none');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(combinedData);

            // Smart column width calculation
            const maxWidths = [];
            combinedData.forEach(row => {
                if (!row) return;
                row.forEach((cell, i) => {
                    const len = cell ? Math.min(cell.toString().length, 60) : 0;
                    maxWidths[i] = Math.max(maxWidths[i] || 8, len + 2);
                });
            });
            ws['!cols'] = maxWidths.map(w => ({ wch: Math.min(w, 70) }));

            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
            
            // Helper function to convert string to ArrayBuffer
            function s2ab(s) {
                const buf = new ArrayBuffer(s.length);
                const view = new Uint8Array(buf);
                for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
                return buf;
            }
            
            const blob = new Blob([s2ab(wbout)], {
                type: "application/octet-stream"
            });

            progressEl.style.width = '100%';

            // Auto-download immediately
            const baseName = file.name.replace(/\.pdf$/i, '');
            saveAs(blob, baseName + '.xlsx');

            // Also show download button as backup
            if (btnDownload) {
                btnDownload.style.display = 'block';
                btnDownload.onclick = () => saveAs(blob, baseName + '.xlsx');
            }

        } catch (err) {
            console.error('PDF to Excel conversion error:', err);
            statusEl.classList.add('d-none');
            alert('Failed to convert PDF: ' + err.message);
        }
    }

    // Expose globally
    window.convertToExcel = convertToExcel;

    // Set up event listeners
    const excelInput = document.getElementById('pdfExcelInput');
    if (excelInput) {
        excelInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) convertToExcel(file);
        };
    }

    const dropZone = document.getElementById('pdfExcelDropZone');
    if (dropZone) {
        dropZone.onclick = () => document.getElementById('pdfExcelInput').click();

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
                convertToExcel(file);
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }
});
