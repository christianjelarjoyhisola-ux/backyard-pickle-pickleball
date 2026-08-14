const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const admin = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');

test('manual booking offers regular court and event booking types', () => {
  assert.match(admin, /id="mbxBookingType"/);
  assert.match(admin, /value="regular">Court booking/);
  assert.match(admin, /value="event">Event booking/);
});

test('manual event quote uses protected court event configuration', () => {
  assert.match(admin, /court\?\.pricingConfig\?\.event/);
  assert.match(admin, /Number\(mbxEventConfig\(court\)\.hourlyRate \|\| 0\)/);
  assert.match(admin, /minimumHours = Math\.max\(1, Number\(pricingSection\.minimumHours \|\| 1\)\)/);
});

test('manual booking submission sends type but no browser-controlled amount', () => {
  const call = admin.match(/await DB\.createManualBooking\(\{([\s\S]*?)\n    \}\);/);
  assert.ok(call, 'Manual booking API call was not found.');
  assert.match(call[1], /bookingType: _mbxState\.bookingType/);
  assert.doesNotMatch(call[1], /subtotal|serviceFee|bookingFee|total|amount/i);
});
