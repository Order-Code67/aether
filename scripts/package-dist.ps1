# Assemble a clean-Windows USB / folder drop: installer + OfflineLibs + README.
# Does not build the NSIS or offline zip - copies what already exists under release/.
#
# Usage (from repo root):
#   .\scripts\package-dist.ps1
#   .\scripts\package-dist.ps1 -Version 0.2.34
#   npm run package:dist

param(
  [string]$Version = "",
  [string]$ReleaseDir = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $Version) {
  $pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}
if (-not $ReleaseDir) { $ReleaseDir = Join-Path $root "release" }
if (-not $OutDir) { $OutDir = Join-Path $ReleaseDir "Aether_Dist_$Version" }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$setupCandidates = @(
  (Join-Path $ReleaseDir "Aether_${Version}_x64-setup.exe"),
  (Join-Path $root "src-tauri\target\release\bundle\nsis\Aether_${Version}_x64-setup.exe")
)
$setup = $setupCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $setup) {
  throw "Installer not found. Build first (npm run tauri:build)."
}

$libsZip = Join-Path $ReleaseDir "Aether_OfflineLibs_${Version}_windows-x64.zip"
$cacheZip = Join-Path $ReleaseDir "Aether_OfflineCache_${Version}_windows-x64.zip"
$offline = $null
if (Test-Path $libsZip) { $offline = $libsZip }
elseif (Test-Path $cacheZip) { $offline = $cacheZip }

Copy-Item -Force $setup (Join-Path $OutDir (Split-Path $setup -Leaf))
if ($offline) {
  Copy-Item -Force $offline (Join-Path $OutDir (Split-Path $offline -Leaf))
}
else {
  Write-Host "WARN: no OfflineLibs/OfflineCache zip in $ReleaseDir - dist folder will have installer only."
  Write-Host "      Run: npm run build:offline-libs"
}

$readmeLines = @(
  "Aether - clean Windows pack (v$Version)",
  "=====================================",
  "",
  "1. Run Aether_*_x64-setup.exe (any drive / All users OK).",
  "2. Open Aether. Tools Doctor -> Install missing (PlatformIO).",
  "3. Keep this offline zip next to the app, on Desktop, or in Downloads.",
  "   In Aether: Doctor or Settings -> Tools -> Import offline pack.",
  "4. Welcome -> Examples -> esp32-blink (or Mega). Pick COM -> Build + Upload.",
  "",
  "Target: open -> build -> flash in under ~15 minutes on a clean PC.",
  "Details: docs/CLEAN_WINDOWS.md and docs/OFFLINE_INSTALLER.md in the repo."
)
Set-Content -Path (Join-Path $OutDir "README-FIRST.txt") -Value $readmeLines -Encoding utf8

$cleanDoc = Join-Path $root "docs\CLEAN_WINDOWS.md"
if (Test-Path $cleanDoc) {
  Copy-Item -Force $cleanDoc (Join-Path $OutDir "CLEAN_WINDOWS.md")
}

Write-Host "Dist folder: $OutDir"
Get-ChildItem $OutDir | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 1)
  Write-Host ("  {0}  ({1} MB)" -f $_.Name, $mb)
}
