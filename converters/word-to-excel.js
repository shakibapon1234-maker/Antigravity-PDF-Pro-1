// Word to Excel Logic - Antigravity PDF Pro (FIXED: full table extraction + non-table content)
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
    let extractedParagraphs = [];

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
        // Handle files from archive that may not have correct type
        const isWord = file.name && (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc'));
        const fileType = file.type || (isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null);
        if (!file || (file.type && !file.type.includes('wordprocessingml') && !file.type.includes('msword') && !file.type.includes('document')) && !fileType) {
            alert('Please select a valid Word document.');
            return;
        }
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
                
                // Show preview
                previewArea.innerHTML = `<div style="background:#fff; color:#222; padding:20px; border-radius:8px; max-height:400px; overflow:auto;">${html}</div>`;
                
                // Parse HTML to extract ALL content
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                extractedTables = [];
                extractedParagraphs = [];
                
                // Helper to clean invisible characters (like zero-width space)
                function cleanText(str) {
                    if (!str) return '';
                    return str.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').trim();
                }
                
                // --- Extract ALL tables ---
                const tables = doc.querySelectorAll('table');
                tables.forEach((table, index) => {
                    const rows = [];
                    table.querySelectorAll('tr').forEach(tr => {
                        const row = [];
                        tr.querySelectorAll('td, th').forEach(td => {
                            // Use textContent (not innerText — innerText doesn't work in DOMParser)
                            let cellText = cleanText(td.textContent);
                            // Preserve line breaks within cells
                            cellText = cellText.replace(/\s+/g, ' ');
                            row.push(cellText);
                        });
                        if (row.length > 0) rows.push(row);
                    });
                    if (rows.length > 0) {
                        extractedTables.push({
                            name: `Table_${index + 1}`,
                            data: rows
                        });
                    }
                });

                // --- Also extract non-table content (paragraphs, headings, lists) ---
                const bodyChildren = doc.body.children;
                let textRows = [];
                for (let i = 0; i < bodyChildren.length; i++) {
                    const el = bodyChildren[i];
                    // Skip tables (already extracted)
                    if (el.tagName === 'TABLE') continue;
                    
                    const tag = el.tagName.toLowerCase();
                    if (tag === 'ul' || tag === 'ol') {
                        el.querySelectorAll('li').forEach(li => {
                            const text = cleanText(li.textContent);
                            if (text) {
                                textRows.push(text);
                            }
                        });
                    } else {
                        const text = cleanText(el.textContent);
                        if (text) {
                            textRows.push(text);
                        }
                    }
                }
                if (textRows.length > 0) {
                    extractedParagraphs = textRows;
                }

                // Show status
                let statusHtml = '';
                if (extractedTables.length > 0) {
                    statusHtml += `<div style="margin-bottom:10px; padding:10px; background:#e8f5e9; color:#2e7d32; border-radius:8px; border:1px solid #c8e6c9;">
                        <strong>✅ ${extractedTables.length} table(s) detected</strong> — Total rows: ${extractedTables.reduce((s, t) => s + t.data.length, 0)}
                    </div>`;
                }
                if (extractedParagraphs.length > 0) {
                    statusHtml += `<div style="margin-bottom:10px; padding:10px; background:#e3f2fd; color:#1565c0; border-radius:8px; border:1px solid #bbdefb;">
                        <strong>📝 ${extractedParagraphs.length} text paragraph(s) detected</strong> — will be added to the Excel sheet
                    </div>`;
                }
                if (extractedTables.length === 0 && extractedParagraphs.length === 0) {
                    statusHtml = `<div style="padding:15px; background:#fff3cd; color:#856404; border-radius:8px; border:1px solid #ffeeba;">
                        <strong>Note:</strong> No content detected in this document.
                    </div>`;
                }
                previewArea.innerHTML = statusHtml + previewArea.innerHTML;

                if (window.lucide) lucide.createIcons();

            } catch (err) {
                console.error('Error parsing Word doc:', err);
                alert('Failed to read Word document: ' + err.message);
                resetW2E();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    convertBtn.addEventListener('click', () => {
        if (extractedTables.length === 0 && extractedParagraphs.length === 0) {
            alert('No content found to extract. Please upload a Word document with tables or text.');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            // === COMBINE all tables into ONE sheet ===
            let combinedData = [];
            
            extractedTables.forEach((table, idx) => {
                // Add table header/separator
                if (idx > 0) {
                    combinedData.push([]); // Empty row separator
                    combinedData.push([]); // Double spacing between tables
                }
                combinedData.push([`📋 ${table.name} (${table.data.length} rows)`]);
                
                // Add all rows of this table
                table.data.forEach(row => {
                    combinedData.push(row);
                });
            });

            // Add paragraphs at the end
            if (extractedParagraphs.length > 0) {
                if (combinedData.length > 0) {
                    combinedData.push([]);
                    combinedData.push([]);
                }
                extractedParagraphs.forEach(p => {
                    combinedData.push([p]);
                });
            }

            if (combinedData.length === 0) {
                alert('No data to export.');
                return;
            }

            const ws = XLSX.utils.aoa_to_sheet(combinedData);
            
            // Smart column width — scan ALL rows for max width
            const maxWidths = [];
            combinedData.forEach(row => {
                if (!row) return;
                row.forEach((cell, i) => {
                    const len = cell ? Math.min(cell.toString().length, 60) : 0;
                    maxWidths[i] = Math.max(maxWidths[i] || 8, len + 2);
                });
            });
            ws['!cols'] = maxWidths.map(w => ({ wch: Math.min(w, 70) }));
            
            XLSX.utils.book_append_sheet(wb, ws, 'All Data');

            const outName = currentFile.name.replace(/\.[^/.]+$/, "") + '_Extracted.xlsx';
            XLSX.writeFile(wb, outName);
            
            // Success feedback
            convertBtn.innerHTML = '<i data-lucide="check-circle"></i> Downloaded!';
            convertBtn.style.background = 'linear-gradient(135deg, #00c851, #007e33)';
            setTimeout(() => {
                convertBtn.innerHTML = '<i data-lucide="file-spreadsheet"></i> Convert & Download Excel';
                convertBtn.style.background = '';
                if (window.lucide) lucide.createIcons();
            }, 2500);

        } catch (err) {
            console.error('Excel export error:', err);
            alert('Failed to generate Excel file: ' + err.message);
        }
    });

    resetBtn.addEventListener('click', resetW2E);

    function resetW2E() {
        currentFile = null;
        extractedTables = [];
        extractedParagraphs = [];
        fileInput.value = '';
        workspace.classList.add('d-none');
        emptyState.classList.remove('d-none');
        previewArea.innerHTML = '';
    }

    window.loadWordToExcel = handleWordFile;
});
