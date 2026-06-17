/**
 * Antigravity PDF Pro — Automatic Update Checker
 */
const UpdateChecker = (() => {
    const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/shakibapon1234-maker/Antigravity-PDF-Pro-1/main/version.json';
    const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // Check every 12 hours

    async function checkUpdates() {
        try {
            // Get current app version from Electron API
            const currentVersion = await window.electronAPI?.getVersion() || '1.0.0';
            
            // Check internet
            if (!navigator.onLine) return;

            console.log('[update] Checking for updates against:', UPDATE_CHECK_URL);
            const res = await fetch(UPDATE_CHECK_URL, { cache: 'no-store' });
            if (!res.ok) return;

            const data = await res.json();
            if (!data.version) return;

            console.log(`[update] Current version: ${currentVersion}, Latest version: ${data.version}`);
            if (isNewerVersion(currentVersion, data.version)) {
                showUpdateBanner(data.version, data.downloadUrl || 'https://github.com/shakibapon1234-maker/Antigravity-PDF-Pro-1/releases');
            }
        } catch (e) {
            console.warn('[update] Failed to check for updates:', e.message);
        }
    }

    function isNewerVersion(current, latest) {
        const cParts = current.split('.').map(Number);
        const lParts = latest.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const c = cParts[i] || 0;
            const l = lParts[i] || 0;
            if (l > c) return true;
            if (c > l) return false;
        }
        return false;
    }

    function showUpdateBanner(version, downloadUrl) {
        // Prevent duplicate banners
        if (document.getElementById('ag-update-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'ag-update-banner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 44px;
            background: linear-gradient(90deg, #1e1b4b, #311042);
            border-bottom: 1px solid rgba(184, 41, 249, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            z-index: 999998;
            color: #fff;
            font-family: 'Outfit', sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideDown 0.4s ease-out;
        `;

        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(184, 41, 249, 0.2); border: 1px solid rgba(184, 41, 249, 0.5); border-radius: 20px; padding: 2px 8px; font-size: 11px; font-weight: 700; color: #d8b4fe; letter-spacing: 0.5px;">UPDATE AVAILABLE</span>
                <span>Antigravity PDF Pro v${version} is now available!</span>
            </div>
            <a href="${downloadUrl}" target="_blank" style="background: #b829f9; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 10px rgba(184,41,249,0.3);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Download Now</a>
            <button id="btn-close-update-banner" style="background: transparent; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 18px; position: absolute; right: 16px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.05)';" onmouseout="this.style.color='rgba(255,255,255,0.4)'; this.style.background='transparent';">&times;</button>
        `;

        // Push down the app container to make room
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.transition = 'margin-top 0.4s ease-out';
            appContainer.style.marginTop = '44px';
        }

        document.body.appendChild(banner);

        document.getElementById('btn-close-update-banner').addEventListener('click', () => {
            banner.remove();
            if (appContainer) {
                appContainer.style.marginTop = '0';
            }
        });
    }

    return {
        init() {
            // Check on startup after 4 seconds
            setTimeout(checkUpdates, 4000);

            // Periodically check
            setInterval(checkUpdates, CHECK_INTERVAL_MS);
        }
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    UpdateChecker.init();
});
