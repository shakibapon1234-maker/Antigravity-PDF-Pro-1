// Antigravity PDF - Excel to PDF Logic
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('excelFileInput');
    const uploadBtn = document.getElementById('btnUploadExcel');
    const convertBtn = document.getElementById('btnConvertExcelToPdf');
    const workspace = document.getElementById('excelWorkspace');
    const emptyState = document.getElementById('excelEmptyState');
    const previewContainer = document.getElementById('excelPreview');
    const orientationSelect = document.getElementById('excelOrientation');
    const pageSizeSelect = document.getElementById('excelPageSize');
    const areaSelectInput = document.getElementById('excelAreaSelect');
    const showGridlinesInput = document.getElementById('excelShowGridlines');

    let currentFile = null;
    let currentWorksheet = null;
    let currentWorkbook = null;
    let colsConfig = [];

    // Make Fit to Data default to avoid unintentional truncation
    if(pageSizeSelect) pageSizeSelect.value = 'fit';

    if (!fileInput) return;

    window.loadExcelToPdf = function(file) {
        if (!file) return;
        handleExcelFile(file);
    };

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

        // Build HTML Table looking exactly like Excel (with headers A,B,C and 1,2,3)
        let html = '<div style="margin-bottom: 5px; color: #ffeb3b; font-size: 13px;" id="a4WarningNotice"></div>';
        html += '<table id="excel-table-preview" style="width: max-content; border-collapse: collapse; background: #ffffff !important; color: #000000 !important; font-family: Calibri, Arial, sans-serif; user-select: none; table-layout: fixed;">';
        
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
                // Strict widths like Excel to fix huge columns
                html += `<td data-row="${R}" data-col="${C}" class="excel-preview-cell" style="border: 1px solid #d4d4d4; padding: 2px 4px; min-width: ${colWidth}px; max-width: ${colWidth}px; font-size: 14px; overflow: hidden; white-space: nowrap; cursor: crosshair; transition: background 0.1s; vertical-align: bottom;">${cellText}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';

        previewContainer.innerHTML = html;
        
        // Remove dark mode constraints
        previewContainer.style.background = '#d8d8d8';
        previewContainer.style.padding = '0px'; // Sticky headers need 0 padding container
        previewContainer.style.overflow = 'auto'; // allow horizontal scrolling
        previewContainer.style.maxHeight = '600px'; 
        
        setupDragSelection();
        updateA4Visuals();
    }
    
    let isDragging = false;
    let dragStart = null;
    let dragEnd = null;

    function setupDragSelection() {
        const table = previewContainer.querySelector('table');
        if (!table) return;

        const handleCellEvents = (e) => {
            const td = e.target.closest('td.excel-preview-cell');
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
        const cells = previewContainer.querySelectorAll('td.excel-preview-cell');
        if (!dragStart || !dragEnd) {
            cells.forEach(td => {
                td.style.background = 'transparent';
                // Reset right and bottom borders in case A4 guide is there
                updateA4Visuals();
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
                td.style.background = 'rgba(0, 120, 215, 0.2)'; // Excel selection blue
                // Do not override dashed borders if A4 is active, keep background highlight
            } else {
                td.style.background = 'transparent';
            }
        });
    }

    function updateA4Visuals() {
        const cells = previewContainer.querySelectorAll('td.excel-preview-cell');
        // Clear old A4 boundaries
        cells.forEach(td => {
            td.style.borderRight = '1px solid #d4d4d4';
            td.style.borderBottom = '1px solid #d4d4d4';
        });

        const warningDiv = document.getElementById('a4WarningNotice');

        if (pageSizeSelect && pageSizeSelect.value !== 'fit' && currentWorksheet) {
            const orientation = orientationSelect ? orientationSelect.value : 'portrait';
            // standard A4 at 96 DPI, minus 10mm margins
            const effectiveW = orientation === 'portrait' ? 719 : 1048; 
            const effectiveH = orientation === 'portrait' ? 1048 : 719;

            let curW = 40; // Row header width
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

            let curH = 25; // Col header height
            let bottomBreakRows = new Set();
            for (let R = range.s.r; R <= range.e.r; ++R) {
                let rowH = 22; // Approx row height
                if (curH + rowH > effectiveH && curH > 25) {
                    bottomBreakRows.add(R - 1);
                    curH = 25;
                }
                curH += rowH;
            }

            cells.forEach(td => {
                const r = parseInt(td.dataset.row);
                const c = parseInt(td.dataset.col);
                if (rightBreakCols.has(c)) td.style.borderRight = '2px dashed red';
                if (bottomBreakRows.has(r)) td.style.borderBottom = '2px dashed red';
            });

            if (warningDiv) {
                warningDiv.innerHTML = '<i data-lucide="scissors" style="width: 14px; height: 14px;"></i> The red dashed lines show exactly what fits on one A4 page. (For large sheets, use Fit to Data!)';
                if (window.lucide) lucide.createIcons();
            }
        } else {
            if (warningDiv) warningDiv.innerHTML = '';
        }
    }

    if (pageSizeSelect) pageSizeSelect.addEventListener('change', updateA4Visuals);
    if (orientationSelect) orientationSelect.addEventListener('change', updateA4Visuals);

    convertBtn.addEventListener('click', async () => {
        if (!currentWorksheet) return;

        convertBtn.disabled = true;
        convertBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Converting...';
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
            const pdfBorderStyle = showGridlines ? '1px dotted #a0a0a0' : 'none';

            // Construct secure raw HTML String - Solves blank crashes globally
            let pdfHtml = `
            <div style="background: #ffffff; padding: 20px; width: max-content;">
                <table style="border-collapse: collapse; width: max-content; font-family: Calibri, Arial, sans-serif; color: #000000; font-size: 12px; table-layout: fixed;">
            `;

            // Include Headers (A, B, C...)
            pdfHtml += '<tr><th style="background: #f3f3f3; border: 1px solid #a0a0a0; width: 40px; height: 25px;"></th>';
            for (let C = exportRange.s.c; C <= exportRange.e.c; ++C) {
                let colWidth = colsConfig[C] ? colsConfig[C].wpx : 80;
                pdfHtml += `<th style="background: #f3f3f3; border: 1px solid #a0a0a0; font-weight: bold; min-width: ${colWidth}px; max-width: ${colWidth}px;">${getColName(C)}</th>`;
            }
            pdfHtml += '</tr>';
            
            for (let R = exportRange.s.r; R <= exportRange.e.r; ++R) {
                pdfHtml += '<tr>';
                // Row Number Header
                pdfHtml += `<th style="background: #f3f3f3; border: 1px solid #a0a0a0; font-weight: bold; padding: 2px;">${R + 1}</th>`;
                
                for (let C = exportRange.s.c; C <= exportRange.e.c; ++C) {
                    const cellAddr = XLSX.utils.encode_cell({c: C, r: R});
                    const cell = currentWorksheet[cellAddr];
                    let txt = cell && cell.v !== undefined ? XLSX.utils.format_cell(cell) : '';
                    let cleanTxt = txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    
                    let colWidth = colsConfig[C] ? colsConfig[C].wpx : 80;
                    pdfHtml += `<td style="border: ${pdfBorderStyle}; padding: 3px 5px; min-width: ${colWidth}px; max-width: ${colWidth}px; overflow: hidden; white-space: nowrap; vertical-align: bottom;">${cleanTxt}</td>`;
                }
                pdfHtml += '</tr>';
            }
            
            pdfHtml += '</table></div>';

            const orientation = orientationSelect ? orientationSelect.value : 'portrait';
            const pageSize = pageSizeSelect ? pageSizeSelect.value : 'a4';
            
            let format = 'a4';
            if (pageSize === 'fit') {
                const pxToMm = 0.264583;
                let tableW = 40; // width of row headers
                for (let C = exportRange.s.c; C <= exportRange.e.c; ++C) tableW += (colsConfig[C] ? colsConfig[C].wpx : 80) + 12; // padding buffer
                let tableH = 25 + ((exportRange.e.r - exportRange.s.r + 1) * 22);

                const wMm = Math.max(210, tableW * pxToMm + 40);
                const hMm = Math.max(297, tableH * pxToMm + 40);
                format = [wMm, hMm];
            } else {
                format = pageSize;
            }

            const opt = {
                margin:        [10, 10, 10, 10],
                filename:      currentFile.name.replace(/\.[^/.]+$/, "") + '.pdf',
                image:         { type: 'jpeg', quality: 1.0 },
                html_canvas_options: { scale: 1.5, useCORS: true, logging: false },
                html2canvas:   { scale: 1.5, useCORS: true },
                jsPDF:         { unit: 'mm', format: format, orientation: orientation, compress: true }
            };

            // String mode avoids DOM bugs
            await html2pdf().set(opt).from(pdfHtml).save();

        } catch (err) {
            console.error(err);
            alert('Error converting Excel to PDF: ' + err.message);
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i data-lucide="file-check"></i> Convert & Download PDF';
            if (window.lucide) lucide.createIcons();
        }
    });
});
