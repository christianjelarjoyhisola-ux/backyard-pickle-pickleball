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

test('cutoff opens details for System Owners and credit-settled records, without requesting payment', async () => {
  const source = admin.match(/async function prepareRemittanceNow\([^]*?\n\}/)[0];
  for (const [role, status, destination] of [
    ['owner', 'due', 'details'], ['court_owner', 'settled', 'details'],
    ['court_owner', 'due', 'payment'],
  ]) {
    const visits = [];
    const context = vm.createContext({
      $: () => ({}), rmSetBusy: () => {}, toast: () => {},
      DB: { prepareBookingFeeRemittance: async () => ({ remittance: { id: 'cutoff-1', status } }) },
      closeRemittanceModal: () => {}, renderRemittances: async () => {},
      rmDashboardRole: () => role, rmStatusKey: record => record.status,
      rmRecordId: record => record?.id, _rmState: { active: [] },
      openRemittanceDetails: async id => visits.push(['details', id]),
      openRemittancePayment: async id => visits.push(['payment', id]), console,
    });
    vm.runInContext(source, context);
    await context.prepareRemittanceNow();
    assert.deepEqual(visits, [[destination, 'cutoff-1']]);
  }
});

test('System Owner cutoff respects the backend eligibility decision', () => {
  const context = loadHelpers();
  const fields = {};
  const messages = [];
  let opened = false;
  Object.assign(context, {
    $: id => fields[id] ||= {}, rmDashboardRole: () => 'owner',
    toast: message => messages.push(message),
    rmReservationCount: () => 1, rmBookingCount: () => 1,
    rmBillableHours: () => 1, rmFlatBookingCount: () => 0,
    rmFeeBreakdownHtml: () => '', rmCoverageLabel: () => 'Current fees',
    rmDateOnly: () => 'Oct 14', openRemittanceModal: () => { opened = true; },
  });
  for (const name of ['rmCanPrepareInfo', 'openRemittancePrepare']) {
    vm.runInContext(admin.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0], context);
  }
  context._rmState.dashboard = { live: { amount_due: 100 }, can_prepare: { allowed: false, reason: 'Active cutoff exists' } };
  context.openRemittancePrepare();
  assert.equal(opened, false);
  assert.equal(messages[0], 'Active cutoff exists');
  context._rmState.dashboard.can_prepare.allowed = true;
  context.openRemittancePrepare();
  assert.equal(opened, true);
  assert.equal(fields.rmPrepareTitle.textContent, 'CUT OFF REMITTANCE');
});

test('System Owner can upload a receipt to mark an unpaid cutoff paid', () => {
  const context = loadHelpers();
  for (const name of ['rmStatusKey', 'rmOwnerReceivedDraft', 'rmOwnerCanRecordReceived', 'rmDashboardRole']) {
    vm.runInContext(admin.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0], context);
  }
  Object.assign(context, { rmRecordPayment: () => ({}), sess: { role: 'owner' } });
  context._rmState.dashboard = { role: 'owner' };
  const cutoff = { status: 'due', preparation_source: 'court_owner', amount_due: 16, amount_settled: 0 };
  assert.equal(context.rmOwnerCanRecordReceived(cutoff), true);
  assert.equal(context.rmOwnerCanRecordReceived({ ...cutoff, status: 'rejected' }), true);
  for (const blocked of [
    { status: 'submitted' }, { status: 'settled' },
    { amount_settled: 16, credit_applied: 0 },
    { preparation_source: 'system_owner_external_receipt', status: 'rejected' },
  ]) assert.equal(context.rmOwnerCanRecordReceived({ ...cutoff, ...blocked }), false);
  context._rmState.dashboard.role = 'court_owner';
  assert.equal(context.rmOwnerCanRecordReceived(cutoff), false);
});
