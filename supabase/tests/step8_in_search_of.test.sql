-- Step 8: "In search of". Requests, offers, matching, and the all-or-nothing accept. BUILD.md 6.1 and 6.3.
-- Run with `supabase test db`. Everything rolls back. (Races between sessions: supabase/tests/race/offers.mjs.)
begin;
select plan(134);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d01', 'dana@hmc.edu'), ('00000000-0000-0000-0000-000000000d02', 'drew@hmc.edu'), ('00000000-0000-0000-0000-000000000a01', 'rae@pomona.edu'), ('00000000-0000-0000-0000-000000000a02', 'r2@pomona.edu'), ('00000000-0000-0000-0000-000000000a03', 'r3@pomona.edu'),
  ('00000000-0000-0000-0000-000000000a04', 'r4@pomona.edu'), ('00000000-0000-0000-0000-000000000b01', 'stan@pomona.edu'), ('00000000-0000-0000-0000-000000000b02', 'blake@pomona.edu'), ('00000000-0000-0000-0000-000000000c01', 'sue@pomona.edu'),
  ('00000000-0000-0000-0000-000000000c02', 'new@pomona.edu'), ('00000000-0000-0000-0000-000000000e01', 'rl@pomona.edu');
update profiles set first_name = 'Person', onboarded_at = now() where id <> '00000000-0000-0000-0000-000000000c02';
update profiles set first_name = case id when '00000000-0000-0000-0000-000000000d01' then 'Dana' when '00000000-0000-0000-0000-000000000d02' then 'Drew' when '00000000-0000-0000-0000-000000000a01' then 'Rae' else first_name end;
update profiles set suspended_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-000000000c01';

-- Test-only points and coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, shared, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'hmc', 'Shared point', 'hub', 0, 0, true, 'approved'),
  ('00000000-0000-0000-0000-0000000000f2', 'hmc', 'HMC-only point', 'hub', 0, 0, false, 'approved'),
  ('00000000-0000-0000-0000-0000000000f3', 'hmc', 'Suspended point', 'hub', 0, 0, true, 'suspended');
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000000f1', 'Stand by the north door');

-- Trips. T1 and T5 fit a request around WHEN. T2 is too late. T3 is another place. T4 is full. T6 has two seats.
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, seats_taken, meetup_point_id, car_make, car_color) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000d01',  'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '30 minutes', 3, 0, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000d01',  'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '5 hours',    3, 0, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000d01',  'ont',          'ONT',           now() + interval '1 day' + interval '30 minutes', 3, 0, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000d01',  'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '20 minutes', 1, 1, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000d02', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '10 minutes', 3, 0, '00000000-0000-0000-0000-0000000000f1', 'Mazda', 'Red'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000d01',  'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '40 minutes', 2, 0, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000d01',  null,           'Ontario Mills', now() + interval '1 day' + interval '30 minutes', 3, 0, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue');
insert into trip_private (trip_id, car_plate)
  select id, 'PLATE' || right(id::text, 2) from trips where driver_id in ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d02');
insert into places (id, name, category, address, chip, active) values ('zz-gone', 'Retired place', 'test', 'nowhere', 'Other', false);

-- Who may call what ---------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'post_ride_request(text,text,double precision,double precision,timestamptz,flexibility_kind,integer,uuid,boolean,text)', 'execute'), 'signed-out visitors cannot post requests');
select ok(not has_function_privilege('anon', 'respond_offer(uuid,boolean)', 'execute'), 'or answer offers');
select ok(not has_function_privilege('authenticated', 'matching_nudges()', 'execute'), 'the matching job is not callable from the browser');

-- Asking for a ride ------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, 'Just a few bags') $$, 'a rider asks for a ride');
reset role;
set local request.jwt.claim.sub = '';

select is((select window_start = now() + interval '1 day' - interval '60 minutes' and window_end = now() + interval '1 day' + interval '60 minutes' from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01'),
          true, 'plus or minus 1 hour makes a two-hour window around the time');
select is((select destination_name || '/' || seats || '/' || chip_in || '/' || status || '/' || note from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01'),
          'Trader Joe''s/1/true/open/Just a few bags', 'and saves the rest');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'exact', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'an exact request');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';

select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm30', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'a plus or minus 30 minute request');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a04';

select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'anytime', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'an any-time-that-day request');
reset role;
set local request.jwt.claim.sub = '';

