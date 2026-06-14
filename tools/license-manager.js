/**
 * Antigravity PDF Pro — License Manager
 * ────────────────────────────────────────
 * Supports two verification modes:
 *  1. Gumroad API (online) — verifies against your real Gumroad product
 *  2. Offline master-key list — encrypted fallback for air-gapped use
 *
 * HOW TO SET UP GUMROAD:
 *  1. Create a product on gumroad.com
 *  2. Enable "Generate a unique license key per sale" in product settings
 *  3. Copy your Gumroad Product Permalink (e.g. "antigravity-pdf-pro")
 *  4. Replace GUMROAD_PRODUCT_PERMALINK below with your permalink
 */

const LicenseManager = (() => {
    // ── Configuration ────────────────────────────────────────────────────────
    // Replace with your actual Gumroad product permalink after setting it up
    const GUMROAD_PRODUCT_PERMALINK = 'antigravity-pdf-pro';

    // Offline master keys (for pre-issued or test keys before Gumroad is set up)
    // Format: AGP-XXXX-XXXX-XXXX  (all caps, hardcoded here for now)
    // Add your own pre-issued keys to this list before distributing
    const OFFLINE_MASTER_KEYS = [
        'AGP-1111-2222-3333', // dev/test key
        'AGP-BETA-2026-FREE', // early-access beta key
        // Add more pre-issued keys here
    ];

    const LICENSE_KEY_REGEX = /^AGP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    const GRACE_PERIOD_MS   = 30 * 24 * 60 * 60 * 1000; // 30 days offline grace
    const STORE_KEY         = 'licenseData';
    const GUMROAD_API_URL   = 'https://api.gumroad.com/v2/licenses/verify';

    let lockScreenEl = null;
    let inputEl      = null;
    let statusEl     = null;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function normalizeKey(key) {
        return key ? key.trim().toUpperCase() : '';
    }

    function validateKeyFormat(key) {
        return LICENSE_KEY_REGEX.test(normalizeKey(key));
    }

    function isOfflineMasterKey(key) {
        return OFFLINE_MASTER_KEYS.includes(normalizeKey(key));
    }

    function getLicenseData() {
        return window.electronAPI?.storeGet(STORE_KEY);
    }

    function saveLicenseData(data) {
        return window.electronAPI?.storeSet(STORE_KEY, data);
    }

    function withinGracePeriod(license) {
        if (!license?.lastOnlineCheck) return false;
        return Date.now() - license.lastOnlineCheck <= GRACE_PERIOD_MS;
    }

    function setStatus(message, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.display = message ? 'block' : 'none';
        statusEl.style.color = isError ? 'var(--accent-pink)' : 'var(--text-muted)';
    }

    function showLockScreen(message = '') {
        if (lockScreenEl) lockScreenEl.style.display = 'flex';
        setStatus(message, true);
    }

    function hideLockScreen() {
        if (lockScreenEl) lockScreenEl.style.display = 'none';
        setStatus('');
    }

    // ── Internet check ───────────────────────────────────────────────────────
    async function hasInternetConnection() {
        if (!navigator.onLine) return false;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const res = await fetch('https://www.google.com/generate_204', {
                method: 'HEAD', cache: 'no-store', signal: controller.signal,
            });
            clearTimeout(timeout);
            return res && res.status >= 200 && res.status < 400;
        } catch {
            return false;
        }
    }

    // ── Gumroad API Verification ─────────────────────────────────────────────
    async function verifyWithGumroad(licenseKey) {
        try {
            const body = new URLSearchParams({
                product_permalink: GUMROAD_PRODUCT_PERMALINK,
                license_key: normalizeKey(licenseKey),
                increment_uses_count: 'false',
            });

            const res = await fetch(GUMROAD_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });

            if (!res.ok) {
                console.warn('[license] Gumroad HTTP error:', res.status);
                return { ok: false, reason: 'server-error' };
            }

            const data = await res.json();
            console.log('[license] Gumroad response:', data);

            if (data.success) {
                return {
                    ok: true,
                    purchaserEmail: data.purchase?.email || '',
                    productName: data.purchase?.product_name || '',
                };
            }

            return { ok: false, reason: data.message || 'invalid-key' };

        } catch (err) {
            console.warn('[license] Gumroad API call failed:', err.message);
            return { ok: false, reason: 'network-error' };
        }
    }

    // ── Master verification logic ─────────────────────────────────────────────
    async function verifyLicenseOnline(licenseKey) {
        // 1. Check format first
        if (!validateKeyFormat(licenseKey)) {
            return { ok: false, reason: 'invalid-format' };
        }

        // 2. Check offline master keys (always works, even without internet)
        if (isOfflineMasterKey(licenseKey)) {
            console.log('[license] Offline master key accepted');
            return { ok: true, offline: true };
        }

        // 3. Check internet
        const online = await hasInternetConnection();
        if (!online) {
            return { ok: false, reason: 'no-internet' };
        }

        // 4. Verify with Gumroad
        return await verifyWithGumroad(licenseKey);
    }

    // ── Restore on startup ───────────────────────────────────────────────────
    async function restoreLicenseState() {
        const isDevMode = await window.electronAPI?.isDev();
        let license = await getLicenseData();

        // Dev mode: auto-activate with test key
        if (isDevMode) {
            if (!license || !validateKeyFormat(license.key)) {
                const devLicense = {
                    key: 'AGP-1111-2222-3333',
                    verifiedOnline: true,
                    activatedAt: Date.now(),
                    lastOnlineCheck: Date.now(),
                    purchaserEmail: 'dev@localhost',
                };
                await saveLicenseData(devLicense);
                license = devLicense;
            }
            hideLockScreen();
            return;
        }

        const currentHwid = await window.electronAPI?.getHardwareId();

        // No saved license → Free mode
        if (!license || !validateKeyFormat(license.key)) {
            return;
        }

        // Hardware ID mismatch → invalid
        if (license.hardwareId && license.hardwareId !== currentHwid) {
            setStatus('License is bound to another device.', true);
            return;
        }

        // Pre-fill the input
        if (inputEl) inputEl.value = license.key;

        // Already verified and within grace period → let through
        if (license.verifiedOnline && withinGracePeriod(license)) {
            hideLockScreen();
            // Silently re-verify in background (don't block startup)
            setTimeout(() => silentReVerify(license.key), 3000);
            return;
        }

        // Needs re-verification
        const online = await hasInternetConnection();
        if (!online) {
            // Offline but within grace period
            if (license.verifiedOnline && withinGracePeriod(license)) {
                hideLockScreen();
                return;
            }
            showLockScreen('No internet connection. Connect to the internet to verify your license.');
            return;
        }

        await verifyAndSave(license.key);
    }

    // ── Verify and update stored data ─────────────────────────────────────────
    async function verifyAndSave(key) {
        const result = await verifyLicenseOnline(key);
        if (result.ok) {
            const hwid = await window.electronAPI?.getHardwareId();
            const updated = {
                key: normalizeKey(key),
                verifiedOnline: true,
                activatedAt: Date.now(),
                lastOnlineCheck: Date.now(),
                purchaserEmail: result.purchaserEmail || '',
                offlineKey: result.offline || false,
                hardwareId: hwid
            };
            await saveLicenseData(updated);
            hideLockScreen();
            return true;
        }
        return false;
    }

    // ── Silent background re-verification ────────────────────────────────────
    async function silentReVerify(key) {
        try {
            const result = await verifyLicenseOnline(key);
            if (result.ok) {
                const license = await getLicenseData();
                await saveLicenseData({
                    ...license,
                    lastOnlineCheck: Date.now(),
                    verifiedOnline: true,
                });
            }
        } catch (e) {
            console.warn('[license] Silent re-verify failed:', e.message);
        }
    }

    // ── Activate button handler ───────────────────────────────────────────────
    async function activate(key) {
        const normalized = normalizeKey(key);

        if (!validateKeyFormat(normalized)) {
            setStatus('Invalid key format. Use: AGP-XXXX-XXXX-XXXX', true);
            if (inputEl) {
                inputEl.classList.add('error-shake');
                setTimeout(() => inputEl.classList.remove('error-shake'), 400);
            }
            return;
        }

        setStatus('Verifying license...', false);

        // Disable button during check
        const btnUnlock = document.getElementById('btnUnlock');
        if (btnUnlock) btnUnlock.disabled = true;

        const result = await verifyLicenseOnline(normalized);

        if (btnUnlock) btnUnlock.disabled = false;

        if (!result.ok) {
            if (result.reason === 'no-internet') {
                setStatus('Internet required for first activation. Please connect and try again.', true);
            } else if (result.reason === 'invalid-format') {
                setStatus('Invalid key format. Use: AGP-XXXX-XXXX-XXXX', true);
            } else {
                setStatus('License not found. Please check your key and try again.', true);
            }
            return;
        }

        const hwid = await window.electronAPI?.getHardwareId();

        await saveLicenseData({
            key: normalized,
            verifiedOnline: true,
            activatedAt: Date.now(),
            lastOnlineCheck: Date.now(),
            purchaserEmail: result.purchaserEmail || '',
            offlineKey: result.offline || false,
            hardwareId: hwid
        });

        hideLockScreen();

        // Show success toast if available
        if (window.AGToast) {
            window.AGToast.success('✓ License activated! Welcome to Antigravity PDF Pro.');
        }
    }

    // ── Periodic background check (every 6 hours) ────────────────────────────
    async function periodicCheck() {
        const license = await getLicenseData();
        if (!license || !validateKeyFormat(license.key)) return;
        await silentReVerify(license.key);
    }

    // ── Public init ──────────────────────────────────────────────────────────
    return {
        init(lockScreen, input, status) {
            lockScreenEl = lockScreen;
            inputEl      = input;
            statusEl     = status;

            restoreLicenseState();

            // Re-verify when internet comes back online
            window.addEventListener('online', () => {
                setStatus('Internet found. Verifying license...', false);
                periodicCheck();
            });

            // Re-verify on window focus (catches expiry while app was minimised)
            window.addEventListener('focus', () => {
                if (navigator.onLine) periodicCheck();
            });

            // Every 6 hours in background
            setInterval(() => {
                if (navigator.onLine) periodicCheck();
            }, 6 * 60 * 60 * 1000);
        },

        activate,
        getLicenseData,
        validateKeyFormat,

        // Expose for settings panel / about dialog
        async getLicenseInfo() {
            const d = await getLicenseData();
            if (!d) return null;
            return {
                key: d.key,
                email: d.purchaserEmail || '',
                activatedAt: d.activatedAt ? new Date(d.activatedAt).toLocaleDateString() : '',
                isOffline: d.offlineKey || false,
                hardwareId: d.hardwareId || 'unknown',
            };
        },

        // Check if user is PRO
        async checkPremiumStatus() {
            const isDevMode = await window.electronAPI?.isDev();
            if (isDevMode) return true;

            const license = await getLicenseData();
            if (!license || !validateKeyFormat(license.key)) return false;

            const currentHwid = await window.electronAPI?.getHardwareId();
            if (license.hardwareId && license.hardwareId !== currentHwid) return false;

            return license.verifiedOnline;
        },
        
        showLockScreen
    };
})();
