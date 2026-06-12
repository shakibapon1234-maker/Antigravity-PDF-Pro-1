/**
 * Antigravity PDF Pro — Phase 4-C
 * Find & Replace Text in PDF
 * PDF এর মধ্যে text খোঁজে এবং highlight করে দেখায়
 */

const FindReplace = (() => {
  let isVisible = false;
  let currentDoc = null;
  let searchResults = []; // [{page, x, y, width, height, text}]
  let currentResultIndex = -1;
  let searchHighlightCanvas = null;
  let activeSearchTerm = '';

  // ─── Init UI ─────────────────────────────────────────────────────────────────
  function init() {
    if (document.getElementById('find-replace-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'find-replace-panel';
    panel.className = 'find-replace-panel hidden';
    panel.innerHTML = `
      <div class="find-replace-header">
        <i data-lucide="search"></i>
        <span>Find &amp; Replace</span>
        <button class="btn-icon find-close-btn" title="Close (Esc)">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="find-replace-row">
        <label>Find</label>
        <div class="find-input-wrap">
          <input type="text" id="find-input" placeholder="Search text..." autocomplete="off" spellcheck="false">
          <button class="btn-icon" id="find-clear-btn" title="Clear" style="display:none">
            <i data-lucide="x-circle"></i>
          </button>
        </div>
        <div class="find-options">
          <label title="Case sensitive">
            <input type="checkbox" id="find-case-sensitive"> Aa
          </label>
          <label title="Whole word">
            <input type="checkbox" id="find-whole-word"> W
          </label>
        </div>
      </div>

      <div class="find-replace-row">
        <label>Replace</label>
        <input type="text" id="replace-input" placeholder="Replace with..." autocomplete="off" spellcheck="false">
        <div class="find-replace-btn-group">
          <button class="btn-sm" id="replace-one-btn" disabled>Replace</button>
          <button class="btn-sm" id="replace-all-btn" disabled>Replace All</button>
        </div>
      </div>

      <div class="find-nav-row">
        <button class="btn-icon" id="find-prev-btn" title="Previous (Shift+Enter)" disabled>
          <i data-lucide="chevron-up"></i>
        </button>
        <span id="find-count">No results</span>
        <button class="btn-icon" id="find-next-btn" title="Next (Enter)" disabled>
          <i data-lucide="chevron-down"></i>
        </button>
      </div>

      <div id="find-replace-log" class="find-replace-log" style="display:none"></div>
    `;

    // Attach to editor area
    const editorArea = document.getElementById('editor-area') ||
                       document.querySelector('.editor-container') ||
                       document.body;
    editorArea.appendChild(panel);

    wireEvents(panel);
    if (window.lucide) window.lucide.createIcons();
  }

  function wireEvents(panel) {
    const findInput = document.getElementById('find-input');
    const clearBtn = document.getElementById('find-clear-btn');

    findInput.addEventListener('input', () => {
      const val = findInput.value;
      clearBtn.style.display = val ? 'inline-flex' : 'none';
      debounceSearch();
    });

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.shiftKey ? navigate(-1) : navigate(1);
      }
      if (e.key === 'Escape') hide();
    });

    clearBtn.addEventListener('click', () => {
      findInput.value = '';
      clearBtn.style.display = 'none';
      clearHighlights();
      updateCount(0);
    });

    document.getElementById('find-case-sensitive').addEventListener('change', debounceSearch);
    document.getElementById('find-whole-word').addEventListener('change', debounceSearch);
    document.getElementById('find-prev-btn').addEventListener('click', () => navigate(-1));
    document.getElementById('find-next-btn').addEventListener('click', () => navigate(1));
    document.getElementById('replace-one-btn').addEventListener('click', replaceOne);
    document.getElementById('replace-all-btn').addEventListener('click', replaceAll);
    panel.querySelector('.find-close-btn').addEventListener('click', hide);
  }

  // ─── Search ───────────────────────────────────────────────────────────────────
  let debounceTimer = null;
  function debounceSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 350);
  }

  // ─── Merge raw PDF text items into lines (mirrors renderer.js mergeTextItems) ─
  function mergeRawTextItems(items) {
    if (!items || items.length === 0) return [];

    // Group into rows by Y coordinate
    const rows = [];
    items.forEach(item => {
      if (!item.str || !item.str.trim()) return;
      const y = item.transform[5];
      let foundRow = rows.find(r => Math.abs(r.y - y) < 4);
      if (foundRow) foundRow.items.push(item);
      else rows.push({ y, items: [item] });
    });

    const merged = [];
    rows.forEach(row => {
      row.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let cur = null;
      row.items.forEach(item => {
        if (!cur) {
          cur = { ...item, transform: [...item.transform] };
          return;
        }
        const endX   = cur.transform[4] + cur.width;
        const startX = item.transform[4];
        const gap    = startX - endX;

        if (gap >= -5 && gap < 15) {
          const needsSpace = gap > 1.5 &&
                             !cur.str.endsWith(' ') &&
                             !item.str.startsWith(' ');
          cur.str    += (needsSpace ? ' ' : '') + item.str;
          cur.width   = (item.transform[4] + item.width) - cur.transform[4];
          cur.height  = Math.max(cur.height, item.height);
          // keep fontName of the first (leftmost) item
        } else {
          merged.push(cur);
          cur = { ...item, transform: [...item.transform] };
        }
      });
      if (cur) merged.push(cur);
    });
    return merged;
  }

  async function runSearch() {
    const term = document.getElementById('find-input').value;
    if (!term || !currentDoc) {
      clearHighlights();
      updateCount(0);
      return;
    }

    activeSearchTerm = term;
    const caseSensitive = document.getElementById('find-case-sensitive').checked;
    const wholeWord = document.getElementById('find-whole-word').checked;

    searchResults = [];
    currentResultIndex = -1;

    for (let p = 1; p <= currentDoc.numPages; p++) {
      const page = await currentDoc.getPage(p);
      const tc = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      // Use merged items (same as renderer.js) so context/width match what is drawn
      const mergedItems = mergeRawTextItems(tc.items);

      for (const item of mergedItems) {
        const str = item.str;
        const matches = findMatches(str, term, caseSensitive, wholeWord);

        for (const match of matches) {
          // PDF.js transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
          const tx = item.transform;
          searchResults.push({
            page: p,
            text: str.substring(match.start, match.end),
            context: str,
            matchStart: match.start,
            matchEnd: match.end,
            fontName: getStandardFontName(item.fontName, tc.styles),
            // Bounding box from merged transform (matches renderer coordinates)
            x: tx[4],
            y: viewport.height - tx[5],
            originalY: tx[5],
            width: item.width || (match.end - match.start) * (tx[0] || 12),
            height: Math.abs(tx[3]) || item.height || 14,
          });
        }
      }
    }

    updateCount(searchResults.length);

    const replaceOneBtn = document.getElementById('replace-one-btn');
    const replaceAllBtn = document.getElementById('replace-all-btn');
    replaceOneBtn.disabled = searchResults.length === 0;
    replaceAllBtn.disabled = searchResults.length === 0;

    if (searchResults.length > 0) {
      currentResultIndex = 0;
      highlightResult(0);
    } else {
      clearHighlights();
    }
  }

  function findMatches(str, term, caseSensitive, wholeWord) {
    const matches = [];
    let s = str;
    let t = term;

    if (!caseSensitive) { s = s.toLowerCase(); t = t.toLowerCase(); }

    let idx = 0;
    while (true) {
      const pos = s.indexOf(t, idx);
      if (pos === -1) break;

      if (wholeWord) {
        const before = pos === 0 || !/\w/.test(s[pos - 1]);
        const after = pos + t.length >= s.length || !/\w/.test(s[pos + t.length]);
        if (before && after) matches.push({ start: pos, end: pos + t.length });
      } else {
        matches.push({ start: pos, end: pos + t.length });
      }
      idx = pos + 1;
    }
    return matches;
  }

  function updateCount(total) {
    const el = document.getElementById('find-count');
    if (total === 0) {
      el.textContent = activeSearchTerm ? '0 results' : 'No results';
      el.style.color = activeSearchTerm ? 'var(--accent-pink, #e05)' : '';
    } else {
      const cur = currentResultIndex >= 0 ? currentResultIndex + 1 : 1;
      el.textContent = `${cur} of ${total}`;
      el.style.color = '';
    }

    const prev = document.getElementById('find-prev-btn');
    const next = document.getElementById('find-next-btn');
    prev.disabled = total === 0;
    next.disabled = total === 0;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────
  function navigate(delta) {
    if (searchResults.length === 0) return;
    currentResultIndex = (currentResultIndex + delta + searchResults.length) % searchResults.length;
    highlightResult(currentResultIndex);
    updateCount(searchResults.length);
  }

  function highlightResult(index) {
    const result = searchResults[index];
    if (!result) return;

    // Navigate to the right page
    document.dispatchEvent(new CustomEvent('thumbnail:goToPage', { detail: { page: result.page } }));
    if (window.goToPage) window.goToPage(result.page);

    // Draw highlight overlay
    drawHighlight(result);
  }

  function drawHighlight(result) {
    // Remove old highlight canvas
    clearHighlightCanvas();

    // Find the main PDF canvas
    const mainCanvas = document.getElementById('pdf-canvas') ||
                       document.querySelector('canvas.pdf-canvas') ||
                       document.querySelector('#canvas-container canvas');
    if (!mainCanvas) return;

    const overlay = document.createElement('canvas');
    overlay.id = 'find-highlight-canvas';
    overlay.className = 'find-highlight-canvas';
    overlay.width = mainCanvas.width;
    overlay.height = mainCanvas.height;
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      pointer-events: none;
      z-index: 200;
      width: ${mainCanvas.offsetWidth}px;
      height: ${mainCanvas.offsetHeight}px;
    `;

    mainCanvas.parentElement.style.position = 'relative';
    mainCanvas.parentElement.appendChild(overlay);
    searchHighlightCanvas = overlay;

    const ctx = overlay.getContext('2d');
    const scaleX = mainCanvas.width / (mainCanvas.offsetWidth || mainCanvas.width);

    // Draw all results faintly
    ctx.fillStyle = 'rgba(255, 220, 0, 0.3)';
    searchResults.forEach(r => {
      if (r.page === result.page) {
        ctx.fillRect(r.x, r.y - r.height, r.width, r.height + 2);
      }
    });

    // Draw current result prominently
    ctx.fillStyle = 'rgba(255, 140, 0, 0.6)';
    ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(result.x, result.y - result.height, result.width, result.height + 2);
    ctx.strokeRect(result.x, result.y - result.height, result.width, result.height + 2);

    // Scroll to result
    overlay.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearHighlights() {
    clearHighlightCanvas();
    searchResults = [];
    currentResultIndex = -1;
    activeSearchTerm = '';
  }

  function clearHighlightCanvas() {
    if (searchHighlightCanvas) {
      searchHighlightCanvas.remove();
      searchHighlightCanvas = null;
    }
    document.getElementById('find-highlight-canvas')?.remove();
  }

  // ─── Replace ──────────────────────────────────────────────────────────────────
  function replaceOne() {
    if (currentResultIndex < 0 || searchResults.length === 0) return;
    const replaceWith = document.getElementById('replace-input').value;
    const result = searchResults[currentResultIndex];

    logReplaceAction(`Replaced "${result.text}" → "${replaceWith}" on page ${result.page}`);

    // Dispatch replace event so the main editor can handle it
    document.dispatchEvent(new CustomEvent('findreplace:replace', {
      detail: { result, replaceWith, replaceAll: false }
    }));

    // Re-run search after a brief delay
    setTimeout(runSearch, 400);
  }

  function replaceAll() {
    if (searchResults.length === 0) return;
    const replaceWith = document.getElementById('replace-input').value;
    const count = searchResults.length;

    logReplaceAction(`Replaced all ${count} occurrences of "${activeSearchTerm}" → "${replaceWith}"`);

    document.dispatchEvent(new CustomEvent('findreplace:replace', {
      detail: { results: [...searchResults], replaceWith, replaceAll: true }
    }));

    setTimeout(runSearch, 400);
  }

  function logReplaceAction(msg) {
    const log = document.getElementById('find-replace-log');
    if (!log) return;
    log.style.display = 'block';
    const entry = document.createElement('div');
    entry.className = 'find-log-entry';
    entry.textContent = `✓ ${msg}`;
    log.prepend(entry);
    // Keep only last 5
    while (log.children.length > 5) log.removeChild(log.lastChild);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  function open(doc) {
    init();
    if (doc) currentDoc = doc;
    const panel = document.getElementById('find-replace-panel');
    if (panel) {
      panel.classList.remove('hidden');
      isVisible = true;
      setTimeout(() => document.getElementById('find-input')?.focus(), 50);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function hide() {
    const panel = document.getElementById('find-replace-panel');
    if (panel) panel.classList.add('hidden');
    isVisible = false;
    clearHighlights();
  }

  function toggle(doc) {
    if (isVisible) hide(); else open(doc);
  }

  function setDocument(doc) {
    currentDoc = doc;
  }

  return { open, hide, toggle, setDocument, isVisible: () => isVisible };
})();

window.FindReplace = FindReplace;

// Global keyboard shortcut: Ctrl+F
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    FindReplace.toggle(window._currentPdfDoc || null);
  }
});
