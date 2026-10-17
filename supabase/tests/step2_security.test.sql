-- Step 2: leak tests. BUILD.md Section 14 and AGENTS.md Section 7.
-- Run with `supabase test db`. Everything rolls back.
--
-- Cast: A drives trip c1. B has an accepted seat on it. C has a pending seat (a stranger to the
-- accepted ride). E was blocked by A. F blocked A. X is an admin. L is in a chat that has closed.
begin;
select plan(76);

-- Setup, as the database owner --------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'), ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a4'), ('00000000-0000-0000-0000-0000000000a5'), ('00000000-0000-0000-0000-0000000000a6'), ('00000000-0000-0000-0000-0000000000a7');
insert into profiles (id, campus_id, first_name, last_name, bio, onboarded_at, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'hmc', 'Maya',  'Lopez',  'driver bio', now(), 'student'),
  ('00000000-0000-0000-0000-0000000000a2', 'hmc', 'Alex',  'Reed',   null,         now(), 'student'),
  ('00000000-0000-0000-0000-0000000000a3', 'hmc', 'Casey', 'Nguyen', null,         now(), 'student'),
  ('00000000-0000-0000-0000-0000000000a4', 'hmc', 'Eli',   'Park',   null,         now(), 'student'),
  ('00000000-0000-0000-0000-0000000000a5', 'hmc', 'Xan',   'Admin',  null,         now(), 'admin'),
  ('00000000-0000-0000-0000-0000000000a6', 'hmc', 'Lee',   'Stone',  null,         now(), 'student'),
  ('00000000-0000-0000-0000-0000000000a7', 'hmc', 'Finn',  'Gray',   null,         now(), 'student');

-- Test-only coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, status) values
  ('00000000-0000-0000-0000-0000000000b1', 'hmc', 'Approved point',        'hub', 0, 0, 'approved'),
  ('00000000-0000-0000-0000-0000000000b2', 'hmc', 'Suspended but in use',  'hub', 0, 0, 'suspended'),
  ('00000000-0000-0000-0000-0000000000b3', 'hmc', 'Suspended and unused',  'hub', 0, 0, 'suspended');
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000000b1', 'Stand by the north door');

insert into trips (id, driver_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Trader Joe''s', now() + interval '1 day', 3, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Target',        now() + interval '2 days', 3, '00000000-0000-0000-0000-0000000000b2', 'Honda', 'Blue');
insert into trip_private (trip_id, car_plate) values ('00000000-0000-0000-0000-0000000000c1', 'ABC123'), ('00000000-0000-0000-0000-0000000000c2', 'XYZ789');

insert into seat_requests (trip_id, rider_id, seats, status) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 1, 'accepted'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a3', 1, 'pending');

insert into conversations (id, trip_id, driver_id, rider_id, closes_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() + interval '2 days'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a6', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a7', now() + interval '2 days');
insert into messages (conversation_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'See you at the north door');

insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4'), ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a1');

