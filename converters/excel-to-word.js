// Antigravity PDF - Excel to Word Logic
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('e2wFileInput');
    const uploadBtn = document.getElementById('btnUploadExcelToWord');
    const convertBtn = document.getElementById('btnConvertExcelToWord');
    const workspace = document.getElementById('e2wWorkspace');
    const emptyState = document.getElementById('e2wEmptyState');
    const previewContainer = document.getElementById('e2wPreview');
    const orientationSelect = document.getElementById('e2wOrientation');
    const pageSizeSelect = document.getElementById('e2wPageSize');
    const areaSelectInput = document.getElementById('e2wAreaSelect');
    const showGridlinesInput = document.getElementById('e2wShowGridlines');

    let currentFile = null;
    let currentWorksheet = null;
    let currentWorkbook = null;
    let colsConfig = [];

    if (!fileInput) return;

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleExcelFile(file);
    });

    function getColName(n) {
        let s = "";
        while(n >= 0) {
            s = String.fromCharCode(n % 26 + 65) + s;
            n = Math.floor(n / 26) - 1;
        }
        return s;
    }

    function computeTrueRange(worksheet) {
        let max_r = 0, max_c = 0;
        let min_r = Infinity, min_c = Infinity;
        let hasData = false;
        
        for (let key in worksheet) {
            if (key[0] === '!') continue; 
            let cell = worksheet[key];
            if (cell.v === undefined && cell.w === undefined) continue;
            if (cell.v === '' && cell.w === '') continue;

            hasData = true;
            try {
                let addr = XLSX.utils.decode_cell(key);
                if (addr.r > max_r) max_r = addr.r;
                if (addr.c > max_c) max_c = addr.c;
                if (addr.r < min_r) min_r = addr.r;
                if (addr.c < min_c) min_c = addr.c;
            } catch(e) {}
        }
        
        if (!hasData) return { s: {r:0, c:0}, e: {r:0, c:0} };
        return { s: {r: min_r, c: min_c}, e: {r: max_r, c: max_c} };
    }

    function handleExcelFile(file) {
        currentFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            currentWorkbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = currentWorkbook.SheetNames[0];
            currentWorksheet = currentWorkbook.Sheets[firstSheetName];
            currentWorksheet['!true_range'] = computeTrueRange(currentWorksheet);
            colsConfig = currentWorksheet['!cols'] || [];
            
            renderTablePreview();

            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');
        };
        reader.readAsArrayBuffer(file);
    }

    function renderTablePreview() {
        if (!currentWorksheet) return;

        let range = currentWorksheet['!true_range'];

        let html = '<div style="margin-bottom: 5px; color: #ffeb3b; font-size: 13px;" id="e2wWarningNotice"></div>';
        html += '<table id="e2w-table-preview" style="width: max-content; border-collapse: collapse; background: #ffffff !important; color: #000000 !important; font-family: Calibri, Arial, sans-serif; user-select: none; table-layout: fixed;">';
        
        // Column Headers (A, B, C...)
        html += '<tr>';
        html += '<th style="background: #e6e6e6; border: 1px solid #c0c0c0; width: 40px; min-width: 40px; max-width: 40px; height: 25px; position: sticky; top: 0; left: 0; z-index: 3;"></th>';
        for (let C = range.s.c; C <= range.e.c; ++C) {
            let colWidth = colsConfig[C] ? colsConfig[C].wpx : 80;
            html += `<th style="background: #e6e6e6; border: 1px solid #c0c0c0; font-weight: normal; font-size: 13px; text-align: center; min-width: ${colWidth}px; max-width: ${colWidth}px; overflow: hidden; position: sticky; top: 0; z-index: 2;">${getColName(C)}</th>`;
        }
        html += '</tr>';

        // Data Rows with Row Number Headers
        for (let R = range.s.r; R <= range.e.r; ++R) {
            html += '<tr>';
            html += `<th style="background: #e6e6e6; border: 1px solid #c0c0c0; font-weight: normal; font-size: 13px; text-align: center; position: sticky; left: 0; z-index: 2;">${R + 1}</th>`;
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddr = XLSX.utils.encode_cell({c: C, r: R});
                const cell = currentWorksheet[cellAddr];
                let cellText = cell && cell.v !== undefined ? XLSX.utils.format_cell(cell) : '';
                cellText = cellText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                let colWidth = colsConfig[C] ? colsConfig[C].wpx : 80;
                html += `<td data-row="${R}" data-col="${C}" class="e2w-preview-cell" style="border: 1px solid #d4d4d4; padding: 2px 4px; min-width: ${colWidth}px; max-width: ${colWidth}px; font-size: 14px; overflow: hidden; white-space: nowrap; cursor: crosshair; transition: background 0.1s; vertical-align: bottom;">${cellText}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';

        previewContainer.innerHTML = html;
        previewContainer.style.background = '#d8d8d8';
        previewContainer.style.padding = '0px'; 
        previewContainer.style.overflow = 'auto'; 
        previewContainer.style.maxHeight = '600px'; 
        
        setupDragSelection();
        updateWordVisuals();
    }
    
    let isDragging = false;
    let dragStart = null;
    let dragEnd = null;

    function setupDragSelection() {
        const table = previewContainer.querySelector('table');
        if (!table) return;

        const handleCellEvents = (e) => {
            const td = e.target.closest('td.e2w-preview-cell');
            if (!td) return null;
            return { r: parseInt(td.dataset.row), c: parseInt(td.dataset.col) };
        };

        table.addEventListener('mousedown', (e) => {
            const coords = handleCellEvents(e);
            if (!coords) return;
            isDragging = true;
            dragStart = coords;
            dragEnd = coords;
            updateSelectionVisuals();
        });

        table.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const coords = handleCellEvents(e);
            if (!coords) return;
            dragEnd = coords;
            updateSelectionVisuals();
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                if (dragStart && dragEnd) {
                    const minC = Math.min(dragStart.c, dragEnd.c);
                    const minR = Math.min(dragStart.r, dragEnd.r);
                    const maxC = Math.max(dragStart.c, dragEnd.c);
                    const maxR = Math.max(dragStart.r, dragEnd.r);
                    areaSelectInput.value = XLSX.utils.encode_cell({c:minC, r:minR}) + ':' + XLSX.utils.encode_cell({c:maxC, r:maxR});
                }
            }
        });
        
        if (areaSelectInput) {
            areaSelectInput.addEventListener('input', () => {
                 try {
                    if(!areaSelectInput.value.trim()) {
                        dragStart = dragEnd = null;
                        updateSelectionVisuals();
                        return;
                    }
                    const pRange = XLSX.utils.decode_range(areaSelectInput.value.trim().toUpperCase());
                    dragStart = { r: pRange.s.r, c: pRange.s.c };
                    dragEnd = { r: pRange.e.r, c: pRange.e.c };
                    updateSelectionVisuals();
                 } catch(e) {}
            });
        }
    }

    function updateSelectionVisuals() {
        const cells = previewContainer.querySelectorAll('td.e2w-preview-cell');
        if (!dragStart || !dragEnd) {
            cells.forEach(td => {
                td.style.background = 'transparent';
                updateWordVisuals();
            });
            return;
        }

        const minR = Math.min(dragStart.r, dragEnd.r);
        const maxR = Math.max(dragStart.r, dragEnd.r);
        const minC = Math.min(dragStart.c, dragEnd.c);
        const maxC = Math.max(dragStart.c, dragEnd.c);

        cells.forEach(td => {
            const r = parseInt(td.dataset.row);
            const c = parseInt(td.dataset.col);
            if (r >= minR && r <= maxR && c >= minC && c <= maxC) {
                td.style.background = 'rgba(0, 212, 255, 0.25)'; // Word selection blue
            } else {
                td.style.background = 'transparent';
            }
        });
    }

    function updateWordVisuals() {
        const cells = previewContainer.querySelectorAll('td.e2w-preview-cell');
        cells.forEach(td => {
            td.style.borderRight = '1px solid #d4d4d4';
            td.style.borderBottom = '1px solid #d4d4d4';
        });

        const warningDiv = document.getElementById('e2wWarningNotice');

        if (pageSizeSelect && pageSizeSelect.value !== 'fit' && currentWorksheet) {
            const orientation = orientationSelect ? orientationSelect.value : 'portrait';
            // Word sizes approximately converted to Word pixel space
            // Assuming 8.5 x 11 inches at 96 PPI => 816 x 1056 px
            // A4: 8.27 x 11.69 inches => ~794 x 1122 px
            let effectiveW = 794;
            let effectiveH = 1122;

            if (pageSizeSelect.value === 'letter') {
                effectiveW = 816; effectiveH = 1056;
            } else if (pageSizeSelect.value === 'legal') {
                effectiveW = 816; effectiveH = 1344;
            }

            if (orientation === 'landscape') {
                let temp = effectiveW;
                effectiveW = effectiveH;
                effectiveH = temp;
            }

            // Margin deductions (default 1 inch = 96px)
            effectiveW -= 192; // 1" left + 1" right
            effectiveH -= 192; // 1" top + 1" bottom

            let curW = 40; 
            let rightBreakCols = new Set();
            let range = currentWorksheet['!true_range'];
            
            for (let C = range.s.c; C <= range.e.c; ++C) {
                let colWidth = colsConfig[C] ? colsConfig[C].wpx : 80;
                if (curW + colWidth > effectiveW && curW > 40) {
                    rightBreakCols.add(C - 1);
                    curW = 40; 
                }
                curW += colWidth;
            }

            let curH = 25; 
            let bottomBreakRows = new Set();
            for (let R = range.s.r; R <= range.e.r; ++R) {
                let rowH = 22; 
                if (curH + rowH > effectiveH && curH > 25) {
                    bottomBreakRows.add(R - 1);
                    curH = 25;
                }
                curH += rowH;
            }

            cells.forEach(td => {
                const r = parseInt(td.dataset.row);
                const c = parseInt(td.dataset.col);
                if (rightBreakCols.has(c)) td.style.borderRight = '2px dashed #005aff'; // Word Blue
                if (bottomBreakRows.has(r)) td.style.borderBottom = '2px dashed #005aff';
            });

            if (warningDiv) {
                warningDiv.innerHTML = '<i data-lucide="scissors" style="width: 14px; height: 14px;"></i> The blue dashed lines show the Word Document page bounds. Use "Fit to Data" if columns are cutting off!';
                if (window.lucide) lucide.createIcons();
            }
        } else {
            if (warningDiv) warningDiv.innerHTML = '';
        }
    }

    if (pageSizeSelect) pageSizeSelect.addEventListener('change', updateWordVisuals);
    if (orientationSelect) orientationSelect.addEventListener('change', updateWordVisuals);

    convertBtn.addEventListener('click', async () => {
        if (!currentWorksheet) return;

        convertBtn.disabled = true;
        const originalBtnText = convertBtn.innerHTML;
        convertBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Generating Word Document...';
        if (window.lucide) lucide.createIcons();

        try {
            let exportRangeStr = areaSelectInput.value.trim().toUpperCase();
            let exportRange;
            try {
                exportRange = exportRangeStr ? XLSX.utils.decode_range(exportRangeStr) : currentWorksheet['!true_range'];
            } catch(e) {
                exportRange = currentWorksheet['!true_range'];
            }

            const showGridlines = showGridlinesInput ? showGridlinesInput.checked : true;
            
            // Construct Document Setup for Page Bounds First
            const isLandscape = orientationSelect.value === 'landscape';
            const pageSz = pageSizeSelect.value;
            
            const mmToTwip = 56.6929;
            const inToTwip = 1440;
            
            // Default Twips size
            // Calculate exact Microsoft Word recognised standard twip sizes 
            // to ensure Word highlights 'A4' or 'Letter' in the layout menu natively.
            if (pageSz === 'a4') {
                outWidth = 11906;
                outHeight = 16838;
            } else if (pageSz === 'letter') {
                outWidth = 12240;
                outHeight = 15840;
            } else if (pageSz === 'legal') {
                outWidth = 12240;
                outHeight = 20160;
            } else {
                // 'fit' layout default baseline
                outWidth = 11906;
                outHeight = 16838;
            }

            if (isLandscape && pageSz !== 'fit') {
                let temp = outWidth;
                outWidth = outHeight;
                outHeight = temp;
            }

            const marginLR = 720; // exactly 0.5 inch (1440 / 2)
            
            let rawTableTwips = 0;
            for (let C = exportRange.s.c; C <= exportRange.e.c; ++C) {
                let colW = colsConfig[C] ? colsConfig[C].wpx : 80;
                rawTableTwips += (colW * 15);
            }

            let availableWidthTwips = outWidth - (marginLR * 2);
            let scaleFactor = 1.0;

            if (pageSz !== 'fit' && rawTableTwips > availableWidthTwips) {
                scaleFactor = availableWidthTwips / rawTableTwips;
            } else if (pageSz === 'fit') {
                // Only expand Document Bounds if user explicitly selected "Fit to Data"
                outWidth = Math.max(outWidth, rawTableTwips + (marginLR * 2));
                availableWidthTwips = rawTableTwips;
                if (isLandscape && outWidth < outHeight) {
                    let temp = outWidth; outWidth = outHeight; outHeight = temp;
                }
            }

            const tableRows = [];
            
            // Microsoft Word table column limit is strictly 63.
            if (exportRange.e.c - exportRange.s.c + 1 > 63) {
                 alert('Warning: Word limits tables to 63 columns. Truncating to 63 columns to prevent corruption.');
                 exportRange.e.c = exportRange.s.c + 62;
            }

            // Word cell margins defaults
            let baseMarginTB = 60;
            let baseMarginLR = 80;
            
            // Automatically scale interior margins so they don't consume the A4 page size
            let scaledMarginTB = Math.floor(baseMarginTB * scaleFactor);
            let scaledMarginLR = Math.floor(baseMarginLR * scaleFactor);

            // Compute ideal Font Size. Down to size 6 (3pt font) to ensure it doesn't wrap!
            let fontSize = Math.max(6, Math.round(24 * scaleFactor));

            for (let R = exportRange.s.r; R <= exportRange.e.r; ++R) {
                const rowCells = [];
                for (let C = exportRange.s.c; C <= exportRange.e.c; ++C) {
                    const cellAddr = XLSX.utils.encode_cell({c: C, r: R});
                    const cell = currentWorksheet[cellAddr];
                    let cellText = cell && cell.v !== undefined ? XLSX.utils.format_cell(cell) : '';
                    let strText = String(cellText); 
                    if (strText === "") strText = " "; 

                    const cellParams = {
                        children: [new docx.Paragraph({ 
                            children: [ new docx.TextRun({ text: strText, size: fontSize }) ],
                            // Prevent paragraph spacing from pushing boundaries
                            spacing: { before: 0, after: 0, line: 240, lineRule: docx.LineRuleType.AUTO }
                        })],
                        // Let Word AUTOFIT compute the precise width based on text
                        margins: { top: scaledMarginTB, bottom: scaledMarginTB, left: scaledMarginLR, right: scaledMarginLR }
                    };

                    if (!showGridlines) {
                        cellParams.borders = {
                            top: { style: docx.BorderStyle.NONE, size: 0, color: "auto" },
                            bottom: { style: docx.BorderStyle.NONE, size: 0, color: "auto" },
                            left: { style: docx.BorderStyle.NONE, size: 0, color: "auto" },
                            right: { style: docx.BorderStyle.NONE, size: 0, color: "auto" },
                        };
                    } else {
                        cellParams.borders = {
                            top: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" },
                        };
                    }
                    rowCells.push(new docx.TableCell(cellParams));
                }
                tableRows.push(new docx.TableRow({ children: rowCells }));
            }

            // Word AUTOFIT Engine combined with 100% width cleanly prevents bleed-out
            const tableParams = { 
                rows: tableRows, 
                width: { size: 100, type: docx.WidthType.PERCENTAGE },
                layout: docx.TableLayoutType.AUTOFIT
            };
            
            if (!showGridlines) {
                tableParams.borders = {
                    top: { style: docx.BorderStyle.NONE },
                    bottom: { style: docx.BorderStyle.NONE },
                    left: { style: docx.BorderStyle.NONE },
                    right: { style: docx.BorderStyle.NONE },
                    insideHorizontal: { style: docx.BorderStyle.NONE },
                    insideVertical: { style: docx.BorderStyle.NONE },
                };
            }

            const docTable = new docx.Table(tableParams);

            const sectionProps = {
                properties: {
                    page: {
                        size: {
                            width: outWidth,
                            height: outHeight,
                            orientation: isLandscape ? docx.PageOrientation.LANDSCAPE : docx.PageOrientation.PORTRAIT,
                        },
                        margin: {
                            top: 0.5 * inToTwip, right: 0.5 * inToTwip, bottom: 0.5 * inToTwip, left: 0.5 * inToTwip
                        }
                    }
                },
                children: [
                    new docx.Paragraph({
                        text: `Exported Table from ${currentFile.name}`,
                        heading: docx.HeadingLevel.HEADING_2,
                        spacing: { after: 200 }
                    }),
                    docTable
                ],
            };

            const doc = new docx.Document({ sections: [sectionProps] });

            const blob = await docx.Packer.toBlob(doc);
            
            const outName = currentFile.name.replace(/\.[^/.]+$/, "") + '_Word.docx';
            saveAs(blob, outName);

        } catch (err) {
            console.error('Error in Excel to Word:', err);
            alert('Failed to generate Word document: ' + err.message);
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = originalBtnText;
            if (window.lucide) lucide.createIcons();
        }
    });

    // Dropzone logic
    if (emptyState) {
        emptyState.addEventListener('click', () => fileInput.click());
        emptyState.addEventListener('dragover', (e) => {
            e.preventDefault();
            emptyState.style.borderColor = 'var(--primary)';
        });
        emptyState.addEventListener('dragleave', () => emptyState.style.borderColor = '');
        emptyState.addEventListener('drop', (e) => {
            e.preventDefault();
            emptyState.style.borderColor = '';
            if (e.dataTransfer.files[0]) handleExcelFile(e.dataTransfer.files[0]);
        });
    }
});
