// Word to Excel Logic - Antigravity PDF Pro
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('w2eFileInput');
    const uploadBtn = document.getElementById('btnUploadWordToExcel');
    const convertBtn = document.getElementById('btnConvertWordToExcel');
    const resetBtn = document.getElementById('btnW2EReset');
    const workspace = document.getElementById('w2eWorkspace');
    const emptyState = document.getElementById('w2eEmptyState');
    const previewArea = document.getElementById('w2ePreview');

    let currentFile = null;
    let extractedTables = [];

    if (!fileInput) return;

    uploadBtn.addEventListener('click', () => fileInput.click());
    emptyState.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleWordFile(file);
    });

    // Dropzone logic
    emptyState.addEventListener('dragover', (e) => {
        e.preventDefault();
        emptyState.style.borderColor = 'var(--primary)';
        emptyState.style.background = 'rgba(184, 41, 249, 0.05)';
    });
    emptyState.addEventListener('dragleave', () => {
        emptyState.style.borderColor = '';
        emptyState.style.background = '';
    });
    emptyState.addEventListener('drop', (e) => {
        e.preventDefault();
        emptyState.style.borderColor = '';
        emptyState.style.background = '';
        if (e.dataTransfer.files[0]) handleWordFile(e.dataTransfer.files[0]);
    });

    async function handleWordFile(file) {
        currentFile = file;
        emptyState.classList.add('d-none');
        workspace.classList.remove('d-none');
        
        previewArea.innerHTML = `
            <div style="text-align: center; color: #666; padding: 40px;">
                <i data-lucide="loader-2" class="spin" style="width: 40px; height: 40px; margin-bottom: 15px;"></i>
                <p>Reading Word document...</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();

        const reader = new FileReader();
        reader.onload = async function(e) {
            const arrayBuffer = e.target.result;
            try {
                const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                const html = result.value;
                previewArea.innerHTML = html;
                
                // Extract tables for conversion
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const tables = doc.querySelectorAll('table');
                
                extractedTables = [];
                tables.forEach((table, index) => {
                    const rows = [];
                    table.querySelectorAll('tr').forEach(tr => {
                        const row = [];
                        tr.querySelectorAll('td, th').forEach(td => {
                            row.push(td.innerText.trim());
                        });
                        rows.push(row);
                    });
                    if (rows.length > 0) {
                        extractedTables.push({
                            name: `Table ${index + 1}`,
                            data: rows
                        });
                    }
                });

                if (extractedTables.length === 0) {
                    previewArea.innerHTML += `
                        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; color: #856404; border-radius: 8px; border: 1px solid #ffeeba;">
                            <strong>Note:</strong> No clear tables were detected in this document. Only actual Word tables can be converted to Excel.
                        </div>
                    `;
                } else {
                    previewArea.innerHTML = `
                        <div style="margin-bottom: 20px; padding: 10px; background: #e8f5e9; color: #2e7d32; border-radius: 8px; border: 1px solid #c8e6c9;">
                            <strong>Success:</strong> ${extractedTables.length} table(s) detected and ready for extraction.
                        </div>
                    ` + previewArea.innerHTML;
                }

                if (window.lucide) lucide.createIcons();

            } catch (err) {
                console.error('Error parsing Word doc:', err);
                alert('Failed to read Word document. Please ensure it is a valid .docx file.');
                resetW2E();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    convertBtn.addEventListener('click', () => {
        if (extractedTables.length === 0) {
            alert('No tables found to extract. Please upload a Word document containing tables.');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            extractedTables.forEach(table => {
                const ws = XLSX.utils.aoa_to_sheet(table.data);
                // Basic column width estimation
                const maxWidths = [];
                table.data.forEach(row => {
                    row.forEach((cell, i) => {
                        const len = cell ? cell.toString().length : 0;
                        maxWidths[i] = Math.max(maxWidths[i] || 10, len + 2);
                    });
                });
                ws['!cols'] = maxWidths.map(w => ({ wch: w }));
                
                XLSX.utils.book_append_sheet(wb, ws, table.name);
            });

            const outName = currentFile.name.replace(/\.[^/.]+$/, "") + '_Extracted.xlsx';
            XLSX.writeFile(wb, outName);
            
            // Success notification or sound could go here
        } catch (err) {
            console.error('Excel export error:', err);
            alert('Failed to generate Excel file: ' + err.message);
        }
    });

    resetBtn.addEventListener('click', resetW2E);

    function resetW2E() {
        currentFile = null;
        extractedTables = [];
        fileInput.value = '';
        workspace.classList.add('d-none');
        emptyState.classList.remove('d-none');
        previewArea.innerHTML = '';
    }
});
