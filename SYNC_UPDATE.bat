@echo off
TITLE Antigravity PDF Pro — GitHub Sync & Update
COLOR 0B
cls

echo.
echo  ====================================================
echo   Antigravity PDF Pro — Sync ^& Update
echo   GitHub থেকে সর্বশেষ আপডেট নামাবে এবং Build করবে
echo  ====================================================
echo.

:: ── Step 1: Git Pull ──────────────────────────────────
echo  [1/3] GitHub থেকে আপডেট নামানো হচ্ছে...
echo.
git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] GitHub থেকে pull করা যায়নি!
    echo  ইন্টারনেট কানেকশন চেক করুন।
    pause
    exit /b 1
)
echo.
echo  [OK] আপডেট সফলভাবে নামানো হয়েছে।
echo.

:: ── Step 2: npm install (নতুন প্যাকেজ থাকলে) ──────────
echo  [2/3] Dependencies চেক করা হচ্ছে...
echo.
call npm install --silent
echo.
echo  [OK] Dependencies ঠিক আছে।
echo.

:: ── Step 3: Build ────────────────────────────────────
echo  [3/3] App Build করা হচ্ছে (২-৪ মিনিট লাগতে পারে)...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build ব্যর্থ হয়েছে!
    echo  App বন্ধ করে আবার চেষ্টা করুন।
    pause
    exit /b 1
)

:: ── Done ─────────────────────────────────────────────
echo.
echo  ====================================================
echo   সব কাজ সম্পন্ন হয়েছে!
echo   App চালু করতে নিচের ফোল্ডারে যান:
echo   dist\win-unpacked\Antigravity PDF Pro.exe
echo  ====================================================
echo.

set /p open="এখনই App চালু করবেন? (Y/N): "
if /i "%open%"=="Y" (
    start "" "dist\win-unpacked\Antigravity PDF Pro.exe"
)

pause
