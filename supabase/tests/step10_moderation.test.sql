-- Step 10: reports, no-shows, blocks, suspension, account removal, the admin tools, and the audit log.
-- Run with `supabase test db`. Everything rolls back.
begin;
select plan(147);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000f01', 'xan@hmc.edu'), ('00000000-0000-0000-0000-000000000d01', 'dana@hmc.edu'), ('00000000-0000-0000-0000-000000000a01', 'rae@pomona.edu'), ('00000000-0000-0000-0000-000000000a02', 'rob@pomona.edu'),
  ('00000000-0000-0000-0000-000000000b01', 'stan@pomona.edu'), ('00000000-0000-0000-0000-000000000a09', 'vic@pomona.edu'), ('00000000-0000-0000-0000-000000000c01', 'sue@pomona.edu');
update profiles set onboarded_at = now(), last_name = 'Lastname', first_name = 'Person';
update profiles set first_name = case id when '00000000-0000-0000-0000-000000000f01' then 'Xan' when '00000000-0000-0000-0000-000000000d01' then 'Dana' when '00000000-0000-0000-0000-000000000a01' then 'Rae' when '00000000-0000-0000-0000-000000000a02' then 'Rob' when '00000000-0000-0000-0000-000000000a09' then 'Vic' else first_name end;
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000f01';

-- Test-only point and coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ('00000000-0000-0000-0000-0000000000f1', 'hmc', 'Test point', 'hub', 34.1, -117.7, true);
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000000f1', 'Stand by the north door');

-- T1: D's trip tomorrow, R accepted, R2 pending. T2: D's trip that left 3 hours ago, R accepted. T3: D's future trip, R has a pending seat.
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, seats_taken, meetup_point_id, car_make, car_color) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day', 3, 1, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000d01', 'ont', 'ONT', now() - interval '3 hours', 3, 1, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000d01', 'lax', 'LAX', now() + interval '3 days', 3, 0, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue');
insert into trip_private (trip_id, car_plate) values ('00000000-0000-0000-0000-000000000101', 'PLATE1'), ('00000000-0000-0000-0000-000000000102', 'PLATE2'), ('00000000-0000-0000-0000-000000000103', 'PLATE3');
insert into seat_requests (trip_id, rider_id, seats, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000a01', 1, 'accepted'), ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000a02', 1, 'pending'), ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000a01', 1, 'accepted'), ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000a01', 1, 'pending');
insert into conversations (id, trip_id, driver_id, rider_id, closes_at) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a01', now() + interval '2 days');
insert into messages (id, conversation_id, sender_id, body) overriding system value values (900001, '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000a01', 'hello there');
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000a01', 'ont', 'ONT', now() + interval '20 hours', now() + interval '28 hours', 1, '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000a02', 'ont', 'ONT', now() + interval '20 hours', now() + interval '28 hours', 1, '00000000-0000-0000-0000-0000000000f1');
insert into ride_offers (id, request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000103');

-- Who may call what ---------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'file_report(report_target,uuid,text,text,uuid,bigint)', 'execute'), 'signed-out visitors cannot file reports');
select ok(not has_function_privilege('authenticated', 'assert_admin()', 'execute'), 'the admin check is not callable from the browser');
select ok(not has_function_privilege('authenticated', 'deactivate_account(uuid)', 'execute'), 'nor is account deactivation');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select * from admin_report_queue() $$, 'P0001', 'forbidden', 'a student cannot open the report queue');
select throws_ok($$ select admin_suspend_user('00000000-0000-0000-0000-000000000a01', 7) $$, 'P0001', 'forbidden', 'or suspend anyone');
select throws_ok($$ select admin_add_meetup_point('hmc', 'x point', 'hub', 34.1, -117.7, false, 'stand here') $$, 'P0001', 'forbidden', 'or add a meetup point');
select throws_ok($$ select * from admin_audit_log() $$, 'P0001', 'forbidden', 'or read the audit log');
select is((select count(*) from audit_log), 0::bigint, 'and the audit table is closed to them');

-- Filing a report ----------------------------------------------------------------------------------------------------------------
select lives_ok($$ select file_report('trip', '00000000-0000-0000-0000-000000000101', 'Unsafe driving', 'Drove fast') $$, 'a student reports a trip');
select lives_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000a01', 'Fake profile', null) $$, 'or a person');
select lives_ok($$ select file_report('request', '00000000-0000-0000-0000-00000000c001', 'Other', 'Strange note') $$, 'or a request');
reset role;
set local request.jwt.claim.sub = '';

