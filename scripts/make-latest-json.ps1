# Regenerates release/latest.json and/or release/latest-beta.json from signed NSIS setup .sig.
# Usage (from repo root):
#   .\scripts\make-latest-json.ps1 -Version 0.2.17 -Notes "Stable notes."
#   .\scripts\make-latest-json.ps1 -Version 0.2.17 -BetaVersion 0.2.17-beta.1 -BetaNotes "Beta notes."
#   .\scripts\make-latest-json.ps1 -Version 0.2.17 -StableOnly
#   .\scripts\make-latest-json.ps1 -BetaVersion 0.2.17-beta.1 -BetaOnly
#
# Stable latest.json must point at a non-prerelease installer.
# Beta latest-beta.json should point at a prerelease build when one exists.
# Upload latest-beta.json on the *latest stable* GitHub Release assets so
# /releases/latest/download/latest-beta.json remains reachable.

param(
  [string]$Version = "0.2.19",
  [string]$Notes = "Aether update.",
  [string]$BetaVersion = "",
  [string]$BetaNotes = "",
  [string]$BaseUrl = "https://github.com/Order-Code67/aether/releases/download",
  [string]$ReleaseDir = "",
  [switch]$StableOnly,
  [switch]$BetaOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $ReleaseDir) { $ReleaseDir = Join-Path $root "release" }

function Write-Feed {
  param(
    [string]$OutName,
    [string]$FeedVersion,
    [string]$FeedNotes,
    [string]$Tag
  )
  $setupName = "Aether_${FeedVersion}_x64-setup.exe"
  # Tauri may emit prerelease filenames with the full semver (e.g. 0.2.17-beta.1).
  $sigPath = Join-Path $ReleaseDir "$setupName.sig"
  if (-not (Test-Path $sigPath)) {
    throw "Missing signature: $sigPath (copy from bundle/nsis after tauri:build)"
  }
  $signature = (Get-Content -Raw $sigPath).Trim()
  $pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $url = "$BaseUrl/$Tag/$setupName"
  $feed = [ordered]@{
    version   = $FeedVersion
    notes     = $FeedNotes
    pub_date  = $pubDate
    platforms = [ordered]@{
      "windows-x86_64" = [ordered]@{
        signature = $signature
        url       = $url
      }
    }
  }
  $out = Join-Path $ReleaseDir $OutName
  $feed | ConvertTo-Json -Depth 6 | Set-Content -Path $out -Encoding utf8
  Write-Host "Wrote $out → $url"
}

if (-not $BetaOnly) {
  if ($Version -match "-") {
    throw "Stable -Version must be a non-prerelease SemVer (got '$Version')."
  }
  Write-Feed "latest.json" $Version $Notes "v$Version"
}

if (-not $StableOnly) {
  $betaVer = if ($BetaVersion) { $BetaVersion } else { $Version }
  $betaNotesText = if ($BetaNotes) { $BetaNotes } else { $Notes }
  $betaTag = "v$betaVer"
  Write-Feed "latest-beta.json" $betaVer $betaNotesText $betaTag
}

Write-Host "Upload: stable setup + latest.json on v$Version; beta setup on its prerelease tag; put latest-beta.json on the latest stable release assets."
