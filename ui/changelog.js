/**
 * Antigravity PDF Pro — In-App Changelog / What's New System (DEV-04)
 * আপডেট চালুর পর "What's New" মডাল দেখাবে
 * Features: Version update checks, dynamic feature lists, styled list cards
 */

(function AGChangelog() {
    const STORE_KEY = 'lastSeenVersion';
    const CURRENT_VERSION = '1.0.0';

    // ── CSS ──────────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
        #agChangelogBackdrop {
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
        #agChangelogBackdrop.ag-changelog-open {
            opacity: 1;
            pointer-events: all;
        }
        #agChangelogModal {
            background: linear-gradient(165deg, #0a0a16 0%, #121228 60%, #06060c 100%);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 20px;
            width: 580px;
            max-width: 95vw;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(0,212,255,0.15);
            display: flex;
            flex-direction: column;
            animation: agChangelogSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes agChangelogSlideIn {
            from { transform: translateY(30px) scale(0.96); opacity: 0; }
            to   { transform: translateY(0)   scale(1);    opacity: 1; }
        }

        /* ── Header ── */
        .ag-cl-header {
            background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(184,41,249,0.1));
            padding: 30px 36px 20px;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            position: relative;
        }
        .ag-cl-badge {
            display: inline-block;
            background: rgba(0,212,255,0.15);
            border: 1px solid rgba(0,212,255,0.3);
            padding: 4px 12px;
            border-radius: 999px;
            color: #00d4ff;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 12px;
            font-family: 'Outfit', sans-serif;
        }
        .ag-cl-title {
            font-size: 22px;
            font-weight: 800;
            color: #fff;
            margin: 0 0 6px;
            font-family: 'Outfit', sans-serif;
            letter-spacing: -0.5px;
        }
        .ag-cl-subtitle {
            font-size: 13px;
            color: rgba(255,255,255,0.5);
            margin: 0;
            font-family: 'Outfit', sans-serif;
        }

        /* ── Body ── */
        .ag-cl-body {
            padding: 24px 36px;
            overflow-y: auto;
            flex: 1;
        }

        /* ── Feature List ── */
        .ag-cl-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .ag-cl-item {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .ag-cl-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
        .ag-cl-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
            border: 1px solid rgba(255,255,255,0.06);
        }
        .ag-cl-text strong {
            display: block;
            font-size: 13.5px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 4px;
            font-family: 'Outfit', sans-serif;
        }
        .ag-cl-text p {
            font-size: 12px;
            color: #c8d0e8;
            line-height: 1.5;
            margin: 0;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }

        /* ── Footer ── */
        .ag-cl-footer {
            padding: 20px 36px 24px;
            border-top: 1px solid rgba(255,255,255,0.06);
            display: flex;
            justify-content: center;
        }
        .ag-cl-btn-close {
            width: 100%;
            background: linear-gradient(135deg, #00d4ff, #b829f9);
            border: none;
            border-radius: 12px;
            color: #fff;
            font-size: 15px;
            font-weight: 700;
            padding: 13px 24px;
            cursor: pointer;
            font-family: 'Outfit', sans-serif;
            letter-spacing: 0.02em;
            transition: opacity 0.2s, transform 0.15s;
            box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
        }
        .ag-cl-btn-close:hover {
            opacity: 0.95;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(184, 41, 249, 0.4);
        }
    `;
    document.head.appendChild(css);

    // ── HTML ─────────────────────────────────────────────────────────────────
    function buildModal() {
        if (document.getElementById('agChangelogBackdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'agChangelogBackdrop';
        backdrop.innerHTML = `
            <div id="agChangelogModal" role="dialog" aria-modal="true" aria-label="What's New in Antigravity PDF Pro">
                <!-- Header -->
                <div class="ag-cl-header">
                    <div class="ag-cl-badge">New Update Available</div>
                    <h2 class="ag-cl-title">What's New in Version ${CURRENT_VERSION}</h2>
                    <p class="ag-cl-subtitle">Here are the latest tools and improvements added to your workspace.</p>
                </div>

                <!-- Body -->
                <div class="ag-cl-body">
                    <div class="ag-cl-list">
                        <!-- Item 1: PDF Compare -->
                        <div class="ag-cl-item">
                            <div class="ag-cl-icon-box" style="background: rgba(255, 45, 146, 0.15); color: #ff2d92;">🔍</div>
                            <div class="ag-cl-text">
                                <strong>Side-by-Side PDF Compare</strong>
                                <p>নতুন Compare PDF টুলের সাহায্যে আপনি দুটি ডকুমেন্টের মধ্যে পার্থক্য দেখতে পারবেন (যেমন: বাদ যাওয়া বা নতুন টেক্সট)। সাইডবারে বাটন যুক্ত করা হয়েছে!</p>
                            </div>
                        </div>

                        <!-- Item 2: Drag and Drop -->
                        <div class="ag-cl-item">
                            <div class="ag-cl-icon-box" style="background: rgba(0, 212, 255, 0.15); color: #00d4ff;">🖱️</div>
                            <div class="ag-cl-text">
                                <strong>Smart Drag & Drop Routing</strong>
                                <p>উইন্ডোর যেকোনো স্থানে PDF, Excel, Word বা Image ফাইল ড্র্যাগ করে ছেড়ে দিলে অ্যাপটি অটোমেটিক সঠিক কনভার্টার বা এডিটরে লোড করে নেবে।</p>
                            </div>
                        </div>

                        <!-- Item 3: License manager -->
                        <div class="ag-cl-item">
                            <div class="ag-cl-icon-box" style="background: rgba(184, 41, 249, 0.15); color: #b829f9;">🚀</div>
                            <div class="ag-cl-text">
                                <strong>Secure Offline-Enabled License Key</strong>
                                <p>Gumroad-এর সাথে লাইসেন্স ইন্টিগ্রেশন সম্পন্ন। একবার অনলাইনে অ্যাক্টিভেট হওয়ার পর আপনার কোনো ইন্টারনেট সংযোগ ছাড়াই এটি ৩০ দিন পর্যন্ত অফলাইনে সম্পূর্ণ কার্যকর থাকবে।</p>
                            </div>
                        </div>

                        <!-- Item 4: Time Aware Greeting -->
                        <div class="ag-cl-item">
                            <div class="ag-cl-icon-box" style="background: rgba(0, 255, 136, 0.15); color: #00ff88;">🕒</div>
                            <div class="ag-cl-text">
                                <strong>Dynamic Greeting & Custom Avatar</strong>
                                <p>ড্যাশবোর্ড এখন আপনার সময় অনুযায়ী শুভেচ্ছা জানাবে এবং আপনার প্রোফাইল সেটিংসের নাম অনুযায়ী একটি গ্রেডিয়েন্ট রঙিন অবতার ডিসপ্লে করবে।</p>
                            </div>
                        </div>

                        <!-- Item 5: Keyboard shortcuts -->
                        <div class="ag-cl-item">
                            <div class="ag-cl-icon-box" style="background: rgba(255, 107, 43, 0.15); color: #ff6b2b;">⌨️</div>
                            <div class="ag-cl-text">
                                <strong>Quick Keyboard Shortcuts Overlay</strong>
                                <p>কীবোর্ডের <code>?</code> (Shift + /) অথবা <code>F1</code> কী চেপে যেকোনো স্ক্রিন থেকে আপনি শর্টকাট কী গাইড ও উইন্ডো এক নজরে অ্যাক্টিভেট করতে পারবেন।</p>
                            </div>
                        </div>

                        <!-- Item 6: Security Fix -->
                        <div class="ag-cl-item">
                            <div class="ag-cl-icon-box" style="background: rgba(0, 255, 229, 0.15); color: #00ffe5;">🔒</div>
                            <div class="ag-cl-text">
                                <strong>Enhanced Security (webSecurity)</strong>
                                <p>Chromium-এর প্রোডাকশন সিকিউরিটি রুলস (webSecurity) অন করা হয়েছে, যাতে লোকাল কনভার্শনগুলোর স্পিড ও ডেটা সিকিউরিটি আরও অনেক গুণ বেশি সুরক্ষিত থাকে।</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="ag-cl-footer">
                    <button class="ag-cl-btn-close" id="agClBtnClose">Awesome, Let's Go!</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Wire events
        document.getElementById('agClBtnClose').addEventListener('click', dismiss);
    }

    async function dismiss() {
        const backdrop = document.getElementById('agChangelogBackdrop');
        if (backdrop) {
            backdrop.style.opacity = '0';
            backdrop.style.pointerEvents = 'none';
            setTimeout(() => backdrop.remove(), 300);
        }

        // Mark as seen
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
            // First time users (who have never completed onboarding) should NOT see the changelog
            let onboardingDone;
            if (window.electronAPI?.storeGet) {
                onboardingDone = await window.electronAPI.storeGet('onboardingDone');
            } else {
                onboardingDone = localStorage.getItem('onboardingDone');
            }
            if (!onboardingDone) {
                // First run — onboarding will show, so silently mark changelog as seen
                if (window.electronAPI?.storeSet) {
                    await window.electronAPI.storeSet(STORE_KEY, CURRENT_VERSION);
                } else {
                    localStorage.setItem(STORE_KEY, CURRENT_VERSION);
                }
                return false;
            }

            // Check last seen version
            let lastSeen;
            if (window.electronAPI?.storeGet) {
                lastSeen = await window.electronAPI.storeGet(STORE_KEY);
            } else {
                lastSeen = localStorage.getItem(STORE_KEY);
            }
            return lastSeen !== CURRENT_VERSION;
        } catch (e) {
            return false;
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

        // 1500ms delay so dashboard renders first
        setTimeout(() => {
            const backdrop = document.getElementById('agChangelogBackdrop');
            if (backdrop) backdrop.classList.add('ag-changelog-open');
        }, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