select is((select target_user_id from reports where target_type = 'trip' and target_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000d01'::uuid, 'a trip report is about the driver');
select is((select trip_id from reports where target_type = 'trip' and target_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000101'::uuid, 'and keeps the trip');
select is((select target_user_id from reports where target_type = 'request'), '00000000-0000-0000-0000-000000000a01'::uuid, 'a request report is about the rider');
select is((select status::text from reports where target_type = 'user' and target_id = '00000000-0000-0000-0000-000000000a01' and reason = 'Fake profile'), 'new', 'new reports start as new');
select is((select count(*) from email_outbox where template = 'report_received' and to_user_id = '00000000-0000-0000-0000-000000000b01'), 3::bigint, 'the reporter is thanked each time');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000d01', 'Other', 'From the chat', '00000000-0000-0000-0000-000000000101') $$, 'a rider reports the driver from their chat, with the trip');
select throws_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000a01', 'Other', null) $$, 'P0001', 'invalid_target', 'nobody can report themselves');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select file_report('trip', '00000000-0000-0000-0000-000000000101', 'Other', null) $$, 'P0001', 'invalid_target', 'a driver cannot report their own trip');
select throws_ok($$ select file_report('user', gen_random_uuid(), 'Other', null) $$, 'P0001', 'invalid_target', 'an unknown person is not a valid target');
select throws_ok($$ select file_report('trip', gen_random_uuid(), 'Other', null) $$, 'P0001', 'invalid_target', 'nor an unknown trip');
select throws_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000a01', 'Rude', null) $$, 'P0001', 'invalid_request', 'a reason outside the five is refused');
select throws_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000a01', 'Other', repeat('x', 1001)) $$, 'P0001', 'invalid_request', 'details over 1000 characters are refused');
select lives_ok($$ select file_report('message', '00000000-0000-0000-0000-00000000d001', 'Harassment', 'A message', null, 900001) $$, 'the driver reports a message in their chat');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select file_report('message', '00000000-0000-0000-0000-00000000d001', 'Harassment', null, null, 900001) $$, 'P0001', 'invalid_target', 'a stranger cannot report a message in a chat they are not in');
reset role;
set local request.jwt.claim.sub = '';

select is((select message_id from reports where target_type = 'message'), 900001::bigint, 'the message report names the message');
select is((select target_user_id from reports where target_type = 'message'), '00000000-0000-0000-0000-000000000a01'::uuid, 'and is about its sender');

-- Who can read reports ------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select is((select count(*) from reports), 1::bigint, 'a person sees only the reports they filed, never reports about them');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select count(*) from reports), 1::bigint, 'a reported person sees none about themselves');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select is((select count(*) from reports), 3::bigint, 'the reporter sees their own');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select is((select count(*) from reports), 5::bigint, 'an admin sees them all');
select throws_ok($$ insert into reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-000000000f01', 'user', '00000000-0000-0000-0000-000000000a01', 'Other') $$, '42501', null, 'and the browser cannot insert reports directly');

-- Rate limit ---------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from rate_events where kind = 'file_report';
insert into rate_events (user_id, kind) select '00000000-0000-0000-0000-000000000a09', 'file_report' from generate_series(1, 10);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a09';

select throws_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000a01', 'Other', null) $$, 'P0001', 'rate_limited', 'the eleventh report in a day is refused');

-- Rider didn't show ---------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select mark_no_show('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000a01') $$, 'P0001', 'too_early', 'a no-show cannot be filed before the trip leaves');
select throws_ok($$ select mark_no_show('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000a02') $$, 'P0001', 'forbidden', 'only for a rider who had an accepted seat');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select mark_no_show('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000a01') $$, 'P0001', 'forbidden', 'and only the driver can file it');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select mark_no_show('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000a01') $$, 'the driver files a no-show after departure');
select lives_ok($$ select mark_no_show('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000a01') $$, 'filing it again changes nothing');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from reports where reason = 'No-show' and trip_id = '00000000-0000-0000-0000-000000000102' and target_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'there is one no-show report');
select is((select reporter_id from reports where reason = 'No-show'), '00000000-0000-0000-0000-000000000d01'::uuid, 'filed by the driver');

