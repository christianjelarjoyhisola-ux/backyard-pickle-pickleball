# Backyard Pickle Changelog

This changelog belongs only to the Backyard Pickle booking system.

## 2026-07-18

### Platform isolation

- Confirmed the GitHub remote uses the independent `backyard-pickle-pickleball` repository.
- Confirmed Cloudflare Pages deploys only to the `backyard-pickle-pickleball` project.
- Kept the public frontend disconnected from any production database until the new shared multi-tenant platform passes isolation testing.
- Removed copied venue history and all references to unrelated court systems.

### Booking experience

- Added a modern Backyard Pickle splash screen using the official logo and brand colors.
- Added separate regular-court and event-package booking paths.
- Limited booking inventory to the Main Court.
- Set regular rates to PHP 200/hour from 6:00 AM to 4:00 PM and PHP 280/hour from 5:00 PM to midnight.
- Added event packages at PHP 380/hour with a four-hour minimum, full payment, and a 50-guest capacity.
- Made event start-time selection automatically reserve four consecutive hours and recommend the nearest valid block when unavailable.
- Removed Open Play and the redundant availability-search banner.

### Contact and sharing

- Added the official Backyard Pickle Facebook page and contact number.
- Added the Backyard Pickle social-sharing image and logo metadata.
- Published the independent frontend through Cloudflare Pages.
