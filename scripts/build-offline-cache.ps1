# Build a portable PlatformIO offline cache for Aether (espressif32 + atmelavr + libs).
# Covers ESP32 Dev / Heltec / TTGO LoRa boards, Arduino Mega, and curated libraries
# (RadioLib, ArduinoJson, OLED helpers, …).
# Does NOT embed toolchains into the main NSIS installer - produces a separate zip.
#
# Usage (from repo root):
#   .\scripts\build-offline-cache.ps1
#   .\scripts\build-offline-cache.ps1 -Version 0.2.33 -SkipInstall
#   .\scripts\build-offline-cache.ps1 -SkipLibs
#   .\scripts\build-offline-cache.ps1 -LibsOnly    # ~50–80 MB lib/ pack for USB dist
#   npm run build:offline-cache
#   npm run build:offline-libs
#
# Requires: PlatformIO Core (`pio` on PATH or ~/.platformio/penv).
# Import in Aether: Settings → Tools → Import offline cache…

param(
  [string]$Version = "",
  [string]$OutDir = "",
  [switch]$SkipInstall,
  [switch]$SkipLibs,
  [switch]$LibsOnly,
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

# Curated libs for ESP32 / Mega / LoRa stacks (global `pio pkg install -g -l`).
$libraries = @(
  "jgromes/RadioLib",
  "bblanchon/ArduinoJson",
  "adafruit/Adafruit GFX Library",
  "adafruit/Adafruit SSD1306",
  "adafruit/Adafruit BusIO",
  "olikraus/U8g2",
  "sandeepmistry/LoRa",
  "mcci-catena/MCCI LoRaWAN LMIC library",
  "knolleary/PubSubClient",
  "fastled/FastLED",
  "adafruit/Adafruit NeoPixel",
  "madhephaestus/ESP32Servo",
  "arduino-libraries/Servo",
  "paulstoffregen/OneWire",
  "milesburton/DallasTemperature"
)

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
if ($LibsOnly) { $SkipLibs = $false }

if (-not $SkipInstall) {
  if (-not $LibsOnly) {
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
    Write-Host "LibsOnly: skipping platform/toolchain install."
  }

  if (-not $SkipLibs) {
    foreach ($lib in $libraries) {
      Write-Host "`n=== Installing library: $lib ==="
      & $pio pkg install -g -l $lib
      if ($LASTEXITCODE -ne 0) {
        Write-Host "WARN: failed to install $lib (continuing)"
      }
    }
  }
} else {
  Write-Host "SkipInstall: packing existing staging contents only."
}

$platformsDir = Join-Path $StagingDir "platforms"
$packagesDir = Join-Path $StagingDir "packages"
$libDir = Join-Path $StagingDir "lib"

if (-not $LibsOnly) {
  foreach ($p in $platforms) {
    $dir = Join-Path $platformsDir $p
    if (-not (Test-Path $dir)) {
      throw "Missing platform after install: $dir"
    }
  }
  if (-not (Test-Path $packagesDir)) {
    throw "Missing packages directory: $packagesDir"
  }
}

$libsInstalled = @()
if (Test-Path $libDir) {
  $libsInstalled = @(Get-ChildItem $libDir -Directory | ForEach-Object { $_.Name })
}
if ($LibsOnly -and $libsInstalled.Count -eq 0) {
  throw "LibsOnly pack has no lib/ folders. Remove -SkipInstall or pre-populate staging."
}

$manifest = [ordered]@{
  format      = "aether-offline-cache"
  version     = 2
  aether      = $Version
  platforms   = $(if ($LibsOnly) { @() } else { $platforms })
  libraries   = $libraries
  lib_folders = $libsInstalled
  created_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  note        = $(if ($LibsOnly) {
      "Libs-only pack: merge lib/ into %USERPROFILE%\.platformio. Platforms/toolchains not included."
    } else {
      "Extract/merge into %USERPROFILE%\.platformio (platforms + packages + lib)."
    })
}
$manifestPath = Join-Path $StagingDir "aether-offline-cache.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding utf8

$zipName = if ($LibsOnly) {
  "Aether_OfflineLibs_${Version}_windows-x64.zip"
} else {
  "Aether_OfflineCache_${Version}_windows-x64.zip"
}
$zipPath = Join-Path $OutDir $zipName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

$packRoot = Join-Path $env:TEMP "aether-pio-pack-$Version"
if (Test-Path $packRoot) { Remove-Item -Recurse -Force $packRoot }
New-Item -ItemType Directory -Force -Path $packRoot | Out-Null
if (-not $LibsOnly) {
  Copy-Item -Recurse (Join-Path $StagingDir "platforms") (Join-Path $packRoot "platforms")
  Copy-Item -Recurse (Join-Path $StagingDir "packages") (Join-Path $packRoot "packages")
}
if (Test-Path $libDir) {
  Copy-Item -Recurse $libDir (Join-Path $packRoot "lib")
}
Copy-Item $manifestPath (Join-Path $packRoot "aether-offline-cache.json")

Write-Host "`nCompressing $zipPath ..."
Compress-Archive -Path (Join-Path $packRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Wrote $zipPath ($sizeMb MB)"
Write-Host "Libs in pack: $($libsInstalled.Count) folder(s)"
Write-Host "Import in Aether: Settings -> Tools -> Import offline cache..."
if ($sizeMb -ge 1900) {
  Write-Host "WARNING: zip is near/over GitHub 2GB asset limit - attach only if under 2GB, otherwise document local build."
}

Remove-Item -Recurse -Force $packRoot -ErrorAction SilentlyContinue