select is((select window_end - window_start from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02'), interval '10 minutes', '"Exactly" is a 10-minute window');
select is((select window_end - window_start from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a03'), interval '60 minutes', 'plus or minus 30 minutes is a one-hour window');
select ok((select window_start <= now() + interval '1 day' and window_end > now() + interval '1 day' and window_end - window_start between interval '23 hours' and interval '25 hours'
                  and (window_start at time zone 'America/Los_Angeles')::time = '00:00' from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a04'),
          '"Any time" covers the whole Los Angeles day');

-- The rules on requests -------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';

select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() - interval '1 minute', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'time_in_past', 'a time in the past is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '8 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'too_far_ahead', 'more than 7 days ahead is refused');
select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '6 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, '6 days ahead is fine');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 0, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'invalid_request', 'zero seats is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 4, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'invalid_request', 'four seats is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', null, 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'invalid_request', 'a missing flexibility is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f3', true, null) $$, 'P0001', 'meetup_not_allowed', 'a suspended meetup point is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f2', true, null) $$, 'P0001', 'meetup_not_allowed', 'another campus''s own point is refused');
select throws_ok($$ select post_ride_request('zz-gone', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'invalid_request', 'a retired place is refused');
select throws_ok($$ select post_ride_request(null, 'Somewhere', null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'invalid_request', 'an "Other" place needs coordinates');
select throws_ok($$ select post_ride_request(null, 'New York', 40.7, -74.0, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'invalid_request', 'an "Other" place outside Southern California is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, 'text me 909-555-0123') $$, 'P0001', 'contact_info', 'a phone number in the note is refused');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, repeat('x', 201)) $$, 'P0001', 'invalid_request', 'a note over 200 characters is refused');
select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '5 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'a second open request is fine');
select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '2 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'too_many_requests', 'a third open request is refused (this person already has two)');
reset role;
set local request.jwt.claim.sub = '';

update ride_requests set status = 'cancelled' where rider_id = '00000000-0000-0000-0000-000000000e01' and window_start > now() + interval '4 days';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';

select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '2 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'a cancelled request no longer counts toward the two');
reset role;
set local request.jwt.claim.sub = '';

update ride_requests set window_start = now() - interval '3 hours', window_end = now() - interval '2 hours' where rider_id = '00000000-0000-0000-0000-000000000e01';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';

select lives_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '3 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'nor does one whose time has passed');
reset role;
set local request.jwt.claim.sub = '';

delete from rate_events where user_id = '00000000-0000-0000-0000-000000000e01';
insert into rate_events (user_id, kind) select '00000000-0000-0000-0000-000000000e01', 'post_ride_request' from generate_series(1, 5);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';

select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '3 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'rate_limited', 'the sixth request in a day is refused');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c01';

select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '3 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'account_suspended', 'a suspended person cannot ask');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c02';

select throws_ok($$ select post_ride_request('tj-claremont', null, null, null, now() + interval '3 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'not_onboarded', 'someone who has not finished their profile cannot ask');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select lives_ok($$ select post_ride_request(null, 'Ontario Mills', 34.07, -117.55, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'an "Other" destination from a verified point of interest is fine');

-- Editing, extending, cancelling a request (no offers yet) ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select update_ride_request((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), now() + interval '1 day' + interval '1 hour', 'exact', 2, false, 'Updated note') $$, 'the rider edits their request');
reset role;
set local request.jwt.claim.sub = '';

select is((select flexibility::text || '/' || seats || '/' || chip_in || '/' || note || '/' || (window_start = now() + interval '1 day' + interval '1 hour') from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01'),
          'exact/2/false/Updated note/true', 'the changes and the new window are saved');
update ride_requests set window_start = now() + interval '1 day' - interval '60 minutes', window_end = now() + interval '1 day' + interval '60 minutes', flexibility = 'pm60', seats = 1, chip_in = true where rider_id = '00000000-0000-0000-0000-000000000a01';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select update_ride_request((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), now() + interval '1 day', 'pm60', 1, true, null) $$, 'P0001', 'forbidden', 'someone else cannot edit a request');
reset role;
set local request.jwt.claim.sub = '';

create table t_ids (k text primary key, id uuid);
grant select on t_ids to authenticated;
insert into t_ids values ('RQ', (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), ('RQ2', (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'tj-claremont' order by created_at desc limit 1)), ('RQ3', (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a03' and place_id = 'tj-claremont' order by created_at desc limit 1));
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select update_ride_request((select id from t_ids where k = 'RQ'), now() + interval '1 day', 'pm60', 1, true, null) $$, 'P0001', 'forbidden', 'only the rider can edit a request');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select update_ride_request((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), now() - interval '1 hour', 'pm60', 1, true, null) $$, 'P0001', 'time_in_past', 'an edit to a past time is refused');
select throws_ok($$ select update_ride_request((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), now() + interval '1 day', 'pm60', 1, true, 'me@hmc.edu') $$, 'P0001', 'contact_info', 'an edit with contact details is refused');
select lives_ok($$ select extend_ride_request((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)) $$, 'the rider extends the request');
reset role;
set local request.jwt.claim.sub = '';

select is((select window_end from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01'), now() + interval '1 day' + interval '3 hours', 'by two hours');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select extend_ride_request((select id from t_ids where k = 'RQ')) $$, 'P0001', 'forbidden', 'only the rider can extend');
reset role;
set local request.jwt.claim.sub = '';

update ride_requests set window_end = now() + interval '1 day' + interval '60 minutes' where rider_id = '00000000-0000-0000-0000-000000000a01';

-- Offering a trip ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', 'Happy to take you') $$, 'a driver offers a trip that fits');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from email_outbox where template = 'offer_received' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'the rider is emailed once');
insert into t_ids select 'OFD1', id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000101' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'already_offered', 'offering the same trip twice is refused');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000102', null) $$, 'P0001', 'trip_mismatch', 'a trip outside the time window does not match');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000103', null) $$, 'P0001', 'trip_mismatch', 'a trip to another place does not match');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000104', null) $$, 'P0001', 'trip_mismatch', 'a full trip does not match');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000105', null) $$, 'P0001', 'forbidden', 'a driver cannot offer someone else''s trip');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', 'call 909-555-0123') $$, 'P0001', 'contact_info', 'contact details in the message are refused');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', repeat('x', 301)) $$, 'P0001', 'invalid_request', 'a message over 300 characters is refused');
select throws_ok($$ select send_offer(gen_random_uuid(), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'not_found', 'an unknown request is not found');
select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), gen_random_uuid(), null) $$, 'P0001', 'trip_mismatch', 'an unknown trip does not match');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'forbidden', 'a rider cannot offer on their own request (or someone else''s trip)');
reset role;
set local request.jwt.claim.sub = '';

