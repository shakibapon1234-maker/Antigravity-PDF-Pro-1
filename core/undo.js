// ─────────────────────────────────────────────
// core/undo.js — Antigravity PDF Pro
// Undo ও Redo সিস্টেম
// নির্ভর করে: core/state.js, core/renderer.js
// ─────────────────────────────────────────────

// Race-condition lock: prevents a second undo/redo from firing while
// the previous renderPage() is still in-flight.
let _undoRedoLock = false;

// ════════════════════════════════════════════
// Internal helpers
// ════════════════════════════════════════════

/** Deep-clone all live state arrays into a plain snapshot object. */
function _snapshotLiveState(description) {
    return {
        description,
        textEdits:     JSON.parse(JSON.stringify(textEdits    || [])),
        shapeEdits:    JSON.parse(JSON.stringify(shapeEdits   || [])),
        clearStrokes:  JSON.parse(JSON.stringify(clearStrokes || [])),
        imageEdits:    JSON.parse(JSON.stringify(typeof imageEdits          !== 'undefined' ? imageEdits          : [])),
        formFields:    JSON.parse(JSON.stringify(typeof formFields          !== 'undefined' ? formFields          : [])),
        hyperlinks:    JSON.parse(JSON.stringify(typeof window.hyperlinks   !== 'undefined' ? window.hyperlinks   : [])),
        fhPaths:       JSON.parse(JSON.stringify(typeof _fhPaths            !== 'undefined' ? _fhPaths            : [])),
        createdTables: JSON.parse(JSON.stringify(typeof window.createdTables !== 'undefined' ? window.createdTables : [])),
    };
}

/** Write a snapshot back into all live state arrays. */
function _applySnapshotValues(snapshot) {
    textEdits    = JSON.parse(JSON.stringify(snapshot.textEdits    || []));
    shapeEdits   = JSON.parse(JSON.stringify(snapshot.shapeEdits   || []));
    clearStrokes = JSON.parse(JSON.stringify(snapshot.clearStrokes || []));
    if (typeof imageEdits           !== 'undefined') imageEdits           = JSON.parse(JSON.stringify(snapshot.imageEdits      || []));
    if (typeof formFields           !== 'undefined') window.formFields    = JSON.parse(JSON.stringify(snapshot.formFields      || []));
    if (typeof window.hyperlinks    !== 'undefined') window.hyperlinks    = JSON.parse(JSON.stringify(snapshot.hyperlinks      || []));
    if (typeof _fhPaths             !== 'undefined') _fhPaths             = JSON.parse(JSON.stringify(snapshot.fhPaths         || []));
    if (typeof window.createdTables !== 'undefined') window.createdTables = JSON.parse(JSON.stringify(snapshot.createdTables  || []));
}

/**
 * Re-render the current page with the restored state, then re-attach
 * any freehand canvas or static path overlay.
 * Returns a Promise that resolves when rendering is complete.
 */
function _rerenderPage() {
    if (!currentPdfObj) return Promise.resolve();
    return renderPage(currentPdfObj, currentPageNum).then(() => {
        // Re-draw freehand strokes on the new page wrapper
        if (typeof window.fhReattachCanvas === 'function') {
            window.fhReattachCanvas();
        }
    });
}

// ════════════════════════════════════════════
// Public API — captureUndoSnapshot
// ════════════════════════════════════════════

/**
 * Call this BEFORE applying a change.
 * Stores the pre-change state so Undo can restore it.
 *
 * undoHistory layout:
 *   [S_initial, S_before_action1, S_before_action2, ...]
 *
 * On Undo: we pop the top (= pre-last-action state) and apply it.
 */
function captureUndoSnapshot(description) {
    if (_undoRedoLock) return; // don't pollute history during an in-flight undo/redo

    const snapshot = _snapshotLiveState(description);
    undoHistory.push(snapshot);
    if (undoHistory.length > UNDO_LIMIT) undoHistory.shift();

    // New action → invalidate redo stack
    redoHistory = [];
    _updateRedoBtn();
    updateUndoButtonState();
}

// ════════════════════════════════════════════
// UNDO
// ════════════════════════════════════════════

