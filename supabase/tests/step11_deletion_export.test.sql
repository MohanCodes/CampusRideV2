-- Step 11: deleting an account, and "Download my data". Run with `supabase test db`. Everything rolls back.
begin;
select plan(39);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d11', 'dee@hmc.edu'), ('00000000-0000-0000-0000-000000000a11', 'ray@pomona.edu'), ('00000000-0000-0000-0000-000000000a12', 'ron@pomona.edu');
update profiles set onboarded_at = now(), first_name = 'Person', last_name = 'Lastname'
 where id in ('00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000000a12');
update profiles set first_name = 'Dee', last_name = 'Driverlast', bio = 'I drive on Saturdays', avatar_path = '00000000-0000-0000-0000-000000000d11/profile.jpg', class_year = 2027 where id = '00000000-0000-0000-0000-000000000d11';
update profiles set first_name = 'Ray', last_name = 'Riderlast' where id = '00000000-0000-0000-0000-000000000a11';
update profiles set first_name = 'Ron', last_name = 'Otherlast' where id = '00000000-0000-0000-0000-000000000a12';

insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ('00000000-0000-0000-0000-0000000011f1', 'hmc', 'Deletion test point', 'hub', 34.1, -117.7, true);
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000011f1', 'Stand by the south door');

-- Dee drives: a trip tomorrow (Ray accepted, Ron pending) and one that left yesterday (Ray rode). Ray also asked for a ride.
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, seats_taken, meetup_point_id, car_make, car_color, status) values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000d11', 'tj-claremont', 'Trader Joe''s', now() + interval '1 day', 3, 1, '00000000-0000-0000-0000-0000000011f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000000d11', 'ont', 'ONT', now() - interval '1 day', 3, 1, '00000000-0000-0000-0000-0000000011f1', 'Honda', 'Blue', 'open');
insert into trip_private (trip_id, car_plate) values ('00000000-0000-0000-0000-000000001101', 'DEEPLATE1'), ('00000000-0000-0000-0000-000000001102', 'DEEPLATE2');
insert into seat_requests (trip_id, rider_id, seats, status) values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000a11', 1, 'accepted'),
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000a12', 1, 'pending'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000000a11', 1, 'accepted');
insert into conversations (id, trip_id, driver_id, rider_id, closes_at) values ('00000000-0000-0000-0000-00000000d111', '00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000a11', now() + interval '2 days');
insert into messages (conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-00000000d111', '00000000-0000-0000-0000-000000000a11', 'see you at the south door'),
  ('00000000-0000-0000-0000-00000000d111', '00000000-0000-0000-0000-000000000d11', 'blue Honda');
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id) values
  ('00000000-0000-0000-0000-00000000c111', '00000000-0000-0000-0000-000000000a11', 'ont', 'ONT', now() + interval '20 hours', now() + interval '28 hours', 1, '00000000-0000-0000-0000-0000000011f1');
insert into reports (reporter_id, target_type, target_id, target_user_id, reason, details) values
  ('00000000-0000-0000-0000-000000000a11', 'user', '00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000d11', 'Other', 'Test report');

-- Who may call what ---------------------------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'request_account_deletion()', 'execute'), 'signed-out visitors cannot delete accounts');
select ok(has_function_privilege('authenticated', 'request_account_deletion()', 'execute'), 'a signed-in person can delete their own');
select ok(not has_function_privilege('anon', 'export_my_data()', 'execute'), 'signed-out visitors cannot export');
select ok(not has_function_privilege('authenticated', 'deactivate_account(uuid)', 'execute'), 'nobody can deactivate someone else');

-- The export ------------------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a11';
create temp table ray_export on commit drop as select export_my_data() as j;
reset role;
set local request.jwt.claim.sub = '';

