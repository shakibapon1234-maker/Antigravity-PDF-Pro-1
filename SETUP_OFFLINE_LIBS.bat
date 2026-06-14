@echo off
chcp 65001 >nul
echo ================================================
echo  Antigravity PDF Pro - Offline Library Setup
echo  (CDN dependencies কে local করা হচ্ছে)
echo ================================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [!] node_modules নেই। আগে npm install করুন।
    echo     CMD তে: npm install
    pause
    exit /b 1
)

:: Create ui/libs directory
echo [1/4] ui\libs ফোল্ডার তৈরি হচ্ছে...
if not exist "ui\libs" mkdir "ui\libs"
if not exist "ui\libs\bootstrap-icons\font\fonts" mkdir "ui\libs\bootstrap-icons\font\fonts"

:: Copy files from node_modules (already installed)
echo [2/4] node_modules থেকে লাইব্রেরি কপি হচ্ছে...

:: fontkit
copy /Y "node_modules\@pdf-lib\fontkit\dist\fontkit.umd.min.js" "ui\libs\fontkit.umd.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] fontkit) else (echo   [FAIL] fontkit - npm install @pdf-lib/fontkit করুন)

:: file-saver
copy /Y "node_modules\file-saver\dist\FileSaver.min.js" "ui\libs\FileSaver.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] file-saver) else (echo   [FAIL] file-saver)

:: jszip
copy /Y "node_modules\jszip\dist\jszip.min.js" "ui\libs\jszip.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] jszip) else (echo   [FAIL] jszip)

:: sortablejs
copy /Y "node_modules\sortablejs\Sortable.min.js" "ui\libs\Sortable.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] sortablejs) else (echo   [FAIL] sortablejs)

:: tesseract
copy /Y "node_modules\tesseract.js\dist\tesseract.min.js" "ui\libs\tesseract.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] tesseract) else (echo   [FAIL] tesseract)
copy /Y "node_modules\tesseract.js\dist\worker.min.js" "ui\libs\tesseract.worker.min.js" >nul 2>&1

:: lucide
copy /Y "node_modules\lucide\dist\umd\lucide.min.js" "ui\libs\lucide.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] lucide) else (echo   [FAIL] lucide)

:: html2pdf
copy /Y "node_modules\html2pdf.js\dist\html2pdf.bundle.min.js" "ui\libs\html2pdf.bundle.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] html2pdf) else (echo   [FAIL] html2pdf)

:: xlsx
copy /Y "node_modules\xlsx\dist\xlsx.full.min.js" "ui\libs\xlsx.full.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] xlsx) else (echo   [FAIL] xlsx)

:: jspdf
copy /Y "node_modules\jspdf\dist\jspdf.umd.min.js" "ui\libs\jspdf.umd.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] jspdf) else (echo   [FAIL] jspdf)

:: mammoth
copy /Y "node_modules\mammoth\mammoth.browser.min.js" "ui\libs\mammoth.browser.min.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] mammoth) else (echo   [FAIL] mammoth)

:: docx
copy /Y "node_modules\docx\build\index.js" "ui\libs\docx.index.js" >nul 2>&1
if %errorlevel%==0 (echo   [OK] docx) else (echo   [FAIL] docx)

:: bootstrap-icons
copy /Y "node_modules\bootstrap-icons\font\bootstrap-icons.min.css" "ui\libs\bootstrap-icons\font\bootstrap-icons.min.css" >nul 2>&1
xcopy /Y /E /Q "node_modules\bootstrap-icons\font\fonts\*" "ui\libs\bootstrap-icons\font\fonts\" >nul 2>&1
if %errorlevel%==0 (echo   [OK] bootstrap-icons) else (echo   [FAIL] bootstrap-icons)

echo.
echo [3/4] Missing packages install হচ্ছে (যদি দরকার হয়)...
call npm install @pdf-lib/fontkit@0.0.4 docx@7.1.0 file-saver@2.0.5 jszip@3.10.1 sortablejs tesseract.js@5 lucide html2pdf.js@0.10.1 xlsx@0.18.5 jspdf@2.5.2 mammoth@1.6.0 bootstrap-icons@1.11.3 --save-dev 2>nul
echo   [OK] npm install সম্পন্ন

echo.
echo [4/4] উপরের step repeat করা হচ্ছে (নতুন downloads এর জন্য)...
copy /Y "node_modules\@pdf-lib\fontkit\dist\fontkit.umd.min.js" "ui\libs\fontkit.umd.min.js" >nul 2>&1
copy /Y "node_modules\file-saver\dist\FileSaver.min.js" "ui\libs\FileSaver.min.js" >nul 2>&1
copy /Y "node_modules\jszip\dist\jszip.min.js" "ui\libs\jszip.min.js" >nul 2>&1
copy /Y "node_modules\sortablejs\Sortable.min.js" "ui\libs\Sortable.min.js" >nul 2>&1
copy /Y "node_modules\tesseract.js\dist\tesseract.min.js" "ui\libs\tesseract.min.js" >nul 2>&1
copy /Y "node_modules\tesseract.js\dist\worker.min.js" "ui\libs\tesseract.worker.min.js" >nul 2>&1
copy /Y "node_modules\lucide\dist\umd\lucide.min.js" "ui\libs\lucide.min.js" >nul 2>&1
copy /Y "node_modules\html2pdf.js\dist\html2pdf.bundle.min.js" "ui\libs\html2pdf.bundle.min.js" >nul 2>&1
copy /Y "node_modules\xlsx\dist\xlsx.full.min.js" "ui\libs\xlsx.full.min.js" >nul 2>&1
copy /Y "node_modules\jspdf\dist\jspdf.umd.min.js" "ui\libs\jspdf.umd.min.js" >nul 2>&1
copy /Y "node_modules\mammoth\mammoth.browser.min.js" "ui\libs\mammoth.browser.min.js" >nul 2>&1
copy /Y "node_modules\docx\build\index.js" "ui\libs\docx.index.js" >nul 2>&1
copy /Y "node_modules\bootstrap-icons\font\bootstrap-icons.min.css" "ui\libs\bootstrap-icons\font\bootstrap-icons.min.css" >nul 2>&1
xcopy /Y /E /Q "node_modules\bootstrap-icons\font\fonts\*" "ui\libs\bootstrap-icons\font\fonts\" >nul 2>&1

echo.
echo ================================================
echo  সম্পন্ন! অ্যাপ এখন সম্পূর্ণ Offline কাজ করবে।
echo  এখন npm start বা DEV_START.bat চালান।
echo ================================================
echo.
pause
