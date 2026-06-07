@echo off
REM =========================================================================
REM  Antigravity PDF Pro - Portable Setup
REM  Complete solution for moving app anywhere
REM =========================================================================

title Antigravity PDF Pro - Setup Wizard
color 0A
cls

:MENU
cls
echo.
echo ====================================================================
echo          Antigravity PDF Pro - Portable Edition Setup
echo ====================================================================
echo.
echo What do you want to do?
echo.
echo   1) Create portable package (for distribution)
echo   2) Install to Desktop (with shortcuts)
echo   3) Fix: Run from Desktop/other location
echo   4) Check system requirements
echo   5) Exit
echo.
echo ====================================================================
set /p CHOICE="Enter your choice (1-5): "

if "%CHOICE%"=="1" goto CREATEPACKAGE
if "%CHOICE%"=="2" goto INSTALLDESKTOP
if "%CHOICE%"=="3" goto FIXPORTABLE
if "%CHOICE%"=="4" goto CHECKSYSTEM
if "%CHOICE%"=="5" goto EOF
goto MENU

:CREATEPACKAGE
cls
echo.
echo Creating portable package...
if exist "CREATE_DISTRIBUTION.bat" (
    call CREATE_DISTRIBUTION.bat
) else (
    echo ERROR: Setup file not found!
)
pause
goto MENU

:INSTALLDESKTOP
cls
echo.
echo Installing to Desktop...
echo.

if exist "dist\Install.bat" (
    call dist\Install.bat
    echo Installation complete!
) else (
    echo ERROR: Build not found. Run: npm run build
)
pause
goto MENU

:FIXPORTABLE
cls
echo.
echo ====================================================================
echo            SOLUTION: Running app from other locations
echo ====================================================================
echo.
echo PROBLEM: "ffmpeg.dll not found" error
echo.
echo SOLUTION: You must copy the ENTIRE folder together!
echo.
echo Instructions:
echo.
echo   Step 1: Locate the correct folder
echo     - This should be in: Antigravity-PDF-Pro-1\dist\win-unpacked
echo     - NOT just the .exe file!
echo.
echo   Step 2: Copy ENTIRE folder to Desktop
echo     - Right-click on "win-unpacked" folder
echo     - Copy
echo     - Go to Desktop
echo     - Paste
echo.
echo   Step 3: Run the app
echo     - Inside the pasted folder
echo     - Find "Antigravity PDF Pro.exe"
echo     - Double-click to run
echo.
echo   Step 4 (Optional): Rename folder
echo     - You can rename "win-unpacked" to "Antigravity PDF Pro"
echo     - For easier use
echo.
echo KEY POINTS:
echo   ✓ Always copy the entire folder
echo   ✓ Keep all .dll files with .exe
echo   ✓ Don't move individual files
echo   ✓ Can be on Desktop, USB, Cloud Drive, anywhere!
echo.
echo ====================================================================
pause
goto MENU

:CHECKSYSTEM
cls
echo.
echo ====================================================================
echo           System Requirements Check
echo ====================================================================
echo.

echo Checking Windows Version...
systeminfo | findstr /C:"OS Name"

echo.
echo Checking for Visual C++ Runtime...
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Classes\Installer\Dependencies\Microsoft.VS.VC_RuntimeMinimumRuntime-14.0-x64" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Visual C++ Runtime installed
) else (
    echo [WARNING] Visual C++ Runtime might be missing
    echo.
    echo Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
    echo Install it and try again
)

echo.
echo ====================================================================
pause
goto MENU
