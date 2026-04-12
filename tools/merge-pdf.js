document.addEventListener('DOMContentLoaded', () => {
    const { PDFDocument } = window.PDFLib;
    
    let mergeFiles = [];

    const btnAddMergeFile = document.getElementById('btnAddMergeFile');
    if (btnAddMergeFile) {
        btnAddMergeFile.onclick = () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.pdf';
            inp.multiple = true;
            inp.style.display = 'none';
            document.body.appendChild(inp);
            inp.onchange = (e) => {
                handleMergeFiles(e.target.files);
                document.body.removeChild(inp);
                inp.value = '';
            };
            inp.click();
        };
    }

    function handleMergeFiles(files) {
        if (!files || files.length === 0) return;
        
        Array.from(files).forEach(file => {
            if (file.name.toLowerCase().endsWith('.pdf')) {
                mergeFiles.push(file);
            }
        });
        
        renderMergeFileList();
    }

    function renderMergeFileList() {
        const listContainer = document.getElementById('mergeFileList');
        const actionsContainer = document.getElementById('mergeActions');
        
        if (!listContainer || !actionsContainer) return;

        if (mergeFiles.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state-merge">
                    <i data-lucide="files" class="large-icon"></i>
                    <h3>No Files Added</h3>
                    <p>Add PDF files to merge them into one document</p>
                </div>
            `;
            actionsContainer.classList.add('d-none');
        } else {
            listContainer.innerHTML = mergeFiles.map((file, index) => `
                <div class="merge-file-item" data-index="${index}" draggable="true">
                    <i data-lucide="grip-vertical" class="drag-handle"></i>
                    <span class="file-order">${index + 1}</span>
                    <i data-lucide="file-text"></i>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button class="btn-remove-file" onclick="window.removeMergeFile(${index})">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `).join('');
            
            actionsContainer.classList.remove('d-none');
            
            setTimeout(() => initMergeDragReorder(), 100);
        }
        if (window.safeCreateIcons) window.safeCreateIcons();
    }

    window.removeMergeFile = function(index) {
        mergeFiles.splice(index, 1);
        renderMergeFileList();
    };

    const btnMergeFiles = document.getElementById('btnMergeFiles');
    if (btnMergeFiles) {
        btnMergeFiles.onclick = async () => {
            if (mergeFiles.length < 2) {
                alert('Please add at least 2 PDF files to merge.');
                return;
            }
            
            try {
                const mergedPdf = await PDFDocument.create();
                
                for (let i = 0; i < mergeFiles.length; i++) {
                    const file = mergeFiles[i];
                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach(page => mergedPdf.addPage(page));
                }
                
                const pdfBytes = await mergedPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                window.saveAs(blob, 'merged_document.pdf');
                
                mergeFiles = [];
                renderMergeFileList();
            } catch (err) {
                console.error(err);
                alert('Failed to merge PDFs: ' + err.message);
            }
        };
    }

    let draggedItem = null;
    let draggedIndex = null;

    function initMergeDragReorder() {
        const items = document.querySelectorAll('.merge-file-item');
        const listContainer = document.getElementById('mergeFileList');
        
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                draggedIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
            });
            
            item.addEventListener('dragend', (e) => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                }
                draggedItem = null;
                draggedIndex = null;
                updateMergeFileOrder();
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!draggedItem || draggedItem === item) return;
                
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (e.clientY < midY) {
                    listContainer.insertBefore(draggedItem, item);
                } else {
                    const next = item.nextSibling;
                    if (next) {
                        listContainer.insertBefore(draggedItem, next);
                    } else {
                        listContainer.appendChild(draggedItem);
                    }
                }
            });
        });
    }

    function updateMergeFileOrder() {
        const items = document.querySelectorAll('.merge-file-item');
        const newOrder = [];
        
        items.forEach((item, index) => {
            const origIndex = parseInt(item.dataset.index);
            newOrder.push(mergeFiles[origIndex]);
        });
        
        mergeFiles = newOrder;
        renderMergeFileList();
    }
});
