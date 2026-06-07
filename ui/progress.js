// ─────────────────────────────────────────────────────────────────────────────
// ui/progress.js — Antigravity PDF Pro
// Global Progress Bar + Toast Notification System
// Phase 2-A Implementation
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    // ── DOM তৈরি করা ──────────────────────────────────────────────────────────
    function createUI() {
        // Global Progress Bar (top of screen)
        if (!document.getElementById('agProgressBar')) {
            const bar = document.createElement('div');
            bar.id = 'agProgressBar';
            bar.innerHTML = `
                <div id="agProgressInner"></div>
                <div id="agProgressGlow"></div>
            `;
            document.body.appendChild(bar);
        }

        // Full-screen overlay spinner (for heavy operations)
        if (!document.getElementById('agSpinnerOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'agSpinnerOverlay';
            overlay.innerHTML = `
                <div id="agSpinnerBox">
                    <div id="agSpinnerRing"></div>
                    <div id="agSpinnerLabel">Processing...</div>
                    <div id="agSpinnerSub"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        // Toast container
        if (!document.getElementById('agToastContainer')) {
            const container = document.createElement('div');
            container.id = 'agToastContainer';
            document.body.appendChild(container);
        }
    }

    // ── Progress Bar API ──────────────────────────────────────────────────────
    let progressTimer = null;
    let currentProgress = 0;

    window.AGProgress = {
        // Simple indeterminate progress (জানা নেই কতক্ষণ লাগবে)
        start: function (label, sub) {
            const bar = document.getElementById('agProgressBar');
            const inner = document.getElementById('agProgressInner');
            if (!bar || !inner) return;

            currentProgress = 0;
            bar.classList.add('ag-progress-active', 'ag-progress-indeterminate');
            inner.style.width = '0%';

            // label থাকলে spinner দেখাও
            if (label) {
                AGProgress.showSpinner(label, sub);
            }
        },

        // Determinate progress (0–100)
        set: function (percent, label, sub) {
            const bar = document.getElementById('agProgressBar');
            const inner = document.getElementById('agProgressInner');
            if (!bar || !inner) return;

            currentProgress = Math.min(100, Math.max(0, percent));
            bar.classList.add('ag-progress-active');
            bar.classList.remove('ag-progress-indeterminate');
            inner.style.width = currentProgress + '%';

            if (label) {
                const lbl = document.getElementById('agSpinnerLabel');
                if (lbl) lbl.textContent = label;
            }
            if (sub !== undefined) {
                const sublbl = document.getElementById('agSpinnerSub');
                if (sublbl) sublbl.textContent = sub || '';
            }
        },

        // Operation শেষ — progress 100% এ নিয়ে hide করো
        done: function () {
            const bar = document.getElementById('agProgressBar');
            const inner = document.getElementById('agProgressInner');
            if (!bar || !inner) return;

            bar.classList.remove('ag-progress-indeterminate');
            bar.classList.add('ag-progress-active');
            inner.style.width = '100%';

            AGProgress.hideSpinner();

            clearTimeout(progressTimer);
            progressTimer = setTimeout(() => {
                bar.classList.remove('ag-progress-active');
                inner.style.width = '0%';
                currentProgress = 0;
            }, 600);
        },

        // Error হলে red দেখাও
        error: function () {
            const bar = document.getElementById('agProgressBar');
            if (!bar) return;

            bar.classList.add('ag-progress-error');
            bar.classList.remove('ag-progress-indeterminate');
            AGProgress.hideSpinner();

            clearTimeout(progressTimer);
            progressTimer = setTimeout(() => {
                bar.classList.remove('ag-progress-active', 'ag-progress-error');
                currentProgress = 0;
            }, 1200);
        },

        // Spinner overlay
        showSpinner: function (label, sub) {
            const overlay = document.getElementById('agSpinnerOverlay');
            const lbl = document.getElementById('agSpinnerLabel');
            const sublbl = document.getElementById('agSpinnerSub');
            if (!overlay) return;

            if (lbl) lbl.textContent = label || 'Processing...';
            if (sublbl) sublbl.textContent = sub || '';
            overlay.classList.add('ag-spinner-visible');
        },

        hideSpinner: function () {
            const overlay = document.getElementById('agSpinnerOverlay');
            if (overlay) overlay.classList.remove('ag-spinner-visible');
        }
    };

    // ── Toast API ──────────────────────────────────────────────────────────────
    let toastIdCounter = 0;

    window.AGToast = {
        show: function (message, type, duration) {
            const container = document.getElementById('agToastContainer');
            if (!container) return;

            type = type || 'info'; // 'success' | 'error' | 'info' | 'warning'
            duration = duration !== undefined ? duration : 3500;

            const id = 'ag-toast-' + (++toastIdCounter);
            const icons = {
                success: '✓',
                error: '✕',
                info: 'ℹ',
                warning: '⚠'
            };

            const toast = document.createElement('div');
            toast.id = id;
            toast.className = 'ag-toast ag-toast-' + type;
            toast.innerHTML = `
                <span class="ag-toast-icon">${icons[type] || icons.info}</span>
                <span class="ag-toast-msg">${message}</span>
                <button class="ag-toast-close" onclick="AGToast.dismiss('${id}')">×</button>
            `;

            container.appendChild(toast);

            // Animate in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => toast.classList.add('ag-toast-show'));
            });

            // Auto dismiss
            if (duration > 0) {
                setTimeout(() => AGToast.dismiss(id), duration);
            }

            return id;
        },

        dismiss: function (id) {
            const toast = document.getElementById(id);
            if (!toast) return;
            toast.classList.remove('ag-toast-show');
            toast.classList.add('ag-toast-hide');
            setTimeout(() => toast && toast.remove(), 400);
        },

        // Shorthand helpers
        success: function (msg, duration) { return AGToast.show(msg, 'success', duration); },
        error:   function (msg, duration) { return AGToast.show(msg, 'error',   duration !== undefined ? duration : 5000); },
        info:    function (msg, duration) { return AGToast.show(msg, 'info',    duration); },
        warning: function (msg, duration) { return AGToast.show(msg, 'warning', duration); }
    };

    // ── CSS inject করা ────────────────────────────────────────────────────────
    function injectCSS() {
        if (document.getElementById('ag-progress-styles')) return;
        const style = document.createElement('style');
        style.id = 'ag-progress-styles';
        style.textContent = `
            /* ── Progress Bar ── */
            #agProgressBar {
                position: fixed;
                top: 0; left: 0; right: 0;
                height: 3px;
                z-index: 999999;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
            }
            #agProgressBar.ag-progress-active {
                opacity: 1;
            }
            #agProgressInner {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #00d4ff, #b829f9, #ff6b6b);
                border-radius: 0 2px 2px 0;
                transition: width 0.3s ease;
                position: relative;
                z-index: 1;
            }
            #agProgressGlow {
                position: absolute;
                top: 0; right: 0;
                width: 60px; height: 3px;
                background: radial-gradient(ellipse at center, rgba(184,41,249,0.8) 0%, transparent 70%);
                filter: blur(3px);
                pointer-events: none;
            }
            /* Indeterminate animation */
            #agProgressBar.ag-progress-indeterminate #agProgressInner {
                width: 35% !important;
                animation: ag-progress-slide 1.4s ease-in-out infinite;
            }
            @keyframes ag-progress-slide {
                0%   { margin-left: -35%; }
                60%  { margin-left: 100%; }
                100% { margin-left: 100%; }
            }
            /* Error state */
            #agProgressBar.ag-progress-error #agProgressInner {
                background: linear-gradient(90deg, #ff4444, #ff6b6b) !important;
                width: 100% !important;
            }

            /* ── Spinner Overlay ── */
            #agSpinnerOverlay {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 20, 0.75);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 99998;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s ease;
            }
            #agSpinnerOverlay.ag-spinner-visible {
                opacity: 1;
                pointer-events: all;
            }
            #agSpinnerBox {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                padding: 40px 48px;
                background: rgba(22, 22, 40, 0.95);
                border: 1px solid rgba(184, 41, 249, 0.3);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(184,41,249,0.15);
            }
            #agSpinnerRing {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                border: 3px solid rgba(184, 41, 249, 0.2);
                border-top-color: #b829f9;
                border-right-color: #00d4ff;
                animation: ag-spin 0.9s linear infinite;
            }
            @keyframes ag-spin {
                to { transform: rotate(360deg); }
            }
            #agSpinnerLabel {
                font-family: 'Outfit', sans-serif;
                font-size: 15px;
                font-weight: 600;
                color: #e8e8ff;
                letter-spacing: 0.02em;
            }
            #agSpinnerSub {
                font-family: 'Outfit', sans-serif;
                font-size: 12px;
                color: rgba(255,255,255,0.45);
                text-align: center;
                max-width: 240px;
            }

            /* ── Toast Container ── */
            #agToastContainer {
                position: fixed;
                bottom: 28px;
                right: 28px;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: flex-end;
                pointer-events: none;
            }
            .ag-toast {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 13px 18px;
                border-radius: 12px;
                font-family: 'Outfit', sans-serif;
                font-size: 13.5px;
                font-weight: 500;
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                border: 1px solid rgba(255,255,255,0.08);
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                pointer-events: all;
                cursor: default;
                max-width: 340px;
                transform: translateX(120%);
                transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                            opacity 0.35s ease;
                opacity: 0;
                white-space: nowrap;
            }
            .ag-toast-show {
                transform: translateX(0);
                opacity: 1;
            }
            .ag-toast-hide {
                transform: translateX(120%);
                opacity: 0;
            }
            .ag-toast-success { background: rgba(16, 185, 129, 0.92); color: #fff; border-color: rgba(16,185,129,0.4); }
            .ag-toast-error   { background: rgba(239, 68, 68, 0.92);  color: #fff; border-color: rgba(239,68,68,0.4);  }
            .ag-toast-info    { background: rgba(99, 102, 241, 0.92); color: #fff; border-color: rgba(99,102,241,0.4); }
            .ag-toast-warning { background: rgba(245, 158, 11, 0.92); color: #fff; border-color: rgba(245,158,11,0.4); }
            .ag-toast-icon {
                font-size: 15px;
                font-weight: 700;
                flex-shrink: 0;
            }
            .ag-toast-msg { flex: 1; line-height: 1.4; white-space: normal; }
            .ag-toast-close {
                background: none;
                border: none;
                color: rgba(255,255,255,0.7);
                font-size: 18px;
                cursor: pointer;
                padding: 0 0 0 6px;
                line-height: 1;
                flex-shrink: 0;
            }
            .ag-toast-close:hover { color: #fff; }
        `;
        document.head.appendChild(style);
    }

    // ── Operations Patch করা ──────────────────────────────────────────────────
    // সব heavy operation গুলোতে progress/toast hook করা হবে

    function patchOperations() {

        // ── 1. Merge PDF ──────────────────────────────────────────────────────
        const origMergeBtn = document.getElementById('btnMergeFiles');
        if (origMergeBtn) {
            const newMerge = origMergeBtn.cloneNode(true);
            origMergeBtn.parentNode.replaceChild(newMerge, origMergeBtn);

            newMerge.addEventListener('click', async function (e) {
                e.stopImmediatePropagation();
                const { PDFDocument } = window.PDFLib;
                const listItems = document.querySelectorAll('.merge-file-item');
                if (listItems.length < 2) {
                    AGToast.warning('কমপক্ষে ২টি PDF ফাইল যোগ করুন।');
                    return;
                }

                AGProgress.start('PDF Merge করা হচ্ছে...', listItems.length + 'টি ফাইল');
                AGProgress.set(5);

                try {
                    const mergedPdf = await PDFDocument.create();
                    const mergeFilesArr = window._mergeFiles || [];

                    for (let i = 0; i < mergeFilesArr.length; i++) {
                        AGProgress.set(10 + Math.round((i / mergeFilesArr.length) * 80),
                            'মার্জ হচ্ছে...', `ফাইল ${i + 1} / ${mergeFilesArr.length}`);
                        const file = mergeFilesArr[i];
                        const arrayBuffer = await file.arrayBuffer();
                        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                        copiedPages.forEach(page => mergedPdf.addPage(page));
                    }

                    AGProgress.set(92, 'সেভ করা হচ্ছে...');
                    const pdfBytes = await mergedPdf.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    window.saveAs(blob, 'merged_document.pdf');

                    AGProgress.done();
                    AGToast.success('✓ PDF Merge সম্পন্ন! ফাইল ডাউনলোড হয়েছে।');
                } catch (err) {
                    console.error(err);
                    AGProgress.error();
                    AGToast.error('Merge ব্যর্থ: ' + err.message);
                }
            });
        }

        // ── 2. Split PDF ──────────────────────────────────────────────────────
        const origSplitBtn = document.getElementById('btnDownloadSplit');
        if (origSplitBtn) {
            origSplitBtn.addEventListener('click', function () {
                // split operation শুরু হলে progress দেখাও
                AGProgress.start('PDF Split করা হচ্ছে...');
                setTimeout(() => AGProgress.set(40, 'পেজ প্রসেস হচ্ছে...'), 100);
                // done() ধরার জন্য saveAs intercept
                const origSaveAs = window.saveAs;
                window.saveAs = function () {
                    origSaveAs.apply(this, arguments);
                    window.saveAs = origSaveAs;
                    AGProgress.done();
                    AGToast.success('✓ Split সম্পন্ন! ফাইল ডাউনলোড হয়েছে।');
                };
            }, true); // capture phase তে ধরব
        }

        // ── 3. Rotate PDF ─────────────────────────────────────────────────────
        const origRotateBtn = document.getElementById('btnRotatePdf');
        if (origRotateBtn) {
            origRotateBtn.addEventListener('click', function () {
                AGProgress.start('PDF Rotate হচ্ছে...');
            }, true);
        }

        // ── 4. Watermark ──────────────────────────────────────────────────────
        const origWatermarkBtn = document.getElementById('btnApplyWatermark');
        if (origWatermarkBtn) {
            origWatermarkBtn.addEventListener('click', function () {
                AGProgress.start('Watermark যোগ হচ্ছে...');
            }, true);
        }

        // ── 5. PDF Save ───────────────────────────────────────────────────────
        const origSaveBtn = document.getElementById('btnSavePdf');
        if (origSaveBtn) {
            origSaveBtn.addEventListener('click', function () {
                AGProgress.start('PDF সেভ হচ্ছে...');
                AGProgress.set(20);
            }, true);
        }

        // ── 6. Convert PDF to Image ───────────────────────────────────────────
        const origConvertPti = document.getElementById('btnConvertPdfToImage');
        if (origConvertPti) {
            origConvertPti.addEventListener('click', function () {
                AGProgress.start('Image Convert হচ্ছে...', 'প্রতিটি পেজ রেন্ডার হচ্ছে');
            }, true);
        }

        // ── 7. PDF to Word ────────────────────────────────────────────────────
        const origPdfToWord = document.getElementById('btnConvertPdfToWord');
        if (origPdfToWord) {
            origPdfToWord.addEventListener('click', function () {
                AGProgress.start('Word-এ Convert হচ্ছে...');
            }, true);
        }

        // ── 8. Image to PDF ───────────────────────────────────────────────────
        const origImgToPdf = document.getElementById('btnConvertImageToPdf');
        if (origImgToPdf) {
            origImgToPdf.addEventListener('click', function () {
                AGProgress.start('PDF তৈরি হচ্ছে...');
            }, true);
        }

        // ── 9. OCR ────────────────────────────────────────────────────────────
        const origOcrBtn = document.getElementById('btnStartOcr');
        if (origOcrBtn) {
            origOcrBtn.addEventListener('click', function () {
                AGProgress.start('OCR চলছে...', 'এটি কিছুটা সময় নিতে পারে');
            }, true);
        }

        // ── 10. PDF Load (file open) ──────────────────────────────────────────
        // window.loadPdfFile patch করা
        if (typeof window.loadPdfFile === 'function') {
            const origLoad = window.loadPdfFile;
            window.loadPdfFile = async function () {
                AGProgress.start('PDF লোড হচ্ছে...');
                try {
                    const result = await origLoad.apply(this, arguments);
                    AGProgress.done();
                    return result;
                } catch (err) {
                    AGProgress.error();
                    AGToast.error('PDF লোড ব্যর্থ হয়েছে।');
                    throw err;
                }
            };
        }
    }

    // ── global saveAs intercept for rotate/watermark/split (fallback) ─────────
    function patchSaveAs() {
        const origSaveAs = window.saveAs;
        if (!origSaveAs || origSaveAs._agPatched) return;

        window.saveAs = function (blob, name) {
            // progress bar যদি active থাকে তাহলে done করো
            const bar = document.getElementById('agProgressBar');
            if (bar && bar.classList.contains('ag-progress-active') &&
                bar.classList.contains('ag-progress-indeterminate')) {
                setTimeout(() => {
                    AGProgress.done();
                    // operation-specific success toast
                    if (name) {
                        const n = name.replace(/_/g, ' ');
                        AGToast.success('✓ সম্পন্ন! ' + n + ' ডাউনলোড হয়েছে।');
                    }
                }, 200);
            }
            origSaveAs.apply(this, arguments);
        };
        window.saveAs._agPatched = true;
    }

    // ── savePdfChanges wrap ───────────────────────────────────────────────────
    function patchSavePdf() {
        if (typeof window.savePdfChanges !== 'function') return;
        if (window.savePdfChanges._agPatched) return;

        const orig = window.savePdfChanges;
        window.savePdfChanges = async function () {
            AGProgress.start('PDF সেভ হচ্ছে...');
            AGProgress.set(15);
            try {
                const result = await orig.apply(this, arguments);
                AGProgress.done();
                AGToast.success('✓ PDF সফলভাবে সেভ হয়েছে!');
                return result;
            } catch (err) {
                AGProgress.error();
                AGToast.error('Save ব্যর্থ: ' + (err && err.message ? err.message : 'Unknown error'));
                throw err;
            }
        };
        window.savePdfChanges._agPatched = true;
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        injectCSS();
        createUI();

        // DOM ready হলে operations patch করব
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(() => {
                    patchOperations();
                    patchSaveAs();
                    patchSavePdf();
                }, 500); // সব script লোড হওয়ার পর
            });
        } else {
            setTimeout(() => {
                patchOperations();
                patchSaveAs();
                patchSavePdf();
            }, 500);
        }
    }

    init();

    // Public API expose করা
    window.AGProgress = window.AGProgress;
    window.AGToast = window.AGToast;

})();
