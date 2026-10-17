# Assemble a clean-Windows USB / folder drop: installer + offlineLibs + README.
# Does not build the NSIS or offline zip - copies what already exists under release/.
# Optionally copies a portable Aether Configurator if a small enough build is present
# (full Electron bundles are often too large for USB packs — see README-FIRST).
#
# Usage (from repo root):
#   .\scripts\package-dist.ps1
#   .\scripts\package-dist.ps1 -Version 0.2.34
#   npm run package:dist

param(
  [string]$Version = "",
  [string]$ReleaseDir = "",
  [string]$OutDir = "",
  # Skip copying Configurator even if found (default: try when under size cap).
  [switch]$SkipConfigurator,
  # Max portable Configurator size to include (MB). Larger → README note only.
  [int]$ConfiguratorMaxMb = 120
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

# --- Optional portable Aether Configurator (detection + README if too large) ---
$configuratorNote = "not bundled (Electron pack is large — install separately or set AETHER_CONFIGURATOR)."
$configuratorCopied = $false
if (-not $SkipConfigurator) {
  $cfgRelease = Join-Path $root "apps\aether-configurator\release"
  $cfgCandidates = @()
  if (Test-Path $cfgRelease) {
    $cfgCandidates += Get-ChildItem -Path $cfgRelease -Filter "*.exe" -File -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Name -match '(?i)aether[\s\-]?configurator' -and $_.Name -notmatch '(?i)setup|installer|uninstall'
      }
  }
  # Known custom install / portable folder on this machine
  $cfgDir = "D:\CFG\Aether"
  if (Test-Path $cfgDir) {
    $cfgCandidates += Get-ChildItem -Path $cfgDir -Filter "*.exe" -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '(?i)aether[\s\-]?configurator' }
  }

  $preferred = $cfgCandidates |
    Sort-Object Length |
    Select-Object -First 1

  if ($preferred) {
    $mb = [math]::Round($preferred.Length / 1MB, 1)
    if ($mb -le $ConfiguratorMaxMb) {
      $destName = "Aether Configurator.exe"
      Copy-Item -Force $preferred.FullName (Join-Path $OutDir $destName)
      $configuratorCopied = $true
      $configuratorNote = "included as `"$destName`" ($mb MB) — place next to Aether.exe or keep in this folder; IDE also detects D:\CFG\Aether and AETHER_CONFIGURATOR."
      Write-Host "Copied Configurator: $($preferred.Name) ($mb MB)"
    }
    else {
      $configuratorNote = "found $($preferred.Name) ($mb MB) but skipped (over ${ConfiguratorMaxMb} MB). Aether detects D:\CFG\Aether, %LOCALAPPDATA%\Programs\Aether Configurator, or AETHER_CONFIGURATOR. Build: npm run configurator:package."
      Write-Host "WARN: Configurator $mb MB > ${ConfiguratorMaxMb} MB — not copied; documented in README-FIRST."
    }
  }
  else {
    Write-Host "INFO: no portable Aether Configurator.exe found — README explains detect paths."
  }
}

$readmeLines = @(
  "Aether - clean Windows pack (v$Version)",
  "=====================================",
  "",
  "Arduino-first IDE for boards, LoRa radio, and BPLA — not another VS Code.",
  "The NSIS setup is lean (no multi-GB toolchains). OfflineLibs is a separate zip.",
  "",
  "~15 minutes to first flash",
  "",
  "1. Run Aether_*_x64-setup.exe (any drive / All users OK).",
  "2. Open Aether. Tools Doctor -> Install missing (PlatformIO).",
  "3. Keep OfflineLibs zip next to the app, on Desktop, or in Downloads.",
  "   In Aether: Doctor or Settings -> Tools -> Import offline pack.",
  "4. Welcome -> Getting started: Blink -> LoRa -> Configurator (or Examples).",
  "   Pick COM -> Build + Upload.",
  "",
  "Arduino CLI (optional, Arduino-first .ino path)",
  "----------------------------------------------",
  "- Settings -> Tools: install arduino-cli, then «Install AVR + ESP32 cores».",
  "- Build toolbar: switch Build tool to Arduino CLI (remembered per project).",
  "- First Build/Upload auto-installs the core for the mapped FQBN when missing.",
  "",
  "Aether Configurator (FC / BPLA)",
  "------------------------------",
  "- Status: $configuratorNote",
  "- Activity BPLA -> Open Aether Configurator (COM handoff).",
  "- Detect paths: next to Aether.exe, D:\CFG\Aether, %LOCALAPPDATA%\Programs\,",
  "  or env AETHER_CONFIGURATOR=full\path\to\Aether Configurator.exe.",
  "- Full Electron bundle is often too large for USB packs; package separately:",
  "  npm run configurator:package -> apps/aether-configurator/release/",
  "",
  "Hints: Status Bar «Hints» + Welcome checklists (Blink / LoRa / UAV).",
  "Signing / lean NSIS: docs/SIGNING_AND_RELEASES.md in the repo.",
  "",
  "Target: open -> build -> flash in under ~15 minutes on a clean PC.",
  "Details: CLEAN_WINDOWS.md (copied here) and docs/OFFLINE_INSTALLER.md in the repo."
)
Set-Content -Path (Join-Path $OutDir "README-FIRST.txt") -Value $readmeLines -Encoding utf8

$cleanDoc = Join-Path $root "docs\CLEAN_WINDOWS.md"
if (Test-Path $cleanDoc) {
  Copy-Item -Force $cleanDoc (Join-Path $OutDir "CLEAN_WINDOWS.md")
}

if ($configuratorCopied) {
  Write-Host "Configurator bundled in dist."
}

Write-Host "Dist folder: $OutDir"
Get-ChildItem $OutDir | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 1)
  Write-Host ("  {0}  ({1} MB)" -f $_.Name, $mb)
}
