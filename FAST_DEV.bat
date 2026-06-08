@echo off
TITLE Antigravity PDF Pro - Fast Development Mode
COLOR 0D
echo.
echo  Starting in Fast Development Mode (skipping npm install)...
echo.
cd /d "%~dp0"
call npm run dev
