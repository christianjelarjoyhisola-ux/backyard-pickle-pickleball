// Backyard Pickle's public tenant identity for the shared booking platform.
// This file contains no secrets. Service-role, email, Vision, and payment
// credentials must stay in Supabase secrets and never enter a client repo.
(function configureBackyardTenant(global) {
  'use strict';

  const config = Object.freeze({
    tenantSlug: 'backyard-pickle',
    productionHosts: Object.freeze([
      'backyard-pickle-pickleball.pages.dev',
    ]),
    developmentHosts: Object.freeze([
      'localhost',
      '127.0.0.1',
      '::1',
    ]),
    supabaseUrl: 'https://neqvrwtofiolcuxewdze.supabase.co',
    supabasePublishableKey: 'sb_publishable_UHMKYGsygjeMl79VRfPNVw_RyWiV5Yr',
    schemaVersion: 'multi-tenant-v1',
    turnstileSiteKey: '0x4AAAAAAD4f_jPZuqET5eVD',
    // Authentication is activated independently from public booking writes.
    // This lets approved staff use real Supabase Auth while the remaining
    // booking/payment rollout stays explicitly disabled.
    authEnabled: true,
    backendEnabled: false,
    publicBookingEnabled: false,
    hostPortalEnabled: false,
  });

  Object.defineProperty(global, 'PB_TENANT_CONFIG', {
    value: config,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(window);
