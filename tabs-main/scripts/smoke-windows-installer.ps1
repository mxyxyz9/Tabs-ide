$ErrorActionPreference = "Stop"
$installer = (Get-ChildItem tabs-main/release -Filter *.exe | Select-Object -First 1).FullName
$installDir = Join-Path $env:RUNNER_TEMP "TabsSmokeInstall"
$unrelatedDir = Join-Path $env:RUNNER_TEMP "TabsUnrelatedProcess"
New-Item $unrelatedDir -ItemType Directory -Force | Out-Null
$holder = $null
$unrelated = $null
try {
  & $installer /S "/D=$installDir"
  if ($LASTEXITCODE -ne 0) { throw "Initial NSIS install failed: $LASTEXITCODE" }
  if (-not (Test-Path (Join-Path $installDir "Tabs.exe"))) { throw "Tabs.exe was not installed." }

  $holderExe = Join-Path $installDir "TabsSmokeHold.exe"
  $unrelatedExe = Join-Path $unrelatedDir "rg.exe"
  Copy-Item "$env:WINDIR\System32\cmd.exe" $holderExe
  Copy-Item "$env:WINDIR\System32\cmd.exe" $unrelatedExe
  $holder = Start-Process $holderExe -ArgumentList '/c ping -t 127.0.0.1' -WindowStyle Hidden -PassThru
  $unrelated = Start-Process $unrelatedExe -ArgumentList '/c ping -t 127.0.0.1' -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  if ($holder.HasExited -or $unrelated.HasExited) { throw "Smoke-test process exited before upgrade." }

  & $installer /S "/D=$installDir"
  if ($LASTEXITCODE -ne 0) { throw "NSIS upgrade failed: $LASTEXITCODE" }
  $holder.Refresh()
  $unrelated.Refresh()
  if (-not $holder.HasExited) { throw "Installer did not close a process running from its installation." }
  if ($unrelated.HasExited) { throw "Installer killed an unrelated rg.exe process." }
  if (-not (Test-Path (Join-Path $installDir "Tabs.exe"))) { throw "Tabs.exe is missing after upgrade." }
} finally {
  foreach ($process in @($holder, $unrelated)) {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  }
}
