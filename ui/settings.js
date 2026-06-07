// ─────────────────────────────────────────────────────────────────────────────
// ui/settings.js — Antigravity PDF Pro
// Settings Panel — Phase 2-B Implementation
// Features: Default Output Folder, Theme, Auto-Backup toggle
// ─────────────────────────────────────────────────────────────────────────────

(function () {

    // ── Default settings ──────────────────────────────────────────────────────
    const DEFAULTS = {
        outputFolder: '',          // blank = Downloads folder (user hasn't set one)
        theme: 'dark',
        autoBackup: true,
        backupCount: 5,
        language: 'en'             // Reserved for future use
    };

    // ── In-memory cache (avoids repeated IPC calls) ───────────────────────────
    let _cache = null;

    // ── Store helpers (electron-store via IPC, or localStorage fallback) ───────
    async function getSettings() {
        if (_cache) return _cache;
        if (window.electronAPI && window.electronAPI.storeGet) {
            const saved = await window.electronAPI.storeGet('settings');
            _cache = Object.assign({}, DEFAULTS, saved || {});
        } else {
            try {
                const raw = localStorage.getItem('ag_settings');
                _cache = Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
            } catch {
                _cache = Object.assign({}, DEFAULTS);
            }
        }
        return _cache;
    }

    async function saveSettings(data) {
        _cache = Object.assign({}, _cache || DEFAULTS, data);
        if (window.electronAPI && window.electronAPI.storeSet) {
            await window.electronAPI.storeSet('settings', _cache);
        } else {
            try { localStorage.setItem('ag_settings', JSON.stringify(_cache)); } catch {}
        }
    }

    // Public API so other modules can read settings
    window.AGSettings = {
        get: getSettings,
        save: saveSettings
    };

    // ── CSS ───────────────────────────────────────────────────────────────────
    function injectCSS() {
        if (document.getElementById('ag-settings-styles')) return;
        const style = document.createElement('style');
        style.id = 'ag-settings-styles';
        style.textContent = `
            /* ── Settings backdrop ── */
            #agSettingsBackdrop {
                position: fixed;
                inset: 0;
                background: rgba(5, 5, 15, 0.7);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.22s ease;
            }
            #agSettingsBackdrop.ag-settings-open {
                opacity: 1;
                pointer-events: all;
            }

            /* ── Panel ── */
            #agSettingsPanel {
                background: var(--bg-surface, #12121f);
                border: 1px solid rgba(184,41,249,0.25);
                border-radius: 20px;
                width: 480px;
                max-width: 95vw;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 24px 80px rgba(0,0,0,0.6),
                            0 0 60px rgba(184,41,249,0.08),
                            inset 0 0 40px rgba(0,212,255,0.03);
                transform: translateY(24px) scale(0.97);
                transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
                scrollbar-width: thin;
                scrollbar-color: rgba(184,41,249,0.3) transparent;
            }
            #agSettingsBackdrop.ag-settings-open #agSettingsPanel {
                transform: translateY(0) scale(1);
            }

            /* ── Header ── */
            .ag-settings-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 22px 24px 18px;
                border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
                position: sticky;
                top: 0;
                background: var(--bg-surface, #12121f);
                border-radius: 20px 20px 0 0;
                z-index: 1;
            }
            .ag-settings-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 17px;
                font-weight: 700;
                color: var(--text, #fff);
                letter-spacing: -0.2px;
            }
            .ag-settings-title-icon {
                width: 34px;
                height: 34px;
                background: linear-gradient(135deg, rgba(184,41,249,0.25), rgba(0,212,255,0.2));
                border: 1px solid rgba(184,41,249,0.3);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .ag-settings-close {
                width: 30px;
                height: 30px;
                background: rgba(255,255,255,0.07);
                border: none;
                border-radius: 8px;
                color: var(--text-muted, #888);
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, color 0.2s;
                line-height: 1;
            }
            .ag-settings-close:hover { background: rgba(255,80,80,0.15); color: #ff5050; }

            /* ── Body ── */
            .ag-settings-body { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 6px; }

            /* ── Section ── */
            .ag-settings-section {
                background: var(--bg-raised, #1a1a2e);
                border: 1px solid var(--border, rgba(255,255,255,0.07));
                border-radius: 14px;
                overflow: hidden;
                margin-bottom: 4px;
            }
            .ag-settings-section-title {
                padding: 12px 16px 8px;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                color: var(--text-muted, #6a7090);
            }

            /* ── Row ── */
            .ag-settings-row {
                display: flex;
                align-items: center;
                padding: 13px 16px;
                gap: 14px;
                border-top: 1px solid var(--border, rgba(255,255,255,0.05));
                transition: background 0.15s;
            }
            .ag-settings-row:first-of-type { border-top: none; }
            .ag-settings-row:hover { background: rgba(255,255,255,0.02); }

            .ag-settings-row-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .ag-settings-row-icon svg { width: 16px; height: 16px; }
            .ag-row-icon-purple { background: rgba(184,41,249,0.15); color: #b829f9; }
            .ag-row-icon-cyan   { background: rgba(0,212,255,0.12);  color: #00d4ff; }
            .ag-row-icon-green  { background: rgba(0,255,136,0.12);  color: #00ff88; }
            .ag-row-icon-orange { background: rgba(255,107,43,0.12); color: #ff6b2b; }
            .ag-row-icon-blue   { background: rgba(0,100,255,0.12);  color: #6699ff; }

            .ag-settings-row-info { flex: 1; min-width: 0; }
            .ag-settings-row-label {
                font-size: 13.5px;
                font-weight: 600;
                color: var(--text, #e0e0e0);
                display: block;
            }
            .ag-settings-row-desc {
                font-size: 11.5px;
                color: var(--text-muted, #6a7090);
                margin-top: 2px;
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* ── Toggle switch ── */
            .ag-toggle {
                position: relative;
                width: 42px;
                height: 24px;
                flex-shrink: 0;
            }
            .ag-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
            .ag-toggle-slider {
                position: absolute;
                inset: 0;
                background: rgba(255,255,255,0.1);
                border-radius: 12px;
                cursor: pointer;
                transition: background 0.25s;
                border: 1px solid rgba(255,255,255,0.12);
            }
            .ag-toggle-slider::before {
                content: '';
                position: absolute;
                width: 18px;
                height: 18px;
                left: 2px;
                top: 50%;
                transform: translateY(-50%);
                background: #fff;
                border-radius: 50%;
                transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                            box-shadow 0.25s;
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            }
            .ag-toggle input:checked + .ag-toggle-slider {
                background: linear-gradient(135deg, #b829f9, #00d4ff);
                border-color: rgba(184,41,249,0.4);
            }
            .ag-toggle input:checked + .ag-toggle-slider::before {
                transform: translateX(18px) translateY(-50%);
                box-shadow: 0 1px 8px rgba(184,41,249,0.5);
            }

            /* ── Folder path field ── */
            .ag-folder-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            .ag-folder-input {
                flex: 1;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                border-radius: 8px;
                padding: 7px 12px;
                color: var(--text-muted, #aaa);
                font-size: 12px;
                font-family: 'Outfit', monospace, sans-serif;
                outline: none;
                cursor: default;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .ag-folder-btn {
                background: linear-gradient(135deg, rgba(184,41,249,0.2), rgba(0,212,255,0.15));
                border: 1px solid rgba(184,41,249,0.3);
                border-radius: 8px;
                color: #b829f9;
                font-size: 12px;
                font-weight: 600;
                padding: 7px 12px;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .ag-folder-btn:hover {
                background: linear-gradient(135deg, rgba(184,41,249,0.35), rgba(0,212,255,0.25));
                border-color: rgba(184,41,249,0.5);
                color: #d060ff;
            }
            .ag-folder-clear {
                background: rgba(255,80,80,0.1);
                border: 1px solid rgba(255,80,80,0.25);
                border-radius: 8px;
                color: #ff5050;
                font-size: 12px;
                font-weight: 600;
                padding: 7px 10px;
                cursor: pointer;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .ag-folder-clear:hover { background: rgba(255,80,80,0.2); }

            /* ── Select ── */
            .ag-select {
                background: var(--bg-raised, #1a1a2e);
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                border-radius: 8px;
                color: var(--text, #e0e0e0);
                font-size: 13px;
                font-family: 'Outfit', sans-serif;
                padding: 7px 10px;
                cursor: pointer;
                outline: none;
                transition: border-color 0.2s;
                min-width: 110px;
            }
            .ag-select:focus { border-color: rgba(184,41,249,0.5); }
            .ag-select option { background: #1a1a2e; }

            /* ── Footer ── */
            .ag-settings-footer {
                padding: 16px 24px 22px;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                border-top: 1px solid var(--border, rgba(255,255,255,0.06));
            }
            .ag-btn-save {
                background: linear-gradient(135deg, #b829f9, #00d4ff);
                border: none;
                border-radius: 10px;
                color: #fff;
                font-size: 13.5px;
                font-weight: 700;
                padding: 10px 22px;
                cursor: pointer;
                transition: opacity 0.2s, transform 0.15s;
                letter-spacing: 0.02em;
            }
            .ag-btn-save:hover { opacity: 0.9; transform: translateY(-1px); }
            .ag-btn-save:active { transform: translateY(0); }
            .ag-btn-cancel {
                background: rgba(255,255,255,0.06);
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                border-radius: 10px;
                color: var(--text-muted, #888);
                font-size: 13.5px;
                font-weight: 600;
                padding: 10px 18px;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
            }
            .ag-btn-cancel:hover { background: rgba(255,255,255,0.1); color: var(--text, #e0e0e0); }

            /* ── Version tag ── */
            .ag-settings-version {
                text-align: center;
                font-size: 11px;
                color: var(--text-muted, #555);
                padding: 0 24px 18px;
                letter-spacing: 0.4px;
            }

            /* Light theme overrides */
            body.light-theme #agSettingsPanel {
                background: #ffffff;
                border-color: rgba(147,51,234,0.2);
                box-shadow: 0 24px 80px rgba(0,0,0,0.15);
            }
            body.light-theme .ag-settings-header,
            body.light-theme .ag-settings-version { background: #ffffff; }
            body.light-theme .ag-settings-section { background: #f9fafb; border-color: rgba(0,0,0,0.07); }
            body.light-theme .ag-folder-input { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: #555; }
            body.light-theme .ag-select { background: #f3f4f6; border-color: rgba(0,0,0,0.12); }
            body.light-theme .ag-toggle-slider { background: rgba(0,0,0,0.12); border-color: rgba(0,0,0,0.1); }
            body.light-theme .ag-toggle-slider::before { background: #fff; }
        `;
        document.head.appendChild(style);
    }

    // ── Build HTML ─────────────────────────────────────────────────────────────
    function buildPanel() {
        if (document.getElementById('agSettingsBackdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'agSettingsBackdrop';
        backdrop.innerHTML = `
            <div id="agSettingsPanel" role="dialog" aria-modal="true" aria-label="Settings">
                <!-- Header -->
                <div class="ag-settings-header">
                    <div class="ag-settings-title">
                        <div class="ag-settings-title-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M19.07 4.93 4.93 19.07"/></svg>
                        </div>
                        Settings
                    </div>
                    <button class="ag-settings-close" id="agSettingsClose" title="Close (Esc)">×</button>
                </div>

                <div class="ag-settings-body">

                    <!-- SECTION: File & Storage -->
                    <div class="ag-settings-section">
                        <div class="ag-settings-section-title">📁 File &amp; Storage</div>

                        <!-- Default Output Folder -->
                        <div class="ag-settings-row" style="flex-wrap:wrap; gap: 10px;">
                            <div class="ag-settings-row-icon ag-row-icon-purple">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            </div>
                            <div class="ag-settings-row-info" style="flex-basis: 120px;">
                                <span class="ag-settings-row-label">Default Save Folder</span>
                                <span class="ag-settings-row-desc">PDF গুলো এখানে সেভ হবে</span>
                            </div>
                            <div class="ag-folder-row" style="flex: 1; min-width: 200px;">
                                <input type="text" id="agOutputFolderInput" class="ag-folder-input" readonly placeholder="Downloads (default)" title="Output folder path">
                                <button class="ag-folder-btn" id="agBtnBrowseFolder">Browse</button>
                                <button class="ag-folder-clear" id="agBtnClearFolder" title="Reset to default">✕</button>
                            </div>
                        </div>

                        <!-- Auto-Backup toggle -->
                        <div class="ag-settings-row">
                            <div class="ag-settings-row-icon ag-row-icon-green">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div class="ag-settings-row-info">
                                <span class="ag-settings-row-label">Auto-Backup</span>
                                <span class="ag-settings-row-desc">Save করার সময় স্বয়ংক্রিয়ভাবে backup রাখবে</span>
                            </div>
                            <label class="ag-toggle" title="Enable auto backup">
                                <input type="checkbox" id="agToggleAutoBackup">
                                <span class="ag-toggle-slider"></span>
                            </label>
                        </div>

                        <!-- Backup count -->
                        <div class="ag-settings-row" id="agBackupCountRow">
                            <div class="ag-settings-row-icon ag-row-icon-blue">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                            </div>
                            <div class="ag-settings-row-info">
                                <span class="ag-settings-row-label">Keep Backups</span>
                                <span class="ag-settings-row-desc">কতটা পুরনো backup রাখতে চান</span>
                            </div>
                            <select id="agSelectBackupCount" class="ag-select">
                                <option value="3">3 copies</option>
                                <option value="5" selected>5 copies</option>
                                <option value="10">10 copies</option>
                                <option value="20">20 copies</option>
                            </select>
                        </div>
                    </div>

                    <!-- SECTION: Appearance -->
                    <div class="ag-settings-section">
                        <div class="ag-settings-section-title">🎨 Appearance</div>

                        <!-- Theme -->
                        <div class="ag-settings-row">
                            <div class="ag-settings-row-icon ag-row-icon-cyan">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            </div>
                            <div class="ag-settings-row-info">
                                <span class="ag-settings-row-label">Theme</span>
                                <span class="ag-settings-row-desc">Light বা Dark mode বেছে নিন</span>
                            </div>
                            <select id="agSelectTheme" class="ag-select">
                                <option value="dark">🌙 Dark</option>
                                <option value="light">☀️ Light</option>
                                <option value="system">🖥 System</option>
                            </select>
                        </div>
                    </div>

                    <!-- SECTION: About -->
                    <div class="ag-settings-section">
                        <div class="ag-settings-section-title">ℹ️ About</div>

                        <div class="ag-settings-row">
                            <div class="ag-settings-row-icon ag-row-icon-orange">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            </div>
                            <div class="ag-settings-row-info">
                                <span class="ag-settings-row-label">Antigravity PDF Pro</span>
                                <span class="ag-settings-row-desc" id="agSettingsVersion">Version 1.0.0</span>
                            </div>
                        </div>

                        <div class="ag-settings-row">
                            <div class="ag-settings-row-icon ag-row-icon-purple">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </div>
                            <div class="ag-settings-row-info">
                                <span class="ag-settings-row-label">Mode</span>
                                <span class="ag-settings-row-desc">100% Local &amp; Private — No Internet Required</span>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Footer -->
                <div class="ag-settings-footer">
                    <button class="ag-btn-cancel" id="agSettingsCancel">Cancel</button>
                    <button class="ag-btn-save" id="agSettingsSave">Save Settings</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
    }

    // ── Open / Close ──────────────────────────────────────────────────────────
    function openSettings() {
        const backdrop = document.getElementById('agSettingsBackdrop');
        if (!backdrop) return;
        backdrop.classList.add('ag-settings-open');
        loadCurrentValues();
    }

    function closeSettings() {
        const backdrop = document.getElementById('agSettingsBackdrop');
        if (backdrop) backdrop.classList.remove('ag-settings-open');
    }

    // ── Load current saved values into UI ──────────────────────────────────────
    async function loadCurrentValues() {
        const settings = await getSettings();

        // Output folder
        const folderInput = document.getElementById('agOutputFolderInput');
        if (folderInput) folderInput.value = settings.outputFolder || '';

        // Auto-backup
        const backupToggle = document.getElementById('agToggleAutoBackup');
        if (backupToggle) {
            backupToggle.checked = settings.autoBackup !== false;
            updateBackupCountVisibility(backupToggle.checked);
        }

        // Backup count
        const backupCountSel = document.getElementById('agSelectBackupCount');
        if (backupCountSel) backupCountSel.value = String(settings.backupCount || 5);

        // Theme
        const themeSel = document.getElementById('agSelectTheme');
        if (themeSel) {
            // Check if theme is system-preference
            const storeTheme = settings.theme || 'dark';
            themeSel.value = storeTheme;
        }

        // Version
        if (window.electronAPI && window.electronAPI.getVersion) {
            try {
                const ver = await window.electronAPI.getVersion();
                const verEl = document.getElementById('agSettingsVersion');
                if (verEl) verEl.textContent = 'Version ' + ver;
            } catch {}
        }
    }

    // ── Toggle backup count row visibility ────────────────────────────────────
    function updateBackupCountVisibility(enabled) {
        const row = document.getElementById('agBackupCountRow');
        if (row) row.style.opacity = enabled ? '1' : '0.4';
    }

    // ── Save handler ──────────────────────────────────────────────────────────
    async function handleSave() {
        const folderInput    = document.getElementById('agOutputFolderInput');
        const backupToggle   = document.getElementById('agToggleAutoBackup');
        const backupCountSel = document.getElementById('agSelectBackupCount');
        const themeSel       = document.getElementById('agSelectTheme');

        const newSettings = {
            outputFolder: folderInput ? folderInput.value : '',
            autoBackup:   backupToggle ? backupToggle.checked : true,
            backupCount:  backupCountSel ? parseInt(backupCountSel.value, 10) : 5,
            theme:        themeSel ? themeSel.value : 'dark'
        };

        await saveSettings(newSettings);

        // Apply theme immediately
        applyThemeFromSettings(newSettings.theme);

        // Sync theme toggle icon
        updateThemeToggleIcon(newSettings.theme);

        closeSettings();

        if (window.AGToast) {
            window.AGToast.success('✓ Settings saved!');
        }
    }

    // ── Apply theme ───────────────────────────────────────────────────────────
    function applyThemeFromSettings(themeValue) {
        let resolved = themeValue;
        if (themeValue === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        if (resolved === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        // Persist to electron-store under 'theme' key so theme.js picks it up next launch
        if (window.electronAPI && window.electronAPI.storeSet) {
            window.electronAPI.storeSet('theme', resolved).catch(() => {});
        }
    }

    function updateThemeToggleIcon(themeValue) {
        const themeBtn = document.getElementById('btnToggleTheme');
        if (!themeBtn) return;
        let resolved = themeValue;
        if (themeValue === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        const iconName = resolved === 'light' ? 'moon' : 'sun';
        themeBtn.innerHTML = `<i data-lucide="${iconName}" id="themeIcon"></i>`;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // ── Browse folder (Electron open dialog) ──────────────────────────────────
    async function browseFolderDialog() {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            try {
                const result = await window.electronAPI.showOpenDialog({
                    title: 'Select Default Output Folder',
                    properties: ['openDirectory', 'createDirectory']
                });
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    const folderInput = document.getElementById('agOutputFolderInput');
                    if (folderInput) folderInput.value = result.filePaths[0];
                }
            } catch (err) {
                console.error('[Settings] Browse folder error:', err);
            }
        } else {
            // Web fallback — no folder picker available
            if (window.AGToast) window.AGToast.info('Folder picker শুধু Electron app-এ কাজ করে।');
        }
    }

    // ── Wire up the gear button in the top bar ────────────────────────────────
    function wireGearButton() {
        // The existing settings button (btn-icon with lucide "settings" icon)
        // It has no id, so we'll give it one and wire it up
        const userActions = document.querySelector('.user-actions');
        if (userActions) {
            const buttons = userActions.querySelectorAll('.btn-icon');
            buttons.forEach(btn => {
                const icon = btn.querySelector('[data-lucide="settings"], i.bi-gear, i.bi-gear-fill');
                if (icon || btn.innerHTML.includes('settings')) {
                    if (!btn.id) btn.id = 'agSettingsBtn';
                    btn.addEventListener('click', openSettings);
                    btn.title = 'Settings';
                }
            });
        }
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        injectCSS();
        buildPanel();

        // ── Direct bind: Settings gear button (id already set in HTML) ────────
        // This is the most reliable approach — no need to scan for lucide icons
        // which get replaced with SVG after createIcons() runs.
        const settingsBtn = document.getElementById('agSettingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openSettings);
        }

        // Event listeners for the settings panel itself
        document.getElementById('agSettingsClose')?.addEventListener('click', closeSettings);
        document.getElementById('agSettingsCancel')?.addEventListener('click', closeSettings);
        document.getElementById('agSettingsSave')?.addEventListener('click', handleSave);
        document.getElementById('agBtnBrowseFolder')?.addEventListener('click', browseFolderDialog);
        document.getElementById('agBtnClearFolder')?.addEventListener('click', () => {
            const inp = document.getElementById('agOutputFolderInput');
            if (inp) inp.value = '';
        });

        // Auto-backup toggle → show/hide count row
        document.getElementById('agToggleAutoBackup')?.addEventListener('change', function () {
            updateBackupCountVisibility(this.checked);
        });

        // Theme select → live preview
        document.getElementById('agSelectTheme')?.addEventListener('change', function () {
            applyThemeFromSettings(this.value);
            updateThemeToggleIcon(this.value);
        });

        // Backdrop click to close
        document.getElementById('agSettingsBackdrop')?.addEventListener('click', function (e) {
            if (e.target === this) closeSettings();
        });

        // Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                const backdrop = document.getElementById('agSettingsBackdrop');
                if (backdrop && backdrop.classList.contains('ag-settings-open')) closeSettings();
            }
        });

        // wireGearButton as fallback (for cases where the button might not have id yet)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', wireGearButton);
        } else {
            wireGearButton();
        }

        // Apply saved settings on startup (theme already handled by theme.js,
        // but we sync outputFolder & autoBackup into window for other modules)
        getSettings().then(settings => {
            window._agOutputFolder = settings.outputFolder || '';
            window._agAutoBackup   = settings.autoBackup !== false;
            window._agBackupCount  = settings.backupCount || 5;
        });
    }

    // Public
    window.AGSettingsPanel = { open: openSettings, close: closeSettings };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
