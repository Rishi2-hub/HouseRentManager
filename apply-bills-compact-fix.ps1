$ErrorActionPreference = "Stop"
$project = "D:\Projects\HouseRentManager"
$source = Join-Path $PSScriptRoot "BillsScreen.tsx"
$target = Join-Path $project "src\screens\BillsScreen.tsx"

if (-not (Test-Path $target)) {
  throw "BillsScreen.tsx was not found at $target"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $project ".bills-ui-backup-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $target (Join-Path $backupDir "BillsScreen.tsx") -Force
Copy-Item $source $target -Force

Write-Host "Compact Bills UI applied successfully."
Write-Host "Backup: $backupDir"
Write-Host "Next: cd $project ; npx tsc --noEmit"
