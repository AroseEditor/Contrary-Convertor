; build/installer.nsh — Custom NSIS hooks for Contrary Convertor

!macro customInstall
  ; Launch the app after install
  Exec '"$INSTDIR\${APP_FILENAME}.exe"'
!macroend
