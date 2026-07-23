const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const read = file => fs.readFileSync(file, 'utf8');

test('protected reschedule client uses the shared Edge Function contract only', () => {
  const data = read('supabase-config.js');

  assert.equal((data.match(/reschedule-booking\?tenantSlug=/g) || []).length, 3);
  assert.match(data, /async previewBookingReschedule\(ref, bookingDate\)/);
  assert.match(data, /action:\s*'preview'[\s\S]*bookingReference:[\s\S]*bookingDate:/);
  assert.match(data, /async rescheduleBooking\(ref, change = \{\}\)/);
  assert.match(
    data,
    /action:\s*'reschedule'[\s\S]*newDate:[\s\S]*newStartTime:[\s\S]*reasonCode:[\s\S]*publicReason:[\s\S]*internalNote:[\s\S]*notifyCustomer:[\s\S]*idempotencyKey:/
  );
  assert.match(data, /async resendBookingRescheduleEmail\(ref, eventId\)/);
  assert.match(data, /action:\s*'resend'[\s\S]*bookingReference:[\s\S]*eventId:/);
  assert.doesNotMatch(data, /reschedule_tenant_booking/);
  assert.doesNotMatch(data, /send-reschedule-email/);
  assert.match(data, /_pbClearFastCache\(\['bookings', 'platformAvailability'\]\)/);
});