update trips set seats_total = 2 where id = '00000000-0000-0000-0000-000000000101';
update ride_requests set seats = 3 where rider_id = '00000000-0000-0000-0000-000000000a03';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a03' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'trip_mismatch', 'a trip without enough seats for the request does not match');
reset role;
set local request.jwt.claim.sub = '';

update trips set seats_total = 3 where id = '00000000-0000-0000-0000-000000000101';
update ride_requests set seats = 1 where rider_id = '00000000-0000-0000-0000-000000000a03';
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a03');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select send_offer((select id from t_ids where k = 'RQ3'), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'blocked', 'a blocked rider''s request cannot be answered');
reset role;
set local request.jwt.claim.sub = '';

delete from blocks;
update trips set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000106';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a03' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000106', null) $$, 'P0001', 'trip_mismatch', 'a cancelled trip does not match');
reset role;
set local request.jwt.claim.sub = '';

update trips set status = 'open' where id = '00000000-0000-0000-0000-000000000106';
update ride_requests set status = 'cancelled' where rider_id = '00000000-0000-0000-0000-000000000a03';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select send_offer((select id from t_ids where k = 'RQ3'), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'not_open', 'a cancelled request takes no offers');
reset role;
set local request.jwt.claim.sub = '';

update ride_requests set status = 'open' where rider_id = '00000000-0000-0000-0000-000000000a03';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c01';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000101', null) $$, 'P0001', 'account_suspended', 'a suspended driver cannot offer');
reset role;
set local request.jwt.claim.sub = '';

