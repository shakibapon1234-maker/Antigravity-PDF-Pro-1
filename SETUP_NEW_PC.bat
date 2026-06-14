@echo off
chcp 65001 >nul
TITLE Antigravity PDF Pro — নতুন PC Setup
COLOR 0A
cls

echo.
echo  ====================================================
echo   Antigravity PDF Pro — নতুন PC তে প্রথমবার Setup
echo   GitHub থেকে Project নামাবে এবং Build করবে
echo  ====================================================
echo.
echo  এই ফাইলটা নতুন PC তে যেকোনো ফোল্ডারে রেখে চালান।
echo  সব কিছু এই ফোল্ডারেই ডাউনলোড হবে।
echo.
pause

:: ── Check Git installed ───────────────────────────────
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Git installed নেই!
    echo  https://git-scm.com/download/win থেকে Git ডাউনলোড করুন।
    echo  Install করার পর এই ফাইল আবার চালান।
    pause
    exit /b 1
)

:: ── Check Node.js installed ──────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js installed নেই!
    echo  https://nodejs.org থেকে Node.js ডাউনলোড করুন।
    echo  Install করার পর এই ফাইল আবার চালান।
    pause
    exit /b 1
)

echo.
echo  [1/4] GitHub থেকে Project নামানো হচ্ছে...
echo.
git clone https://github.com/shakibapon1234-maker/Antigravity-PDF-Pro-1.git
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Clone করা যায়নি!
    echo  ইন্টারনেট কানেকশন চেক করুন।
    pause
    exit /b 1
)
echo.
echo  [OK] Project নামানো হয়েছে।
echo.

:: ── Enter project folder ─────────────────────────────
cd Antigravity-PDF-Pro-1

:: ── npm install ──────────────────────────────────────
echo  [2/4] Dependencies ইন্সটল করা হচ্ছে (৫-১০ মিনিট)...
echo.
call npm install
echo.
echo  [OK] Dependencies ইন্সটল হয়েছে।
echo.

:: ── Build ────────────────────────────────────────────
echo  [3/4] App Build করা হচ্ছে (২-৪ মিনিট)...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build ব্যর্থ হয়েছে!
    pause
    exit /b 1
)
echo.
echo  [OK] Build সম্পন্ন।
echo.

:: ── Create shortcut tip ──────────────────────────────
echo  [4/4] সব কাজ শেষ!
echo.
echo  ====================================================
echo   Setup সম্পন্ন হয়েছে!
echo.  
echo   App চালু করতে:
echo   Antigravity-PDF-Pro-1\dist\win-unpacked\
echo   ^> Antigravity PDF Pro.exe
echo.
echo   ভবিষ্যতে আপডেটের জন্য:
echo   Antigravity-PDF-Pro-1 ফোল্ডারে
echo   SYNC_UPDATE.bat চালান।
echo  ====================================================
echo.

set /p open="এখনই App চালু করবেন? (Y/N): "
if /i "%open%"=="Y" (
    start "" "dist\win-unpacked\Antigravity PDF Pro.exe"
)

pause
