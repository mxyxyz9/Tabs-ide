param([Parameter(Mandatory)] [string]$InstallDir)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\') + '\'

try {
  for ($attempt = 1; $attempt -le 10; $attempt++) {
    $running = @(Get-CimInstance Win32_Process | Where-Object {
      $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)
    })
    if ($running.Count -eq 0) { exit 0 }

    foreach ($item in $running) {
      Write-Output "Closing $($item.Name) (PID $($item.ProcessId)) from $root"
      & taskkill.exe /F /T /PID $item.ProcessId
    }
    Start-Sleep -Milliseconds 500
  }

  Write-Error "Processes remain inside $root after ten attempts."
  exit 1
} catch {
  Write-Error $_
  exit 2
}
