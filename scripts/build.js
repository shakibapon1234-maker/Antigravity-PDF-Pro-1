const { execSync } = require('child_process');

if (process.env.VERCEL) {
  console.log("Running on Vercel deployment — skipping electron-builder compilation.");
  // Vercel only needs static files, so we don't compile Electron binaries here.
} else {
  console.log("Running local build — starting electron-builder...");
  try {
    execSync('electron-builder --win --x64', { stdio: 'inherit' });
  } catch (error) {
    console.error("Local build failed:", error.message);
    process.exit(1);
  }
}
