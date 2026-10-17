-- Step 5: check_rate and post_trip. BUILD.md 6.1, 6.4, 6.6.
-- Run with `supabase test db`. Everything rolls back.
begin;
select plan(65);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'dana@hmc.edu'), ('00000000-0000-0000-0000-0000000000d2', 'rae@pomona.edu'), ('00000000-0000-0000-0000-0000000000d3', 'r2@pomona.edu'), ('00000000-0000-0000-0000-0000000000d4', 'r3@pomona.edu'),
  ('00000000-0000-0000-0000-0000000000d5', 'r4@pomona.edu'), ('00000000-0000-0000-0000-0000000000d6', 'r5@pomona.edu'), ('00000000-0000-0000-0000-0000000000d7', 'r6@pomona.edu'), ('00000000-0000-0000-0000-0000000000d8', 'r7@pomona.edu'),
  ('00000000-0000-0000-0000-0000000000d9', 'sue@hmc.edu'), ('00000000-0000-0000-0000-0000000000da', 'new@hmc.edu'), ('00000000-0000-0000-0000-0000000000db', 'stan@hmc.edu');
update profiles set first_name = 'Person', onboarded_at = now() where id not in ('00000000-0000-0000-0000-0000000000da');
update profiles set suspended_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000000d9';

-- Test-only points and coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, shared, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'hmc',    'HMC point',           'hub', 0, 0, false, 'approved'),
  ('00000000-0000-0000-0000-0000000000f2', 'pomona', 'Pomona-only point',   'hub', 0, 0, false, 'approved'),
  ('00000000-0000-0000-0000-0000000000f3', 'pomona', 'Shared point',        'hub', 0, 0, true,  'approved'),
  ('00000000-0000-0000-0000-0000000000f4', 'hmc',    'Suspended HMC point', 'hub', 0, 0, false, 'suspended');
insert into places (id, name, category, address, chip, active) values ('zz-gone', 'Retired place', 'test', 'nowhere', 'Other', false);

-- A wrapper so each test only names what it changes. Defaults post a valid trip.
create function t_post(
  p_place text default 'tj-claremont', p_name text default null, p_lat double precision default null,
  p_lng double precision default null, p_dep timestamptz default now() + interval '1 day',
  p_back timestamptz default null, p_seats int default 3, p_point uuid default '00000000-0000-0000-0000-0000000000f1',
  p_make text default 'Honda', p_color text default 'Blue', p_plate text default 'abc 123',
  p_cost text default null, p_notes text default null, p_confirm boolean default false
) returns uuid language sql as $$
  select post_trip(p_place, p_name, p_lat, p_lng, p_dep, p_back, p_seats, p_point, p_make, p_color, p_plate, p_cost, p_notes, p_confirm)
$$;
grant execute on function t_post to authenticated;

-- Who may call what ---------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'post_trip(text,text,double precision,double precision,timestamptz,timestamptz,integer,uuid,text,text,text,text,text,boolean)', 'execute'), 'signed-out visitors cannot post trips');
select ok(not has_function_privilege('anon', 'check_rate(text, int, interval)', 'execute'), 'or call the rate limiter');

-- The rate limiter ------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select lives_ok($$ select check_rate('probe', 2, interval '1 hour') $$, 'the first call is allowed');
select lives_ok($$ select check_rate('probe', 2, interval '1 hour') $$, 'the second call is allowed');
select throws_ok($$ select check_rate('probe', 2, interval '1 hour') $$, 'P0001', 'rate_limited', 'the third is refused');
select lives_ok($$ select check_rate('other-kind', 2, interval '1 hour') $$, 'a different kind has its own count');
reset role;
insert into rate_events (user_id, kind, at) select '00000000-0000-0000-0000-0000000000d1', 'aged', now() - interval '2 hours' from generate_series(1, 5);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select lives_ok($$ select check_rate('aged', 2, interval '1 hour') $$, 'events older than the window do not count');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000db';

