const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('Launch Electron App and verify basic structure', async () => {
  // Launch Electron App
  const electronApp = await electron.launch({ args: ['.', '--dev'] });

  // Get the first window that the app opens
  const window = await electronApp.firstWindow();

  // Wait for the DOM content to be fully loaded
  await window.waitForLoadState('domcontentloaded');

  // Verify that we loaded the local Express server URL
  const url = window.url();
  console.log(`Loaded URL: ${url}`);
  expect(url).toContain('http://localhost:3000');

  // Verify that the document title is correct or at least not empty
  const docTitle = await window.evaluate(() => document.title);
  console.log(`Document title: ${docTitle}`);
  expect(docTitle).toContain('Antigravity PDF Editor');

  // Close the app
  await electronApp.close();
});
