$ErrorActionPreference = "Stop"
function Invoke-SilentInstaller {
  param(
    [Parameter(Mandatory)] [string]$Path,
    [Parameter(Mandatory)] [string]$InstallDir,
    [Parameter(Mandatory)] [string]$Label,
    [int]$TimeoutSeconds = 1200
  )

  if (-not (Test-Path $Path -PathType Leaf)) {
    throw "$Label installer was not found: $Path"
  }

  Write-Host "$Label`: $Path"
  Write-Host "Install directory: $InstallDir"

  # NSIS requires /D= to be the final installer argument.
  $arguments = @(
    '/S',
    "/D=$InstallDir"
  )

  $process = Start-Process `
    -FilePath $Path `
    -ArgumentList $arguments `
    -PassThru `
    -WorkingDirectory (Split-Path -Parent $Path)

  try {
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      $process.Refresh()
      $childProcesses = Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $process.Id } |
        Select-Object ProcessId, Name, CommandLine

      Write-Host "$Label did not exit within $TimeoutSeconds seconds."
      Write-Host "Installer PID: $($process.Id)"
      $childProcesses | Format-List | Out-String | Write-Host

      # Kill descendants first, then the installer.
      Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $process.Id } |
        ForEach-Object {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }

      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      throw "$Label timed out."
    }

    $process.Refresh()
    if ($process.ExitCode -ne 0) {
      throw "$Label failed with exit code $($process.ExitCode)."
    }
  }
  finally {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

$installer = (Get-ChildItem tabs-main/release -Filter *.exe | Select-Object -First 1).FullName
$initialInstaller = $installer
if ($env:TABS_SMOKE_PREVIOUS_VERSION) {
  $version = $env:TABS_SMOKE_PREVIOUS_VERSION
  $assetName = "Tabs-$version-x64.exe"
  $initialInstaller = Join-Path $env:RUNNER_TEMP $assetName
  Write-Host "Downloading and verifying previous installer v$version..."
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
  Write-Host "Previous installer digest verified."
}
$installDir = Join-Path $env:RUNNER_TEMP "TabsSmokeInstall"
$unrelatedDir = Join-Path $env:RUNNER_TEMP "TabsUnrelatedProcess"
New-Item $unrelatedDir -ItemType Directory -Force | Out-Null
$holder = $null
$unrelated = $null
try {
  Write-Host "Installing previous version into $installDir..."
  Invoke-SilentInstaller -Path $initialInstaller -InstallDir $installDir -Label "Initial NSIS install" -TimeoutSeconds 1200
  if (-not (Test-Path (Join-Path $installDir "Tabs.exe"))) { throw "Tabs.exe was not installed." }
  Write-Host "Initial install completed."

  $holderExe = Join-Path $installDir "TabsSmokeHold.exe"
  $unrelatedExe = Join-Path $unrelatedDir "rg.exe"
  Copy-Item "$env:WINDIR\System32\cmd.exe" $holderExe
  Copy-Item "$env:WINDIR\System32\cmd.exe" $unrelatedExe
  $holder = Start-Process $holderExe -ArgumentList '/c ping -t 127.0.0.1' -WindowStyle Hidden -PassThru
  $unrelated = Start-Process $unrelatedExe -ArgumentList '/c ping -t 127.0.0.1' -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  if ($holder.HasExited -or $unrelated.HasExited) { throw "Smoke-test process exited before upgrade." }

  Write-Host "Upgrading with an in-installation lock holder and unrelated rg.exe running..."
  Invoke-SilentInstaller -Path $installer -InstallDir $installDir -Label "NSIS upgrade" -TimeoutSeconds 1200
  $holder.Refresh()
  $unrelated.Refresh()
  if (-not $holder.HasExited) { throw "Installer did not close a process running from its installation." }
  if ($unrelated.HasExited) { throw "Installer killed an unrelated rg.exe process." }
  if (-not (Test-Path (Join-Path $installDir "Tabs.exe"))) { throw "Tabs.exe is missing after upgrade." }
  Write-Host "Windows legacy upgrade and process-scope checks passed."
} finally {
  foreach ($process in @($holder, $unrelated)) {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  }
}
