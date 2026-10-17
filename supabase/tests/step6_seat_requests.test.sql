-- Step 6: seat requests, answers, cancellations, and trip management. BUILD.md 6.1 and 6.2.
-- Run with `supabase test db`. Everything rolls back.
-- (The two-sessions-at-once overbooking test is in supabase/tests/race/, since pgTAP is one session.)
begin;
select plan(96);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d01', 'dana@hmc.edu'), ('00000000-0000-0000-0000-000000000a01', 'r1@pomona.edu'), ('00000000-0000-0000-0000-000000000a02', 'r2@pomona.edu'), ('00000000-0000-0000-0000-000000000a03', 'r3@pomona.edu'),
  ('00000000-0000-0000-0000-000000000a04', 'r4@pomona.edu'), ('00000000-0000-0000-0000-000000000b01', 'stan@pomona.edu'), ('00000000-0000-0000-0000-000000000b02', 'blake@pomona.edu'), ('00000000-0000-0000-0000-000000000c01', 'sue@pomona.edu'),
  ('00000000-0000-0000-0000-000000000c02', 'new@pomona.edu'), ('00000000-0000-0000-0000-000000000e01', 'rl@pomona.edu');
update profiles set first_name = 'Person', onboarded_at = now() where id <> '00000000-0000-0000-0000-000000000c02';
update profiles set suspended_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-000000000c01';
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000b02');

-- Test-only point and coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ('00000000-0000-0000-0000-0000000000f1', 'hmc', 'Test point', 'hub', 0, 0, true);
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000000f1', 'Stand by the north door');

-- T1 main (2 seats). T2 one seat. T3 cancelled. T4 leaves in 10 minutes. T5 already left.
-- T6 cancel tests. T7 and T8 update tests (8 is the one 7 would collide with).
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '2 days', 2, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '3 days', 1, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '3 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'cancelled'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '10 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() - interval '1 hour', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '4 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '5 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '6 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open');
insert into trip_private (trip_id, car_plate) select id, 'PLATE' || right(id::text, 2) from trips where driver_id = '00000000-0000-0000-0000-000000000d01';

-- Request ids, looked up as the owner, for the tests where someone who cannot see a request names it anyway.
create table t_ids (k text primary key, id uuid);
grant select on t_ids to authenticated;

-- Who may call what -----------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'request_seat(uuid,integer,text)', 'execute'), 'signed-out visitors cannot request seats');
select ok(not has_function_privilege('anon', 'respond_seat_request(uuid,boolean)', 'execute'), 'or answer requests');
select ok(not has_function_privilege('anon', 'cancel_trip(uuid)', 'execute'), 'or cancel trips');

-- Asking for a seat ---------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, 'Just Trader Joe''s and back') $$, 'a rider can ask for a seat');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'already_requested', 'asking twice is refused');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text || '/' || seats || '/' || message from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'),
          'pending/1/Just Trader Joe''s and back', 'the request is saved as pending, with its message');
select is((select count(*) from email_outbox where template = 'seat_requested' and to_user_id = '00000000-0000-0000-0000-000000000d01'), 1::bigint, 'the driver is emailed once');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'own_trip', 'a driver cannot ask for a seat on their own trip');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000103', 1, null) $$, 'P0001', 'trip_unavailable', 'a cancelled trip is unavailable');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000104', 1, null) $$, 'P0001', 'trip_unavailable', 'a trip leaving within 30 minutes is unavailable');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000105', 1, null) $$, 'P0001', 'trip_unavailable', 'a trip that has left is unavailable');
select throws_ok($$ select request_seat(gen_random_uuid(), 1, null) $$, 'P0001', 'trip_unavailable', 'an unknown trip is unavailable');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 0, null) $$, 'P0001', 'invalid_request', 'zero seats is refused');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 4, null) $$, 'P0001', 'invalid_request', 'more than three seats is refused');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, repeat('x', 301)) $$, 'P0001', 'invalid_request', 'a message over 300 characters is refused');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, 'text 909-555-0123') $$, 'P0001', 'contact_info', 'a phone number in the message is refused');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000102', 2, null) $$, 'P0001', 'trip_full', 'asking for more seats than are left is refused');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b02';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'blocked', 'someone the driver blocked cannot ask');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c01';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'account_suspended', 'a suspended person cannot ask');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c02';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'not_onboarded', 'someone who has not finished their profile cannot ask');
reset role;
set local request.jwt.claim.sub = '';

insert into rate_events (user_id, kind) select '00000000-0000-0000-0000-000000000e01', 'request_seat' from generate_series(1, 20);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'rate_limited', 'the 21st request in a day is refused');

