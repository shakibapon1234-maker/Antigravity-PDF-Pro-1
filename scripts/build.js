const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.env.VERCEL) {
  console.log("Running on Vercel deployment — copying static site assets to dist/...");
  
  const srcDir = path.join(__dirname, '..');
  const destDir = path.join(srcDir, 'dist');
  
  // Create dist/ if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Helper to copy file or folder
  function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else if (exists) {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy files
  copyRecursiveSync(path.join(srcDir, 'landing.html'), path.join(destDir, 'index.html')); // copy landing.html as index.html
  copyRecursiveSync(path.join(srcDir, 'landing.html'), path.join(destDir, 'landing.html')); // copy landing.html as landing.html for vercel rewrites
  copyRecursiveSync(path.join(srcDir, 'googled6196e4fd6461a39.html'), path.join(destDir, 'googled6196e4fd6461a39.html'));
  copyRecursiveSync(path.join(srcDir, 'assets'), path.join(destDir, 'assets'));
  copyRecursiveSync(path.join(srcDir, 'style.css'), path.join(destDir, 'style.css'));

  console.log("Static site assets successfully copied to dist/!");
} else {
  console.log("Running local build — starting electron-builder...");
  try {
    execSync('electron-builder --win --x64', { stdio: 'inherit' });
  } catch (error) {
    console.error("Local build failed:", error.message);
    process.exit(1);
  }
}
