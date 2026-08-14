const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const admin = fs.readFileSync('admin.html', 'utf8');
const client = fs.readFileSync('supabase-config.js', 'utf8');
const publicSite = fs.readFileSync('index.html', 'utf8');

test('payment settings save account details before linking managed QR assets', () => {
  assert.match(admin, /const _platformPaymentQrChanges = new Map\(\)/);
  assert.doesNotMatch(admin, /ensureReceiptMfa\(savePlatformActivationSettings\)/);
  assert.match(
    admin,
    /let savedActivation = await DB\.saveTenantActivationSettings[\s\S]*?await savePlatformPaymentQrChanges\(\)[\s\S]*?savedActivation = await DB\.saveTenantActivationSettings/,
  );
  assert.match(admin, /_platformPaymentQrChanges\.set\(methodCode, \{ action: 'upload', file, previewUrl, displayName \}\)/);
  assert.match(client, /async deleteTenantPaymentQr\(\{ methodCode \}\)/);
  assert.match(client, /'X-Asset-Action': 'delete'/);
  assert.doesNotMatch(client, /publicBookingEnabled: publicBookingRequested === true/);
});

test('MariBank is available in admin and public checkout payment mappings', () => {
  assert.match(admin, /\{ code: 'maribank', displayName: 'MariBank' \}/);
  assert.match(publicSite, /id="payOptMaribank" data-m="maribank"/);
  assert.match(publicSite, /const DIGITAL_PAYMENT_METHODS = \[[^\]]*'maribank'/);
  assert.match(publicSite, /maribank: 'MariBank'/);
  assert.match(client, /'cash', 'gcash', 'bdopay', 'maya', 'bpi', 'maribank', 'gotyme', 'pnb'/);
});

test('each platform payment method keeps its own account, QR, and instructions', () => {
  assert.match(client, /settings\[`payment_\$\{uiCode\}_account_reference`\] = method\.accountReference/);
  assert.match(client, /settings\[`payment_\$\{uiCode\}_qr_image`\] = method\.qrImageUrl/);
  assert.match(publicSite, /function paymentReceiverFromSettings\(settings, method, legacyMethod = method\)/);
  assert.match(publicSite, /bpi: paymentReceiverFromSettings\(settings, 'bpi', 'gcash'\)/);
  assert.match(publicSite, /maribank: paymentReceiverFromSettings\(settings, 'maribank'\)/);
  assert.match(publicSite, /const receiver = paymentReceiverSettings\[method\] \|\| paymentReceiverSettings\.gcash/);
});
