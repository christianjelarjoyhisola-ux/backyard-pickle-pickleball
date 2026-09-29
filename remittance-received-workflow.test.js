const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const database = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');

test('system owner sees direct posting only for a live balance with no active remittance', () => {
  assert.match(admin, /id="rmPostReceivedBtn"[^>]+onclick="openReceivedRemittancePost\(\)"/);
  assert.match(admin, /role === 'owner' && liveCashDue > 0 && active\.length === 0/);
  assert.match(admin, /Post Received \$\{fmt\(liveCashDue\)\}/);
  assert.match(admin, /postReceivedBtn\.hidden = !ownerCanPostReceived/);
});

test('received payment requires an explicit review and final settlement confirmation', () => {
  assert.match(admin, /id="rmPostReceivedEntry"/);
  assert.match(admin, /id="rmPostReceivedConfirm" hidden/);
  assert.match(admin, /reviewReceivedRemittancePost\(event\)/);
  assert.match(admin, /id="rmPostReceivedConfirmBtn"[^>]+onclick="submitReceivedRemittancePost\(\)"/);
  assert.match(admin, /Final confirmation\./);
});

test('owner posting captures exact payment evidence and a substantive exception reason', () => {
  assert.match(admin, /value="bank_transfer" selected>Bank transfer \(MariBank \/ InstaPay\)/);
  assert.match(admin, /id="rmPostReceivedReason"[^>]+minlength="10"/);
  assert.match(admin, /id="rmPostReceivedProof"[^>]+accept="image\/jpeg,image\/png,image\/webp,/);
  assert.match(admin, /reason\.length < 10/);
  assert.match(database, /safeReason\.length < 10/);
});

test('client prepares the exact balance then posts it through protected storage and RPC', () => {
  assert.match(database, /async prepareReceivedBookingFeeRemittance/);
  assert.match(database, /rpc\('prepare_received_booking_fee_remittance'/);
  assert.match(database, /p_expected_amount: amount/);
  assert.match(database, /async recordReceivedBookingFeeRemittance/);
  assert.match(database, /\.from\('tenant-private'\)[\s\S]*\.upload\(proofPath/);
  assert.match(database, /rpc\('record_received_booking_fee_remittance'/);
  assert.match(database, /p_idempotency_key: recordKey/);
});

test('uncertain settlement is reconciled before receipt cleanup', () => {
  assert.match(database, /header\.latest_payment \|\| header\.latestPayment/);
  assert.match(database, /entrySource === 'system_owner_external_receipt'/);
  assert.match(database, /latestProofPath === proofPath/);
  assert.match(database, /if \(reconciliation\.matches\) return reconciliation\.detail/);
  assert.match(database, /definiteRejection && reconciliation\.loaded && !reconciliation\.pathUsed/);
  assert.match(database, /REMITTANCE_RECEIVED_PAYMENT_STATUS_UNKNOWN/);
});

test('deterministic proof retries are bound to the selected receipt bytes', () => {
  assert.match(database, /crypto\.subtle\.digest\('SHA-256', image\.bytes\)/);
  assert.match(database, /recordKey\.replace[\s\S]*proofDigest/);
  assert.match(database, /latestProofPath === proofPath/);
});

test('unfinished owner exception records remain recoverable', () => {
  assert.match(admin, /\['draft','due','prepared'/);
  assert.match(admin, /source === 'system_owner_external_receipt'/);
  assert.match(admin, />Finish Posting<\/button>/);
  assert.match(admin, /system_owner_exception_reason/);
});

test('external-receipt drafts cannot enter normal court-owner payment or cancellation', () => {
  assert.match(admin, /role === 'court_owner' && !rmOwnerReceivedDraft\(record\)/);
  assert.match(admin, /if \(rmOwnerReceivedDraft\(record\)\) \{ toast\('This System Owner external-receipt record cannot use the normal court-owner payment flow/);
  assert.match(admin, /if \(record && rmOwnerReceivedDraft\(record\)\) \{ toast\('A System Owner external-receipt record cannot use the normal court-owner cancellation flow/);
});

test('system owner can safely release an unfinished external-receipt draft', () => {
  assert.match(admin, /openReceivedRemittanceCancellation/);
  assert.match(admin, />Release Frozen Balance<\/button>/);
  assert.match(admin, /receivedCancelKey = rmReceivedActionKey\('cancel-received'\)/);
  assert.match(admin, /DB\.cancelReceivedBookingFeeRemittance\(id, \{ reason, idempotencyKey:_rmState\.receivedCancelKey \}\)/);
  assert.match(database, /async cancelReceivedBookingFeeRemittance/);
  assert.match(database, /rpc\('cancel_received_booking_fee_remittance'/);
  assert.match(database, /p_idempotency_key: cancelKey/);
});
