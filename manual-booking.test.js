const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');
const backendRoot = path.join(root, 'platform-backend');
const edge = fs.readFileSync(
  path.join(backendRoot, 'supabase', 'functions', 'create-manual-booking', 'index.ts'),
  'utf8',
);
const shared = fs.readFileSync(
  path.join(backendRoot, 'supabase', 'functions', '_shared', 'manual-booking.ts'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(backendRoot, 'supabase', 'migrations', '20260724100000_manual_paid_bookings.sql'),
  'utf8',
);

test('manual booking uses one protected owner-only service path', () => {
  assert.match(client, /async createManualBooking\(payload\)/);
  assert.match(client, /create-manual-booking\?tenantSlug=/);
  assert.match(client, /\['owner', 'court_owner'\]\.includes\(role\)/);
  assert.match(edge, /canCreateManualBooking\(access\)/);
  assert.match(migration, /membership\.role in \('owner', 'admin'\)/);
  assert.match(shared, /access\.membershipRole === "owner"[\s\S]*access\.membershipRole === "admin"/);
  assert.doesNotMatch(shared.match(/function canCreateManualBooking[\s\S]*?\n\}/)[0], /staff/);
});

test('manual booking accepts no browser-controlled price or payment amount', () => {
  const createCall = admin.match(/await DB\.createManualBooking\(\{([\s\S]*?)\n    \}\);/);
  assert.ok(createCall, 'Manual booking client call was not found.');
  assert.doesNotMatch(createCall[1], /subtotal|serviceFee|bookingFee|total|amount/i);
  assert.match(edge, /calculateBookingQuote\(\{/);
  assert.match(migration, /public\.create_public_booking\(/);
});

test('manual booking is always fully paid, confirmed, and remittance eligible', () => {
  assert.match(migration, /set status = 'confirmed',\s*payment_status = 'paid'/);
  assert.match(migration, /status = 'confirmed'/);
  assert.match(migration, /'fullPaymentOnly', true/);
  assert.match(migration, /payment_sessions[\s\S]*'paid'/);
  assert.match(admin, /Total paid/);
  assert.doesNotMatch(
    admin.match(/PROTECTED MANUAL BOOKING[\s\S]*?<!-- RESCHEDULE MODAL -->/)[0],
    /50%|downpayment|Pending/,
  );
});

test('mobile manual booking is a two-step bottom sheet with touch-sized controls', () => {
  assert.match(admin, /id="mbxProgressSchedule"/);
  assert.match(admin, /id="mbxProgressCustomer"/);
  assert.match(admin, /@media \(max-width: 700px\) \{[\s\S]*?\.mbx-modal \{[\s\S]*?94svh/);
  assert.match(admin, /\.mbx-time \{[\s\S]*?min-height: 58px/);
  assert.match(admin, /\.mbx-footer \.btn \{[\s\S]*?min-height: 50px/);
});

test('manual time slots are fixed four-column hour ranges with a sticky schedule summary', () => {
  assert.match(admin, /\.mbx-time-grid \{[^}]*repeat\(4,/);
  assert.match(admin, /@media \(max-width: 700px\) \{[\s\S]*?\.mbx-time-grid \{[^}]*repeat\(4,/);
  assert.match(admin, /function mbxSlotLabel\(hour\) \{[\s\S]*?mbxSlotHour\(hour \+ 1\)/);
  assert.match(admin, /class="mbx-time \$\{selected \? 'selected' : ''\}" type="button" draggable="false"/);
  assert.match(admin, /\.mbx-time \{[\s\S]*?touch-action: manipulation; user-select: none;/);
  assert.match(
    admin,
    /<div class="mbx-footer" id="mbxFooter">[\s\S]*?id="mbxScheduleSelection"[\s\S]*?id="mbxNextBtn"/,
  );
});

test('platform source mapper preserves the owner audit trail', () => {
  assert.match(client, /createdVia: metadata\.createdVia/);
  assert.match(client, /createdByUserId: metadata\.createdByUserId/);
  assert.match(client, /createdByRole: metadata\.createdByRole/);
  assert.match(edge, /source: "manual_dashboard"/);
  assert.match(migration, /'manual_booking_created'/);
});
