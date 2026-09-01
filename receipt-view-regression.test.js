const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const database = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');

test('grouped bookings keep the row that owns the receipt evidence', () => {
  assert.match(admin, /const receiptItem = items\.find\(b => b\.receiptImageUrl\)/);
  assert.match(admin, /receiptVerificationId: receiptItem\.receiptVerificationId/);
  assert.match(admin, /receiptSourceRef: receiptItem\.ref/);
});

test('protected receipt viewer uses the loaded verification id', () => {
  assert.match(database, /async getReceiptSignedUrl\(bookingRef, receiptVerificationId = ''\)/);
  assert.match(database, /verificationId = String\(receiptVerificationId \|\| ''\)\.trim\(\)/);
  assert.match(admin, /b\.receiptSourceRef \|\| b\.ref,[\s\S]*b\.receiptVerificationId/);
});

test('manager image availability flags are accepted without exposing storage paths', () => {
  assert.match(database, /receipt\?\.image_available === true/);
  assert.match(database, /receipt\?\.imageAvailable === true/);
  assert.match(database, /receiptImageAvailable \? 'protected' : null/);
});

test('started pending or expired receipts expose an owner-only confirmation action', () => {
  assert.match(admin, /function canLateConfirmBooking\(b\)/);
  assert.match(admin, /\['owner','court_owner'\]\.includes\(role\)/);
  assert.match(admin, /b\?\.receiptVerificationId/);
  assert.match(admin, /\['pending','forfeited'\]\.includes/);
  assert.match(admin, /startMs <= Date\.now\(\)/);
  assert.match(admin, /✅ Review &amp; Confirm/);
  assert.match(admin, /Confirm Paid — Past Booking/);
  assert.match(database, /async confirmExpiredPayment\(ref, note\)/);
  assert.match(database, /decision: 'late_approve'/);
});

test('post-start copy distinguishes ongoing reservation from ended accounting', () => {
  assert.match(admin, /function lateConfirmationPhase\(b\)/);
  assert.match(admin, /Past court time will not be reopened/);
  assert.match(admin, /original slots still have no conflict/);
  assert.match(admin, /This records it as PAID and COMPLETED without reopening past court time/);
  assert.match(admin, /reserves its original court time only if no conflicting booking or block exists/);
});

test('future forfeited receipts expose atomic restore and confirm', () => {
  assert.match(admin, /function canRestoreConfirmBooking\(b\)/);
  assert.match(admin, /startMs > Date\.now\(\)/);
  assert.match(admin, /♻️ Restore &amp; Confirm/);
  assert.match(admin, /every released slot is still available/);
  assert.match(admin, /dataset\.restoreConfirmation/);
  assert.match(database, /async restoreExpiredPayment\(ref, note\)/);
  assert.match(database, /decision: 'restore_approve'/);
});

test('future restore warns that original court time must be reclaimed', () => {
  assert.match(admin, /reserve the original court time again only if every slot is still available/);
  assert.match(admin, /Booking restored, payment confirmed, and original court time reserved/);
});

test('bookings are segregated into clear status groups with counts', () => {
  assert.match(admin, /data-booking-status="pending"[\s\S]*Pending/);
  assert.match(admin, /data-booking-status="confirmed"[\s\S]*Confirmed/);
  assert.match(admin, /data-booking-status="completed"[\s\S]*Completed/);
  assert.match(admin, /data-booking-status="cancelled"[\s\S]*Cancelled \/ Forfeited/);
  assert.match(admin, /\['pending', 'verifying'\]\.includes\(status\)/);
  assert.match(admin, /\['cancelled', 'forfeited'\]\.includes\(status\)/);
});

test('status segregation is shared by list and calendar without callback indexes overriding the selected group', () => {
  assert.match(admin, /bks = bks\.filter\(b => bookingMatchesStatusGroup\(b\)\)/);
  assert.match(admin, /const bks = allBks[\s\S]*\.filter\(bookingMatchesType\)[\s\S]*\.filter\(b => bookingMatchesStatusGroup\(b\)\)/);
  assert.doesNotMatch(admin, /\.filter\(bookingMatchesStatusGroup\)/);
});

test('confirmed bookings complete as soon as their scheduled end passes', () => {
  assert.match(admin, /window\.PB_PLATFORM_V1 && !window\.PB_USE_LOCAL_DATA/);
  assert.match(admin, /const result = await DB\.completeEndedBookings\(\)/);
  assert.match(admin, /return now >= endDt/);
  assert.match(database, /async completeEndedBookings\(\)/);
  assert.match(database, /rpc\('complete_ended_tenant_bookings'/);
});

test('future or ongoing paid cancellations expose owner-only accidental restore actions until the booking ends', () => {
  assert.match(admin, /function canRestoreAccidentalCancellation\(b\)/);
  assert.match(admin, /String\(b\?\.status \|\| ''\)\.toLowerCase\(\) === 'cancelled'/);
  assert.match(admin, /String\(b\?\.paymentStatus \|\| ''\)\.toLowerCase\(\) === 'paid'/);
  assert.match(admin, /Number\.isFinite\(endMs\) && endMs > Date\.now\(\)/);
  assert.match(admin, /Restore booking/);
  assert.match(admin, /Restore accidental cancellation/);
  assert.match(database, /Number\.isFinite\(endsAtMs\)/);
  assert.match(database, /endsAtMs <= Date\.now\(\)/);
  assert.match(database, /future or ongoing, fully paid cancelled booking that has not ended/);
});

test('accidental cancellation restore warns about conflicts and refreshes every booking view', () => {
  assert.match(admin, /future or ongoing booking has not ended/);
  assert.match(admin, /Every original slot must still be free/);
  assert.match(admin, /await DB\.restoreCancelledBooking/);
  assert.match(admin, /Promise\.all\(\[renderBookings\(\), renderCalendar\(\), renderDash\(\)\]\)/);
  assert.match(admin, /original court time is reserved again/);
  assert.match(database, /async restoreCancelledBooking\(ref, reason = ''\)/);
  assert.match(database, /rpc\('restore_cancelled_tenant_booking'/);
  assert.match(database, /p_booking_id: booking\.id/);
  assert.match(database, /_pbClearFastCache\(\['bookings', 'platformAvailability'\]\)/);
});
