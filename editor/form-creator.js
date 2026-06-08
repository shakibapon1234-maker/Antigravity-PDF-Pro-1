// ─────────────────────────────────────────────────────────────
// editor/form-creator.js — Antigravity PDF Pro
// Interactive Form Creator: Text, Checkbox, Radio, Dropdown, Signature
// ─────────────────────────────────────────────────────────────

if (typeof window.formFields === 'undefined') {
    window.formFields = [];
}

let _selectedFieldId = null;

// ════════════════════════════════════════════
// Panel UI management
// ════════════════════════════════════════════

function openFormCreatorPanel() {
    // Deactivate other tools first
    if (typeof deactivateAllTools === 'function') deactivateAllTools();
    
    const panel = document.getElementById('formCreatorPanel');
    const overlay = document.getElementById('formCreatorPanelOverlay');
    if (!panel) return;
    
    panel.classList.add('open');
    if (overlay) {
        overlay.style.display = 'block';
        requestAnimationFrame(() => overlay.style.opacity = '1');
    }
    
    activeTool = 'formCreator';
    document.getElementById('btnFormCreator')?.classList.add('active');
    
    // Clear selections and hide settings initially
    _deselectAllFields();
}

function closeFormCreatorPanel() {
    const panel = document.getElementById('formCreatorPanel');
    const overlay = document.getElementById('formCreatorPanelOverlay');
    if (!panel) return;
    
    panel.classList.remove('open');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    
    activeTool = 'select';
    document.getElementById('btnFormCreator')?.classList.remove('active');
    document.getElementById('btnSelect')?.classList.add('active');
    
    _deselectAllFields();
}

// ════════════════════════════════════════════
// Create Field Elements
// ════════════════════════════════════════════

