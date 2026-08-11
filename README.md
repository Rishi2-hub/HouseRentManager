# House Rent Manager

Shared-household Android rent management app built with React Native and Expo. Up to four verified users have separate accounts while sharing the same protected household records.

## Included

- Floors and rooms with photos
- Tenant details, PP-size photo, and identity documents
- Citizenship, NID, Passport, Driving Licence, Aadhaar, and other ID types
- Nepali monthly bills with the previous BS month selected automatically
- Electricity calculated from previous unit, current unit, and per-unit cost
- Tenant advance deposit with remaining-deposit protection during billing
- Water, waste, additional charges, previous due, advance use, and payments
- Paid, partial, and due status
- Nepali month names on-screen and in PDF bills
- PDF bill creation and sharing
- Local SQLite storage and a cloud synchronization queue
- Supabase owner authentication, PostgreSQL schema, private Storage bucket, and row-level security
- Automatic private upload of queued tenant documents and photos during synchronization
- Verified-email registration, separate user IDs, show/hide password, login, and email password recovery
- Household invite code with a maximum of four members

## Setup

1. Install Node.js LTS, Android Studio, and the Expo tooling.
2. Run `npm install`.
3. Create a Supabase project and run all SQL files in `supabase/migrations`, in number order.
4. Copy `.env.example` to `.env` and enter the project URL and anon key.
5. Enable email confirmation and add the two redirect URLs described in `SETUP_STEP_BY_STEP.md`.
6. Run `npx expo start` for development.

## Build an APK

1. Run `npx eas login`.
2. Run `npx eas build:configure` and put the generated project ID in `app.json`.
3. Run `npm run build:apk`.

The `preview` EAS profile produces an installable Android APK. Production uses an Android App Bundle for Play Store submission.

## Important security note

Tenant identity files contain sensitive personal data. Keep the Supabase bucket private, retain the included row-level policies, never commit `.env`, and do not share exported bills or documents without the tenant's permission.

The developer-only offline preview button is automatically excluded from release behavior. Release users must authenticate using a confirmed email. See `SETUP_STEP_BY_STEP.md` for Supabase, multi-user, password-reset, local-first, and APK instructions.
