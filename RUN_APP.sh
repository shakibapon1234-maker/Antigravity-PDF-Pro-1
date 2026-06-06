#!/bin/bash
# Antigravity PDF Pro - Linux/Mac Launcher
cd "$(dirname "$0")/dist/win-unpacked"
open "Antigravity PDF Pro.exe" 2>/dev/null || "./Antigravity PDF Pro.exe"
