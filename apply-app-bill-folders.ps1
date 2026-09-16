$ErrorActionPreference = 'Stop'
$root = 'D:\Projects\HouseRentManager'
$source = Join-Path $PSScriptRoot 'app\BillsScreen.tsx'
$target = Join-Path $root 'src\screens\BillsScreen.tsx'

if (!(Test-Path $root)) { throw "App project not found: $root" }
if (!(Test-Path $source)) { throw "Patch file not found: $source" }
if (!(Test-Path $target)) { throw "BillsScreen not found: $target" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ".bill-folders-backup-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $target (Join-Path $backup 'BillsScreen.tsx') -Force
Copy-Item $source $target -Force

Write-Host ''
Write-Host 'Android bill month/folder UI applied successfully.' -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'Next: cd D:\Projects\HouseRentManager ; npx tsc --noEmit'