insert into ride_requests (id, rider_id, destination_name, window_start, window_end, meetup_point_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a3', 'Target', now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a4', 'Target', now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-0000000000b1');
insert into ride_offers (request_id, driver_id, trip_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1');

insert into reports (reporter_id, target_type, target_id, target_user_id, reason) values
  ('00000000-0000-0000-0000-0000000000a2', 'user', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Other');
insert into audit_log (actor_id, action) values ('00000000-0000-0000-0000-0000000000a5', 'test');
insert into email_outbox (to_user_id, template) values ('00000000-0000-0000-0000-0000000000a2', 'seat_accepted');
insert into rate_events (user_id, kind) values ('00000000-0000-0000-0000-0000000000a2', 'test');
insert into places (id, name, category, address, chip, active) values
  ('zz-inactive', 'Retired place', 'test', 'nowhere', 'Other', false);
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000a1/profile.jpg');

-- Structure, as the database owner -------------------------------------------------------------------
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
          0::bigint, 'every table in public has row-level security on');
select is((select array_agg(c.relname::text order by c.relname)
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
          array['email_outbox', 'rate_events'],
          'only the service-role-only tables have no policy');
select ok(not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'public_profiles'
                        and column_name in ('last_name', 'email', 'role', 'suspended_until')),
          'public_profiles has no last name, email, or admin fields');
select ok((select not public and file_size_limit = 5242880
                  and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
           from storage.buckets where id = 'avatars'),
          'avatars bucket is private, 5 MB, and images only');

-- A stranger to the accepted ride (C: pending request only) --------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';

select is((select count(*) from trip_private), 0::bigint,           'stranger cannot read trip_private');
select is((select count(*) from meetup_point_details), 0::bigint,   'stranger cannot read meetup_point_details');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-0000000000c1')), null::text,      'stranger gets no exact meetup spot');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint,
          'stranger sees only their own seat request on a trip');
select is((select count(*) from conversations), 0::bigint,          'stranger cannot read conversations they are not in');
select is((select count(*) from messages), 0::bigint,               'stranger cannot read messages they are not in');
select is((select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'stranger cannot read another profile row');
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'stranger can read the public profile');
select is((select count(*) from audit_log), 0::bigint,              'stranger cannot read audit_log');
select is((select count(*) from reports), 0::bigint,                'stranger cannot read other people''s reports');
select is((select count(*) from places where id = 'zz-inactive'), 0::bigint, 'retired places are hidden');
select throws_ok('select * from email_outbox', '42501', null,       'email_outbox is closed to signed-in users');
select throws_ok('select * from rate_events', '42501', null,        'rate_events is closed to signed-in users');
select is((select count(*) from meetup_points where id = '00000000-0000-0000-0000-0000000000b2'), 1::bigint,
          'a suspended point stays readable while a trip uses it');
select is((select count(*) from meetup_points where id = '00000000-0000-0000-0000-0000000000b3'), 0::bigint,
          'a suspended point nobody uses is hidden');
select is((select count(*) from ride_offers), 1::bigint,            'a rider sees offers on their own request');

-- The accepted rider (B) -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';

select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint, 'accepted rider reads the plate');
select is((select count(*) from trip_private where trip_id = '00000000-0000-0000-0000-0000000000c2'), 0::bigint, 'but not the plate of a trip they have no seat on');
select is((select count(*) from meetup_point_details), 1::bigint,   'accepted rider reads the exact spot');
select is((select get_trip_meetup_detail('00000000-0000-0000-0000-0000000000c1')), 'Stand by the north door', 'accepted rider gets the stand-at text');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint, 'rider sees only their own seat request');
select is((select count(*) from conversations), 1::bigint,          'rider sees only their own conversation');
select is((select count(*) from messages), 1::bigint,               'rider reads their conversation''s messages');
select is((select count(*) from ride_offers), 0::bigint,            'someone outside a request cannot see its offers');
select is((select count(*) from ride_requests where id = '00000000-0000-0000-0000-0000000000e2'), 1::bigint,
          'open requests are visible to other students');

-- The driver (A) -------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select is((select count(*) from trip_private), 2::bigint,           'driver reads both plates of their own trips');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-0000000000c1'), 2::bigint, 'driver sees every request on their trip');
select is((select count(*) from conversations), 3::bigint,          'driver sees their conversations');
select is((select count(*) from ride_offers), 1::bigint,            'driver sees the offers they made');
select is((select bio from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'driver bio', 'driver reads their own full profile');

-- Blocks -----------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a4';

select is((select count(*) from trips where id = '00000000-0000-0000-0000-0000000000c1'), 0::bigint,           'a blocked user cannot see the blocker''s trips');
select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint,  'a blocked user cannot see the blocker''s profile');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select is((select count(*) from public_profiles where id = '00000000-0000-0000-0000-0000000000a4'), 0::bigint,  'the blocker cannot see the blocked user''s profile');
select is((select count(*) from ride_requests where id = '00000000-0000-0000-0000-0000000000e2'), 0::bigint,
          'the blocker cannot see the blocked user''s requests');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a7';

