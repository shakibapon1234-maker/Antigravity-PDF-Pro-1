@echo off
setlocal enabledelayedexpansion

REM =========================================================================
REM  Antigravity PDF Pro - Distribution Creator
REM  Creates a self-contained, move-anywhere package
REM =========================================================================

echo.
echo ====================================================================
echo   Creating Distribution Package with All Dependencies
echo ====================================================================
echo.

cd /d "%~dp0"

if not exist "dist\win-unpacked" (
    echo ERROR: Build folder not found!
    echo Please run: npm run build
    pause
    exit /b 1
)

set "SOURCE=dist\win-unpacked"
set "OUTPUT=Antigravity-PDF-Pro-Portable"

REM Remove old package
if exist "%OUTPUT%" (
    echo [1/5] Cleaning old package...
    rmdir /s /q "%OUTPUT%"
)

REM Create package folder
echo [2/5] Creating package structure...
mkdir "%OUTPUT%"

REM Copy all files
echo [3/5] Copying application files...
xcopy "%SOURCE%\*" "%OUTPUT%\" /E /I /Y >nul

REM Create startup scripts
echo [4/5] Creating launcher scripts...

REM Main launcher
(
echo @echo off
echo cd /d "%%~dp0"
echo if not exist "ffmpeg.dll" (
echo     color 0C
echo     echo ERROR: Missing files detected!
echo     echo.
echo     echo Make sure you copied the ENTIRE folder, not just the .exe
echo     echo.
echo     echo Files should include:
echo     echo   - Antigravity PDF Pro.exe
echo     echo   - ffmpeg.dll
echo     echo   - Other .dll files
echo     echo.
echo     pause
echo     exit /b 1
echo )
echo "Antigravity PDF Pro.exe"
) > "%OUTPUT%\RUN.bat"

REM Repair script
(
echo @echo off
echo echo Checking for missing dependencies...
echo echo.
echo set "FOUND_ERRORS=0"
echo.
echo for %%%%D in (ffmpeg.dll d3dcompiler_47.dll libEGL.dll libGLESv2.dll) do (
echo     if exist "%%%%D" (
echo         echo [OK] %%%%D found
echo     ) else (
echo         echo [ERROR] %%%%D MISSING!
echo         set "FOUND_ERRORS=1"
echo     )
echo )
echo.
echo if !FOUND_ERRORS! equ 1 (
echo     echo.
echo     echo SOLUTION:
echo     echo 1. Download Visual C++ Redistributable:
echo     echo    https://aka.ms/vs/17/release/vc_redist.x64.exe
echo     echo 2. Install it
echo     echo 3. Download full package again
echo     echo.
echo ) else (
echo     echo.
echo     echo All files found! Try running RUN.bat
echo     echo.
echo )
echo pause
) > "%OUTPUT%\CheckDependencies.bat"

REM Create info file
echo [5/5] Creating documentation...
(
echo # Antigravity PDF Pro - Portable Package
echo.
echo ## How to Use
echo.
echo Simply run: **RUN.bat** or double-click **Antigravity PDF Pro.exe**
echo.
echo ## Troubleshooting
echo.
echo If you get error "ffmpeg.dll not found":
echo.
echo 1. Make sure you copied the ENTIRE folder
echo 2. Don't move individual files
echo 3. Keep all .dll files together with the .exe
echo.
echo If app won't start:
echo.
echo 1. Run "CheckDependencies.bat"
echo 2. Install Visual C++ Redistributable if needed:
echo    https://aka.ms/vs/17/release/vc_redist.x64.exe
echo 3. Make sure Windows is updated
echo.
echo ## Moving to Another Computer
echo.
echo 1. Zip this entire folder
echo 2. Copy to another computer
echo 3. Extract it
echo 4. Run RUN.bat
echo.
) > "%OUTPUT%\README.txt"

echo.
echo ====================================================================
echo   Package Created Successfully!
echo ====================================================================
echo.
echo Location: %OUTPUT%
echo.
echo Test it:
echo   1. cd %OUTPUT%
echo   2. RUN.bat
echo.
echo To distribute:
echo   1. Zip the %OUTPUT% folder
echo   2. Send to users
echo   3. Users extract and run RUN.bat
echo.
pause
