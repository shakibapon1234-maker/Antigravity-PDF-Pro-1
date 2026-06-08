const LicenseManager = (() => {
    const LICENSE_KEY_REGEX = /^AGP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const STORE_KEY = 'licenseData';

    let lockScreenEl = null;
    let inputEl = null;
    let statusEl = null;

    function normalizeKey(key) {
        return key ? key.trim().toUpperCase() : '';
    }

    function validateLicenseKey(key) {
        return LICENSE_KEY_REGEX.test(normalizeKey(key));
    }

    function formatDate(ts) {
        return new Date(ts).toLocaleDateString();
    }

    function getLicenseData() {
        return window.electronAPI.storeGet(STORE_KEY);
    }

    function saveLicenseData(data) {
        return window.electronAPI.storeSet(STORE_KEY, data);
    }

    function setStatus(message, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.display = message ? 'block' : 'none';
        statusEl.style.color = isError ? 'var(--accent-pink)' : 'var(--text-muted)';
    }

    function showLockScreen(message = '') {
        if (lockScreenEl) lockScreenEl.style.display = 'flex';
        setStatus(message);
    }

    function hideLockScreen() {
        if (lockScreenEl) lockScreenEl.style.display = 'none';
        setStatus('License activated. Thank you for using Antigravity Pro.', false);
    }

    function withinGracePeriod(license) {
        if (!license || !license.lastOnlineCheck) return false;
        return Date.now() - license.lastOnlineCheck <= GRACE_PERIOD_MS;
    }

    async function hasInternetConnection() {
        if (!navigator.onLine) return false;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const response = await fetch('https://www.google.com/generate_204', {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timeout);
            return response && response.status >= 200 && response.status < 400;
        } catch (err) {
            return false;
        }
    }

    async function verifyLicenseOnline(licenseKey) {
        const hasConnection = await hasInternetConnection();
        if (!hasConnection) {
            return { ok: false, reason: 'no-internet' };
        }

        // Placeholder online verification: if key format is valid, treat it as verified.
        // Replace this with a real remote license server endpoint later.
        if (validateLicenseKey(licenseKey)) {
            return { ok: true };
        }
        return { ok: false, reason: 'invalid-key' };
    }

    async function restoreLicenseState() {
        const isDevMode = await window.electronAPI.isDev();
        let license = await getLicenseData();
        
        if (isDevMode) {
            // Auto-populate default key in development/offline local runs
            if (!license || !validateLicenseKey(license.key)) {
                const defaultLicense = {
                    key: 'AGP-1111-2222-3333',
                    verifiedOnline: true,
                    activatedAt: Date.now(),
                    lastOnlineCheck: Date.now(),
                };
                await saveLicenseData(defaultLicense);
                license = defaultLicense;
            }
            if (inputEl && license && license.key) {
                inputEl.value = license.key;
            }
            hideLockScreen();
            return;
        }

        // Production Mode (when you package and sell the app)
        if (license && license.key) {
            inputEl.value = license.key;
        }

        if (!license || !validateLicenseKey(license.key)) {
            showLockScreen('Enter a valid Antigravity Pro license key to activate the app.');
            return;
        }

        if (license.verifiedOnline && withinGracePeriod(license)) {
            hideLockScreen();
            return;
        }

        const online = await hasInternetConnection();
        if (!online) {
            if (license.verifiedOnline && withinGracePeriod(license)) {
                hideLockScreen();
                return;
            }
            showLockScreen('No internet connection. Connect to the internet to verify your license.');
            return;
        }

        await verifyAndUpdateLicense(license.key);
    }

    async function verifyAndUpdateLicense(key) {
        const result = await verifyLicenseOnline(key);
        if (result.ok) {
            const updated = {
                key: normalizeKey(key),
                verifiedOnline: true,
                lastOnlineCheck: Date.now(),
                activatedAt: Date.now(),
            };
            await saveLicenseData(updated);
            hideLockScreen();
            return true;
        }

        showLockScreen('License verification failed. Enter a valid Antigravity Pro license key.');
        return false;
    }

    async function activate(key) {
        const normalizedKey = normalizeKey(key);
        if (!validateLicenseKey(normalizedKey)) {
            setStatus('License key is invalid. Use AGP-XXXX-XXXX-XXXX format.', true);
            inputEl.classList.add('error-shake');
            setTimeout(() => inputEl.classList.remove('error-shake'), 300);
            return;
        }

        setStatus('Checking license online...', false);
        const result = await verifyLicenseOnline(normalizedKey);
        if (!result.ok) {
            if (result.reason === 'no-internet') {
                setStatus('Internet required for first activation. Please connect and try again.', true);
            } else {
                setStatus('License activation failed. Please verify your key.', true);
            }
            return;
        }

        const licenseData = {
            key: normalizedKey,
            verifiedOnline: true,
            activatedAt: Date.now(),
            lastOnlineCheck: Date.now(),
        };
        await saveLicenseData(licenseData);
        hideLockScreen();
    }

    async function checkOnlineLicense() {
        const license = await getLicenseData();
        if (!license || !validateLicenseKey(license.key)) {
            return;
        }
        await verifyAndUpdateLicense(license.key);
    }

    return {
        init: (lockScreen, input, status) => {
            lockScreenEl = lockScreen;
            inputEl = input;
            statusEl = status;
            restoreLicenseState();

            window.addEventListener('online', () => {
                setStatus('Internet connection found. Verifying license...', false);
                checkOnlineLicense();
            });

            window.addEventListener('focus', () => {
                if (navigator.onLine) {
                    checkOnlineLicense();
                }
            });

            setInterval(() => {
                if (navigator.onLine) {
                    checkOnlineLicense();
                }
            }, 6 * 60 * 60 * 1000); // every 6 hours
        },
        activate,
        getLicenseData,
        validateLicenseKey,
    };
})();
