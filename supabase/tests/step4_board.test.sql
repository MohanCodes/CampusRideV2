-- Step 4: the board views. Open future trips with seats show; everything else stays off the board,
-- and the views never carry the plate or the exact spot.
-- Run with `supabase test db`. Everything rolls back.
begin;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'maya@hmc.edu'), ('00000000-0000-0000-0000-0000000000a2', 'alex@pomona.edu'), ('00000000-0000-0000-0000-0000000000a4', 'eli@hmc.edu');
update profiles set first_name = 'Maya', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set first_name = 'Alex', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set first_name = 'Eli',  onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a4';
-- Test-only coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng) values ('00000000-0000-0000-0000-0000000000b1', 'hmc', 'Test point', 'hub', 0, 0);
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000000b1', 'Stand by the secret door');

-- c1 shows. c2 is full. c3 is cancelled. c4 has left. c5 is past status. c6 has no curated place.
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, seats_taken, meetup_point_id, car_make, car_color, status) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'tj-claremont', 'Trader Joe''s',  now() + interval '1 day', 3, 1, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'tj-claremont', 'Trader Joe''s',  now() + interval '1 day', 2, 2, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', 'ont',          'ONT',            now() + interval '1 day', 3, 0, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'cancelled'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1', 'lax',          'LAX',            now() - interval '1 hour', 3, 0, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', 'lax',          'LAX',            now() + interval '1 day', 3, 0, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'past'),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1', null,           'Ontario Mills',  now() + interval '2 days', 3, 0, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'open');
insert into trip_private (trip_id, car_plate) values ('00000000-0000-0000-0000-0000000000c1', 'ABC123');

-- r1 shows. r2 expired by time. r3 is matched.
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, meetup_point_id, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a2', 'target-montclair', 'Target', now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-0000000000b1', 'open'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 'target-montclair', 'Target', now() - interval '2 days', now() - interval '1 day',  '00000000-0000-0000-0000-0000000000b1', 'open'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a2', 'target-montclair', 'Target', now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-0000000000b1', 'matched');

-- Structure, as the database owner ---------------------------------------------------------------------
select ok(not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name in ('board_trips', 'board_requests')
                        and column_name in ('car_plate', 'stand_at', 'last_name', 'email')),
          'the board views carry no plate, exact spot, last name, or email');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where relname = 'board_trips'),
          'board_trips runs with the reader''s own row-level security');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where relname = 'board_requests'),
          'board_requests runs with the reader''s own row-level security');

-- A signed-in stranger (B) -------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select is((select count(*) from board_trips where driver_id = '00000000-0000-0000-0000-0000000000a1'), 2::bigint,
          'only open, upcoming trips with seats appear (plus the trip with no curated place)');
select is((select count(*) from board_trips where id = '00000000-0000-0000-0000-0000000000c2'), 0::bigint, 'a full trip is hidden');
select is((select count(*) from board_trips where id = '00000000-0000-0000-0000-0000000000c3'), 0::bigint, 'a cancelled trip is hidden');
select is((select count(*) from board_trips where id = '00000000-0000-0000-0000-0000000000c4'), 0::bigint, 'a trip that has already left is hidden');
select is((select count(*) from board_trips where id = '00000000-0000-0000-0000-0000000000c5'), 0::bigint, 'a past trip is hidden');
select is((select seats_left from board_trips where id = '00000000-0000-0000-0000-0000000000c1'), 2, 'seats_left is total minus taken');
select is((select chip from board_trips where id = '00000000-0000-0000-0000-0000000000c1'), 'Trader Joe''s', 'a curated place brings its chip');
select is((select chip from board_trips where id = '00000000-0000-0000-0000-0000000000c6'), 'Other', 'a destination with no curated place goes under Other');
select is((select driver_first_name || ' / ' || driver_campus_id from board_trips where id = '00000000-0000-0000-0000-0000000000c1'),
          'Maya / hmc', 'the card carries the driver''s first name and college');
select is((select meetup_point_name from board_trips where id = '00000000-0000-0000-0000-0000000000c1'), 'Test point', 'and the meetup point''s name');
select is((select count(*) from board_requests where rider_id = '00000000-0000-0000-0000-0000000000a2'), 1::bigint, 'only open requests that have not expired appear');
select is((select chip from board_requests where id = '00000000-0000-0000-0000-0000000000e1'), 'Target', 'a request carries its chip');
select is((select rider_first_name from board_requests where id = '00000000-0000-0000-0000-0000000000e1'), 'Alex', 'and its rider''s first name');

-- Blocks hide cards in both directions -------------------------------------------------------------------
reset role;
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4');
insert into ride_requests (id, rider_id, destination_name, window_start, window_end, meetup_point_id) values
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a4', 'Target', now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a4';
select is((select count(*) from board_trips where driver_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'a blocked person sees none of the blocker''s trips');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*) from board_requests where rider_id = '00000000-0000-0000-0000-0000000000a4'), 0::bigint, 'the blocker sees none of the blocked person''s requests');
select is((select count(*) from board_trips where driver_id = '00000000-0000-0000-0000-0000000000a1'), 2::bigint, 'but still sees their own trips');

-- Signed out ---------------------------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok('select count(*) from board_trips', '42501', null, 'signed-out visitors cannot read the trip board');
select throws_ok('select count(*) from board_requests', '42501', null, 'or the request board');

select * from finish();
rollback;
