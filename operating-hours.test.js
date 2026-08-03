const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const admin = fs.readFileSync('admin.html', 'utf8');
const customer = fs.readFileSync('index.html', 'utf8');
const dataLayer = fs.readFileSync('supabase-config.js', 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
      opened = true;
    } else if (source[index] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

test('admin offers 3:00 AM as a next-day closing time', () => {
  const context = {};
  vm.runInNewContext(functionSource(admin, 'fmtH'), context);

  assert.equal(context.fmtH(24), '12:00 AM (Next Day / Midnight)');
  assert.equal(context.fmtH(27), '3:00 AM (Next Day)');
  assert.match(admin, /for \(let h = 1; h <= 27; h\+\+\)/);
});

test('overnight court hours convert 03:00 to hour 27', () => {
  const context = {};
  vm.runInNewContext(
    `${functionSource(dataLayer, '_pbClockHour')}
     ${functionSource(dataLayer, '_pbCourtOperatingHours')}`,
    context,
  );

  assert.deepEqual(
    { ...context._pbCourtOperatingHours({ opensAt: '06:00', closesAt: '03:00' }) },
    { open: 6, close: 27 },
  );
});

test('after-midnight bookings advance the calendar date and normalize the clock', () => {
  const context = {};
  vm.runInNewContext(functionSource(dataLayer, '_pbAddCalendarDays'), context);

  assert.equal(context._pbAddCalendarDays('2026-07-31', 1), '2026-08-01');
  assert.match(dataLayer, /startDayOffset = Math\.floor\(startSlot \/ 24\)/);
  assert.match(dataLayer, /bookingDate: _pbAddCalendarDays\(String\(booking\.date\), startDayOffset\)/);
  assert.match(dataLayer, /startClockHour = \(\(startSlot % 24\) \+ 24\) % 24/);
});

test('after-midnight slots use the matching early-morning pricing tier', () => {
  const context = {};
  vm.runInNewContext(functionSource(customer, 'getRateForHourFromTiers'), context);
  const tiers = [
    { from: 6, to: 24, rate: 200 },
    { from: 0, to: 3, rate: 300 },
  ];

  assert.equal(context.getRateForHourFromTiers(23, tiers), 200);
  assert.equal(context.getRateForHourFromTiers(24, tiers), 300);
  assert.equal(context.getRateForHourFromTiers(26, tiers), 300);
});

test('platform booking ranges stay chronological when they cross midnight', () => {
  const context = {};
  vm.runInNewContext(
    `${functionSource(dataLayer, '_pbZonedDateHour')}
     ${functionSource(dataLayer, '_pbZonedHour')}
     ${functionSource(dataLayer, '_pbCalendarDayOffset')}
     ${functionSource(dataLayer, '_pbExtendedZonedHour')}
     ${functionSource(dataLayer, '_fmtBookingHour')}
     ${functionSource(dataLayer, '_bookingSlotsTimeLabel')}
     function _pbPlatformRescheduleEventToLegacy(value) { return value; }
     ${functionSource(dataLayer, '_pbPlatformBookingToLegacy')}
     result = _pbPlatformBookingToLegacy({
       reference: 'PB-MIDNIGHT',
       local_booking_date: '2026-08-02',
       starts_at: '2026-08-02T15:00:00Z',
       ends_at: '2026-08-02T17:00:00Z',
       status: 'confirmed',
       payment_status: 'paid',
       total_amount: 904,
       booking_slots: [
         { status: 'confirmed', starts_at: '2026-08-02T15:00:00Z' },
         { status: 'confirmed', starts_at: '2026-08-02T16:00:00Z' },
       ],
     }, new Map(), 'Asia/Manila');`,
    context,
  );

  const result = JSON.parse(JSON.stringify(context.result));
  assert.deepEqual(result.slots, [23, 24]);
  assert.equal(result.startTime, '11:00 PM');
  assert.equal(result.endTime, '1:00 AM');
  assert.equal(result.timeLabel, '11:00 PM - 1:00 AM');
  assert.equal(result.duration, 2);
  assert.equal(result.total, 904);
});