insert into rate_events (user_id, kind) select '00000000-0000-0000-0000-000000000d02', 'send_offer' from generate_series(1, 30);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000105', null) $$, 'P0001', 'rate_limited', 'the 31st offer in a day is refused');
reset role;
set local request.jwt.claim.sub = '';

delete from rate_events where user_id = '00000000-0000-0000-0000-000000000d02';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select lives_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000105', null) $$, 'a second driver offers on the same request');

-- Ten pending offers is the most --------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000a04', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1' from generate_series(1, 10);
insert into trips (driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color)
  select '00000000-0000-0000-0000-000000000d02', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '15 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Mazda', 'Red' from generate_series(1, 10);
insert into ride_offers (request_id, driver_id, trip_id)
  select r.id, '00000000-0000-0000-0000-000000000d02', t.id from (select id, row_number() over () n from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a04' and place_id = 'tj-claremont') r
  join (select id, row_number() over () n from trips where driver_id = '00000000-0000-0000-0000-000000000d02' and departs_at = now() + interval '1 day' + interval '15 minutes') t on t.n = r.n;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select throws_ok($$ select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000105', null) $$, 'P0001', 'too_many_offers', 'an eleventh pending offer is refused');
reset role;
set local request.jwt.claim.sub = '';

delete from ride_offers where driver_id = '00000000-0000-0000-0000-000000000d02' and request_id in (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a04');
delete from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a04' and place_id = 'tj-claremont';
delete from trips where driver_id = '00000000-0000-0000-0000-000000000d02' and departs_at = now() + interval '1 day' + interval '15 minutes';
insert into ride_requests (rider_id, place_id, destination_name, window_start, window_end, flexibility, seats, meetup_point_id)
  values ('00000000-0000-0000-0000-000000000a04', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '12 hours', now() + interval '1 day' + interval '12 hours', 'anytime', 1, '00000000-0000-0000-0000-0000000000f1');

-- Withdrawing an offer ----------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select lives_ok($$ select withdraw_offer((select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000105' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1))) $$, 'the driver withdraws their offer');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from ride_offers where trip_id = '00000000-0000-0000-0000-000000000105' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), 'withdrawn', 'it is marked withdrawn');
select is((select count(*) from email_outbox where template = 'offer_withdrawn' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'and the rider is told');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select throws_ok($$ select withdraw_offer((select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000105' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1))) $$, 'P0001', 'no_longer_available', 'withdrawing twice is refused');
select throws_ok($$ select withdraw_offer((select id from t_ids where k = 'OFD1')) $$, 'P0001', 'forbidden', 'only the offering driver can withdraw');
reset role;
set local request.jwt.claim.sub = '';

update ride_offers set status = 'pending' where trip_id = '00000000-0000-0000-0000-000000000105' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1);
delete from email_outbox where template in ('offer_withdrawn', 'offer_received');

-- Who can see offers -------------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select is((select count(*) from ride_offers), 0::bigint, 'a stranger sees no offers');
select is((select count(*) from offer_cards), 0::bigint, 'or offer cards');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select is((select count(*) from ride_offers), 1::bigint, 'a driver sees only their own offers');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select count(*) from offer_cards where request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), 2::bigint, 'the rider sees the offers on their request');
select ok(not exists (select 1 from information_schema.columns where table_name = 'offer_cards' and column_name in ('car_plate', 'stand_at')),
          'offer cards carry no plate or exact spot');
select is((select count(*) from trip_private), 0::bigint, 'and the rider cannot read a plate yet');
select throws_ok($$ insert into ride_offers (request_id, driver_id, trip_id) values ((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000101') $$, '42501', null, 'the browser cannot insert offers');
select throws_ok($$ insert into ride_requests (rider_id, destination_name, window_start, window_end, meetup_point_id) values ('00000000-0000-0000-0000-000000000a01', 'x', now(), now() + interval '1 hour', '00000000-0000-0000-0000-0000000000f1') $$, '42501', null, 'or requests');
select is(inbox_count(), 2, 'the Inbox badge counts the two offers waiting');

-- Accepting an offer: everything happens together --------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select respond_offer((select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000101' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), true) $$, 'P0001', 'forbidden', 'the offering driver cannot accept their own offer');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

reset role;
set local request.jwt.claim.sub = '';

insert into t_ids values ('OF1', (select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000101' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1))), ('OF2', (select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000105' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)));
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select respond_offer((select id from t_ids where k = 'OF1'), true) $$, 'P0001', 'forbidden', 'a stranger cannot answer an offer');
reset role;
set local request.jwt.claim.sub = '';

delete from email_outbox;
-- Prove all-or-nothing: make the last step (the chat message) fail and check nothing was kept.
create function t_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
create trigger t_boom_trigger before insert on messages for each row when (new.kind = 'system') execute function t_boom();
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select respond_offer((select id from t_ids where k = 'OF1'), true) $$, 'P0001', 'boom', 'a failure partway through the accept raises the error');
reset role;
set local request.jwt.claim.sub = '';

select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000101'), 0, 'nothing kept: no seat was taken');
select is((select status::text from ride_requests where id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), 'open', 'the request is still open');
select is((select string_agg(status::text, ',' order by status::text) from ride_offers where request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), 'pending,pending', 'both offers are still pending');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 0::bigint, 'no seat request was written');
select is((select count(*) from conversations where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'no chat was opened');
select is((select count(*) from email_outbox), 0::bigint, 'and no email was queued');
drop trigger t_boom_trigger on messages;
drop function t_boom();

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select respond_offer((select id from t_ids where k = 'OF1'), true) $$, 'the rider accepts the first driver''s offer');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 'accepted', 'the seat is reserved');
select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000101'), 1, 'one seat is taken');
select is((select status::text || '/' || (matched_trip_id = '00000000-0000-0000-0000-000000000101') from ride_requests where id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)), 'matched/true', 'the request is matched to the trip');
select is((select status::text from ride_offers where id = (select id from t_ids where k = 'OF1')), 'accepted', 'the offer is accepted');
select is((select status::text from ride_offers where id = (select id from t_ids where k = 'OF2')), 'closed', 'the other driver''s offer is closed');
select is((select count(*) from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'a chat is open');
select is((select body from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')),
          'Rae accepted Dana''s offer. You can plan the pickup here.', 'with a system message');
select is((select count(*) from email_outbox where template = 'offer_accepted' and to_user_id = '00000000-0000-0000-0000-000000000d01'), 1::bigint, 'the accepted driver is emailed');
select is((select count(*) from email_outbox where template = 'offer_closed' and to_user_id = '00000000-0000-0000-0000-000000000d02'), 1::bigint, 'the other driver is told the rider chose another ride');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select car_plate from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 'PLATE01', 'the rider can now read the plate');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-000000000101')), 'Stand by the north door', 'and the exact meetup spot');
select throws_ok($$ select respond_offer((select id from t_ids where k = 'OF1'), true) $$, 'P0001', 'no_longer_available', 'accepting twice is refused');
select throws_ok($$ select respond_offer((select id from t_ids where k = 'OF2'), true) $$, 'P0001', 'no_longer_available', 'a closed offer cannot be accepted');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'a stranger still cannot read the plate');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select is(inbox_count(), 0, 'sanity: the other driver has nothing waiting');

-- Declining ---------------------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id)
  values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-000000000a02', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1')
  on conflict do nothing;
update ride_requests set status = 'cancelled' where rider_id = '00000000-0000-0000-0000-000000000a02' and id <> '00000000-0000-0000-0000-0000000c0001' and place_id = 'tj-claremont';
insert into ride_offers (id, request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000106');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select lives_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0001', false) $$, 'a rider declines an offer');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from ride_offers where id = '00000000-0000-0000-0000-0000000f0001'), 'declined', 'it is declined');
select is((select status::text from ride_requests where id = '00000000-0000-0000-0000-0000000c0001'), 'open', 'the request stays open');
select is((select count(*) from email_outbox where template = 'offer_declined' and to_user_id = '00000000-0000-0000-0000-000000000d01'), 1::bigint, 'and the driver is told');
select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000106'), 0, 'no seat was taken');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0001', true) $$, 'P0001', 'no_longer_available', 'a declined offer cannot be accepted');

