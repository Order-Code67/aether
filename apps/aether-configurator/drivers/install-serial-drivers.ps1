#Requires -RunAsAdministrator
# Aether Configurator — USB-serial drivers (CH340, FTDI, CP210x)
$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot
$Cache = Join-Path $Root "cache"
$Log = Join-Path $Cache "install-log.txt"
function Log($m) { "$(Get-Date -Format o) $m" | Tee-Object -FilePath $Log -Append }
"" | Set-Content $Log
Log "=== Aether serial driver install ==="
$infs = @(
  (Join-Path $Cache "ch340-extracted\CH341SER\CH341SER.INF"),
  (Join-Path $Cache "adafruit-extracted\Adafruit_Windows_Drivers-main\Drivers\FTDI_VCP_BUS\ftdibus.inf"),
  (Join-Path $Cache "adafruit-extracted\Adafruit_Windows_Drivers-main\Drivers\FTDI_VCP_PORT\ftdiport.inf"),
  (Join-Path $Cache "cp210x-universal\silabser.inf")
)
$found = 0
foreach ($inf in $infs) {
  if (Test-Path $inf) {
    $found++
    Log "pnputil /add-driver $inf /install"
    & pnputil /add-driver $inf /install 2>&1 | Tee-Object -FilePath $Log -Append
  } else { Log "MISSING $inf" }
}
if ($found -eq 0) {
  Log "No INF packages under cache/. See drivers/README.md — cache is not shipped in git."
  Write-Host "No driver packages in drivers/cache/. Populate cache locally or install vendor drivers. See drivers/README.md"
  exit 1
}
& pnputil /scan-devices 2>&1 | Tee-Object -FilePath $Log -Append
Log "=== done ==="
Write-Host "Done. Plug FC / USB-UART and refresh ports in Aether Configurator."
