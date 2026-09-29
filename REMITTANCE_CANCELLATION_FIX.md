# Cancellation remittance correction

This frontend change requires backend commit
`691288298af9e8167cc1e576dfa1639df0bb3034` on branch
`codex/cancelled-booking-remittance` in the separate
`pickleball-booking-platform-backend` repository. That branch has also been saved
in the local `platform-backend` checkout without changing its existing work.

Apply the backend migration
`supabase/migrations/20260929120000_cancelled_booking_remittance_credits.sql`
through the shared backend deployment workflow, then deploy this frontend.
Do not apply it to the legacy frontend database schema.

Cancelled court bookings, including manual bookings, earn no fee. The migration
repairs fees already included in remittances, preserves accepted payments, and
carries excess paid amounts forward as venue credits. The dashboard distinguishes
cash received from credit and shows released fee items as zero for that remittance.

Validation: `npm run check` and all 54 frontend tests passed. The backend migration
and cancellation/remittance SQL tests passed in a disposable PGlite PostgreSQL
database with Auth/Storage fixtures, including an existing-data repair check.
See the backend's `docs/cancelled-booking-remittances.md` for details and a known
unrelated failure in an older cancellation test fixture.

The commits are local. No production database or website has been changed.
