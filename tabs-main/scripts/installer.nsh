# Close only processes launched from this installation before replacing its files.
# The stock electron-builder check can leave a windowless Tabs.exe running.
!macro customCheckAppRunning
  System::Call 'Kernel32::SetEnvironmentVariable(t "TABS_INSTALL_DIR", t "$INSTDIR")i.r0'
  StrCmp $0 0 checkFailed

  checkAgain:
    DetailPrint "Closing processes from $INSTDIR..."
    nsExec::Exec `"$PowerShellPath" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $$root = [IO.Path]::GetFullPath([Environment]::GetEnvironmentVariable('TABS_INSTALL_DIR')).TrimEnd('\') + '\'; $$running = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$root, [StringComparison]::OrdinalIgnoreCase) }); foreach ($$item in $$running) { Stop-Process -Id $$item.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 750; $$remaining = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$root, [StringComparison]::OrdinalIgnoreCase) }); if ($$remaining.Count -gt 0) { exit 1 } } catch { exit 2 }"`
    Pop $0
    StrCmp $0 0 checkDone

  checkFailed:
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY checkAgain
    Quit

  checkDone:
!macroend
