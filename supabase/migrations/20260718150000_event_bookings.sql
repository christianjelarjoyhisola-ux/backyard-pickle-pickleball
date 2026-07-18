-- Backyard Pickle private event booking metadata.
-- Event pricing and minimum-duration validation are enforced by the client;
-- these columns preserve the event details when Supabase is connected.

alter table public.bookings
  add column if not exists booking_type text not null default 'regular',
  add column if not exists event_type text,
  add column if not exists event_guest_count integer,
  add column if not exists event_setup_notes text;

alter table public.bookings
  drop constraint if exists bookings_booking_type_check;

alter table public.bookings
  add constraint bookings_booking_type_check
  check (booking_type in ('regular', 'event'));

alter table public.bookings
  drop constraint if exists bookings_event_guest_count_check;

alter table public.bookings
  add constraint bookings_event_guest_count_check
  check (event_guest_count is null or event_guest_count between 1 and 50);

notify pgrst, 'reload schema';
