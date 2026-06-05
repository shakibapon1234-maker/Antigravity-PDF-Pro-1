// ─────────────────────────────────────────────
// core/undo.js — Antigravity PDF Pro
// Undo ও Redo সিস্টেম এক জায়গায়
// নির্ভর করে: core/state.js, core/renderer.js
// ─────────────────────────────────────────────

// ════════════════════════════════════════════
// UNDO
// ════════════════════════════════════════════

function captureUndoSnapshot(description) {
    const snapshot = {
        description,
        textEdits:    JSON.parse(JSON.stringify(textEdits)),
        shapeEdits:   JSON.parse(JSON.stringify(shapeEdits)),
        clearStrokes: JSON.parse(JSON.stringify(clearStrokes)),
        imageEdits:   JSON.parse(JSON.stringify(typeof imageEdits !== 'undefined' ? imageEdits : [])),
    };
    undoHistory.push(snapshot);
    if (undoHistory.length > UNDO_LIMIT) undoHistory.shift();

    // নতুন কাজ হলে redo স্ট্যাক পরিষ্কার (Redo ছাড়া)
    if (description !== 'Redo') {
        redoHistory = [];
        _updateRedoBtn();
    }

    updateUndoButtonState();
}

function performUndo() {
    // Keep at least the 'Initial state' snapshot — never undo past it
    if (undoHistory.length <= 1) return;

    // বর্তমান স্টেট redo-তে রাখো
    const currentSnap = {
        textEdits:    JSON.parse(JSON.stringify(textEdits)),
        shapeEdits:   JSON.parse(JSON.stringify(shapeEdits)),
        clearStrokes: JSON.parse(JSON.stringify(clearStrokes)),
        imageEdits:   JSON.parse(JSON.stringify(typeof imageEdits !== 'undefined' ? imageEdits : [])),
    };
    _pushRedo(currentSnap);

    const snapshot = undoHistory.pop();
    textEdits    = JSON.parse(JSON.stringify(snapshot.textEdits));
    shapeEdits   = JSON.parse(JSON.stringify(snapshot.shapeEdits   || []));
    clearStrokes = JSON.parse(JSON.stringify(snapshot.clearStrokes || []));
    if (typeof imageEdits !== 'undefined') imageEdits = JSON.parse(JSON.stringify(snapshot.imageEdits || []));

    if (currentPdfObj) renderPage(currentPdfObj, currentPageNum);
    updateUndoButtonState();
}

// অন্য ফাইল থেকে (যেমন image-toolbar) স্টেট সরাসরি সেট করতে
function _applySnapshot(snapshot) {
    textEdits    = JSON.parse(JSON.stringify(snapshot.textEdits    || []));
    shapeEdits   = JSON.parse(JSON.stringify(snapshot.shapeEdits   || []));
    clearStrokes = JSON.parse(JSON.stringify(snapshot.clearStrokes || []));
    if (typeof imageEdits !== 'undefined') imageEdits = JSON.parse(JSON.stringify(snapshot.imageEdits || []));
    if (currentPdfObj) renderPage(currentPdfObj, currentPageNum);
    updateUndoButtonState();
}

function updateUndoButtonState() {
    const btn = document.getElementById('btnUndo');
    if (!btn) return;
    // Disable when only the initial snapshot remains (nothing to undo)
    const canUndo = undoHistory.length > 1;
    btn.disabled = !canUndo;
    btn.title = canUndo
        ? `Undo: ${undoHistory[undoHistory.length - 1].description} (${undoHistory.length - 1} step${undoHistory.length > 2 ? 's' : ''})`
        : 'Nothing to undo';
}

// ════════════════════════════════════════════
// REDO
// ════════════════════════════════════════════

function _pushRedo(snapshot) {
    redoHistory.push(snapshot);
    if (redoHistory.length > REDO_LIMIT) redoHistory.shift();
    _updateRedoBtn();
}

function _updateRedoBtn() {
    const btn = document.getElementById('btnRedo');
    if (!btn) return;
    btn.disabled = redoHistory.length === 0;
    btn.title = redoHistory.length > 0
        ? `Redo (${redoHistory.length} step${redoHistory.length > 1 ? 's' : ''})`
        : 'Nothing to redo (Ctrl+Y)';
}

function performRedo() {
    if (redoHistory.length === 0) return;
    const snapshot = redoHistory.pop();
    _updateRedoBtn();

    captureUndoSnapshot('Redo');
    _applySnapshot(snapshot);
}

// ════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return;
    const k = e.key ? e.key.toLowerCase() : '';

    // Ctrl+Z → Undo
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
    }

    // Ctrl+Y বা Ctrl+Shift+Z → Redo
    if ((e.ctrlKey && k === 'y') || (e.ctrlKey && e.shiftKey && k === 'z')) {
        e.preventDefault();
        performRedo();
    }
});

// ════════════════════════════════════════════
// INIT — DOM তৈরি হওয়ার পরে বাটন ওয়্যার করো
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Undo বাটন
    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) {
        btnUndo.addEventListener('click', () => performUndo());
        btnUndo.addEventListener('mousedown', (e) => e.preventDefault());
    }

    // Redo বাটন
    const btnRedo = document.getElementById('btnRedo');
    if (btnRedo) {
        btnRedo.addEventListener('click', () => performRedo());
        btnRedo.addEventListener('mousedown', (e) => e.preventDefault());
    }

    updateUndoButtonState();
    _updateRedoBtn();
});
