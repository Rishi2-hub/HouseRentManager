# House Rent Manager Android — Bill Month & Paid/Unpaid Folders v1.3

This Android update changes only the Bills history UI. It groups generated bills by Nepali month and adds Paid / Unpaid folders for each month. Existing database, Supabase, SQLite sync, PDF/PNG, tenant data, and household data remain unchanged.

## Apply

```powershell
cd <extracted-folder>
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Unblock-File .\apply-app-bill-folders.ps1
.\apply-app-bill-folders.ps1

cd D:\Projects\HouseRentManager
npx tsc --noEmit
```

If typecheck passes:

```powershell
cd D:\Projects\HouseRentManager\android
.\gradlew.bat assembleRelease
adb install -r ".\app\build\outputs\apk\release\app-release.apk"
```

Do not uninstall the existing app. Do not run `expo prebuild` for this UI-only update.