select is((select count(*) from trips where id = '00000000-0000-0000-0000-0000000000c1'), 0::bigint,           'blocking works in both directions for trips');
select throws_ok($$ insert into messages (conversation_id, sender_id, body)
                    values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a7', 'hi') $$, '42501', null,            'a blocked pair cannot message');

-- is_blocked_pair only answers about the caller's own pairs ---------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
select is(is_blocked_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4'), false, 'a bystander cannot probe whether two other people blocked each other');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select is(is_blocked_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4'), true, 'a person can see their own block');
reset role;
set local request.jwt.claim.sub = '';
select is(is_blocked_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4'), true, 'server jobs with no signed-in user still see every block');

-- Direct writes are closed (B) ----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';

select throws_ok($$ insert into trips (driver_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color)
                    values ('00000000-0000-0000-0000-0000000000a2', 'x', now() + interval '1 day', 1, '00000000-0000-0000-0000-0000000000b1', 'a', 'b') $$,
                 '42501', null, 'the browser cannot insert trips');
select throws_ok($$ update trips set seats_total = 6 where id = '00000000-0000-0000-0000-0000000000c1' $$, '42501', null, 'the browser cannot update trips');
select throws_ok($$ insert into seat_requests (trip_id, rider_id, seats) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2', 1) $$,
                 '42501', null, 'the browser cannot insert seat requests');
select throws_ok($$ insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3') $$,
                 '42501', null, 'the browser cannot insert blocks');
select throws_ok($$ insert into reports (reporter_id, target_type, target_id, reason)
                    values ('00000000-0000-0000-0000-0000000000a2', 'user', '00000000-0000-0000-0000-0000000000a3', 'Other') $$, '42501', null, 'the browser cannot insert reports');
select throws_ok($$ delete from messages $$, '42501', null, 'nobody deletes messages');
select throws_ok($$ update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a2' $$,
                 '42501', null, 'a person cannot make themselves an admin');
select throws_ok($$ update profiles set onboarded_at = null where id = '00000000-0000-0000-0000-0000000000a2' $$,
                 '42501', null, 'a person cannot edit onboarded_at');
select lives_ok($$ update profiles set bio = 'hello' where id = '00000000-0000-0000-0000-0000000000a2' $$, 'a person can edit their own bio');
select is((select bio from profiles where id = '00000000-0000-0000-0000-0000000000a2'), 'hello', 'the bio edit took effect');
select lives_ok($$ update profiles set bio = 'hijacked' where id = '00000000-0000-0000-0000-0000000000a1' $$, 'editing someone else''s row is a quiet no-op');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select is((select bio from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'driver bio', 'and it changed nothing');

-- Chat rules -----------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';

select lives_ok($$ insert into messages (conversation_id, sender_id, body)
                   values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', 'On my way') $$, 'a participant can send a message');
select throws_ok($$ insert into messages (conversation_id, sender_id, body)
                    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'pretending') $$, '42501', null, 'nobody can send as someone else');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';

select throws_ok($$ insert into messages (conversation_id, sender_id, body)
                    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a3', 'hi') $$, '42501', null, 'a non-participant cannot send');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a6';

select throws_ok($$ insert into messages (conversation_id, sender_id, body)
                    values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a6', 'late') $$, '42501', null, 'messages are refused after closes_at');

-- Admin-only tables -------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a5';

select is((select count(*) from audit_log), 1::bigint,              'admin reads audit_log');
select is((select count(*) from reports), 1::bigint,                'admin reads reports');
select is((select count(*) from places where id = 'zz-inactive'), 1::bigint, 'admin reads retired places');
select is((select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'admin reads full profiles');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';

select throws_ok($$ insert into places (id, name, category, address, chip) values ('zz-new', 'n', 'c', 'a', 'Other') $$,
                 '42501', null, 'a student cannot add places');
select throws_ok($$ insert into meetup_points (campus_id, name, type, lat, lng) values ('hmc', 'n', 'hub', 0, 0) $$,
                 '42501', null, 'a student cannot add meetup points');

-- Signed out -------------------------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok('select count(*) from trips', '42501', null,       'signed-out visitors cannot read trips');
select throws_ok('select count(*) from public_profiles', '42501', null, 'signed-out visitors cannot read profiles');
select throws_ok('select count(*) from campuses', '42501', null,    'signed-out visitors cannot read campuses');
select throws_ok('select is_admin()', '42501', null,                'signed-out visitors cannot call helper functions');

-- Storage folders ----------------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';

select lives_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000a2/profile.jpg') $$,
                'a person can write inside their own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000a1/other.jpg') $$,
                 '42501', null, 'a person cannot write into another person''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('other-bucket', '00000000-0000-0000-0000-0000000000a2/profile.jpg') $$,
                 '42501', null, 'the policies only cover the avatars bucket');
select is((select count(*) from storage.objects where name = '00000000-0000-0000-0000-0000000000a1/profile.jpg'), 1::bigint,
          'any signed-in user can read photos');
select lives_ok($$ delete from storage.objects where name = '00000000-0000-0000-0000-0000000000a1/profile.jpg' $$, 'deleting another person''s photo is a quiet no-op');
select lives_ok($$ update storage.objects set name = '00000000-0000-0000-0000-0000000000a2/stolen.jpg' where name = '00000000-0000-0000-0000-0000000000a1/profile.jpg' $$,
                'renaming another person''s photo is a quiet no-op');
reset role;
select ok(exists (select 1 from storage.objects where name = '00000000-0000-0000-0000-0000000000a1/profile.jpg'),
          'and the photo is still there');

select * from finish();
rollback;
