# Build Aether_ArduinoLibs_<ver>_windows-x64.zip — curated Arduino Library Manager pack
# for offline use. Stored/import target: %LOCALAPPDATA%\Aether\arduino-user\libraries
#
# Usage:
#   .\scripts\build-arduino-offline-libs.ps1
#   npm run build:arduino-offline-libs
#
# Requires: arduino-cli on PATH. Online during build; users can later
# Settings → Tools → Update Arduino libs online.

param(
  [string]$Version = "",
  [string]$OutDir = "",
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
  $StagingDir = Join-Path $env:TEMP "aether-arduino-offline-$Version"
}

$libraries = @(
  "Servo", "Stepper", "LiquidCrystal", "SD", "Ethernet", "WiFiNINA",
  "ArduinoHttpClient", "ArduinoMqttClient", "ArduinoBLE", "ArduinoJson",
  "Keyboard", "Mouse", "CapacitiveSensor", "Firmata",
  "OneWire", "DallasTemperature", "DHT sensor library",
  "Adafruit Unified Sensor", "Adafruit BME280 Library", "Adafruit BMP280 Library",
  "Adafruit SSD1306", "Adafruit GFX Library", "Adafruit BusIO", "Adafruit NeoPixel",
  "FastLED", "U8g2", "PubSubClient",
  "RadioLib", "LoRa", "MCCI LoRaWAN LMIC library",
  "ESP32Servo", "WebSockets", "IRremote", "RTClib", "TinyGPSPlus",
  "AccelStepper", "MIDI Library"
)

$cli = Get-Command arduino-cli -ErrorAction SilentlyContinue
if (-not $cli) {
  $candidates = @(
    "${env:ProgramFiles}\Arduino CLI\arduino-cli.exe",
    "${env:LOCALAPPDATA}\Arduino CLI\arduino-cli.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $cli = @{ Source = $c }; break }
  }
}
if (-not $cli) { throw "arduino-cli not found on PATH." }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $StagingDir) { Remove-Item -Recurse -Force $StagingDir }
New-Item -ItemType Directory -Force -Path (Join-Path $StagingDir "libraries") | Out-Null

$env:ARDUINO_DIRECTORIES_USER = $StagingDir
Write-Host "ARDUINO_DIRECTORIES_USER=$StagingDir"
Write-Host "Using: $($cli.Source)"

& $cli.Source lib update-index
foreach ($lib in $libraries) {
  Write-Host "`n=== lib install: $lib ==="
  & $cli.Source lib install $lib
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Failed: $lib (continuing)"
  }
}

$idx = Join-Path $env:LOCALAPPDATA "Arduino15\library_index.json"
if (Test-Path $idx) {
  Copy-Item -Force $idx (Join-Path $StagingDir "library_index.json")
}

$manifest = @{
  name = "aether-arduino-offline-libs"
  version = $Version
  created = (Get-Date).ToUniversalTime().ToString("o")
  libraries = $libraries
} | ConvertTo-Json
Set-Content -Path (Join-Path $StagingDir "aether-arduino-libs.json") -Value $manifest -Encoding utf8

$zipName = "Aether_ArduinoLibs_${Version}_windows-x64.zip"
$zipPath = Join-Path $OutDir $zipName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($StagingDir, $zipPath)

Write-Host "`nWrote $zipPath"
Get-ChildItem (Join-Path $StagingDir "libraries") | Measure-Object | ForEach-Object {
  Write-Host ("Libraries staged: {0}" -f $_.Count)
}
