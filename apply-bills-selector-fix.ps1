$ErrorActionPreference = "Stop"
$project = "D:\Projects\HouseRentManager"
$target = Join-Path $project "src\screens\BillsScreen.tsx"
$source = Join-Path $PSScriptRoot "BillsScreen.tsx"
if (!(Test-Path $target)) { throw "Target not found: $target" }
if (!(Test-Path $source)) { throw "Patch file not found: $source" }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $project ".bills-selector-backup-$stamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item $target (Join-Path $backupDir "BillsScreen.tsx") -Force
Copy-Item $source $target -Force
Write-Host "Bills compact selector applied successfully."
Write-Host "Backup: $backupDir"
Write-Host "Next: cd D:\Projects\HouseRentManager ; npx tsc --noEmit"
