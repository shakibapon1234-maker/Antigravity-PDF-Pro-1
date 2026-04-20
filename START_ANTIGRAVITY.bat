@echo off
TITLE Antigravity PDF Pro - Startup
COLOR 0A
echo.
echo  =========================================
echo    ANTIGRAVITY PDF PRO - STARTUP
echo  =========================================
echo.

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install it.
    pause
    exit /b
)

echo [INFO] Starting Server...
echo [INFO] Opening Browser at http://localhost:3000...
start http://localhost:3000

:: Run the server
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped unexpectedly.
    pause
)