function performUndo() {
    if (_undoRedoLock)          return; // render still in-flight
    if (undoHistory.length <= 1) return; // only the initial floor remains

    _undoRedoLock = true;
    _setButtonsDisabled(true);

    // 1. Save the CURRENT live state to redo so Redo can get back here.
    const currentLive = _snapshotLiveState('redo-target');
    redoHistory.push(currentLive);
    if (redoHistory.length > REDO_LIMIT) redoHistory.shift();

    // 2. Pop the most-recent pre-action snapshot and apply it.
    //    This snapshot IS the state before the last action (= what we want).
    const target = undoHistory.pop();
    _applySnapshotValues(target);

    // 3. Re-render, then release the lock.
    _rerenderPage().finally(() => {
        _undoRedoLock = false;
        _setButtonsDisabled(false);
        updateUndoButtonState();
        _updateRedoBtn();
    });
}

// ════════════════════════════════════════════
// REDO
// ════════════════════════════════════════════

function _updateRedoBtn() {
    const btn = document.getElementById('btnRedo');
    if (!btn) return;
    btn.disabled = redoHistory.length === 0;
    btn.title = redoHistory.length > 0
        ? `Redo (${redoHistory.length} step${redoHistory.length > 1 ? 's' : ''})`
        : 'Nothing to redo (Ctrl+Y)';
}

function performRedo() {
    if (_undoRedoLock)          return;
    if (redoHistory.length === 0) return;

    _undoRedoLock = true;
    _setButtonsDisabled(true);

    // 1. Save the CURRENT live state to undo so the user can undo again.
    const currentLive = _snapshotLiveState('undo-target');
    undoHistory.push(currentLive);
    if (undoHistory.length > UNDO_LIMIT) undoHistory.shift();

    // 2. Pop the redo target and apply it.
    const target = redoHistory.pop();
    _applySnapshotValues(target);

    // 3. Re-render, then release the lock.
    _rerenderPage().finally(() => {
        _undoRedoLock = false;
        _setButtonsDisabled(false);
        updateUndoButtonState();
        _updateRedoBtn();
    });
}

// ════════════════════════════════════════════
// Button helpers
// ════════════════════════════════════════════

function updateUndoButtonState() {
    const btn = document.getElementById('btnUndo');
    if (!btn) return;
    const canUndo = undoHistory.length > 1; // preserve initial floor
    btn.disabled = !canUndo;
    if (canUndo) {
        const last = undoHistory[undoHistory.length - 1];
        const steps = undoHistory.length - 1;
        btn.title = `Undo: ${last.description} (${steps} step${steps > 1 ? 's' : ''})`;
    } else {
        btn.title = 'Nothing to undo (Ctrl+Z)';
    }
}

/** Temporarily disable/enable both buttons while a re-render is in-flight. */
function _setButtonsDisabled(disabled) {
    const u = document.getElementById('btnUndo');
    const r = document.getElementById('btnRedo');
    if (u) u.disabled = disabled ? true : (undoHistory.length <= 1);
    if (r) r.disabled = disabled ? true : (redoHistory.length === 0);
}

// ════════════════════════════════════════════
// _applySnapshot — backward-compat shim
// (image-toolbar.js etc. call this directly)
// ════════════════════════════════════════════

function _applySnapshot(snapshot) {
    _applySnapshotValues(snapshot);
    if (currentPdfObj) {
        renderPage(currentPdfObj, currentPageNum).then(() => {
            if (typeof window.fhReattachCanvas === 'function') window.fhReattachCanvas();
        });
    }
    updateUndoButtonState();
    _updateRedoBtn();
}

// ════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    // Don't intercept shortcuts when user is typing in an input
    if (e.target.tagName === 'INPUT'  ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.contentEditable === 'true') return;

    const k = e.key ? e.key.toLowerCase() : '';

    // Ctrl+Z → Undo
    if (e.ctrlKey && !e.shiftKey && k === 'z') {
        e.preventDefault();
        performUndo();
        return;
    }

    // Ctrl+Y  or  Ctrl+Shift+Z → Redo
    if ((e.ctrlKey && k === 'y') || (e.ctrlKey && e.shiftKey && k === 'z')) {
        e.preventDefault();
        performRedo();
    }
});

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) {
        btnUndo.addEventListener('click', performUndo);
        btnUndo.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus
    }

    const btnRedo = document.getElementById('btnRedo');
    if (btnRedo) {
        btnRedo.addEventListener('click', performRedo);
        btnRedo.addEventListener('mousedown', (e) => e.preventDefault());
    }

    updateUndoButtonState();
    _updateRedoBtn();
});