-- When the offer is no longer good --------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

update ride_offers set status = 'pending' where id = '00000000-0000-0000-0000-0000000f0001';
update trips set seats_taken = 2 where id = '00000000-0000-0000-0000-000000000106';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0001', true) $$, 'P0001', 'no_longer_available', 'a trip that filled up in the meantime is refused');
reset role;
set local request.jwt.claim.sub = '';

update trips set seats_taken = 0 where id = '00000000-0000-0000-0000-000000000106';
update trips set departs_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-000000000106';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0001', true) $$, 'P0001', 'no_longer_available', 'a trip that has left is refused');
reset role;
set local request.jwt.claim.sub = '';

update trips set departs_at = now() + interval '1 day' + interval '40 minutes' where id = '00000000-0000-0000-0000-000000000106';
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a02');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0001', true) $$, 'P0001', 'blocked', 'a driver who blocked the rider since cannot be accepted');
reset role;
set local request.jwt.claim.sub = '';

delete from blocks;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select cancel_trip('00000000-0000-0000-0000-000000000106') $$, 'the driver cancels the trip');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from ride_offers where id = '00000000-0000-0000-0000-0000000f0001'), 'closed', 'cancelling the trip closes the offer on it');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0001', true) $$, 'P0001', 'no_longer_available', 'so it cannot be accepted');

