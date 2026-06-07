@echo off
TITLE Antigravity PDF Pro - Build Desktop App
COLOR 0B
echo.
echo  =========================================
echo    ANTIGRAVITY PDF PRO - DESKTOP BUILD
echo  =========================================
echo.

cd /d "%~dp0"

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Building desktop app...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! 
    echo TIP: Make sure assets/icon.ico exists, or remove icon line from package.json
    pause
    exit /b 1
)

echo.
echo [3/3] Done!
echo.
echo Output is in the "dist" folder:
echo  - win-unpacked\Antigravity PDF Pro.exe (Unpacked Application)
echo.
pause
