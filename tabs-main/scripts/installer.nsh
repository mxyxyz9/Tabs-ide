# Custom NSIS script for Tabs IDE installer
# Overrides default process termination in allowOnlyOneInstallerInstance.nsh to prevent
# "Tabs cannot be closed" errors when windowless/background processes hold file locks.

!macro customCheckAppRunning
  DetailPrint "Ensuring ${PRODUCT_NAME} is closed..."

  # 1. Terminate any processes running from $INSTDIR using PowerShell with ExecutionPolicy Bypass
  nsExec::Exec `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith('$INSTDIR', [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  Pop $0

  # 2. Force-kill Tabs.exe process tree across all sessions/elevation boundaries without username filtering
  nsExec::Exec `"$CmdPath" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
  Pop $0

  # 3. Force-kill helper binaries that may hold file locks under $INSTDIR
  nsExec::Exec `"$CmdPath" /C taskkill /F /IM rg.exe`
  Pop $0

  # 4. Small pause to allow OS file handles and locks on DLLs/ASAR to release
  Sleep 500
!macroend