-- Blocking --------------------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select block_user('00000000-0000-0000-0000-000000000d01') $$, 'a rider blocks a driver');
select lives_ok($$ select block_user('00000000-0000-0000-0000-000000000d01') $$, 'blocking again changes nothing');
select throws_ok($$ select block_user('00000000-0000-0000-0000-000000000a01') $$, 'P0001', 'invalid_target', 'nobody can block themselves');
select throws_ok($$ select block_user(gen_random_uuid()) $$, 'P0001', 'invalid_target', 'or someone who does not exist');
select is((select count(*) from blocks where blocker_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'one block is saved');
reset role;
set local request.jwt.claim.sub = '';

select is((select status::text from seat_requests where trip_id = '00000000-0000-0000-0000-000000000103' and rider_id = '00000000-0000-0000-0000-000000000a01'), 'cancelled', 'the rider''s pending seat on that driver''s trip is cancelled');
select is((select status::text from ride_offers where id = '00000000-0000-0000-0000-00000000f001'), 'closed', 'and that driver''s pending offer on the rider''s request is closed');
select is((select status::text from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 'accepted', 'but an accepted seat stays');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select count(*) from board_trips where driver_id = '00000000-0000-0000-0000-000000000d01'), 0::bigint, 'the driver''s trips vanish from the blocker''s board');
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-000000000d01'), 0::bigint, 'and their profile');
select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000a01', 'hi') $$, '42501', null, 'the chat is closed to them');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-000000000a01'), 0::bigint, 'the blocked person cannot see the blocker''s profile either');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select unblock_user('00000000-0000-0000-0000-000000000d01') $$, 'the rider unblocks');
select is((select count(*) from blocks where blocker_id = '00000000-0000-0000-0000-000000000a01'), 0::bigint, 'the block is gone');
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-000000000d01'), 1::bigint, 'and the profile is back');

-- Suspension: every write fails -----------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select throws_ok($$ select admin_suspend_user('00000000-0000-0000-0000-000000000a01', 3) $$, 'P0001', 'invalid_request', 'a suspension is 7 or 30 days');
select throws_ok($$ select admin_suspend_user('00000000-0000-0000-0000-000000000f01', 7) $$, 'P0001', 'forbidden', 'an admin cannot be suspended');
select throws_ok($$ select admin_suspend_user(gen_random_uuid(), 7) $$, 'P0001', 'not_found', 'an unknown person is not found');
select lives_ok($$ select admin_suspend_user('00000000-0000-0000-0000-000000000a01', 7, (select id from reports where target_type = 'user' and target_id = '00000000-0000-0000-0000-000000000a01' and reason = 'Fake profile')) $$, 'an admin suspends a person for 7 days');
reset role;
set local request.jwt.claim.sub = '';

