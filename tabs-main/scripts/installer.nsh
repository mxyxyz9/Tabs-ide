# Close only processes launched from this installation before replacing its files.
# The stock electron-builder check can leave a windowless Tabs.exe running.
!macro customCheckAppRunning
  System::Call 'Kernel32::SetEnvironmentVariable(t "TABS_INSTALL_DIR", t "$INSTDIR")i.r0'
  StrCmp $0 0 checkFailed

  StrCmp $PowerShellPath "" 0 +2
  StrCpy $PowerShellPath "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"

  checkAgain:
    DetailPrint "Closing processes from $INSTDIR..."
    nsExec::Exec `"$PowerShellPath" -NoProfile -NonInteractive -InputFormat None -ExecutionPolicy Bypass -Command "try { $$raw = [Environment]::GetEnvironmentVariable('TABS_INSTALL_DIR'); if (-not $$raw) { exit 0 }; $$root = [IO.Path]::GetFullPath($$raw).TrimEnd('\') + '\'; function Get-Procs { @(try { Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $$_.ExecutablePath -and ($$_.ExecutablePath -like ($$root + '*')) } } catch { Get-Process -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and ($$_.Path -like ($$root + '*')) } }) }; for ($$i = 0; $$i -lt 10; $$i++) { $$running = Get-Procs; if (-not $$running -or $$running.Count -eq 0) { exit 0 }; foreach ($$item in $$running) { $$p = $$item.ProcessId; if (-not $$p) { $$p = $$item.Id }; if ($$p) { & taskkill.exe /F /T /PID $$p 2>$$null; Stop-Process -Id $$p -Force -ErrorAction SilentlyContinue } }; Start-Sleep -Milliseconds 500 }; $$remaining = Get-Procs; if ($$remaining.Count -gt 0) { exit 1 }; exit 0 } catch { exit 2 }"`
    Pop $0
    StrCmp $0 0 checkDone

  checkFailed:
    IfSilent cancelInstall 0
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY checkAgain IDCANCEL cancelInstall
  cancelInstall:
    Quit

  checkDone:
!macroend
