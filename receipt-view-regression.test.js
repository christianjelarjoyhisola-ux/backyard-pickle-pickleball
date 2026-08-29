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

test('expired past receipts expose an owner-only late confirmation action', () => {
  assert.match(admin, /function canLateConfirmBooking\(b\)/);
  assert.match(admin, /\['owner','court_owner'\]\.includes\(role\)/);
  assert.match(admin, /b\?\.receiptVerificationId/);
  assert.match(admin, /✅ Confirm Payment/);
  assert.match(admin, /Confirm Paid — Past Booking/);
  assert.match(database, /async confirmExpiredPayment\(ref, note\)/);
  assert.match(database, /decision: 'late_approve'/);
});

test('late confirmation records payment without reopening released court time', () => {
  assert.match(admin, /records the expired past booking as completed and does not reopen its released court time/);
  assert.match(admin, /records it as PAID and COMPLETED without reopening the court time/);
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

test('status segregation is shared by list and calendar views', () => {
  assert.match(admin, /bks = bks\.filter\(bookingMatchesStatusGroup\)/);
  assert.match(admin, /const bks = allBks\.filter\(bookingMatchesType\)\.filter\(bookingMatchesStatusGroup\)/);
});

test('confirmed bookings complete as soon as their scheduled end passes', () => {
  assert.match(admin, /window\.PB_PLATFORM_V1 && !window\.PB_USE_LOCAL_DATA/);
  assert.match(admin, /const result = await DB\.completeEndedBookings\(\)/);
  assert.match(admin, /return now >= endDt/);
  assert.match(database, /async completeEndedBookings\(\)/);
  assert.match(database, /rpc\('complete_ended_tenant_bookings'/);
});
