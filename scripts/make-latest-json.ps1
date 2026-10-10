# Regenerates release/latest.json and release/latest-beta.json from the NSIS setup .sig after tauri:build.
# Usage (from repo root):
#   .\scripts\make-latest-json.ps1
#   .\scripts\make-latest-json.ps1 -Version 0.2.15 -Notes "Bug fixes."
#   .\scripts\make-latest-json.ps1 -Version 0.2.15 -BetaNotes "Same as stable until a true prerelease."

param(
  [string]$Version = "0.2.16",
  [string]$Notes = "Aether update.",
  [string]$BetaNotes = "",
  [string]$BaseUrl = "https://github.com/Order-Code67/aether/releases/download",
  [string]$ReleaseDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $ReleaseDir) { $ReleaseDir = Join-Path $root "release" }
if (-not $BetaNotes) { $BetaNotes = $Notes }

$setupName = "Aether_${Version}_x64-setup.exe"
$sigPath = Join-Path $ReleaseDir "$setupName.sig"
if (-not (Test-Path $sigPath)) {
  throw "Missing signature: $sigPath (copy from bundle/nsis after tauri:build)"
}

$signature = (Get-Content -Raw $sigPath).Trim()
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$url = "$BaseUrl/v$Version/$setupName"

function Write-Feed([string]$OutName, [string]$FeedNotes) {
  $feed = [ordered]@{
    version  = $Version
    notes    = $FeedNotes
    pub_date = $pubDate
    platforms = [ordered]@{
      "windows-x86_64" = [ordered]@{
        signature = $signature
        url       = $url
      }
    }
  }
  $out = Join-Path $ReleaseDir $OutName
  $feed | ConvertTo-Json -Depth 6 | Set-Content -Path $out -Encoding utf8
  Write-Host "Wrote $out"
}

Write-Feed "latest.json" $Notes
Write-Feed "latest-beta.json" $BetaNotes
Write-Host "Upload with the installer: $setupName + latest.json + latest-beta.json"