select is((select j -> 'profile' ->> 'email' from ray_export), 'ray@pomona.edu', 'the export has the person''s own email');
select is((select j -> 'profile' ->> 'last_name' from ray_export), 'Riderlast', 'and their own last name');
select is((select jsonb_array_length(j -> 'seats_i_asked_for') from ray_export), 2, 'it lists the seats they asked for');
select is((select jsonb_array_length(j -> 'rides_i_asked_for') from ray_export), 1, 'and the rides they asked for');
select is((select jsonb_array_length(j -> 'trips_i_posted') from ray_export), 0, 'and only the trips they posted');
select is((select jsonb_array_length(j -> 'messages') from ray_export), 2, 'it has both sides of their chats');
select is((select count(*) from ray_export, jsonb_array_elements(j -> 'messages') m where m ->> 'from_who' = 'me' and m ->> 'body' = 'see you at the south door'), 1::bigint, 'their own messages are marked as theirs');
select is((select count(*) from ray_export, jsonb_array_elements(j -> 'messages') m where m ->> 'from_who' = 'Dee'), 1::bigint, 'and the other person is a first name');
select is((select position('Driverlast' in j::text) from ray_export), 0, 'it never shows another person''s last name');
select is((select position('dee@hmc.edu' in j::text) from ray_export), 0, 'or their email');
select is((select position('DEEPLATE' in j::text) from ray_export), 0, 'or a plate from a trip they did not drive');
select is((select jsonb_array_length(j -> 'reports_i_filed') from ray_export), 1, 'it lists reports they filed');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d11';
create temp table dee_export on commit drop as select export_my_data() as j;
reset role;
set local request.jwt.claim.sub = '';
select is((select jsonb_array_length(j -> 'trips_i_posted') from dee_export), 2, 'a driver''s export lists their trips');
select ok((select j::text like '%DEEPLATE1%' from dee_export), 'with their own plate');
select is((select position('Riderlast' in j::text) from dee_export), 0, 'but not a rider''s last name');

-- Deleting an account ----------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d11';
select lives_ok($$ select request_account_deletion() $$, 'a driver deletes their account');
select lives_ok($$ select request_account_deletion() $$, 'and doing it again is harmless');
reset role;
set local request.jwt.claim.sub = '';

select ok((select deleted_at is not null from profiles where id = '00000000-0000-0000-0000-000000000d11'), 'the profile is marked deleted');
select ok((select first_name is null and last_name is null and bio is null and avatar_path is null and class_year is null from profiles where id = '00000000-0000-0000-0000-000000000d11'), 'and holds no name, bio, photo or year');
select is((select status::text from trips where id = '00000000-0000-0000-0000-000000001101'), 'cancelled', 'their trip ahead is cancelled');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-000000001101' and status = 'cancelled'), 2::bigint, 'and its riders'' seats are cancelled');
select is((select count(*) from email_outbox where template = 'trip_cancelled' and to_user_id = '00000000-0000-0000-0000-000000000a11'), 1::bigint, 'riders are told');
select is((select status::text from trips where id = '00000000-0000-0000-0000-000000001102'), 'open', 'a trip that already left is left alone');
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-000000000d11'), 0::bigint, 'other students can no longer read them as a person');

-- Removing the sign-in must not take the history with it -------------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-000000000d11';
select is((select count(*) from profiles where id = '00000000-0000-0000-0000-000000000d11'), 1::bigint, 'the empty profile row stays after the sign-in is deleted');
select is((select count(*) from trips where driver_id = '00000000-0000-0000-0000-000000000d11'), 2::bigint, 'so their trips stay');
select is((select count(*) from reports where target_user_id = '00000000-0000-0000-0000-000000000d11'), 1::bigint, 'and reports about them stay');

-- A rider reading the old trip sees "Deleted user" data, not a name (the app falls back when the person is missing).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a11';
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-000000000d11'), 0::bigint, 'a rider cannot look them up');
select is((select count(*) from trips where id = '00000000-0000-0000-0000-000000001102'), 1::bigint, 'but still sees the trip they rode on');
reset role;

-- The blocked list -------------------------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'my_blocked_users()', 'execute'), 'signed-out visitors cannot read a blocked list');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a11';
select lives_ok($$ select block_user('00000000-0000-0000-0000-000000000a12') $$, 'a rider blocks someone');
select is((select first_name from my_blocked_users()), 'Ron', 'the list shows their first name');
select is((select count(*) from my_blocked_users() m where m::text like '%Otherlast%'), 0::bigint, 'and never a last name');
select lives_ok($$ select unblock_user('00000000-0000-0000-0000-000000000a12') $$, 'they unblock');
select is((select count(*) from my_blocked_users()), 0::bigint, 'and the list is empty again');
reset role;
set local request.jwt.claim.sub = '';

select * from finish();
rollback;
