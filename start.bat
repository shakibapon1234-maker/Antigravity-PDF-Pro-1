@echo off
TITLE Antigravity PDF Pro - Local Server
COLOR 0B
echo.
echo  =========================================
echo    ANTIGRAVITY PDF PRO - STARTUP ENGINE
echo  =========================================
echo.

cd /d "%~dp0"

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js found. Please install it from https://nodejs.org/
    color 0C
    pause
    exit /b
)

:: Install dependencies if missing
if not exist node_modules (
    echo [INFO] First time setup: Installing dependencies...
    call npm install
)

echo [READY] Project is ready to launch.
echo [INFO] Opening Browser at http://localhost:3000...
start http://localhost:3000

echo [INFO] Running Background Server...
echo.
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server crashed or stopped unexpectedly.
    color 0C
    pause
)
