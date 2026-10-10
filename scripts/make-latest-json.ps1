# Regenerates release/latest.json from the NSIS setup .sig after tauri:build.
# Usage (from repo root):
#   .\scripts\make-latest-json.ps1
#   .\scripts\make-latest-json.ps1 -Version 0.1.1 -Notes "Bug fixes."

param(
  [string]$Version = "0.1.0",
  [string]$Notes = "Aether update.",
  [string]$BaseUrl = "https://github.com/aether-ide/aether/releases/download",
  [string]$ReleaseDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $ReleaseDir) { $ReleaseDir = Join-Path $root "release" }

$setupName = "Aether_${Version}_x64-setup.exe"
$sigPath = Join-Path $ReleaseDir "$setupName.sig"
if (-not (Test-Path $sigPath)) {
  throw "Missing signature: $sigPath (copy from bundle/nsis after tauri:build)"
}

$signature = (Get-Content -Raw $sigPath).Trim()
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$url = "$BaseUrl/v$Version/$setupName"

$feed = [ordered]@{
  version  = $Version
  notes    = $Notes
  pub_date = $pubDate
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url       = $url
    }
  }
}

$out = Join-Path $ReleaseDir "latest.json"
$feed | ConvertTo-Json -Depth 6 | Set-Content -Path $out -Encoding utf8
Write-Host "Wrote $out"
Write-Host "Upload with the installer: $setupName + latest.json"
