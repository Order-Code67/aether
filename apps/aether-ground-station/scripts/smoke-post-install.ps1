# Smoke test after NSIS install (current-user).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/smoke-post-install.ps1

$ErrorActionPreference = "Stop"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\Aether Ground Station"
$exeCandidates = @(
  (Join-Path $installDir "aether-ground-station.exe"),
  (Join-Path $installDir "Aether Ground Station.exe")
)
$exe = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "Aether Ground Station.lnk"

Write-Host "Install dir: $installDir"
if (-not $exe) {
  Write-Error "EXE not found under $installDir"
  exit 1
}
Write-Host "OK: exe exists ($exe)"

if (-not (Test-Path $shortcut)) {
  Write-Warning "Desktop shortcut missing: $shortcut"
} else {
  Write-Host "OK: desktop shortcut"
}

$p = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 4
if ($p.HasExited) {
  Write-Error "Process exited early with code $($p.ExitCode)"
  exit 1
}
Write-Host "OK: process running (pid $($p.Id))"
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Write-Host "Smoke post-install passed."
