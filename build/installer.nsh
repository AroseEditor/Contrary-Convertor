; build/installer.nsh — Custom NSIS hooks for Contrary Convertor
; Minimizes the NSIS window and runs the branded Electron setup window instead.

!macro preInit
  ; Hide the NSIS installer window as soon as possible
  HideWindow
!macroend

!macro customInstall
  ; Download dependencies using the branded Electron setup window
  ; The NSIS window is hidden — user only sees our dark red themed UI
  ExecWait '"$INSTDIR\${APP_FILENAME}.exe" --install-deps' $0

  ${If} $0 == "0"
    DetailPrint "Dependencies installed successfully."
  ${Else}
    DetailPrint "Dependencies will download on first launch (code: $0)."
  ${EndIf}

  ; Launch the app normally
  Exec '"$INSTDIR\${APP_FILENAME}.exe"'
!macroend
