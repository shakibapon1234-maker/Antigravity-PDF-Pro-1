document.addEventListener('DOMContentLoaded', () => {
    const { PDFDocument } = window.PDFLib;
    
    let splitPdfFile = null;
    let splitPdfDoc = null;
    let splitTotalPages = 0;
    let selectedPageNumbers = new Set();

    const btnUploadSplit = document.getElementById('btnUploadSplit');
    if (btnUploadSplit) {
        btnUploadSplit.onclick = () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.pdf';
            inp.style.display = 'none';
            document.body.appendChild(inp);
            inp.onchange = (e) => {
                const file = e.target.files[0];
                if (file) loadSplitPdf(file);
                document.body.removeChild(inp);
                inp.value = '';
            };
            inp.click();
        };
    }

    async function loadSplitPdf(file) {
        try {
            splitPdfFile = file;
            const arrayBuffer = await file.arrayBuffer();
            splitPdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            splitTotalPages = splitPdfDoc.getPageCount();
            
            document.getElementById('splitEmptyState').classList.add('d-none');
            document.getElementById('splitWorkspace').classList.remove('d-none');
            
            renderSplitPreview();
        } catch (err) {
            alert('Failed to load PDF: ' + err.message);
        }
    }

    function renderSplitPreview() {
        const previewContainer = document.getElementById('splitPreview');
        const pageItems = [];
        
        for (let i = 1; i <= splitTotalPages; i++) {
            const isSelected = selectedPageNumbers.has(i);
            pageItems.push(`
                <div class="split-page-item ${isSelected ? 'selected' : ''}" data-page="${i}">
                    <div class="page-number">${i}</div>
                    <div class="page-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.togglePageSelection(${i})">
                    </div>
                </div>
            `);
        }
        
        if (previewContainer) {
            previewContainer.innerHTML = pageItems.join('');
        }
        updateSelectedPagesDisplay();
    }

    window.togglePageSelection = function(pageNum) {
        if (selectedPageNumbers.has(pageNum)) {
            selectedPageNumbers.delete(pageNum);
        } else {
            selectedPageNumbers.add(pageNum);
        }
        renderSplitPreview();
    };

    function updateSelectedPagesDisplay() {
        const display = document.getElementById('selectedPagesDisplay');
        if (!display) return;
        
        const count = selectedPageNumbers.size;
        
        if (count === 0) {
            display.querySelector('span').textContent = 'Selected: None';
        } else {
            const sortedPages = Array.from(selectedPageNumbers).sort((a, b) => a - b);
            const pageText = formatPageRange(sortedPages);
            display.querySelector('span').textContent = `Selected: ${count} page(s) (${pageText})`;
        }
    }

    function formatPageRange(pages) {
        if (pages.length === 0) return '';
        if (pages.length === 1) return pages[0].toString();
        
        let ranges = [];
        let start = pages[0];
        let end = pages[0];
        
        for (let i = 1; i < pages.length; i++) {
            if (pages[i] === end + 1) {
                end = pages[i];
            } else {
                ranges.push(start === end ? start.toString() : `${start}-${end}`);
                start = pages[i];
                end = pages[i];
            }
        }
        ranges.push(start === end ? start.toString() : `${start}-${end}`);
        
        return ranges.join(', ');
    }

    const pageRangeInput = document.getElementById('pageRangeInput');
    if (pageRangeInput) {
        pageRangeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btnSelectRange').click();
            }
        });
        
        pageRangeInput.addEventListener('change', () => {
            const input = pageRangeInput.value.trim();
            if (!input) return;
            
            const pages = parsePageRange(input);
            if (pages.length > 0) {
                pages.forEach(p => {
                    if (p >= 1 && p <= splitTotalPages) {
                        selectedPageNumbers.add(p);
                    }
                });
                renderSplitPreview();
            }
        });
    }

    const btnSelectRange = document.getElementById('btnSelectRange');
    if (btnSelectRange) {
        btnSelectRange.onclick = () => {
            const input = document.getElementById('pageRangeInput').value.trim();
            if (!input) return;
            
            const pages = parsePageRange(input);
            if (pages.length === 0) {
                alert('Invalid page range. Use format: 1-3, 5, 7-10');
                return;
            }
            
            pages.forEach(p => {
                if (p >= 1 && p <= splitTotalPages) {
                    selectedPageNumbers.add(p);
                }
            });
            
            renderSplitPreview();
            document.getElementById('pageRangeInput').value = '';
        };
    }

    function parsePageRange(input) {
        const sanitized = input.replace(/[^0-9\-,\s]/g, '');
        const pages = new Set();
        const parts = sanitized.split(',');
        
        parts.forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        pages.add(i);
                    }
                }
            } else {
                const p = parseInt(part);
                if (!isNaN(p)) {
                    pages.add(p);
                }
            }
        });
        
        return Array.from(pages);
    }

    const btnSelectAllSplit = document.getElementById('btnSelectAllSplit');
    if (btnSelectAllSplit) {
        btnSelectAllSplit.onclick = () => {
            for (let i = 1; i <= splitTotalPages; i++) {
                selectedPageNumbers.add(i);
            }
            renderSplitPreview();
        };
    }

    const btnClearSelectionSplit = document.getElementById('btnClearSelectionSplit');
    if (btnClearSelectionSplit) {
        btnClearSelectionSplit.onclick = () => {
            selectedPageNumbers.clear();
            renderSplitPreview();
        };
    }

    const btnDownloadSplit = document.getElementById('btnDownloadSplit');
    if (btnDownloadSplit) {
        btnDownloadSplit.onclick = async () => {
            if (pageRangeInput && pageRangeInput.value.trim()) {
                const input = pageRangeInput.value.trim();
                const pages = parsePageRange(input);
                if (pages.length === 0) {
                    alert('Invalid page range. Use format: 1-3, 5, 7-10');
                    return;
                }
                pages.forEach(p => {
                    if (p >= 1 && p <= splitTotalPages) {
                        selectedPageNumbers.add(p);
                    }
                });
                renderSplitPreview();
            }
            
            if (selectedPageNumbers.size === 0) {
                alert('Please select at least one page.');
                return;
            }
            
            if (!splitPdfDoc) {
                alert('No PDF file loaded.');
                return;
            }
            
            try {
                const splitModeNode = document.querySelector('input[name="splitMode"]:checked');
                const splitMode = splitModeNode ? splitModeNode.value : 'extract';
                const newPdf = await PDFDocument.create();
                
                const pageIndices = Array.from(selectedPageNumbers).map(n => n - 1);
                
                if (splitMode === 'extract') {
                    const copiedPages = await newPdf.copyPages(splitPdfDoc, pageIndices);
                    copiedPages.forEach(page => newPdf.addPage(page));
                } else {
                    const allIndices = Array.from({ length: splitTotalPages }, (_, i) => i);
                    const removeIndices = pageIndices;
                    const keepIndices = allIndices.filter(i => !removeIndices.includes(i));
                    const copiedPages = await newPdf.copyPages(splitPdfDoc, keepIndices);
                    copiedPages.forEach(page => newPdf.addPage(page));
                }
                
                const pdfBytes = await newPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                
                const baseName = splitPdfFile.name.replace('.pdf', '');
                window.saveAs(blob, `${baseName}_split.pdf`);
                if (window.AGProgress) AGProgress.done();
                if (window.AGToast) AGToast.success('✓ Split সম্পন্ন! ফাইল ডাউনলোড হয়েছে।');
                
            } catch (err) {
                console.error(err);
                if (window.AGProgress) AGProgress.error();
                if (window.AGToast) AGToast.error('Split ব্যর্থ: ' + err.message);
                else alert('Failed to split PDF: ' + err.message);
            }
        };
    }
});