-- A seat the rider already asked for is upgraded, not duplicated ---------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id)
  values ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-000000000a03', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1');
update ride_requests set status = 'cancelled' where rider_id = '00000000-0000-0000-0000-000000000a03' and id <> '00000000-0000-0000-0000-0000000c0002';
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000a03', 1, 'declined');
insert into ride_offers (id, request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-0000000f0002', '00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000105');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';

select lives_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0002', true) $$, 'accepting works when the rider had asked for that trip''s seat before and been declined');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) || '/' || max(status::text) from seat_requests where trip_id = '00000000-0000-0000-0000-000000000105' and rider_id = '00000000-0000-0000-0000-000000000a03'), '1/accepted', 'still one seat request, now accepted');
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id)
  values ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-000000000a03', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1');
insert into ride_offers (id, request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-0000000f0003', '00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000105') on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';

select throws_ok($$ select respond_offer('00000000-0000-0000-0000-0000000f0003', true) $$, 'P0001', 'no_longer_available', 'a rider who already has a seat on that trip cannot be given a second');

-- Cancelling a request with offers waiting --------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from email_outbox;
update ride_requests set status = 'cancelled' where rider_id = '00000000-0000-0000-0000-000000000a04';
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id)
  values ('00000000-0000-0000-0000-0000000c0004', '00000000-0000-0000-0000-000000000a04', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1');
insert into ride_offers (id, request_id, driver_id, trip_id) values
  ('00000000-0000-0000-0000-0000000f0004', '00000000-0000-0000-0000-0000000c0004', '00000000-0000-0000-0000-000000000d01',  '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-0000000f0005', '00000000-0000-0000-0000-0000000c0004', '00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000105');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a04';

select lives_ok($$ select cancel_ride_request('00000000-0000-0000-0000-0000000c0004') $$, 'the rider cancels a request that has offers');
select lives_ok($$ select cancel_ride_request('00000000-0000-0000-0000-0000000c0004') $$, 'cancelling again changes nothing');
reset role;
set local request.jwt.claim.sub = '';

select is((select string_agg(status::text, ',') from ride_offers where request_id = '00000000-0000-0000-0000-0000000c0004'), 'closed,closed', 'both offers are closed');
select is((select count(*) from email_outbox where template = 'offer_closed'), 2::bigint, 'each driver is told once');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a04';

select throws_ok($$ select extend_ride_request('00000000-0000-0000-0000-0000000c0004') $$, 'P0001', 'not_open', 'a cancelled request cannot be extended');
select throws_ok($$ select update_ride_request('00000000-0000-0000-0000-0000000c0004', now() + interval '1 day', 'pm60', 1, true, null) $$, 'P0001', 'not_open', 'or edited');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select cancel_ride_request((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'tj-claremont' order by created_at desc limit 1)) $$, 'P0001', 'not_open', 'a matched request cannot be cancelled');

