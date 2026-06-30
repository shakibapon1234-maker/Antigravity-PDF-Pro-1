/**
 * Antigravity PDF Pro — Web Gate
 * ────────────────────────────────────────
 * ব্রাউজার ভার্সনে (GitHub Pages ইত্যাদি) চলার সময় কিছু advanced টুল
 * ডেস্কটপ অ্যাপের জন্য রিজার্ভ রাখা হয়, যাতে:
 *  1. ফ্রি ইউজার মূল্যবান কাজ করতে পারে এবং ব্র্যান্ডে আস্থা তৈরি হয়
 *  2. ভারী/প্রিমিয়াম ফিচার ব্যবহার করতে ডেস্কটপ অ্যাপ ডাউনলোড করতে হয় (লাইসেন্স রেভিনিউর জন্য জরুরি)
 *
 * এই ফাইলটা শুধুমাত্র ব্রাউজারে (window.electronAPI না থাকলে) সক্রিয় হয়।
 * ডেস্কটপ অ্যাপে (Electron) এই গেট সম্পূর্ণ নিষ্ক্রিয় থাকে — সব টুল সবসময় খোলা।
 */

const WebGate = (() => {

    // ── ডেস্কটপ অ্যাপ ডাউনলোড লিংক (প্রয়োজনমতো আপডেট করুন) ──────────────────
    const DOWNLOAD_URL = 'https://antigravitypdf.com/download';

    // ── ব্রাউজারে ফ্রি/আনলিমিটেড থাকা টুলগুলো (মার্কেট ধরার জন্য) ─────────────
    // বাকি সব data-tab, যেগুলো এই লিস্টে নেই, ব্রাউজারে গেটেড থাকবে।
    const FREE_IN_BROWSER = new Set([
        'dashboard',
        'merge',
        'split',
        'compress',
        'rotate',
        'pdf-to-image',
        'image-to-pdf',
        'pdf-to-excel',
        'excel-to-pdf',
        'pdf-to-pptx',
        'excel-to-word',
        'word-to-excel',
        'image-to-word',
        'image-converter',
        'converter',        // PDF → Word
        'watermark-pdf',
        'organize-pdf',
        'crop-pdf',
        'protect-pdf',
        'unlock-pdf',
    ]);

    // ── ফ্রি টুলগুলোতে হালকা ফাইল-সাইজ লিমিট (ভারী ইউজার ডেস্কটপে যাবে) ───────
    const FREE_FILE_SIZE_LIMIT_MB = 50;
    const FREE_FILE_SIZE_LIMIT_BYTES = FREE_FILE_SIZE_LIMIT_MB * 1024 * 1024;

    let modalEl = null;

    // ── পরিবেশ শনাক্তকরণ ─────────────────────────────────────────────────────
    function isDesktopApp() {
        return !!(window.electronAPI && window.electronAPI.isElectron);
    }

    function isGatedTab(tabId) {
        if (isDesktopApp()) return false; // ডেস্কটপে কোনো গেট নেই
        return !FREE_IN_BROWSER.has(tabId);
    }

    // ── "ডেস্কটপ অ্যাপে আছে" মডাল তৈরি ও প্রদর্শন ───────────────────────────────
    function buildModal() {
        if (modalEl) return modalEl;

        const overlay = document.createElement('div');
        overlay.id = 'webGateModal';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(8,8,14,0.75); backdrop-filter: blur(4px);
            display: none; align-items: center; justify-content: center;
            padding: 20px;
        `;

        overlay.innerHTML = `
            <div style="
                background: var(--bg-surface, #12121f);
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                border-radius: var(--radius-lg, 18px);
                max-width: 420px; width: 100%;
                padding: 32px 28px;
                text-align: center;
                box-shadow: var(--shadow-card, 0 4px 24px rgba(0,0,0,0.35));
            ">
                <div style="
                    width: 56px; height: 56px; margin: 0 auto 18px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, var(--primary, #b829f9), var(--accent-blue, #00d4ff));
                    display: flex; align-items: center; justify-content: center;
                    font-size: 26px;
                ">🖥️</div>
                <h3 style="
                    color: var(--text, #fff); font-size: 19px; font-weight: 700;
                    margin: 0 0 8px;
                ">এই ফিচারটি ডেস্কটপ অ্যাপে আছে</h3>
                <p id="webGateModalMsg" style="
                    color: var(--text-muted, #6a7090); font-size: 14px;
                    line-height: 1.6; margin: 0 0 24px;
                ">এই টুলটি Antigravity PDF Pro ডেস্কটপ অ্যাপে ব্যবহার করা যায় — সম্পূর্ণ ফ্রি, অফলাইন, এবং কোনো লিমিট ছাড়াই।</p>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <a href="${DOWNLOAD_URL}" target="_blank" rel="noopener" style="
                        display: block; text-decoration: none;
                        background: linear-gradient(135deg, var(--primary, #b829f9), var(--accent-blue, #00d4ff));
                        color: #fff; font-weight: 600; font-size: 14px;
                        padding: 13px 20px; border-radius: var(--radius, 12px);
                    ">⬇️ ডেস্কটপ অ্যাপ ডাউনলোড করুন (ফ্রি)</a>
                    <button id="webGateModalClose" style="
                        background: none; border: 1px solid var(--border, rgba(255,255,255,0.1));
                        color: var(--text-dim, #c8d0e8); font-size: 13px;
                        padding: 11px 20px; border-radius: var(--radius, 12px);
                        cursor: pointer;
                    ">পরে দেখব</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) hideModal();
        });
        overlay.querySelector('#webGateModalClose').addEventListener('click', hideModal);

        modalEl = overlay;
        return overlay;
    }

    function showModal(customMessage) {
        const overlay = buildModal();
        const msgEl = overlay.querySelector('#webGateModalMsg');
        if (customMessage && msgEl) msgEl.textContent = customMessage;
        overlay.style.display = 'flex';
    }

    function hideModal() {
        if (modalEl) modalEl.style.display = 'none';
    }

    // ── ফ্রি টুলে ফাইল সাইজ লিমিট চেক ───────────────────────────────────────
    // ফ্রি (ব্রাউজার) মোডে বড় ফাইলে এই ফাংশন true রিটার্ন করে এবং একটা সতর্কতা মডাল দেখায়।
    function checkFileSizeLimit(file) {
        if (isDesktopApp()) return false; // ডেস্কটপে লিমিট নেই
        if (!file || typeof file.size !== 'number') return false;
        if (file.size <= FREE_FILE_SIZE_LIMIT_BYTES) return false;

        showModal(
            `আপনার ফাইলটি ${FREE_FILE_SIZE_LIMIT_MB}MB-এর চেয়ে বড় (${(file.size / 1024 / 1024).toFixed(1)}MB)। ` +
            `ব্রাউজার ভার্সনে ${FREE_FILE_SIZE_LIMIT_MB}MB পর্যন্ত ফাইল ফ্রি প্রসেস করা যায়। ` +
            `বড় ফাইল ও আনলিমিটেড ব্যবহারের জন্য ডেস্কটপ অ্যাপ ব্যবহার করুন — সম্পূর্ণ ফ্রি।`
        );
        return true;
    }

    // ── Tab-switch ইন্টারসেপ্টর: switchTab() থেকে কল হবে ──────────────────────
    function interceptTabSwitch(tabId) {
        if (!isGatedTab(tabId)) return false; // গেট নেই, এগিয়ে যাও
        showModal();
        return true; // গেটেড — switchTab()-কে থামতে বলো
    }

    // ── গ্লোবাল ফাইল-সাইজ গার্ড ─────────────────────────────────────────────
    // প্রতিটা <input type="file"> এ change event ক্যাপচার করে — বড় ফাইল হলে
    // capture phase-এই event আটকে দেয়, tool-এর নিজস্ব handler কখনো চলে না।
    // ডেস্কটপ অ্যাপে (Electron) এই গার্ড কিছুই করে না।
    function installGlobalFileSizeGuard() {
        document.addEventListener('change', function (e) {
            if (isDesktopApp()) return;
            const input = e.target;
            if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return;
            const files = input.files;
            if (!files || files.length === 0) return;

            for (let i = 0; i < files.length; i++) {
                if (files[i].size > FREE_FILE_SIZE_LIMIT_BYTES) {
                    checkFileSizeLimit(files[i]);
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    input.value = ''; // ইনপুট রিসেট, tool যেন স্টেলে আটকে না থাকে
                    return;
                }
            }
        }, true); // capture phase — tool-এর নিজস্ব listener-এর আগেই চলবে

        // Drag-and-drop দিয়ে ফাইল দিলেও একইভাবে আটকানো
        document.addEventListener('drop', function (e) {
            if (isDesktopApp()) return;
            const dt = e.dataTransfer;
            if (!dt || !dt.files || dt.files.length === 0) return;
            for (let i = 0; i < dt.files.length; i++) {
                if (dt.files[i].size > FREE_FILE_SIZE_LIMIT_BYTES) {
                    checkFileSizeLimit(dt.files[i]);
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    return;
                }
            }
        }, true);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', installGlobalFileSizeGuard);
        } else {
            installGlobalFileSizeGuard();
        }
    }

    return {
        isDesktopApp,
        isGatedTab,
        showModal,
        hideModal,
        checkFileSizeLimit,
        interceptTabSwitch,
        FREE_FILE_SIZE_LIMIT_MB,
    };
})();

window.WebGate = WebGate;
