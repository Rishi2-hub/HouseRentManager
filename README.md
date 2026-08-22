# Final two-user household update

This package is matched to the supplied Supabase migrations:
001_initial.sql
002_shared_households.sql
003_nepali_billing_and_deposit.sql

Apply the new migration:
004_two_user_households_and_owner_details.sql

Main behavior:
- Unlimited independent app accounts may register.
- Each household is limited to 2 accounts: owner + one member.
- Household sharing code is numeric and 6 digits.
- Settings shows signed-in account, owner details, household members, and 2/2 status.
- Each account can change its own password from Settings.
- A new/empty account can join an owner's household.
- An account that already has rental data is prevented from silently switching households.

Recommended sequence:
1. Back up Supabase.
2. Run 004_two_user_households_and_owner_details.sql in Supabase SQL Editor.
3. Replace src/screens/SettingsScreen.tsx with the included file.
4. Keep the supplied AuthScreen.tsx, database.ts, sync.ts and supabase.ts.
5. Test with two verified accounts before building the release APK.