select ok((select suspended_until between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from profiles where id = '00000000-0000-0000-0000-000000000a01'), 'the suspension lasts 7 days');
select is((select status::text from reports where target_type = 'user' and target_id = '00000000-0000-0000-0000-000000000a01' and reason = 'Fake profile'), 'actioned', 'the report it came from is marked actioned');
select is((select handled_by from reports where target_type = 'user' and target_id = '00000000-0000-0000-0000-000000000a01' and reason = 'Fake profile'), '00000000-0000-0000-0000-000000000f01'::uuid, 'by that admin');
select is((select count(*) from email_outbox where template = 'account_suspended' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'the person is emailed');
select ok((select payload ->> 'until' ~ '^[A-Z][a-z]+ [0-9]{1,2}, 20[0-9]{2}$' from email_outbox where template = 'account_suspended' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 'with the end date in plain words');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000103', 1, null) $$, 'P0001', 'account_suspended', 'a suspended person cannot ask for a seat');
select throws_ok($$ select post_trip('tj-claremont', null, null, null, now() + interval '9 days', null, 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'ABC123', null, null) $$, 'P0001', 'account_suspended', 'or post a trip');
select throws_ok($$ select post_ride_request('ont', null, null, null, now() + interval '2 days', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null) $$, 'P0001', 'account_suspended', 'or ask for a ride');
select throws_ok($$ select send_offer('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000103', null) $$, 'P0001', 'account_suspended', 'or offer one');
select throws_ok($$ select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')) $$, 'P0001', 'account_suspended', 'or cancel a seat');
select throws_ok($$ select update_ride_request('00000000-0000-0000-0000-00000000c001', now() + interval '2 days', 'pm60', 1, true, null) $$, 'P0001', 'account_suspended', 'or edit a request');
select throws_ok($$ select respond_offer('00000000-0000-0000-0000-00000000f001', true) $$, 'P0001', 'account_suspended', 'or answer an offer');
select throws_ok($$ select file_report('user', '00000000-0000-0000-0000-000000000d01', 'Other', null) $$, 'P0001', 'account_suspended', 'or file a report');
select throws_ok($$ select block_user('00000000-0000-0000-0000-000000000d01') $$, 'P0001', 'account_suspended', 'or block someone');
select throws_ok($$ select complete_onboarding('Rae', 'Reed', 2028, null, '00000000-0000-0000-0000-000000000a01/profile.webp') $$, 'P0001', 'account_suspended', 'or change their profile through the onboarding function');
select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000a01', 'still here') $$, '42501', null, 'or send a chat message');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_unsuspend_user('00000000-0000-0000-0000-000000000a01') $$, 'an admin lifts the suspension');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000103', 1, null) $$, 'and the person can ask for a seat again');
reset role;
set local request.jwt.claim.sub = '';

update profiles set suspended_until = now() - interval '1 minute' where id = '00000000-0000-0000-0000-000000000a02';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000103', 1, null) $$, 'a suspension that has ended no longer blocks anything');

-- Warning ---------------------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_warn_user('00000000-0000-0000-0000-000000000a01', (select id from reports where target_type = 'request' limit 1)) $$, 'an admin warns a person');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from email_outbox where template = 'account_warning' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'the person is emailed');
select is((select status::text from reports where target_type = 'request'), 'actioned', 'the report is marked actioned');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select admin_warn_user('00000000-0000-0000-0000-000000000a01') $$, 'P0001', 'forbidden', 'only admins can warn');

-- The queue ---------------------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select is((select count(*) from admin_report_queue()), 6::bigint, 'the queue lists every report');
select is((select count(*) from admin_report_queue('new')), 4::bigint, 'and filters by status');
select is((select count(*) from admin_report_queue(null, 'No-show')), 1::bigint, 'and by reason');
select is((select created_at from admin_report_queue() limit 1), (select max(created_at) from reports), 'newest first');
select is((select target_no_show_count from admin_report_queue(null, 'No-show') limit 1), 1, 'each row counts the no-shows against that person');
select ok((select target_report_count >= 2 from admin_report_queue() where target_first_name = 'Rae' limit 1), 'and all open reports against them');
select ok((select count(*) = 0 from information_schema.columns where table_name = 'admin_report_queue' and column_name like '%last_name%')
          and (select reporter_first_name from admin_report_queue() limit 1) is not null, 'the queue shows first names only');
select is((select count(*) from admin_report_queue(null, null, 2)), 2::bigint, 'the limit is honored');

-- One report in full -------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from audit_log;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select is((admin_report_detail((select id from reports where target_type = 'message')) -> 'message' ->> 'body'), 'hello there', 'a message report shows the reported message');
select is((admin_report_detail((select id from reports where target_type = 'message')) -> 'target' ->> 'last_name'), 'Lastname', 'the person''s full profile opens in the admin page');
select is((admin_report_detail((select id from reports where target_type = 'message')) -> 'target' ->> 'email'), 'rae@pomona.edu', 'with their email');
select ok(jsonb_array_length(admin_report_detail((select id from reports where target_type = 'message')) -> 'other_reports') >= 2, 'and the other reports against them');
select ok((admin_report_detail((select id from reports where target_type = 'message')) ->> 'no_show_count')::int = 1, 'and their no-show count');
select throws_ok($$ select admin_report_detail(gen_random_uuid()) $$, 'P0001', 'not_found', 'an unknown report is not found');
reset role;
set local request.jwt.claim.sub = '';

select ok((select count(*) from audit_log where action = 'view_report') >= 5 and (select count(*) from audit_log where action = 'view_profile') >= 5, 'every opening was logged, for the report and for the profile');
select is((select count(distinct actor_id) from audit_log), 1::bigint, 'always with the admin''s id');

