@echo off
TITLE Antigravity PDF Pro - Development Mode
COLOR 0A
echo.
echo  Starting in Development Mode (with DevTools)...
echo.
cd /d "%~dp0"
call npm install
call npm run dev
