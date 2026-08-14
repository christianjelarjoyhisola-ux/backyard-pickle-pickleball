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
