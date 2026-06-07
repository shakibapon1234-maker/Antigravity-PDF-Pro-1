/**
 * ui/theme.js
 * Handles Light/Dark Theme toggling, persistent storage via electron-store,
 * and system preference matching on startup.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const themeBtn = document.getElementById('btnToggleTheme');
  
  if (!themeBtn) return;

  // 1. Determine initial theme
  let theme = 'dark'; // default theme is dark
  
  if (window.electronAPI && typeof window.electronAPI.storeGet === 'function') {
    try {
      const savedTheme = await window.electronAPI.storeGet('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        theme = savedTheme;
      } else {
        // Fall back to system preferences
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        theme = prefersLight ? 'light' : 'dark';
      }
    } catch (err) {
      console.error('[Theme] Failed to read theme from store, using default:', err);
    }
  } else {
    // Web fallback if running in browser
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = prefersLight ? 'light' : 'dark';
  }

  // 2. Apply theme
  applyTheme(theme);

  // 3. Toggle button click handler
  themeBtn.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);

    // Save choice
    if (window.electronAPI && typeof window.electronAPI.storeSet === 'function') {
      window.electronAPI.storeSet('theme', newTheme).catch(err => {
        console.error('[Theme] Failed to save theme choice:', err);
      });
    }
  });

  // Helper to apply theme to body and update icon
  function applyTheme(targetTheme) {
    if (targetTheme === 'light') {
      document.body.classList.add('light-theme');
      // If it's light theme, show the "moon" icon to switch back to dark
      updateIcon('moon');
      themeBtn.title = 'Switch to Dark Mode';
    } else {
      document.body.classList.remove('light-theme');
      // If it's dark theme, show the "sun" icon to switch back to light
      updateIcon('sun');
      themeBtn.title = 'Switch to Light Mode';
    }
  }

  // Helper to update the Lucide icon
  function updateIcon(iconName) {
    // Re-create the i tag for Lucide
    themeBtn.innerHTML = `<i data-lucide="${iconName}" id="themeIcon"></i>`;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
});
