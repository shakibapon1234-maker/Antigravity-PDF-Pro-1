# installer.nsh - Custom NSIS installer script for Antigravity PDF Pro
# এই ফাইলটা electron-builder এর NSIS build এ include হয়

!macro customInstall
  ; File association: .pdf files
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "AntigravityPDFPro.pdf" ""
  WriteRegStr HKCU "Software\Classes\AntigravityPDFPro.pdf" "" "PDF Document"
  WriteRegStr HKCU "Software\Classes\AntigravityPDFPro.pdf\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\AntigravityPDFPro.pdf\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  
  ; Notify Windows of file association change
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ; Remove file associations
  DeleteRegKey HKCU "Software\Classes\AntigravityPDFPro.pdf"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "AntigravityPDFPro.pdf"
  
  ; Notify Windows
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