-- Matching drivers to requests (the cron job) -----------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from email_outbox;
delete from ride_offers;
update ride_requests set status = 'cancelled';
update trips set status = 'open', seats_taken = 0, departs_at = now() + interval '1 day' + interval '30 minutes' where id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000105');
update trips set seats_taken = 0 where id = '00000000-0000-0000-0000-000000000104';
update trips set seats_taken = 1 where id = '00000000-0000-0000-0000-000000000104';
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id) values
  ('00000000-0000-0000-0000-0000000c0010', '00000000-0000-0000-0000-000000000a02', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000c0011', '00000000-0000-0000-0000-000000000d01',  'tj-claremont', 'Trader Joe''s', now() + interval '1 day' - interval '1 hour', now() + interval '1 day' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1');
select matching_nudges();
select is((select count(*) from email_outbox where template = 'match_for_driver' and to_user_id = '00000000-0000-0000-0000-000000000d01' and payload ->> 'request_id' = '00000000-0000-0000-0000-0000000c0010'
           and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000101'), 1::bigint, 'a driver is told about a request their trip fits');
select is((select count(*) from email_outbox where template = 'match_for_driver' and to_user_id = '00000000-0000-0000-0000-000000000d02' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000105' and payload ->> 'request_id' = '00000000-0000-0000-0000-0000000c0010'), 1::bigint, 'as is another driver');
select is((select count(*) from email_outbox where template = 'match_for_driver' and payload ->> 'trip_id' in ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000104')), 0::bigint,
          'but not for a trip that is too late, to another place, or full');
select is((select count(*) from email_outbox where template = 'match_for_driver' and payload ->> 'request_id' = '00000000-0000-0000-0000-0000000c0011' and to_user_id = '00000000-0000-0000-0000-000000000d01'), 0::bigint,
          'and a driver is not told about their own request');
select matching_nudges();
select is((select count(*) from email_outbox where template = 'match_for_driver' and payload ->> 'request_id' = '00000000-0000-0000-0000-0000000c0010'), 2::bigint, 'running it again adds nothing');
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000a02');
delete from email_outbox;
select matching_nudges();
select is((select count(*) from email_outbox where to_user_id = '00000000-0000-0000-0000-000000000d02' and payload ->> 'request_id' = '00000000-0000-0000-0000-0000000c0010'), 0::bigint, 'a driver who blocked the rider is not told');
delete from blocks;
insert into ride_offers (request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-0000000c0010', '00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000105');
delete from email_outbox;
select matching_nudges();
select is((select count(*) from email_outbox where to_user_id = '00000000-0000-0000-0000-000000000d02' and payload ->> 'request_id' = '00000000-0000-0000-0000-0000000c0010'), 0::bigint, 'nor one who has already offered');

-- Posting a trip to answer a request ---------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select link_trip_to_request('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000c0010') $$, 'a driver links a new trip to the request it answers');
reset role;
set local request.jwt.claim.sub = '';

select is((select from_request_id from trips where id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-0000000c0010'::uuid, 'the link is saved');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select throws_ok($$ select link_trip_to_request('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000c0010') $$, 'P0001', 'forbidden', 'only the trip''s driver can link it');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select link_trip_to_request('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000c0011') $$, 'P0001', 'not_open', 'a driver''s own request does not count');

select * from finish();
rollback;
