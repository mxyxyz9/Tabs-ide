# Close only processes launched from this installation before replacing its files.
# The stock electron-builder check can leave a windowless Tabs.exe running.
!macro customCheckAppRunning
  System::Call 'Kernel32::SetEnvironmentVariable(t "TABS_INSTALL_DIR", t "$INSTDIR")i.r0'
  StrCmp $0 0 checkFailed

  checkAgain:
    DetailPrint "Closing processes from $INSTDIR..."
    nsExec::Exec `"$PowerShellPath" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $$raw = [Environment]::GetEnvironmentVariable('TABS_INSTALL_DIR'); if (-not $$raw) { exit 0 }; $$root = [IO.Path]::GetFullPath($$raw).TrimEnd('\') + '\'; $$running = @(try { Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $$_.ExecutablePath -and ($$_.ExecutablePath -like ($$root + '*')) } } catch { Get-Process -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and ($$_.Path -like ($$root + '*')) } }); foreach ($$item in $$running) { $$p = $$item.ProcessId; if (-not $$p) { $$p = $$item.Id }; if ($$p) { & taskkill.exe /F /T /PID $$p 2>$$null; Stop-Process -Id $$p -Force -ErrorAction SilentlyContinue } }; Start-Sleep -Milliseconds 750; $$remaining = @(try { Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $$_.ExecutablePath -and ($$_.ExecutablePath -like ($$root + '*')) } } catch { Get-Process -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and ($$_.Path -like ($$root + '*')) } }); if ($$remaining.Count -gt 0) { exit 1 } } catch { exit 2 }"`
    Pop $0
    StrCmp $0 0 checkDone

  checkFailed:
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY checkAgain
    Quit

  checkDone:
!macroend
