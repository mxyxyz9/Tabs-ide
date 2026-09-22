$ErrorActionPreference = "Stop"
$installer = (Get-ChildItem tabs-main/release -Filter *.exe | Select-Object -First 1).FullName
$initialInstaller = $installer
if ($env:TABS_SMOKE_PREVIOUS_VERSION) {
  $version = $env:TABS_SMOKE_PREVIOUS_VERSION
  $assetName = "Tabs-$version-x64.exe"
  $initialInstaller = Join-Path $env:RUNNER_TEMP $assetName
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    & gh release download "v$version" --repo $env:GITHUB_REPOSITORY --pattern $assetName --dir $env:RUNNER_TEMP --clobber
    if ($LASTEXITCODE -eq 0) { break }
    if ($attempt -eq 3) { throw "Could not download previous installer v$version." }
    Start-Sleep -Seconds (5 * $attempt)
  }
  $expectedDigest = & gh api "repos/$env:GITHUB_REPOSITORY/releases/tags/v$version" --jq ".assets[] | select(.name == `"$assetName`") | .digest"
  if ($LASTEXITCODE -ne 0 -or -not $expectedDigest) { throw "Could not verify previous installer digest." }
  $actualDigest = "sha256:$((Get-FileHash $initialInstaller -Algorithm SHA256).Hash.ToLowerInvariant())"
  if ($actualDigest -ne $expectedDigest) { throw "Previous installer checksum mismatch." }
}
$installDir = Join-Path $env:RUNNER_TEMP "TabsSmokeInstall"
$unrelatedDir = Join-Path $env:RUNNER_TEMP "TabsUnrelatedProcess"
New-Item $unrelatedDir -ItemType Directory -Force | Out-Null
$holder = $null
$unrelated = $null
try {
  & $initialInstaller /S "/D=$installDir"
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
