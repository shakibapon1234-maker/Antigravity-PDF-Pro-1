/* ============================================================
   TOOLBAR LAYOUT TOGGLE v2 — সব script লোডের পরে কাজ করে
   app.js → text-editor.js → ... → eyedropper-eraser.js → এই ফাইল
   ============================================================ */

(function initToolbarLayoutToggle() {

  /* ── CSS ──────────────────────────────────────────────── */
  const css = document.createElement('style');
  css.textContent = `

    /* SPLIT mode — 3 column grid */
    body.tb-split #pdfEditorContainer {
      display: grid !important;
      grid-template-columns: 200px 1fr 200px !important;
      grid-template-rows: auto auto 1fr !important;
      column-gap: 10px !important;
      align-items: start !important;
    }

    /* Top toolbar row — spans all columns */
    body.tb-split .toolbar-editor {
      grid-column: 1 / -1 !important;
      grid-row: 1 !important;
    }

    /* Hide original formatting-toolbar in split mode */
    body.tb-split .formatting-toolbar {
      display: none !important;
    }

    /* Canvas — center */
    body.tb-split #canvasWrapper {
      grid-column: 2 !important;
      grid-row: 2 / 4 !important;
    }

    /* ── Side panels ── */
    .tb-panel {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding: 10px 8px 14px;
      background: linear-gradient(160deg, rgba(124,58,237,0.18), rgba(0,212,255,0.10));
      border: 1.5px solid rgba(0,212,255,0.22);
      border-radius: 14px;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.4), inset 0 0 16px rgba(0,212,255,0.04);
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(100vh - 160px);
      scrollbar-width: thin;
      scrollbar-color: rgba(0,212,255,0.2) transparent;
    }
    .tb-panel::-webkit-scrollbar { width: 3px; }
    .tb-panel::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.25); border-radius: 3px; }

    body.tb-split .tb-panel {
      display: flex !important;
      grid-row: 2 / 4 !important;
    }
    body.tb-split #tbPanelLeft  { grid-column: 1 !important; }
    body.tb-split #tbPanelRight { grid-column: 3 !important; }

    /* Panel section title */
    .tb-sec {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(0,212,255,0.55);
      text-align: center;
      padding: 4px 0;
      border-bottom: 1px solid rgba(0,212,255,0.12);
      margin: 2px 0 4px;
    }

    /* Proxy buttons — full width in panel */
    .tb-panel .btn-tool {
      width: 100% !important;
      min-width: unset !important;
      justify-content: flex-start !important;
      font-size: 11px !important;
      height: 34px !important;
      padding: 0 8px !important;
    }
    .tb-panel .btn-tool .tool-label { font-size: 11px !important; }

    /* Font row */
    .tb-font-row {
      display: flex; align-items: center; gap: 4px; width: 100%;
    }
    .tb-font-row input[type=number] {
      flex: 1; text-align: center; min-width: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 8px;
      padding: 4px 2px;
      font-size: 12px;
    }
    .tb-font-row .btn-tool {
      width: 30px !important; height: 30px !important;
      min-width: 30px !important; padding: 0 !important;
      justify-content: center !important; flex-shrink: 0;
    }

    /* Font select */
    .tb-panel select {
      width: 100%;
      background: var(--bg-surface);
      border: 1px solid rgba(0,212,255,0.2);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      font-size: 11px;
      padding: 5px 6px;
      border-radius: 8px;
      outline: none;
      cursor: pointer;
    }

    /* Color row */
    .tb-color-row {
      display: flex; gap: 5px; width: 100%;
    }
    .tb-color-row .color-picker-wrapper {
      flex: 1; height: 30px;
    }

    /* ── Toggle button ── */
    #btnTbLayout {
      position: fixed;
      bottom: 20px; right: 20px;
      z-index: 99999;
      width: 44px; height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(0,212,255,0.45);
      background: linear-gradient(135deg, rgba(184,41,249,0.9), rgba(0,212,255,0.8));
      color: #fff;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(184,41,249,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #btnTbLayout:hover {
      transform: scale(1.12);
      box-shadow: 0 6px 26px rgba(184,41,249,0.7), 0 0 0 5px rgba(0,212,255,0.12);
    }
    #btnTbLayout::after {
      content: attr(data-tip);
      position: absolute;
      right: 52px; bottom: 6px;
      background: rgba(15,15,28,0.96);
      color: #fff;
      font-size: 11px; font-weight: 600;
      white-space: nowrap;
      padding: 4px 9px;
      border-radius: 7px;
      border: 1px solid rgba(0,212,255,0.2);
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s;
    }
    #btnTbLayout:hover::after { opacity: 1; }
  `;
  document.head.appendChild(css);

  /* ── Helper: make a proxy button that mirrors original ── */
  function makeProxy(origId) {
    const orig = document.getElementById(origId);
    if (!orig) return null;

    const proxy = orig.cloneNode(true);
    proxy.removeAttribute('id');          // no duplicate IDs
    proxy.removeAttribute('style');       // let panel CSS take over
    proxy.className = orig.className;

    /* Click → trigger original */
    proxy.addEventListener('mousedown', e => e.stopPropagation());
    proxy.addEventListener('click', e => {
      e.stopPropagation();
      orig.click();
    });

    /* Keep active class in sync */
    new MutationObserver(() => {
      proxy.classList.toggle('active', orig.classList.contains('active'));
      proxy.disabled = orig.disabled;
    }).observe(orig, { attributes: true, attributeFilter: ['class', 'disabled'] });

    return proxy;
  }

  /* ── Helper: proxy for font-size input ── */
  function makeFontRow() {
    const dec  = document.getElementById('btnDecreaseFont');
    const sz   = document.getElementById('fontSize');
    const inc  = document.getElementById('btnIncreaseFont');
    if (!dec || !sz || !inc) return null;

    const row = document.createElement('div');
    row.className = 'tb-font-row';

    const pDec = makeProxy('btnDecreaseFont');
    const pInc = makeProxy('btnIncreaseFont');

    const pSz = document.createElement('input');
    pSz.type = 'number'; pSz.className = 'editor-input';
    pSz.value = sz.value; pSz.min = 6; pSz.max = 200;
    pSz.addEventListener('input', () => {
      sz.value = pSz.value;
      sz.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Keep synced
    setInterval(() => { if (document.activeElement !== pSz) pSz.value = sz.value; }, 250);

    row.appendChild(pDec);
    row.appendChild(pSz);
    row.appendChild(pInc);
    return row;
  }

  /* ── Helper: proxy for font-family select ── */
  function makeFontSelect() {
    const orig = document.getElementById('fontFamily');
    if (!orig) return null;
    const sel = orig.cloneNode(true);
    sel.removeAttribute('id');
    sel.addEventListener('change', () => {
      orig.value = sel.value;
      orig.dispatchEvent(new Event('change', { bubbles: true }));
    });
    setInterval(() => { if (document.activeElement !== sel) sel.value = orig.value; }, 250);
    return sel;
  }

  /* ── Helper: color picker row clone ── */
  function makeColorRow() {
    const tb = document.querySelector('.formatting-toolbar');
    if (!tb) return null;
    const pickers = tb.querySelectorAll('.color-picker-wrapper');
    if (!pickers.length) return null;

    const row = document.createElement('div');
    row.className = 'tb-color-row';
    pickers.forEach(p => {
      const clone = p.cloneNode(true);
      // Wire color input
      const origInput  = p.querySelector('input[type=color]');
      const cloneInput = clone.querySelector('input[type=color]');
      if (origInput && cloneInput) {
        cloneInput.addEventListener('input', () => {
          origInput.value = cloneInput.value;
          origInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
      row.appendChild(clone);
    });
    return row;
  }

  /* ── sec label helper ── */
  function sec(label) {
    const d = document.createElement('div');
    d.className = 'tb-sec';
    d.textContent = label;
    return d;
  }

  /* ── Build panels ── */
  function buildPanels() {
    const container = document.getElementById('pdfEditorContainer');
    if (!container || document.getElementById('tbPanelLeft')) return; // already built

    /* LEFT PANEL — Style tools */
    const left = document.createElement('div');
    left.id = 'tbPanelLeft';
    left.className = 'tb-panel';

    left.appendChild(sec('✦ Font'));
    const ff = makeFontSelect(); if (ff) left.appendChild(ff);
    const fr = makeFontRow();    if (fr) left.appendChild(fr);

    left.appendChild(sec('Style'));
    ['btnBold','btnItalic','btnUnderline'].forEach(id => {
      const p = makeProxy(id); if (p) left.appendChild(p);
    });

    left.appendChild(sec('Case'));
    ['btnUppercase','btnLowercase'].forEach(id => {
      const p = makeProxy(id); if (p) left.appendChild(p);
    });

    left.appendChild(sec('Color'));
    const eyeText = makeProxy('btnEyedropperText'); if (eyeText) left.appendChild(eyeText);
    const eyeBg   = makeProxy('btnEyedropperBg');   if (eyeBg)   left.appendChild(eyeBg);
    const cr = makeColorRow(); if (cr) left.appendChild(cr);

    /* RIGHT PANEL — Action tools */
    const right = document.createElement('div');
    right.id = 'tbPanelRight';
    right.className = 'tb-panel';

    right.appendChild(sec('⚡ Edit'));
    ['btnClearEdits','btnUndo','btnRedo'].forEach(id => {
      const p = makeProxy(id); if (p) right.appendChild(p);
    });

    right.appendChild(sec('Mode'));
    ['btnSelect','btnTypeText','btnClearText','btnCloneArea','btnWhiteEraser'].forEach(id => {
      const p = makeProxy(id); if (p) right.appendChild(p);
    });

    right.appendChild(sec('Insert'));
    ['btnInsertImage','btnShapeMenu'].forEach(id => {
      const p = makeProxy(id); if (p) right.appendChild(p);
    });

    right.appendChild(sec('Layer'));
    ['btnLayerToFront','btnLayerUp','btnLayerDown','btnLayerToBack'].forEach(id => {
      const orig = document.getElementById(id);
      if (orig) {
        const p = makeProxy(id);
        if (p) {
          // mirror display state
          p.style.display = orig.style.display || 'flex';
          new MutationObserver(() => { p.style.display = orig.style.display; })
            .observe(orig, { attributes: true, attributeFilter: ['style'] });
          right.appendChild(p);
        }
      }
    });

    container.appendChild(left);
    container.appendChild(right);

    /* Lucide icons re-render for cloned elements */
    if (window.lucide) window.lucide.createIcons();
  }

  /* ── Toggle button ── */
  function buildToggle() {
    if (document.getElementById('btnTbLayout')) return;
    const btn = document.createElement('button');
    btn.id = 'btnTbLayout';
    btn.setAttribute('data-tip', 'Side Panel Mode');
    btn.innerHTML = '⇔';
    document.body.appendChild(btn);

    let split = localStorage.getItem('_tbLayout') === 'split';
    apply(split);

    btn.addEventListener('click', () => {
      split = !split;
      localStorage.setItem('_tbLayout', split ? 'split' : 'top');
      apply(split);
    });

    function apply(s) {
      document.body.classList.toggle('tb-split', s);
      btn.setAttribute('data-tip', s ? 'Top Bar Mode' : 'Side Panel Mode');
      btn.textContent = s ? '▤' : '⇔';
      if (s && window.lucide) window.lucide.createIcons();
    }
  }

  /* ── Init after all scripts loaded ── */
  function init() {
    if (!document.querySelector('.formatting-toolbar')) return;
    buildPanels();
    buildToggle();
  }

  // Run after window load (সব script নিশ্চিতভাবে লোড হবে)
  if (document.readyState === 'complete') {
    setTimeout(init, 100);
  } else {
    window.addEventListener('load', () => setTimeout(init, 100));
  }

})();
