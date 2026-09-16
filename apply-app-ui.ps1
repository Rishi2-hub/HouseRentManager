$ErrorActionPreference = 'Stop'

$target = 'D:\Projects\HouseRentManager'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $target ".approved-ui-backup-$stamp"

if (-not (Test-Path $target)) {
  throw "Android project not found at $target"
}

New-Item -ItemType Directory -Force -Path "$backup\src\components", "$backup\src\screens" | Out-Null
Copy-Item "$target\App.tsx" "$backup\App.tsx" -Force
Copy-Item "$target\src\theme.ts" "$backup\src\theme.ts" -Force
Copy-Item "$target\src\components\UI.tsx" "$backup\src\components\UI.tsx" -Force
Copy-Item "$target\src\screens\DashboardScreen.tsx" "$backup\src\screens\DashboardScreen.tsx" -Force

Copy-Item "$PSScriptRoot\app-patch\App.tsx" "$target\App.tsx" -Force
Copy-Item "$PSScriptRoot\app-patch\src\theme.ts" "$target\src\theme.ts" -Force
Copy-Item "$PSScriptRoot\app-patch\src\components\UI.tsx" "$target\src\components\UI.tsx" -Force
Copy-Item "$PSScriptRoot\app-patch\src\screens\DashboardScreen.tsx" "$target\src\screens\DashboardScreen.tsx" -Force

Write-Host "Android professional UI applied successfully." -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host "Next: cd $target ; npx tsc --noEmit"
