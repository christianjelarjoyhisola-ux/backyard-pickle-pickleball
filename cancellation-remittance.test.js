const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const admin = fs.readFileSync(`${__dirname}/admin.html`, 'utf8');
function loadHelpers() {
  const context = vm.createContext({
    _rmState: { dashboard: {} },
    fmt: value => `PHP ${Number(value).toFixed(2)}`,
    esc: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    rmMetricNumber: value => String(value),
    rmDateTime: value => String(value),
  });
  for (const name of ['rmPick', 'rmNumber', 'rmAmountDue', 'rmAmountSettled',
    'rmCreditApplied', 'rmCashReceived', 'rmAvailableCredit', 'rmLiveCashDue',
    'rmAmountRemaining', 'rmBookingCard']) {
    const match = admin.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
    assert.ok(match, `Missing ${name}`);
    vm.runInContext(match[0], context);
  }
  return context;
}

test('credits settle fees without being counted as new cash', () => {
  const ui = loadHelpers();
  const partial = { amount_due: 16, amount_settled: 8, credit_applied: 8 };
  assert.equal(ui.rmCashReceived(partial), 0);
  assert.equal(ui.rmAmountRemaining(partial), 8);
  assert.equal(ui.rmCashReceived({ ...partial, amount_settled: 16 }), 8);
  assert.equal(ui.rmAmountRemaining({ ...partial, amount_settled: 16 }), 0);
  assert.equal(ui.rmCashReceived({ amount_settled: 16 }), 16); // Older backend.
});

test('received transfer amount deducts available venue credit and never goes negative', () => {
  const ui = loadHelpers();
  ui._rmState.dashboard.credit_available = 8;
  assert.equal(ui.rmLiveCashDue({ amount_due: 16 }), 8);
  assert.equal(ui.rmLiveCashDue({ amount_due: 4 }), 0);
  ui._rmState.dashboard = {};
  assert.equal(ui.rmLiveCashDue({ amount_due: 16 }), 16);
});

test('released fee is retained for audit but displayed as zero, not earned', () => {
  const ui = loadHelpers();
  const item = { booking_ref: 'MANUAL-001', fee_amount: 8, fee_rate: 8,
    fee_type: 'flat', fee_units: 1, fee_earned_at: '2026-09-01',
    released_at: '2026-09-29', release_reason: '<cancelled>' };
  const released = ui.rmBookingCard(item);
  assert.match(released, /rm-booking-fee">PHP 0\.00/);
  assert.match(released, /Removed from this remittance/);
  assert.match(released, /&lt;cancelled&gt;/);
  assert.doesNotMatch(released, /Fee earned/);
  const active = ui.rmBookingCard({ ...item, released_at: null });
  assert.match(active, /rm-booking-fee">PHP 8\.00/);
  assert.match(active, /Fee earned/);
});
