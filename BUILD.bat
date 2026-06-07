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
echo [3/3] Cleaning up build artifacts...
if exist "dist\*.blockmap" (
    echo Removing unnecessary blockmap files...
    del /q "dist\*.blockmap"
)
if exist "dist\Antigravity PDF Pro Setup 1.0.0.exe" del /q "dist\Antigravity PDF Pro Setup 1.0.0.exe"
if exist "dist\Antigravity-PDF-Pro-Setup-1.0.0.exe" del /q "dist\Antigravity-PDF-Pro-Setup-1.0.0.exe"
if exist "dist\Antigravity-PDF-Pro-1.0.0-Portable.exe" del /q "dist\Antigravity-PDF-Pro-1.0.0-Portable.exe"
if exist "dist\Antigravity-PDF-Pro-1.0.0-x64.msi" del /q "dist\Antigravity-PDF-Pro-1.0.0-x64.msi"

echo.
echo =========================================
echo   Build Successful!
echo =========================================
echo.
echo The following files are in the "dist" folder:
echo  - Install App.exe (Install on PC)
echo  - Start with double click.exe (Portable, runs directly)
echo  - win-unpacked\ (Unpacked folder structure)
echo.
pause