-- Before the driver accepts, nobody sees the plate or the exact spot ------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'a rider with a pending request cannot read the plate');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-000000000101')), null::text, 'or the exact meetup spot');
select is((select count(*) from meetup_point_details), 0::bigint, 'or the meetup details table');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'a stranger cannot read the plate');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-000000000101')), null::text, 'or the exact spot');

-- Answering ------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'a second rider asks');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'and a third (the trip has 2 seats, so only two can be accepted)');
reset role;
set local request.jwt.claim.sub = '';
insert into t_ids select '1-R1', id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';
select throws_ok($$ select respond_seat_request((select id from t_ids where k = '1-R1'), true) $$, 'P0001', 'forbidden', 'a rider cannot answer requests on a trip');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select respond_seat_request((select id from t_ids where k = '1-R1'), true) $$, 'P0001', 'forbidden', 'a stranger cannot answer requests');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), true) $$, 'the driver accepts the first rider');
reset role;
set local request.jwt.claim.sub = '';

select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000101'), 1, 'one seat is now taken');
select is((select status::text from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 'accepted', 'the request is accepted');
select is((select count(*) from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'and a conversation is open');
select is((select closes_at = (select departs_at + interval '24 hours' from trips where id = '00000000-0000-0000-0000-000000000101') from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'),
          true, 'which closes 24 hours after departure');
select is((select count(*) from email_outbox where template = 'seat_accepted' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'the rider is emailed');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), true) $$, 'P0001', 'not_pending', 'answering twice is refused');

-- After accepting: the accepted rider, and only that rider, sees the private details ------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select car_plate from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 'PLATE01', 'the accepted rider reads the plate');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-000000000101')), 'Stand by the north door', 'and the exact meetup spot');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'another rider with a pending request still cannot');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-000000000101')), null::text, 'nor get the exact spot');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'a stranger still cannot read the plate');

-- A full trip: the last seat goes to one rider only ---------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a02'), true) $$, 'the second rider is accepted, filling the trip');
select throws_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a03'), true) $$, 'P0001', 'trip_full', 'a third cannot be accepted');
select lives_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a03'), false) $$, 'but can be declined');
reset role;
set local request.jwt.claim.sub = '';

select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000101'), 2, 'two seats taken, never more');
select is((select count(*) from email_outbox where template = 'seat_declined' and to_user_id = '00000000-0000-0000-0000-000000000a03'), 1::bigint, 'the declined rider is emailed');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'P0001', 'trip_full', 'and a full trip takes no new requests');
select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'a declined rider never sees the plate');

-- Declined is final ------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a04';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000106', 1, null) $$, 'a rider asks for a seat on trip 6');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a04'), false) $$, 'and is declined');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a04';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000106', 1, null) $$, 'P0001', 'already_requested', 'a declined rider cannot ask again');
select throws_ok($$ select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a04')) $$, 'P0001', 'not_pending', 'and has nothing to cancel');

-- Accepting needs an open, upcoming trip ------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000a03', 1, 'pending');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000105' and rider_id = '00000000-0000-0000-0000-000000000a03'), true) $$, 'P0001', 'trip_unavailable', 'a request on a trip that has left cannot be accepted');

-- Cancelling a request -----------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000106', 2, 'first try') $$, 'a rider asks for two seats on trip 6');
select lives_ok($$ select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a01')) $$, 'and cancels while it is pending');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a01'), 'cancelled', 'the request is cancelled');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000106', 1, 'second try') $$, 'after cancelling they can ask again');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text || '/' || seats || '/' || message from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a01'),
          'pending/1/second try', 'the old request is revived as pending with the new details');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

reset role;
set local request.jwt.claim.sub = '';
insert into t_ids select '6-R1', id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a01';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';
select throws_ok($$ select cancel_seat_request((select id from t_ids where k = '6-R1')) $$, 'P0001', 'forbidden', 'only the rider can cancel their request');

-- Cancelling an accepted seat frees it ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')) $$, 'an accepted rider cancels');
reset role;
set local request.jwt.claim.sub = '';

select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000101'), 1, 'the seat goes back');
select is((select count(*) from email_outbox where template = 'rider_cancelled' and to_user_id = '00000000-0000-0000-0000-000000000d01'), 1::bigint, 'and the driver is emailed');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'the cancelled rider can no longer read the plate');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-000000000101')), null::text, 'or the exact spot');
reset role;
set local request.jwt.claim.sub = '';

insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000a04', 1, 'accepted');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a04';

