[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

throw @'
Frontend-owned Supabase deployment is disabled.

This Backyard repository must never link or deploy directly to a Supabase
project. Database migrations, Edge Functions, and secrets are owned by the
separate private pickleball-booking-platform-backend repository and its guarded
deployment scripts.
'@
