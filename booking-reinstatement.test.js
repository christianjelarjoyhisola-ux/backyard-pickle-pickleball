const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const admin = fs.readFileSync('admin.html', 'utf8');
const client = fs.readFileSync('supabase-config.js', 'utf8');
const migration = fs.readFileSync(
  'platform-backend/supabase/migrations/20260727133000_booking_reinstatement_and_manual_review.sql',
  'utf8',
);

function sqlFunction(name, nextMarker) {
  const start = migration.indexOf(`function public.${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = nextMarker ? migration.indexOf(nextMarker, start) : migration.length;
  assert.ok(end > start, `${name} should have a complete body`);
  return migration.slice(start, end);
}

test('only owners can reinstate a cancelled future booking', () => {
  const body = sqlFunction('reinstate_tenant_booking', 'revoke all on function public.reinstate_tenant_booking');
  assert.match(body, /array\['owner', 'admin'\]/);
  assert.doesNotMatch(body, /array\['owner', 'admin', 'staff'\]/);
  assert.match(body, /v_booking\.status <> 'cancelled'/);
  assert.match(body, /v_booking\.ends_at <= now\(\)/);
  assert.match(body, /payment_status in \('refunded', 'rejected'\)/);
});

test('reinstatement is conflict safe and restores the original record atomically', () => {
  const body = sqlFunction('reinstate_tenant_booking', 'revoke all on function public.reinstate_tenant_booking');
  assert.match(body, /active_slot\.starts_at < original_slot\.ends_at/);
  assert.match(body, /active_slot\.ends_at > original_slot\.starts_at/);
  assert.match(body, /The original court time is no longer available/);
  assert.match(body, /update public\.booking_slots[\s\S]*set status = 'confirmed'/);
  assert.match(body, /update public\.bookings[\s\S]*set status = 'confirmed'/);
  assert.match(body, /'reinstatedBy', auth\.uid\(\)/);
  assert.match(body, /'reinstatedAt', now\(\)/);
});

test('receipt automation leaves customer bookings pending for owner review', () => {
  const autoReview = sqlFunction(
    'auto_approve_receipt_verification',
    'revoke execute on function public.auto_approve_receipt_verification',
  );
  assert.match(autoReview, /'decision', 'manual_review'/);
  assert.match(autoReview, /'reason', 'owner_review_required'/);
  assert.doesNotMatch(autoReview, /set status = 'confirmed'/);
  assert.match(migration, /new\.expires_at := 'infinity'::timestamptz/);
  assert.match(migration, /set hold_expires_at = 'infinity'::timestamptz/);
});

test('dashboard exposes reinstate and immediate cancellation undo to both owner roles', () => {
  assert.match(admin, /function bookingCanReinstate\(b\)/);
  assert.match(admin, /\['owner','court_owner'\]/);
  assert.match(admin, />Reinstate<\/button>/);
  assert.match(admin, /Booking \$\{ref\} cancelled\.\`, 'Undo'/);
  assert.match(admin, /DB\.reinstateBooking\(ref, cleanReason\)/);
  assert.match(client, /async reinstateBooking\(ref, reason\)/);
  assert.match(client, /_sb\.rpc\('reinstate_tenant_booking'/);
});