select throws_ok($$ select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000105' and rider_id = '00000000-0000-0000-0000-000000000a04')) $$, 'P0001', 'trip_unavailable', 'an accepted seat cannot be cancelled after departure');

-- The Inbox badge counts what is waiting for the driver ----------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select is(inbox_count(), 1, 'one request is waiting: trip 6 from the first rider (the rest are answered or on trips that have left)');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is(inbox_count(), 0, 'a rider with no trips has nothing waiting');

-- Cancelling a trip -------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into seat_requests (trip_id, rider_id, seats, status, decided_at) values ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000a02', 1, 'accepted', now());
update trips set seats_taken = 1 where id = '00000000-0000-0000-0000-000000000106';
insert into ride_offers (request_id, driver_id, trip_id, status)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000106', 'pending' where false;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select cancel_trip('00000000-0000-0000-0000-000000000106') $$, 'P0001', 'forbidden', 'only the driver can cancel a trip');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select cancel_trip('00000000-0000-0000-0000-000000000106') $$, 'the driver cancels trip 6');
select lives_ok($$ select cancel_trip('00000000-0000-0000-0000-000000000106') $$, 'cancelling again changes nothing');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from trips where id = '00000000-0000-0000-0000-000000000106'), 'cancelled', 'the trip is cancelled');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and status in ('pending', 'accepted')), 0::bigint, 'no request is left pending or accepted');
select is((select count(*) from email_outbox where template = 'trip_cancelled' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000106'), 2::bigint,
          'each rider is emailed exactly once, even after a second cancel');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select is((select count(*) from trip_cards where id = '00000000-0000-0000-0000-000000000106'), 1::bigint, 'a rider who had a seat still sees the trip, now cancelled');
select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-000000000106'), 0::bigint, 'but not its plate');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select is((select count(*) from trip_cards where id = '00000000-0000-0000-0000-000000000106'), 0::bigint, 'a stranger does not see a cancelled trip');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select is((select count(*) from trip_cards where id = '00000000-0000-0000-0000-000000000106'), 1::bigint, 'the driver sees their cancelled trip');
select throws_ok($$ select cancel_trip('00000000-0000-0000-0000-000000000105') $$, 'P0001', 'trip_unavailable', 'a trip that has left cannot be cancelled');
select throws_ok($$ select cancel_trip(gen_random_uuid()) $$, 'P0001', 'not_found', 'an unknown trip is not found');
select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000106', 1, null) $$, 'P0001', 'own_trip', 'sanity: the driver still cannot request their own cancelled trip');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000106', 1, null) $$, 'P0001', 'trip_unavailable', 'and nobody can ask for a seat on it');

-- Editing a trip ---------------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into seat_requests (trip_id, rider_id, seats, status, decided_at) values
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000a01', 2, 'accepted', now()), ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000a02', 1, 'pending', null);
update trips set seats_taken = 2 where id = '00000000-0000-0000-0000-000000000107';
insert into conversations (trip_id, driver_id, rider_id, closes_at)
  select '00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a01', departs_at + interval '24 hours' from trips where id = '00000000-0000-0000-0000-000000000107';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '5 days', null, 3, null, null) $$, 'P0001', 'forbidden', 'only the driver can edit');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '5 days', null, 1, null, null) $$, 'P0001', 'seats_below_taken', 'seats cannot go below the seats already taken');
select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() - interval '1 hour', null, 3, null, null) $$, 'P0001', 'time_in_past', 'a time in the past is refused');
select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '5 days', now() + interval '5 days', 3, null, null) $$, 'P0001', 'invalid_trip', 'back-by must be after departure');
select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '5 days', null, 3, null, 'call 909-555-0123') $$, 'P0001', 'contact_info', 'contact details are refused');
select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '6 days' + interval '1 hour', null, 3, null, null) $$, 'P0001', 'overlap', 'moving onto another of the driver''s trips is an overlap');
select lives_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '5 days', null, 3, 'Split gas', 'Updated note') $$, 'a note-only edit works and does not email riders');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from email_outbox where template = 'trip_time_changed'), 0::bigint, 'no time change, no email');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '5 days' + interval '3 hours', null, 4, 'Split gas', 'Updated note') $$, 'changing the time and seats works');
reset role;
set local request.jwt.claim.sub = '';

select is((select seats_total from trips where id = '00000000-0000-0000-0000-000000000107'), 4, 'seats were updated');
select is((select count(*) from email_outbox where template = 'trip_time_changed' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000107'), 2::bigint,
          'both the accepted and the pending rider are told about the new time');
select is((select closes_at = (select departs_at + interval '24 hours' from trips where id = '00000000-0000-0000-0000-000000000107') from conversations where trip_id = '00000000-0000-0000-0000-000000000107'),
          true, 'and the chat closes 24 hours after the new time');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select update_trip('00000000-0000-0000-0000-000000000107', now() + interval '6 days' + interval '1 hour', null, 4, null, null, true) $$, 'an overlap can be confirmed');
select throws_ok($$ select update_trip('00000000-0000-0000-0000-000000000103', now() + interval '3 days', null, 3, null, null) $$, 'P0001', 'trip_unavailable', 'a cancelled trip cannot be edited');

select * from finish();
rollback;