function addFormField(type) {
    if (!currentPdfObj) {
        alert('কোনো PDF খোলা নেই।');
        return;
    }
    
    const pageWrapper = document.querySelector('.pdf-page-wrapper');
    if (!pageWrapper) return;
    
    if (typeof captureUndoSnapshot === 'function') {
        captureUndoSnapshot(`Add Form Field: ${type}`);
    }
    
    // Default dimensions based on type
    let w = 120;
    let h = 24;
    
    if (type === 'checkbox' || type === 'radio') {
        w = 20;
        h = 20;
    } else if (type === 'signature') {
        w = 150;
        h = 40;
    }
    
    const count = window.formFields.filter(f => f.type === type).length + 1;
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)}Field_${count}`;
    
    const field = {
        id: 'formfield_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        page: currentPageNum,
        type,
        name,
        x: 100,
        y: 100,
        w,
        h,
        required: false,
        placeholder: type === 'text' ? 'Enter text...' : '',
        value: type === 'radio' ? 'Choice_' + count : '',
        options: type === 'dropdown' ? ['Option 1', 'Option 2', 'Option 3'] : []
    };
    
    window.formFields.push(field);
    _renderFormFieldElement(field, pageWrapper);
    _selectFormField(field);
}

function _renderFormFieldElement(field, pageWrapper) {
    const el = document.createElement('div');
    el.className = 'placed-form-field draggable';
    el.dataset.fieldId = field.id;
    
    // Scale position and sizing based on pdfScale
    const scaledX = field.x * pdfScale;
    const scaledY = field.y * pdfScale;
    const scaledW = field.w * pdfScale;
    const scaledH = field.h * pdfScale;
    
    el.style.cssText = `
        position: absolute;
        left: ${scaledX}px;
        top: ${scaledY}px;
        width: ${scaledW}px;
        height: ${scaledH}px;
        border: 2px dashed #0284c7;
        background-color: rgba(14, 165, 233, 0.15);
        color: #0284c7;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
        font-size: 10px;
        font-weight: 700;
        z-index: 180;
        cursor: move;
        box-sizing: border-box;
        user-select: none;
        overflow: hidden;
    `;
    
    _updateFieldLabel(el, field);
    
    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'field-resize-handle';
    resizeHandle.style.cssText = `
        position: absolute; right: 0; bottom: 0;
        width: 8px; height: 8px; background: #0284c7;
        cursor: se-resize; z-index: 181;
    `;
    el.appendChild(resizeHandle);
    
    pageWrapper.appendChild(el);
    _makeFieldDraggableAndResizable(el, resizeHandle, field, pageWrapper);
}

function _updateFieldLabel(el, field) {
    let typeLabel = field.type.toUpperCase();
    if (field.type === 'dropdown') typeLabel = 'LIST';
    if (field.type === 'signature') typeLabel = 'SIG FIELD';
    
    // Text container to keep labels readable inside elements
    el.innerHTML = `<span style="pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:2px;">[${typeLabel}] ${field.name}</span>`;
}

function _makeFieldDraggableAndResizable(el, resizeHandle, field, pageWrapper) {
    let startX, startY, startW, startH, startL, startT;
    let isResizing = false;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW  = el.offsetWidth;
        startH  = el.offsetHeight;
        
        let snapshotCaptured = false;
        const onMove = (ev) => {
            if (!isResizing) return;
            if (!snapshotCaptured) {
                snapshotCaptured = true;
                if (typeof captureUndoSnapshot === 'function') {
                    captureUndoSnapshot('Form field resized');
                }
            }
            const newW = Math.max(20, startW + (ev.clientX - startX));
            const newH = Math.max(15, startH + (ev.clientY - startY));
            el.style.width  = `${newW}px`;
            el.style.height = `${newH}px`;
            
            field.w = newW / pdfScale;
            field.h = newH / pdfScale;
        };
        const onUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    
    el.addEventListener('mousedown', (e) => {
        if (e.target === resizeHandle) return;
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        startL = parseFloat(el.style.left) || 0;
        startT = parseFloat(el.style.top)  || 0;
        
        let hasDragged = false;
        let snapshotCaptured = false;
        
        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                hasDragged = true;
                if (!snapshotCaptured) {
                    snapshotCaptured = true;
                    if (typeof captureUndoSnapshot === 'function') {
                        captureUndoSnapshot('Form field moved');
                    }
                }
            }
            
            el.style.left = `${startL + dx}px`;
            el.style.top  = `${startT + dy}px`;
            
            field.x = (startL + dx) / pdfScale;
            field.y = (startT + dy) / pdfScale;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (!hasDragged) {
                _selectFormField(field);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ════════════════════════════════════════════
// Settings and Selection
// ════════════════════════════════════════════

function _selectFormField(field) {
    _selectedFieldId = field.id;
    
    // Highlight elements visually in DOM
    document.querySelectorAll('.placed-form-field').forEach(div => {
        const isActive = div.dataset.fieldId === field.id;
        div.style.borderColor = isActive ? '#ef4444' : '#0284c7';
        div.style.backgroundColor = isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)';
        div.style.color = isActive ? '#ef4444' : '#0284c7';
        const rh = div.querySelector('.field-resize-handle');
        if (rh) rh.style.backgroundColor = isActive ? '#ef4444' : '#0284c7';
    });
    
    // Open settings panel
    const settingsPanel = document.getElementById('formFieldSettings');
    if (settingsPanel) {
        settingsPanel.style.display = 'block';
    }
    
    // Fill settings inputs
    document.getElementById('settingFieldId').value = field.id;
    document.getElementById('settingFieldName').value = field.name;
    document.getElementById('settingFieldRequired').checked = field.required || false;
    
    // Toggle type-specific inputs
    document.getElementById('settingTextOnly').style.display = field.type === 'text' ? 'block' : 'none';
    document.getElementById('settingRadioOnly').style.display = field.type === 'radio' ? 'block' : 'none';
    document.getElementById('settingDropdownOnly').style.display = field.type === 'dropdown' ? 'block' : 'none';
    
    if (field.type === 'text') {
        document.getElementById('settingFieldPlaceholder').value = field.placeholder || '';
    } else if (field.type === 'radio') {
        document.getElementById('settingFieldRadioValue').value = field.value || '';
    } else if (field.type === 'dropdown') {
        document.getElementById('settingFieldDropdownOptions').value = (field.options || []).join(', ');
    }
}

function _deselectAllFields() {
    _selectedFieldId = null;
    document.querySelectorAll('.placed-form-field').forEach(div => {
        div.style.borderColor = '#0284c7';
        div.style.backgroundColor = 'rgba(14, 165, 233, 0.15)';
        div.style.color = '#0284c7';
        const rh = div.querySelector('.field-resize-handle');
        if (rh) rh.style.backgroundColor = '#0284c7';
    });
    const settingsPanel = document.getElementById('formFieldSettings');
    if (settingsPanel) {
        settingsPanel.style.display = 'none';
    }
}

function saveFieldSettings() {
    const id = document.getElementById('settingFieldId').value;
    const field = window.formFields.find(f => f.id === id);
    if (!field) return;
    
    if (typeof captureUndoSnapshot === 'function') {
        captureUndoSnapshot('Save Form Field Settings');
    }
    
    const newName = document.getElementById('settingFieldName').value.trim() || field.name;
    
    // Verify uniqueness of field name
    const exists = window.formFields.some(f => f.name === newName && f.id !== id);
    if (exists) {
        alert('এই নামটি অন্য ফিল্ডে ব্যবহার করা হয়েছে। অনুগ্রহ করে ইউনিক নাম দিন।');
        return;
    }
    
    field.name = newName;
    field.required = document.getElementById('settingFieldRequired').checked;
    
    if (field.type === 'text') {
        field.placeholder = document.getElementById('settingFieldPlaceholder').value;
    } else if (field.type === 'radio') {
        field.value = document.getElementById('settingFieldRadioValue').value.trim() || 'Option';
    } else if (field.type === 'dropdown') {
        const optsText = document.getElementById('settingFieldDropdownOptions').value;
        field.options = optsText.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    // Update visual label in DOM
    const el = document.querySelector(`.placed-form-field[data-field-id="${id}"]`);
    if (el) {
        _updateFieldLabel(el, field);
    }
    
    _deselectAllFields();
}

function deleteSelectedField() {
    const id = document.getElementById('settingFieldId').value;
    if (!id) return;
    
    if (confirm('এই ফর্ম ফিল্ডটি মুছে ফেলবেন?')) {
        if (typeof captureUndoSnapshot === 'function') {
            captureUndoSnapshot('Delete Form Field');
        }
        
        window.formFields = window.formFields.filter(f => f.id !== id);
        const el = document.querySelector(`.placed-form-field[data-field-id="${id}"]`);
        if (el) el.remove();
        
        _deselectAllFields();
    }
}

// ════════════════════════════════════════════
// PDF restore integration
// ════════════════════════════════════════════

function restoreFormFieldsToDom(pageWrapper) {
    pageWrapper.querySelectorAll('.placed-form-field').forEach(el => el.remove());
    
    if (!window.formFields) window.formFields = [];
    
    window.formFields.filter(f => f.page === currentPageNum).forEach(field => {
        _renderFormFieldElement(field, pageWrapper);
    });
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Toolbar Button
    const btnForm = document.getElementById('btnFormCreator');
    if (btnForm) {
        btnForm.addEventListener('click', () => {
            if (activeTool === 'formCreator') {
                closeFormCreatorPanel();
            } else {
                openFormCreatorPanel();
            }
        });
    }
    
    const btnClose = document.getElementById('btnCloseFormPanel');
    if (btnClose) {
        btnClose.addEventListener('click', closeFormCreatorPanel);
    }
    
    // Add Buttons
    const btnText = document.getElementById('btnAddFormText');
    if (btnText) btnText.addEventListener('click', () => addFormField('text'));
    
    const btnCheck = document.getElementById('btnAddFormCheckbox');
    if (btnCheck) btnCheck.addEventListener('click', () => addFormField('checkbox'));
    
    const btnRadio = document.getElementById('btnAddFormRadio');
    if (btnRadio) btnRadio.addEventListener('click', () => addFormField('radio'));
    
    const btnDrop = document.getElementById('btnAddFormDropdown');
    if (btnDrop) btnDrop.addEventListener('click', () => addFormField('dropdown'));
    
    const btnSig = document.getElementById('btnAddFormSignature');
    if (btnSig) btnSig.addEventListener('click', () => addFormField('signature'));
    
    // Settings actions
    const btnSave = document.getElementById('btnSaveFieldSettings');
    if (btnSave) btnSave.addEventListener('click', saveFieldSettings);
    
    const btnDel = document.getElementById('btnDeleteFormField');
    if (btnDel) btnDel.addEventListener('click', deleteSelectedField);
    
    // Panel Overlay click
    const overlay = document.getElementById('formCreatorPanelOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeFormCreatorPanel);
    }
});
