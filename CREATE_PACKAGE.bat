@echo off
setlocal enabledelayedexpansion

REM =========================================================================
REM  Antigravity PDF Pro - Advanced Distribution Packager
REM  This script creates a ready-to-distribute package with installers
REM =========================================================================

cd /d "%~dp0\..\"

if not exist "dist\win-unpacked\Antigravity PDF Pro.exe" (
    echo [ERROR] Build not found! Run npm run build first.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo   Creating Distribution Package...
echo ====================================================================
echo.

set "DIST_DIR=dist\win-unpacked"
set "PKG_NAME=Antigravity-PDF-Pro-Portable"
set "PKG_DIR=%PKG_NAME%"

REM Clean old packages
if exist "%PKG_DIR%" rmdir /s /q "%PKG_DIR%"
mkdir "%PKG_DIR%"

echo [1/3] Copying application files...
xcopy "%DIST_DIR%\*" "%PKG_DIR%\" /E /I /Y >nul

echo [2/3] Creating launcher scripts...

REM Create direct launcher
(
echo @echo off
echo cd /d "%%~dp0"
echo "Antigravity PDF Pro.exe"
) > "%PKG_DIR%\RUN.bat"

REM Create uninstall script (just for cleanup)
(
echo @echo off
echo if exist "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Antigravity PDF Pro.lnk" (
echo     del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Antigravity PDF Pro.lnk"
echo )
echo if exist "%%USERPROFILE%%\Desktop\Antigravity PDF Pro.lnk" (
echo     del "%%USERPROFILE%%\Desktop\Antigravity PDF Pro.lnk"
echo )
echo echo Uninstalled successfully!
echo pause
) > "%PKG_DIR%\Uninstall.bat"

echo [3/3] Creating README files...

REM Create main README
(
echo # Antigravity PDF Pro - Portable Edition
echo.
echo ## Quick Start
echo.
echo Run "RUN.bat" or double-click "Antigravity PDF Pro.exe"
echo.
echo ## Installation
echo.
echo This is a portable application. No installation needed!
echo.
echo Optional: Run "Install.bat" from the dist folder to create shortcuts.
echo.
echo ## Requirements
echo.
echo - Windows 7 or later
echo - No additional software needed
echo.
) > "%PKG_DIR%\README.txt"

echo.
echo ====================================================================
echo   Distribution Package Created!
echo ====================================================================
echo.
echo Location: %PKG_DIR%/
echo.
echo Next steps:
echo   1. Run "%PKG_DIR%\RUN.bat" to test the application
echo   2. Compress the folder to ZIP for distribution
echo   3. Users can extract and run directly!
echo.
pause
