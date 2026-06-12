/**
 * Antigravity PDF Pro — Keyboard Shortcuts Help Overlay (DEV-05)
 * Press ? or F1 to open. Shows all available keyboard shortcuts.
 */

(function AGShortcutsHelp() {
    const SHORTCUTS = [
        {
            category: '📄 File',
            items: [
                { keys: ['Ctrl', 'O'],       desc: 'Open PDF' },
                { keys: ['Ctrl', 'S'],       desc: 'Save / Download PDF' },
                { keys: ['Ctrl', 'Shift', 'S'], desc: 'Save As (new name)' },
                { keys: ['Ctrl', 'P'],       desc: 'Print' },
            ]
        },
        {
            category: '✏️ Editor',
            items: [
                { keys: ['Ctrl', 'Z'],       desc: 'Undo' },
                { keys: ['Ctrl', 'Y'],       desc: 'Redo' },
                { keys: ['Ctrl', 'A'],       desc: 'Select All text' },
                { keys: ['T'],               desc: 'Text Tool' },
                { keys: ['V'],               desc: 'Select / Move Tool' },
                { keys: ['E'],               desc: 'White Eraser' },
                { keys: ['H'],               desc: 'Highlight Tool' },
                { keys: ['P'],               desc: 'Pencil / Freehand' },
                { keys: ['R'],               desc: 'Redact Tool' },
                { keys: ['Delete'],          desc: 'Delete selected item' },
            ]
        },
        {
            category: '🔠 Text Formatting',
            items: [
                { keys: ['Ctrl', 'B'],       desc: 'Bold' },
                { keys: ['Ctrl', 'I'],       desc: 'Italic' },
                { keys: ['Ctrl', 'U'],       desc: 'Underline' },
                { keys: ['Ctrl', ']'],       desc: 'Increase font size' },
                { keys: ['Ctrl', '['],       desc: 'Decrease font size' },
            ]
        },
        {
            category: '🔍 View & Navigation',
            items: [
                { keys: ['Ctrl', '+'],       desc: 'Zoom In' },
                { keys: ['Ctrl', '-'],       desc: 'Zoom Out' },
                { keys: ['Ctrl', '0'],       desc: 'Fit to Width' },
                { keys: ['ArrowRight', '→'], desc: 'Next Page' },
                { keys: ['ArrowLeft',  '←'], desc: 'Previous Page' },
                { keys: ['Ctrl', 'F'],       desc: 'Find & Replace' },
            ]
        },
        {
            category: '🛠️ Tools & Panels',
            items: [
                { keys: ['Alt', '1'],        desc: 'Go to PDF Editor' },
                { keys: ['Alt', '2'],        desc: 'Go to Converter' },
                { keys: ['Alt', '3'],        desc: 'Merge PDF' },
                { keys: ['Alt', '4'],        desc: 'Split PDF' },
                { keys: ['Alt', '5'],        desc: 'Compress PDF' },
                { keys: ['?'],               desc: 'Show this shortcuts panel' },
                { keys: ['F1'],              desc: 'Show this shortcuts panel' },
                { keys: ['Escape'],          desc: 'Close any modal / panel' },
            ]
        },
    ];

    // ── CSS ──────────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
        #agShortcutsBackdrop {
            position: fixed;
            inset: 0;
            background: rgba(5, 5, 20, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
        }
        #agShortcutsBackdrop.ag-shortcuts-open {
            opacity: 1;
            pointer-events: all;
        }
        #agShortcutsPanel {
            background: linear-gradient(160deg, #0f0f23 0%, #0a0a1a 100%);
            border: 1px solid rgba(0, 212, 255, 0.25);
            border-radius: 18px;
            width: 780px;
            max-width: 96vw;
            max-height: 88vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.08);
            animation: agShortcutsIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes agShortcutsIn {
            from { transform: scale(0.92) translateY(20px); opacity: 0; }
            to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        .ag-sh-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 28px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,212,255,0.04);
        }
        .ag-sh-title {
            font-size: 18px;
            font-weight: 800;
            color: #fff;
            font-family: 'Outfit', sans-serif;
            letter-spacing: -0.3px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .ag-sh-title-badge {
            background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(184,41,249,0.2));
            border: 1px solid rgba(0,212,255,0.3);
            border-radius: 6px;
            padding: 2px 8px;
            font-size: 11px;
            color: rgba(0,212,255,0.9);
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .ag-sh-close {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: rgba(255,255,255,0.6);
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .ag-sh-close:hover {
            background: rgba(255,80,80,0.15);
            border-color: rgba(255,80,80,0.3);
            color: #ff6060;
        }
        .ag-sh-body {
            padding: 24px 28px;
            overflow-y: auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }
        @media (max-width: 600px) {
            .ag-sh-body { grid-template-columns: 1fr; }
        }
        .ag-sh-category {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .ag-sh-cat-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: rgba(0,212,255,0.65);
            margin: 0 0 8px;
            font-family: 'Outfit', sans-serif;
        }
        .ag-sh-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 5px 0;
        }
        .ag-sh-desc {
            font-size: 12.5px;
            color: rgba(255,255,255,0.6);
            font-family: 'Outfit', sans-serif;
            flex: 1;
        }
        .ag-sh-keys {
            display: flex;
            gap: 4px;
            align-items: center;
            flex-shrink: 0;
        }
        .ag-sh-key {
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.12);
            border-bottom: 2px solid rgba(255,255,255,0.2);
            border-radius: 5px;
            color: #c0c0e0;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 7px;
            font-family: 'Outfit', monospace;
            white-space: nowrap;
        }
        .ag-sh-plus {
            font-size: 10px;
            color: rgba(255,255,255,0.3);
        }
        .ag-sh-footer {
            padding: 14px 28px;
            border-top: 1px solid rgba(255,255,255,0.06);
            text-align: center;
            font-size: 11.5px;
            color: rgba(255,255,255,0.3);
            font-family: 'Outfit', sans-serif;
        }
    `;
    document.head.appendChild(css);

    // ── Build DOM ────────────────────────────────────────────────────────────
    function buildPanel() {
        if (document.getElementById('agShortcutsBackdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'agShortcutsBackdrop';

        // Build categories HTML
        const categoriesHTML = SHORTCUTS.map(cat => `
            <div class="ag-sh-category">
                <div class="ag-sh-cat-title">${cat.category}</div>
                ${cat.items.map(item => `
                    <div class="ag-sh-row">
                        <span class="ag-sh-desc">${item.desc}</span>
                        <div class="ag-sh-keys">
                            ${item.keys.map((k, i) => `
                                ${i > 0 ? '<span class="ag-sh-plus">+</span>' : ''}
                                <kbd class="ag-sh-key">${k}</kbd>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        backdrop.innerHTML = `
            <div id="agShortcutsPanel" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">
                <div class="ag-sh-header">
                    <div class="ag-sh-title">
                        ⌨️ Keyboard Shortcuts
                        <span class="ag-sh-title-badge">? or F1</span>
                    </div>
                    <button class="ag-sh-close" id="agShClose" title="Close (Esc)">×</button>
                </div>
                <div class="ag-sh-body">${categoriesHTML}</div>
                <div class="ag-sh-footer">Press <kbd class="ag-sh-key">Esc</kbd> or click outside to close</div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Close button
        document.getElementById('agShClose').addEventListener('click', close);

        // Click outside to close
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close();
        });
    }

    // ── Open / Close ─────────────────────────────────────────────────────────
    function open() {
        buildPanel();
        const backdrop = document.getElementById('agShortcutsBackdrop');
        if (backdrop) {
            requestAnimationFrame(() => backdrop.classList.add('ag-shortcuts-open'));
        }
    }

    function close() {
        const backdrop = document.getElementById('agShortcutsBackdrop');
        if (backdrop) backdrop.classList.remove('ag-shortcuts-open');
    }

    function toggle() {
        const backdrop = document.getElementById('agShortcutsBackdrop');
        if (backdrop && backdrop.classList.contains('ag-shortcuts-open')) {
            close();
        } else {
            open();
        }
    }

    // ── Keyboard listener ────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Don't trigger when typing in an input / contenteditable
        const tag = (e.target || document.activeElement);
        const inInput = tag && (
            tag.tagName === 'INPUT' ||
            tag.tagName === 'TEXTAREA' ||
            tag.tagName === 'SELECT' ||
            tag.isContentEditable
        );

        if (e.key === 'F1') {
            e.preventDefault();
            toggle();
            return;
        }

        if (e.key === '?' && !inInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            toggle();
            return;
        }

        if (e.key === 'Escape') {
            const backdrop = document.getElementById('agShortcutsBackdrop');
            if (backdrop && backdrop.classList.contains('ag-shortcuts-open')) {
                close();
                e.stopPropagation();
            }
        }
    });

    // ── Public API ───────────────────────────────────────────────────────────
    window.AGShortcutsHelp = { open, close, toggle };
})();
