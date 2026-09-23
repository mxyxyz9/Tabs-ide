param([Parameter(Mandatory)] [string]$InstallDir)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\') + '\'
$logPath = $env:TABS_INSTALLER_PROCESS_LOG

function Write-ProcessLog([string]$Message) {
  Write-Output $Message
  if ($logPath) {
    Add-Content -LiteralPath $logPath -Value $Message
  }
}

try {
  Write-ProcessLog "Checking processes under $root"
  for ($attempt = 1; $attempt -le 10; $attempt++) {
    $running = @(Get-CimInstance Win32_Process | Where-Object {
      $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)
    })
    if ($running.Count -eq 0) {
      Write-ProcessLog "No processes remain under $root"
      exit 0
    }

    foreach ($item in $running) {
      Write-ProcessLog "Closing $($item.Name) (PID $($item.ProcessId)) from $root"
      & taskkill.exe /F /T /PID $item.ProcessId
    }
    Start-Sleep -Milliseconds 500
  }

  Write-Error "Processes remain inside $root after ten attempts."
  exit 1
} catch {
  Write-ProcessLog "Process check failed: $_"
  exit 2
}
