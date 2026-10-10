# Build a portable PlatformIO offline cache for Aether (espressif32 + atmelavr).
# Does NOT embed toolchains into the main NSIS installer - produces a separate zip.
#
# Usage (from repo root):
#   .\scripts\build-offline-cache.ps1
#   .\scripts\build-offline-cache.ps1 -Version 0.2.15 -SkipInstall
#   npm run build:offline-cache
#
# Requires: PlatformIO Core (`pio` on PATH or ~/.platformio/penv).

param(
  [string]$Version = "",
  [string]$OutDir = "",
  [switch]$SkipInstall,
  [string]$StagingDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $Version) {
  $pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}
if (-not $OutDir) { $OutDir = Join-Path $root "release" }
if (-not $StagingDir) {
  $StagingDir = Join-Path $env:TEMP "aether-pio-offline-cache-$Version"
}

function Find-Pio {
  $cmd = Get-Command pio -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    (Join-Path $env:USERPROFILE ".platformio\penv\Scripts\pio.exe"),
    (Join-Path $env:USERPROFILE ".platformio\penv\Scripts\platformio.exe")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  return $null
}

$pio = Find-Pio
if (-not $pio) {
  throw "PlatformIO CLI not found. Install Core first (Aether Tools Doctor or https://platformio.org)."
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $StagingDir) {
  Write-Host "Cleaning staging: $StagingDir"
  Remove-Item -Recurse -Force $StagingDir
}
New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

$env:PLATFORMIO_CORE_DIR = $StagingDir
Write-Host "PLATFORMIO_CORE_DIR=$StagingDir"
Write-Host "Using pio: $pio"

$platforms = @("espressif32", "atmelavr")
if (-not $SkipInstall) {
  foreach ($platform in $platforms) {
    Write-Host "`n=== Installing platform: $platform ==="
    $ok = $false
    & $pio pkg install -g -p $platform
    if ($LASTEXITCODE -eq 0) { $ok = $true }
    if (-not $ok) {
      & $pio platform install $platform
      if ($LASTEXITCODE -eq 0) { $ok = $true }
    }
    if (-not $ok) {
      throw "Failed to install platform: $platform"
    }
  }
} else {
  Write-Host "SkipInstall: packing existing staging contents only."
}

$platformsDir = Join-Path $StagingDir "platforms"
$packagesDir = Join-Path $StagingDir "packages"
foreach ($p in $platforms) {
  $dir = Join-Path $platformsDir $p
  if (-not (Test-Path $dir)) {
    throw "Missing platform after install: $dir"
  }
}
if (-not (Test-Path $packagesDir)) {
  throw "Missing packages directory: $packagesDir"
}

$manifest = [ordered]@{
  format      = "aether-offline-cache"
  version     = 1
  aether      = $Version
  platforms   = $platforms
  created_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  note        = "Extract/merge into %USERPROFILE%\.platformio (platforms + packages)."
}
$manifestPath = Join-Path $StagingDir "aether-offline-cache.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding utf8

$zipName = "Aether_OfflineCache_${Version}_windows-x64.zip"
$zipPath = Join-Path $OutDir $zipName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

# Pack only platforms/, packages/, and the manifest (flat .platformio layout).
$packRoot = Join-Path $env:TEMP "aether-pio-pack-$Version"
if (Test-Path $packRoot) { Remove-Item -Recurse -Force $packRoot }
New-Item -ItemType Directory -Force -Path $packRoot | Out-Null
Copy-Item -Recurse (Join-Path $StagingDir "platforms") (Join-Path $packRoot "platforms")
Copy-Item -Recurse (Join-Path $StagingDir "packages") (Join-Path $packRoot "packages")
Copy-Item $manifestPath (Join-Path $packRoot "aether-offline-cache.json")

Write-Host "`nCompressing $zipPath ..."
Compress-Archive -Path (Join-Path $packRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Wrote $zipPath ($sizeMb MB)"
Write-Host "Import in Aether: Settings -> Tools -> Import offline cache..."
if ($sizeMb -ge 1900) {
  Write-Host "WARNING: zip is near/over GitHub 2GB asset limit - attach only if under 2GB, otherwise document local build."
}

Remove-Item -Recurse -Force $packRoot -ErrorAction SilentlyContinue
