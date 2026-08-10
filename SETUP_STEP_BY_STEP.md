# House Rent Manager: Complete Setup

## 1. Create Supabase

1. Open https://supabase.com/dashboard and select **New project**.
2. Name it `House Rent Manager`, choose a strong database password and the nearest region.
3. Open **SQL Editor**. Run `supabase/migrations/001_initial.sql`, then run `002_shared_households.sql`.
4. Open **Project Settings > API** and copy the Project URL and publishable/anon key.
5. Copy `.env.example` to `.env` and insert those values. Never use the service-role key in the app.

## 2. Require real email confirmation

1. Open **Authentication > Providers > Email**.
2. Enable Email and **Confirm email**.
3. Open **Authentication > URL Configuration**.
4. Add `houserentmanager://auth-confirmed` and `houserentmanager://reset-password` as Redirect URLs.
5. Review the Confirm signup and Reset password messages under **Email Templates**.

Supabase gives every registered person a unique user ID. The app uses the verified email as the visible login ID.

## 3. Add up to four people

1. The first person registers, confirms their email and logs in.
2. In **Settings**, copy the eight-character household invite code.
3. Each other person installs the APK, registers with a different valid email, confirms it and logs in.
4. They enter the owner's invite code under **Settings > Join household**.
5. The database rejects a fifth member.

Never share one password. Separate accounts allow independent password recovery.

## 4. Forgot password

1. Press **Forgot password?** on Login.
2. Enter the registered email and send the reset email.
3. Open the email on the Android phone and tap its link.
4. The APK opens the new-password screen.

## 5. Local-first synchronization

- Each account has an isolated SQLite database on the phone.
- New changes save locally first.
- Offline changes remain in the sync queue.
- **Sync now** uploads changes and private files, then refreshes shared household data.
- Supabase Row Level Security limits records and files to household members.

## 6. Run on Windows

```powershell
cd "PATH\TO\HouseRentManager"
npm install
npx expo start
```

Expo Go is suitable for basic screen testing. Use an APK build to test email deep links reliably.

## 7. Build the APK with Expo EAS

```powershell
npm install --global eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

Choose Expo-managed Android credentials. When the build finishes, download the APK from its build page and install it on each Android phone.

## 8. Test before real use

- Confirm unverified email cannot log in.
- Test registration, login, logout and forgot password.
- Join two phones to the same household.
- Add a floor on phone 1, sync both phones and verify it appears on phone 2.
- Upload a tenant document and confirm the Storage bucket remains private.
- Generate a PDF bill and verify AD/BS month, totals, paid amount and balance.
- Add a record without Wi-Fi, reconnect and synchronize it.
