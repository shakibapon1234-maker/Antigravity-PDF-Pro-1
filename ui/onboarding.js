/**
 * Antigravity PDF Pro — Onboarding Modal (DEV-03)
 * প্রথমবার launch হলে welcome screen দেখাবে
 * Features: Quick start guide, License key prompt redirect, Tool highlights
 */

(function AGOnboarding() {
    const STORE_KEY = 'onboardingDone';
    const CURRENT_VERSION = '1.0';

    // ── CSS ──────────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
        #agOnboardingBackdrop {
            position: fixed;
            inset: 0;
            background: rgba(5, 5, 20, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }
        #agOnboardingBackdrop.ag-onboard-open {
            opacity: 1;
            pointer-events: all;
        }
        #agOnboardingModal {
            background: linear-gradient(165deg, #0d0d1f 0%, #12122a 50%, #0a0a18 100%);
            border: 1px solid rgba(184, 41, 249, 0.3);
            border-radius: 20px;
            width: 640px;
            max-width: 95vw;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(184,41,249,0.15);
            display: flex;
            flex-direction: column;
            animation: agOnboardSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes agOnboardSlideIn {
            from { transform: translateY(40px) scale(0.95); opacity: 0; }
            to   { transform: translateY(0)   scale(1);    opacity: 1; }
        }

        /* ── Header ── */
        .ag-ob-header {
            background: linear-gradient(135deg, rgba(184,41,249,0.25), rgba(0,212,255,0.15));
            padding: 36px 36px 28px;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            position: relative;
        }
        .ag-ob-logo {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #b829f9, #00d4ff);
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: 900;
            color: #fff;
            margin: 0 auto 16px;
            box-shadow: 0 8px 30px rgba(184,41,249,0.4);
            font-family: 'Outfit', sans-serif;
            letter-spacing: -1px;
        }
        .ag-ob-title {
            font-size: 24px;
            font-weight: 800;
            color: #fff;
            margin: 0 0 8px;
            font-family: 'Outfit', sans-serif;
            letter-spacing: -0.5px;
        }
        .ag-ob-subtitle {
            font-size: 14px;
            color: rgba(255,255,255,0.55);
            margin: 0;
            font-family: 'Outfit', sans-serif;
        }

        /* ── Body ── */
        .ag-ob-body {
            padding: 28px 36px;
            overflow-y: auto;
            flex: 1;
        }
        .ag-ob-section-label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: rgba(0,212,255,0.7);
            margin: 0 0 16px;
            font-family: 'Outfit', sans-serif;
        }

        /* ── Feature grid ── */
        .ag-ob-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 24px;
        }
        .ag-ob-card {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            text-decoration: none;
        }
        .ag-ob-card:hover {
            background: rgba(184,41,249,0.12);
            border-color: rgba(184,41,249,0.35);
            transform: translateY(-2px);
        }
        .ag-ob-card-icon {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }
        .ag-ob-card-text strong {
            display: block;
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 3px;
            font-family: 'Outfit', sans-serif;
        }
        .ag-ob-card-text span {
            font-size: 11.5px;
            color: rgba(255,255,255,0.45);
            font-family: 'Outfit', sans-serif;
        }

        /* ── Name input ── */
        .ag-ob-name-row {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 24px;
        }
        .ag-ob-name-input {
            flex: 1;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(184,41,249,0.3);
            border-radius: 10px;
            color: #fff;
            font-size: 14px;
            font-family: 'Outfit', sans-serif;
            padding: 11px 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .ag-ob-name-input:focus {
            border-color: rgba(184,41,249,0.7);
            box-shadow: 0 0 0 3px rgba(184,41,249,0.1);
        }
        .ag-ob-name-input::placeholder { color: rgba(255,255,255,0.25); }

        /* ── Footer ── */
        .ag-ob-footer {
            padding: 20px 36px 28px;
            display: flex;
            gap: 12px;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        .ag-ob-btn-start {
            flex: 1;
            background: linear-gradient(135deg, #b829f9, #00d4ff);
            border: none;
            border-radius: 12px;
            color: #fff;
            font-size: 15px;
            font-weight: 700;
            padding: 14px 24px;
            cursor: pointer;
            font-family: 'Outfit', sans-serif;
            letter-spacing: 0.02em;
            transition: opacity 0.2s, transform 0.15s;
        }
        .ag-ob-btn-start:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        .ag-ob-btn-skip {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: rgba(255,255,255,0.5);
            font-size: 13px;
            font-weight: 600;
            padding: 14px 20px;
            cursor: pointer;
            font-family: 'Outfit', sans-serif;
            transition: background 0.2s, color 0.2s;
        }
        .ag-ob-btn-skip:hover {
            background: rgba(255,255,255,0.09);
            color: rgba(255,255,255,0.75);
        }
    `;
    document.head.appendChild(css);

    // ── HTML ─────────────────────────────────────────────────────────────────
    function buildModal() {
        if (document.getElementById('agOnboardingBackdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'agOnboardingBackdrop';
        backdrop.innerHTML = `
            <div id="agOnboardingModal" role="dialog" aria-modal="true" aria-label="Welcome to Antigravity PDF Pro">
                <!-- Header -->
                <div class="ag-ob-header">
                    <div class="ag-ob-logo">AG</div>
                    <h2 class="ag-ob-title">Welcome to Antigravity PDF Pro</h2>
                    <p class="ag-ob-subtitle">The all-in-one offline PDF tool. Let's get you started in seconds.</p>
                </div>

                <!-- Body -->
                <div class="ag-ob-body">
                    <!-- Name input -->
                    <p class="ag-ob-section-label">What should we call you?</p>
                    <div class="ag-ob-name-row">
                        <input type="text" id="agObNameInput" class="ag-ob-name-input"
                            placeholder="Type your name (optional)"
                            maxlength="40"
                            autocomplete="off">
                    </div>

                    <!-- Feature cards -->
                    <p class="ag-ob-section-label">Quick start — pick a tool to begin</p>
                    <div class="ag-ob-grid">
                        <div class="ag-ob-card" id="agObCardEditor">
                            <div class="ag-ob-card-icon" style="background: rgba(139,92,246,0.2);">✏️</div>
                            <div class="ag-ob-card-text">
                                <strong>Edit PDF</strong>
                                <span>Add text, images, signatures</span>
                            </div>
                        </div>
                        <div class="ag-ob-card" id="agObCardConvert">
                            <div class="ag-ob-card-icon" style="background: rgba(0,212,255,0.2);">🔄</div>
                            <div class="ag-ob-card-text">
                                <strong>Convert PDF</strong>
                                <span>PDF ↔ Word, Excel, Image</span>
                            </div>
                        </div>
                        <div class="ag-ob-card" id="agObCardMerge">
                            <div class="ag-ob-card-icon" style="background: rgba(16,185,129,0.2);">📎</div>
                            <div class="ag-ob-card-text">
                                <strong>Merge PDFs</strong>
                                <span>Combine multiple files into one</span>
                            </div>
                        </div>
                        <div class="ag-ob-card" id="agObCardOCR">
                            <div class="ag-ob-card-icon" style="background: rgba(245,158,11,0.2);">🔍</div>
                            <div class="ag-ob-card-text">
                                <strong>OCR — Scan to Text</strong>
                                <span>Extract text from scanned PDF</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="ag-ob-footer">
                    <button class="ag-ob-btn-start" id="agObBtnStart">🚀 Get Started</button>
                    <button class="ag-ob-btn-skip" id="agObBtnSkip">Skip</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Wire events
        document.getElementById('agObBtnStart').addEventListener('click', handleStart);
        document.getElementById('agObBtnSkip').addEventListener('click', dismiss);

        const cards = {
            agObCardEditor:  'editor',
            agObCardConvert: 'converter',
            agObCardMerge:   'merge',
            agObCardOCR:     'ocr-pdf',
        };
        Object.entries(cards).forEach(([id, tab]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { handleStart(); switchTabSafe(tab); });
        });

        // Focus name input
        setTimeout(() => {
            const inp = document.getElementById('agObNameInput');
            if (inp) inp.focus();
        }, 400);
    }

    function switchTabSafe(tab) {
        setTimeout(() => {
            if (typeof window.switchTab === 'function') window.switchTab(tab);
        }, 100);
    }

    async function handleStart() {
        const nameInput = document.getElementById('agObNameInput');
        const name = nameInput ? nameInput.value.trim() : '';

        // Save name if provided
        if (name) {
            try {
                if (window.electronAPI?.storeSet) {
                    await window.electronAPI.storeSet('userSettings', { displayName: name });
                    await window.electronAPI.storeSet('settings', {
                        ...(await window.electronAPI.storeGet('settings') || {}),
                        displayName: name
                    });
                }
                // Update greeting live
                const greetEl = document.getElementById('dashboardGreeting');
                const avatarEl = document.getElementById('dashboardAvatar');
                if (greetEl) {
                    const hour = new Date().getHours();
                    const tg = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
                    greetEl.textContent = `${tg}, ${name}! 👋`;
                }
                if (avatarEl) {
                    const parts = name.split(/\s+/);
                    const initials = parts.length >= 2
                        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                        : name.substring(0, 2).toUpperCase();
                    avatarEl.textContent = initials;
                }
            } catch (e) {}
        }

        dismiss();
    }

    async function dismiss() {
        const backdrop = document.getElementById('agOnboardingBackdrop');
        if (backdrop) {
            backdrop.style.opacity = '0';
            backdrop.style.pointerEvents = 'none';
            setTimeout(() => backdrop.remove(), 300);
        }

        // Mark as done
        try {
            if (window.electronAPI?.storeSet) {
                await window.electronAPI.storeSet(STORE_KEY, CURRENT_VERSION);
            } else {
                localStorage.setItem(STORE_KEY, CURRENT_VERSION);
            }
        } catch (e) {}
    }

    async function shouldShow() {
        try {
            let done;
            if (window.electronAPI?.storeGet) {
                done = await window.electronAPI.storeGet(STORE_KEY);
            } else {
                done = localStorage.getItem(STORE_KEY);
            }
            return !done;
        } catch (e) {
            return true;
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    async function init() {
        // Only show if lock screen isn't visible
        const lockScreen = document.getElementById('appLockScreen');
        if (lockScreen && lockScreen.style.display !== 'none') return;

        const show = await shouldShow();
        if (!show) return;

        buildModal();

        // Small delay so app has rendered
        setTimeout(() => {
            const backdrop = document.getElementById('agOnboardingBackdrop');
            if (backdrop) backdrop.classList.add('ag-onboard-open');
        }, 800);
    }

    // Public API to trigger manually (e.g., from help menu)
    window.AGOnboarding = {
        show() {
            buildModal();
            const backdrop = document.getElementById('agOnboardingBackdrop');
            if (backdrop) {
                backdrop.classList.add('ag-onboard-open');
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