-- Setting a report's status ------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_set_report_status((select id from reports where target_type = 'trip'), 'reviewing') $$, 'an admin marks a report as being reviewed');
select is((select handled_by from reports where target_type = 'trip'), null::uuid, 'which does not close it');
select lives_ok($$ select admin_set_report_status((select id from reports where target_type = 'trip'), 'dismissed') $$, 'then dismisses it');
select is((select handled_by from reports where target_type = 'trip'), '00000000-0000-0000-0000-000000000f01'::uuid, 'which records who');
select ok((select handled_at is not null from reports where target_type = 'trip'), 'and when');
select throws_ok($$ select admin_set_report_status(gen_random_uuid(), 'dismissed') $$, 'P0001', 'not_found', 'an unknown report is not found');

-- Removing an account --------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

insert into ride_offers (id, request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000103') on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select throws_ok($$ select admin_remove_account('00000000-0000-0000-0000-000000000f01') $$, 'P0001', 'forbidden', 'an admin''s account cannot be removed this way');
select lives_ok($$ select admin_remove_account('00000000-0000-0000-0000-000000000d01') $$, 'an admin removes the driver''s account');
reset role;
set local request.jwt.claim.sub = '';

select ok((select deleted_at is not null and first_name is null and last_name is null and bio is null and avatar_path is null from profiles where id = '00000000-0000-0000-0000-000000000d01'), 'their name, bio, and photo are cleared');
select is((select status::text from trips where id = '00000000-0000-0000-0000-000000000101'), 'cancelled', 'their upcoming trips are cancelled');
select is((select status::text from trips where id = '00000000-0000-0000-0000-000000000102'), 'open', 'but a trip that already left is left as it was');
select is((select count(*) from seat_requests where trip_id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000103') and status in ('pending', 'accepted')), 0::bigint, 'riders'' requests on the cancelled trips are cancelled');
select ok((select count(*) from email_outbox where template = 'trip_cancelled' and to_user_id = '00000000-0000-0000-0000-000000000a01') >= 1, 'and the riders are told');
select is((select count(*) from ride_offers where driver_id = '00000000-0000-0000-0000-000000000d01' and status = 'pending'), 0::bigint, 'their offers are closed');
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-000000000d01'), 0::bigint, 'they no longer appear to other students');
select is((select count(*) from audit_log where action = 'remove_account'), 1::bigint, 'the removal is in the audit log');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ select request_seat('00000000-0000-0000-0000-000000000103', 1, null) $$, 'P0001', 'not_onboarded', 'a removed account can do nothing');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select admin_remove_account('00000000-0000-0000-0000-000000000a01') $$, 'P0001', 'forbidden', 'only an admin can remove an account');
reset role;
set local request.jwt.claim.sub = '';

insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, seats_taken, meetup_point_id, car_make, car_color) values
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000a02', 'ont', 'ONT', now() + interval '2 days', 3, 2, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue');
insert into trip_private values ('00000000-0000-0000-0000-000000000104', 'PLATE4');
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000a09', 2, 'accepted');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_remove_account('00000000-0000-0000-0000-000000000a09') $$, 'removing a rider who holds seats');
reset role;
set local request.jwt.claim.sub = '';

select is((select seats_taken from trips where id = '00000000-0000-0000-0000-000000000104'), 0, 'gives their seats back');

-- Meetup points -------------------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_add_meetup_point('hmc', 'Zeta Plaza', 'hub', 34.1060, -117.7090, false, 'Stand at the front steps.') $$, 'an admin adds a meetup point with its stand-at text');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from meetup_points where name = 'Zeta Plaza'), 1::bigint, 'the point exists');
select is((select stand_at from meetup_point_details where point_id = (select id from meetup_points where name = 'Zeta Plaza')), 'Stand at the front steps.', 'with its text');
select is((select status::text from meetup_points where name = 'Zeta Plaza'), 'approved', 'and starts approved');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select throws_ok($$ select admin_add_meetup_point('nowhere', 'A point', 'hub', 34.1, -117.7, false, 'stand here') $$, 'P0001', 'invalid_request', 'an unknown campus is refused');
select throws_ok($$ select admin_add_meetup_point('hmc', 'x', 'hub', 34.1, -117.7, false, 'stand here') $$, 'P0001', 'invalid_request', 'a one-letter name is refused');
select throws_ok($$ select admin_add_meetup_point('hmc', 'A point', 'park', 34.1, -117.7, false, 'stand here') $$, 'P0001', 'invalid_request', 'an unknown type is refused');
select throws_ok($$ select admin_add_meetup_point('hmc', 'A point', 'hub', 40.0, -74.0, false, 'stand here') $$, 'P0001', 'invalid_request', 'coordinates outside Southern California are refused');
select throws_ok($$ select admin_add_meetup_point('hmc', 'A point', 'hub', null, null, false, 'stand here') $$, 'P0001', 'invalid_request', 'missing coordinates are refused');
select throws_ok($$ select admin_add_meetup_point('hmc', 'A point', 'hub', 34.1, -117.7, false, '  ') $$, 'P0001', 'invalid_request', 'a point must say where to stand');
select lives_ok($$ select admin_update_meetup_point((select id from meetup_points where name = 'Zeta Plaza'), 'Zeta Plaza (main)', 'hub', 34.1061, -117.7091, true, 'Stand by the main doors.') $$, 'an admin edits a point');
reset role;
set local request.jwt.claim.sub = '';

