@echo off
REM =========================================================================
REM  Antigravity PDF Pro - Direct Launcher
REM  Put this in the root folder to launch app directly
REM =========================================================================

cd /d "%~dp0\dist\win-unpacked"

if not exist "Antigravity PDF Pro.exe" (
    echo ERROR: Application file not found!
    echo Please ensure the folder structure is intact.
    pause
    exit /b 1
)

"Antigravity PDF Pro.exe"
