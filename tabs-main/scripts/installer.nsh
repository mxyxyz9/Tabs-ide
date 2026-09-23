# Close processes launched from this installation before NSIS replaces files.
!macro customCheckAppRunning
  InitPluginsDir
  File /oname=$PLUGINSDIR\close-tabs-processes.ps1 "${PROJECT_DIR}\build\close-windows-install-processes.ps1"
  nsExec::ExecToLog /TIMEOUT=60000 `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\close-tabs-processes.ps1" "$INSTDIR"`
  Pop $0
  StrCmp $0 0 checkDone
  DetailPrint "Process close command returned $0"
  IfSilent cancelInstall 0
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY retryClose IDCANCEL cancelInstall
  retryClose:
    nsExec::ExecToLog /TIMEOUT=60000 `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\close-tabs-processes.ps1" "$INSTDIR"`
    Pop $0
    StrCmp $0 0 checkDone
  cancelInstall:
    Quit
  checkDone:
!macroend