select is((select name || '/' || shared || '/' || (select stand_at from meetup_point_details d where d.point_id = p.id) from meetup_points p where name like 'Zeta Plaza%'),
          'Zeta Plaza (main)/true/Stand by the main doors.', 'the edit, and the new stand-at text, are saved');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_set_meetup_status('00000000-0000-0000-0000-0000000000f1', 'suspended') $$, 'an admin suspends a point');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ select post_trip('tj-claremont', null, null, null, now() + interval '9 days', null, 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'ABC123', null, null) $$, 'P0001', 'meetup_not_allowed', 'a suspended point cannot be used for a new trip');
select is((select count(*) from meetup_points where id = '00000000-0000-0000-0000-0000000000f1'), 1::bigint, 'but riders on existing trips can still read it');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000f01';

select lives_ok($$ select admin_set_meetup_status('00000000-0000-0000-0000-0000000000f1', 'retired') $$, 'an admin retires it');
select is((select status::text from admin_meetup_points() where id = '00000000-0000-0000-0000-0000000000f1'), 'retired', 'the admin list shows every point whatever its status');
select ok((select stand_at is not null and trips_using >= 1 from admin_meetup_points() where id = '00000000-0000-0000-0000-0000000000f1'), 'with its stand-at text and how many trips use it');
select throws_ok($$ select admin_set_meetup_status(gen_random_uuid(), 'retired') $$, 'P0001', 'not_found', 'an unknown point is not found');

-- The audit log --------------------------------------------------------------------------------------------------------------------------------------
select ok((select count(*) from admin_audit_log()) > 10, 'the audit log lists what admins did');
select is((select action from admin_audit_log(1)), 'meetup_point_retired', 'newest first');
select is((select actor_first_name from admin_audit_log(1)), 'Xan', 'with the admin''s first name');
select ok((select count(distinct action) from admin_audit_log(500) where action in ('view_report', 'view_profile', 'report_reviewing', 'report_dismissed', 'remove_account', 'add_meetup_point', 'update_meetup_point', 'meetup_point_suspended', 'meetup_point_retired')) = 9, 'every kind of admin action since then is recorded');
select throws_ok($$ insert into audit_log (action) values ('forged') $$, '42501', null, 'and nobody can write to it directly');

-- The daily digest ----------------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from email_outbox where template = 'admin_digest';
select admin_report_digest();
select is((select count(*) from email_outbox where template = 'admin_digest' and to_user_id = '00000000-0000-0000-0000-000000000f01'), 1::bigint, 'an admin is emailed when reports are still new');
select is((select (payload ->> 'count')::int from email_outbox where template = 'admin_digest' and to_user_id = '00000000-0000-0000-0000-000000000f01'), (select count(*)::int from reports where status = 'new'), 'with how many');
select admin_report_digest();
select is((select count(*) from email_outbox where template = 'admin_digest' and to_user_id = '00000000-0000-0000-0000-000000000f01'), 1::bigint, 'once a day, however often the job runs');
select is((select count(*) from email_outbox where template = 'admin_digest' and to_user_id not in (select id from profiles where role = 'admin')), 0::bigint, 'and only to admins');
update reports set status = 'dismissed';
delete from email_outbox where template = 'admin_digest';
select admin_report_digest();
select is((select count(*) from email_outbox where template = 'admin_digest'), 0::bigint, 'nothing is sent when no report is new');

select * from finish();
rollback;