select lives_ok($$ select check_rate('probe', 2, interval '1 hour') $$, 'each person has their own count');
reset role;
set local request.jwt.claim.sub = '';
set local role authenticated;
select throws_ok($$ select check_rate('probe', 2, interval '1 hour') $$, 'P0001', 'not_signed_in', 'the limiter needs a signed-in person');

-- Posting a valid trip ----------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select ok(t_post(p_dep => now() + interval '2 days', p_plate => ' abc 123 ') is not null, 'a valid trip posts and returns its id');
select is((select count(*) from trips where driver_id = '00000000-0000-0000-0000-0000000000d1'), 1::bigint, 'one trip was created');
select is((select destination_name from trips where driver_id = '00000000-0000-0000-0000-0000000000d1'), 'Trader Joe''s', 'the destination is copied from the curated place');
select is((select car_plate from trip_private where trip_id = (select id from trips where driver_id = '00000000-0000-0000-0000-0000000000d1')), 'ABC 123',
          'the plate is stored trimmed and upper-case, in the private table');
select is((select seats_taken from trips where driver_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'no seats are taken yet');
select is((select status::text from trips where driver_id = '00000000-0000-0000-0000-0000000000d1'), 'open', 'and the trip is open');

-- Destinations ------------------------------------------------------------------------------------------
select ok(t_post(p_place => null, p_name => 'Rancho Santa Ana Botanic Garden', p_lat => 34.1, p_lng => -117.7, p_dep => now() + interval '3 days') is not null,
          'an "Other" point of interest posts');
select is((select place_id from trips where destination_name = 'Rancho Santa Ana Botanic Garden'), null::text, 'with no curated place');
select throws_ok($$ select t_post(p_place => null, p_name => 'Somewhere', p_dep => now() + interval '4 days') $$, 'P0001', 'invalid_trip',
          'an "Other" destination needs coordinates');
select throws_ok($$ select t_post(p_place => null, p_name => 'New York', p_lat => 40.7, p_lng => -74.0, p_dep => now() + interval '4 days') $$,
          'P0001', 'invalid_trip', 'an "Other" destination outside Southern California is refused');
select throws_ok($$ select t_post(p_place => null, p_name => 'X', p_lat => 34.1, p_lng => -117.7, p_dep => now() + interval '4 days') $$,
          'P0001', 'invalid_trip', 'a one-letter destination name is refused');
select throws_ok($$ select t_post(p_place => 'zz-gone', p_dep => now() + interval '4 days') $$, 'P0001', 'invalid_trip', 'a retired place is refused');
select throws_ok($$ select t_post(p_place => 'no-such-place', p_dep => now() + interval '4 days') $$, 'P0001', 'invalid_trip', 'an unknown place is refused');

-- Times and seats ------------------------------------------------------------------------------------------
select throws_ok($$ select t_post(p_dep => now() - interval '1 minute') $$, 'P0001', 'time_in_past', 'a time in the past is refused');
select throws_ok($$ select t_post(p_dep => now() + interval '61 days') $$, 'P0001', 'trip_too_far', 'a trip more than 60 days out is refused');
select ok(t_post(p_dep => now() + interval '59 days') is not null, 'a trip 59 days out is fine');
select throws_ok($$ select t_post(p_dep => now() + interval '5 days', p_back => now() + interval '5 days') $$, 'P0001', 'invalid_trip',
          'back-by must be after departure');
select throws_ok($$ select t_post(p_dep => now() + interval '5 days', p_seats => 0) $$, 'P0001', 'invalid_trip', 'zero seats is refused');
select throws_ok($$ select t_post(p_dep => now() + interval '5 days', p_seats => 7) $$, 'P0001', 'invalid_trip', 'seven seats is refused');
select ok(t_post(p_dep => now() + interval '6 days', p_seats => 6) is not null, 'six seats is the maximum and is fine');

-- Meetup points: approved, and on the driver's campus or shared -------------------------------------------------
select throws_ok($$ select t_post(p_point => '00000000-0000-0000-0000-0000000000f4', p_dep => now() + interval '7 days') $$, 'P0001', 'meetup_not_allowed', 'a suspended point is refused');
select throws_ok($$ select t_post(p_point => '00000000-0000-0000-0000-0000000000f2', p_dep => now() + interval '7 days') $$, 'P0001', 'meetup_not_allowed',
          'another campus''s own point is refused');
select ok(t_post(p_point => '00000000-0000-0000-0000-0000000000f3', p_dep => now() + interval '7 days') is not null, 'a shared point on another campus is fine');
select throws_ok($$ select t_post(p_point => gen_random_uuid(), p_dep => now() + interval '8 days') $$, 'P0001', 'meetup_not_allowed',
          'a point that does not exist is refused');

-- Notes keep contact details out ----------------------------------------------------------------------------------
select throws_ok($$ select t_post(p_notes => 'text me 909-555-0123', p_dep => now() + interval '9 days') $$, 'P0001', 'contact_info', 'a phone number in notes is refused');
select throws_ok($$ select t_post(p_cost => 'venmo @maya_k', p_dep => now() + interval '9 days') $$, 'P0001', 'contact_info', 'a handle in the cost note is refused');
select throws_ok($$ select t_post(p_notes => 'me@hmc.edu', p_dep => now() + interval '9 days') $$, 'P0001', 'contact_info', 'an email is refused');
select throws_ok($$ select t_post(p_cost => '909-555', p_notes => '0123', p_dep => now() + interval '9 days') $$, 'P0001', 'contact_info',
          'a number split across the two note fields is still caught');
select throws_ok($$ select t_post(p_notes => repeat('x', 301), p_dep => now() + interval '9 days') $$, 'P0001', 'invalid_trip', 'a note over 300 characters is refused');
select throws_ok($$ select t_post(p_cost => repeat('x', 201), p_dep => now() + interval '9 days') $$, 'P0001', 'invalid_trip', 'a cost note over 200 characters is refused');
select ok(t_post(p_cost => 'Split gas and parking', p_notes => 'Back by 5, no big bags', p_dep => now() + interval '9 days') is not null, 'ordinary notes are fine');

-- The car ---------------------------------------------------------------------------------------------------------
select throws_ok($$ select t_post(p_plate => 'A', p_dep => now() + interval '10 days') $$, 'P0001', 'invalid_trip', 'a one-character plate is refused');
select throws_ok($$ select t_post(p_plate => 'ABCDEFGHIJK', p_dep => now() + interval '10 days') $$, 'P0001', 'invalid_trip', 'an 11-character plate is refused');
select throws_ok($$ select t_post(p_plate => 'AB<>12', p_dep => now() + interval '10 days') $$, 'P0001', 'invalid_trip', 'a plate with symbols is refused');
select ok(t_post(p_plate => 'a1', p_dep => now() + interval '10 days') is not null, 'a two-character plate is fine');
select throws_ok($$ select t_post(p_make => '  ', p_dep => now() + interval '11 days') $$, 'P0001', 'invalid_trip', 'a blank make is refused');
select throws_ok($$ select t_post(p_color => repeat('x', 41), p_dep => now() + interval '11 days') $$, 'P0001', 'invalid_trip', 'a 41-character color is refused');

-- (The earlier posts used up most of the daily limit; start the overlap checks fresh.)
reset role;
delete from rate_events where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'post_trip';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

-- Overlap: one place at a time ------------------------------------------------------------------------------------------
select ok(t_post(p_dep => now() + interval '20 days') is not null, 'a trip at day 20 posts');
select throws_ok($$ select t_post(p_dep => now() + interval '20 days' + interval '1 hour') $$, 'P0001', 'overlap', 'a trip an hour later overlaps (open-ended trips count as 2 hours)');
select ok(t_post(p_dep => now() + interval '20 days' + interval '1 hour', p_confirm => true) is not null, 'posting anyway works once confirmed');
select ok(t_post(p_dep => now() + interval '20 days' + interval '5 hours') is not null, 'a trip clear of both does not overlap');
select ok(t_post(p_dep => now() + interval '25 days', p_back => now() + interval '25 days' + interval '6 hours') is not null, 'a trip with a back-by posts');
select throws_ok($$ select t_post(p_dep => now() + interval '25 days' + interval '5 hours') $$, 'P0001', 'overlap', 'and the back-by window counts');
reset role;
update trips set status = 'cancelled' where departs_at between now() + interval '25 days' and now() + interval '26 days';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select ok(t_post(p_dep => now() + interval '25 days' + interval '5 hours') is not null, 'a cancelled trip no longer blocks the time');

-- Rate limit: 10 a day ------------------------------------------------------------------------------------------------------
reset role;
delete from rate_events where user_id = '00000000-0000-0000-0000-0000000000d1';
insert into rate_events (user_id, kind) select '00000000-0000-0000-0000-0000000000d1', 'post_trip' from generate_series(1, 10);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select throws_ok($$ select t_post(p_dep => now() + interval '30 days') $$, 'P0001', 'rate_limited', 'the eleventh trip in a day is refused');

-- Who may post ----------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d9';

select throws_ok($$ select t_post(p_dep => now() + interval '31 days') $$, 'P0001', 'account_suspended', 'a suspended person cannot post');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000da';

select throws_ok($$ select t_post(p_dep => now() + interval '31 days') $$, 'P0001', 'not_onboarded', 'someone who has not finished their profile cannot post');
reset role;
set local request.jwt.claim.sub = '';
set local role authenticated;
select throws_ok($$ select t_post(p_dep => now() + interval '31 days') $$, 'P0001', 'not_signed_in', 'nobody signed in cannot post');

-- Strangers see the trip but never the plate --------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000db';

select ok(exists (select 1 from board_trips where driver_id = '00000000-0000-0000-0000-0000000000d1'), 'a stranger sees the trip on the board');
select is((select count(*) from trip_private), 0::bigint, 'but not the plate');

-- Matching riders get an email, once -------------------------------------------------------------------------------------------------
reset role;
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d6');
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id, status) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d2',  'ont',          'ONT',    now() + interval '40 days' - interval '1 hour', now() + interval '40 days' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f3', 'open'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d3', 'lax',          'LAX',    now() + interval '40 days' - interval '1 hour', now() + interval '40 days' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f3', 'open'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d4', 'ont',          'ONT',    now() + interval '41 days',                      now() + interval '41 days' + interval '2 hours', 1, '00000000-0000-0000-0000-0000000000f3', 'open'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d5', 'ont',          'ONT',    now() + interval '40 days' - interval '1 hour', now() + interval '40 days' + interval '1 hour', 3, '00000000-0000-0000-0000-0000000000f3', 'open'),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000d6', 'ont',          'ONT',    now() + interval '40 days' - interval '1 hour', now() + interval '40 days' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f3', 'open'),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000d7', 'ont',          'ONT',    now() + interval '40 days' - interval '1 hour', now() + interval '40 days' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f3', 'matched'),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000d8', 'ont',          'ONT',    now() - interval '2 days',                       now() - interval '1 day',                         1, '00000000-0000-0000-0000-0000000000f3', 'open');
delete from rate_events where user_id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select ok(t_post(p_place => 'ont', p_seats => 2, p_dep => now() + interval '40 days') is not null, 'a trip to ONT posts');
reset role;
select is((select count(*) from email_outbox where template = 'match_for_rider'), 1::bigint,
          'exactly one rider is told: the others had another place, a later window, too many seats, a block, a closed request, or an expired window');
select is((select to_user_id from email_outbox where template = 'match_for_rider'), '00000000-0000-0000-0000-0000000000d2'::uuid, 'and it is the rider whose request fits');
select is((select dedupe_key like 'match_for_rider:00000000-0000-0000-0000-0000000000c1:%' from email_outbox where template = 'match_for_rider'), true,
          'with a key that stops duplicates');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select ok(t_post(p_place => null, p_name => 'Somewhere nice', p_lat => 34.1, p_lng => -117.7, p_dep => now() + interval '42 days') is not null,
          'a trip to an "Other" place posts');
reset role;
select is((select count(*) from email_outbox where template = 'match_for_rider'), 1::bigint, 'and tells no one, since matching is by curated place');

select * from finish();
rollback;