test('the dashboard has one accessible server-authoritative reschedule workflow', () => {
  const admin = read('admin.html');
  const workflowStart = admin.indexOf('let _rescheduleState =');
  const workflowEnd = admin.indexOf('\nasync function exportCSV', workflowStart);

  assert.ok(workflowStart >= 0 && workflowEnd > workflowStart);
  const workflow = admin.slice(workflowStart, workflowEnd);
  assert.equal((admin.match(/async function openRescheduleModal/g) || []).length, 1);
  assert.equal((admin.match(/function closeRescheduleModal/g) || []).length, 1);
  assert.equal((admin.match(/async function saveReschedule/g) || []).length, 1);
  assert.equal((admin.match(/function bookingDetailsButton/g) || []).length, 1);
  assert.equal((admin.match(/function bookingActionsHtml/g) || []).length, 1);
  assert.match(admin, /id="rescheduleModal" aria-hidden="true" inert hidden/);
  assert.match(admin, /role="dialog" aria-modal="true" aria-labelledby="rescheduleTitle"/);
  assert.match(admin, /onkeydown="rescheduleModalKeydown\(event\)"/);
  assert.match(admin, /id="rsReasonCode" required/);
  assert.match(admin, /id="rsPublicReason"[^>]*required/);
  assert.match(admin, /id="rsInternalNote"[^>]*minlength="3"/);
  assert.match(admin, /id="rsNotifyCustomer"/);
  assert.match(admin, /Same court and duration\. Payment status and total stay unchanged\./);
  assert.match(admin, /\['owner','court_owner'\]\.includes\(String\(sess\?\.role/);
  assert.match(admin, /\['confirmed','payment_review'\]\.includes\(platformStatus\)/);
  assert.match(admin, /if \(!b \|\| b\.archivedAt/);
  assert.match(workflow, /DB\.previewBookingReschedule\(ref, date\)/);
  assert.match(workflow, /reasonCodes\.map\(reason =>/);
  assert.match(workflow, /const ready = !!selected[\s\S]*selected\.available !== false/);
  assert.match(workflow, /data-reschedule-index="\$\{index\}"/);
  assert.match(workflow, /querySelector\(`\[data-reschedule-index="\$\{index\}"\]`\)\?\.focus\(\)/);
  assert.match(workflow, /await Promise\.all\(\[renderBookings\(\),renderDash\(\)\]\)[\s\S]*search\.offsetParent !== null[\s\S]*search\.focus\(\)/);
  assert.match(workflow, /DB\.rescheduleBooking\(booking\.ref/);
  assert.match(
    workflow,
    /newDate,[\s\S]*newStartTime,[\s\S]*reasonCode,[\s\S]*publicReason,[\s\S]*internalNote,[\s\S]*notifyCustomer,[\s\S]*idempotencyKey:/
  );
  assert.match(workflow, /bytes\[6\] = \(bytes\[6\] & 0x0f\) \| 0x40/);
  assert.match(workflow, /bytes\[8\] = \(bytes\[8\] & 0x3f\) \| 0x80/);
  assert.doesNotMatch(workflow, /DB\.updateBooking\(/);
  assert.doesNotMatch(admin, /DB\.sendRescheduleEmail\s*\(/);
});

test('reschedule history and email retry use the authoritative latest event', () => {
  const admin = read('admin.html');
  const data = read('supabase-config.js');

  assert.match(data, /booking_reschedule_events/);
  assert.match(data, /lastRescheduleEventId:\s*lastReschedule\.eventId \|\| lastReschedule\.event_id \|\| null/);
  assert.match(data, /tenant-manager-data\?tenantSlug=/);
  assert.doesNotMatch(data, /action:\s*'list-bookings'/);
  assert.doesNotMatch(data, /limit:\s*500/);
  assert.match(data, /booking_reschedule_events\(\*\)/);
  assert.match(data, /\.eq\('booking_reschedule_events\.tenant_id', tenantId\)/);
  assert.match(admin, /bookingRescheduleHistoryHtml\(b\)/);
  assert.match(admin, /const lastRescheduleEventId = String\(b\.lastRescheduleEventId \|\| ''\)/);
  assert.match(admin, /isLatest\?'Latest':'Superseded'/);
  assert.match(admin, /function canResendRescheduleEmailForBooking\(b\)/);
  assert.match(admin, /resendBookingRescheduleEmail\(ref, eventId\)/);
  assert.match(admin, /delivery_unknown'\) return 'Email delivery outcome needs review'/);
  assert.match(admin, /\['sent','failed','disabled','not_requested','pending'\]\.includes\(emailStatus\)/);
});

test('protected DTO mapping accepts camel and database rows', () => {
  const data = read('supabase-config.js');
  const start = data.indexOf('function _pbPlatformRescheduleEventToLegacy');
  const end = data.indexOf('\nfunction _pbPlatformSettingsToLegacy', start);
  assert.ok(start >= 0 && end > start);
  const context = {};
  vm.runInNewContext(`
    function _pbZonedHour() { return 10; }
    function _fmtBookingHour(hour) { return String(hour).padStart(2, '0') + ':00'; }
    function _bookingSlotsTimeLabel() { return ''; }
    ${data.slice(start, end)}
    result = {
      event: _pbPlatformRescheduleEventToLegacy({
        id: 'event-1',
        reason_code: 'weather',
        public_reason: 'Heavy rain',
        old_starts_at: '2026-07-23T10:00:00+08:00',
        old_ends_at: '2026-07-23T11:00:00+08:00',
        new_starts_at: '2026-07-24T13:00:00+08:00',
        new_ends_at: '2026-07-24T14:00:00+08:00',
        email_status: 'failed',
        email_last_error_code: 'MAILEROO_DELIVERY_FAILED'
      }),
      option: _pbPlatformRescheduleOptionToLegacy({
        startsAt: '2026-07-24T13:00:00+08:00',
        endsAt: '2026-07-24T14:00:00+08:00',
        startTime: '13:00',
        endTime: '14:00',
        available: true
      }),
      booking: _pbPlatformBookingToLegacy({
        id: 'booking-1',
        reference: 'PB-TEST-1',
        metadata: { lastReschedule: { eventId: 'event-2' } },
        starts_at: '2026-07-23T10:00:00+08:00',
        ends_at: '2026-07-23T11:00:00+08:00',
        status: 'confirmed',
        payment_status: 'paid',
        booking_reschedule_events: [
          { id: 'event-1', rescheduled_at: '2026-07-23T10:01:00+08:00' },
          { id: 'event-2', rescheduled_at: '2026-07-23T10:00:59+08:00' }
        ]
      }, new Map(), 'Asia/Manila')
    };`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.equal(result.event.reasonCode, 'weather');
  assert.equal(result.event.emailErrorCode, 'MAILEROO_DELIVERY_FAILED');
  assert.equal(result.option.startTime, '13:00');
  assert.equal(result.option.available, true);
  assert.equal(result.booking.lastRescheduleEventId, 'event-2');
  assert.equal(result.booking.rescheduleEvents[0].id, 'event-1');
});

test('every entry page loads the same protected reschedule client version', () => {
  for (const file of ['index.html', 'admin.html', 'login.html', 'host.html']) {
    assert.match(read(file), /supabase-config\.js\?v=20260723-protected-reschedule-v2/);
  }
});

test('public availability stays authoritative while a dashboard session is open', () => {
  const publicPage = read('index.html');
  const data = read('supabase-config.js');
  assert.equal((publicPage.match(/publicAvailability:\s*true/g) || []).length, 5);
  const publicBranch = data.indexOf('if (opts.publicAvailability === true)');
  const sessionBranch = data.indexOf('const session = await _pbAuthenticatedSession()', publicBranch);
  assert.ok(publicBranch >= 0 && sessionBranch > publicBranch);
  assert.match(data.slice(publicBranch, sessionBranch), /_pbPlatformAvailability\(opts\.date\)/);
});

test('all inline entry-page scripts parse', () => {
  for (const file of ['index.html', 'admin.html', 'login.html', 'host.html']) {
    const html = read(file);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .filter(match => !/^<script[^>]*\bsrc=/i.test(match[0]));
    scripts.forEach((match, index) => {
      assert.doesNotThrow(
        () => new vm.Script(match[1], { filename: `${file}:inline-${index + 1}` })
      );
    });
  }
});
