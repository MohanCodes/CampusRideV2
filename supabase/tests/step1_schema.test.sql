-- Step 1: seed data, the contact-info filter, and helper-function access.
-- Run with `supabase test db`. Everything rolls back.
begin;
select plan(25);

-- Seed ---------------------------------------------------------------------------------------
select is((select count(*) from campuses), 5::bigint, 'five campuses are seeded');
select is((select count(*) from places), 14::bigint, 'fourteen places are seeded');
select is((select email_domains from campuses where id = 'hmc'),
          array['hmc.edu', 'g.hmc.edu'], 'Harvey Mudd allows hmc.edu and g.hmc.edu');
select ok(not exists (select 1 from places where chip not in
          ('Trader Joe''s', 'Target', 'The Village', 'Airport (ONT)', 'LA / LAX', 'Other')),
          'every place belongs to a feed chip');

-- Contact-info filter: blocked in notes ---------------------------------------------------------
select ok(contains_contact_info('call me 909-555-0123'),        'blocks a phone number');
select ok(contains_contact_info('text +1 (909) 555 0123'),      'blocks a formatted phone number');
select ok(contains_contact_info('maya@hmc.edu'),                'blocks an email');
select ok(contains_contact_info('find me @maya_k'),             'blocks a handle');
select ok(contains_contact_info('see https://example.com/x'),   'blocks a link');
select ok(contains_contact_info('www.example.org'),             'blocks a www link');
select ok(contains_contact_info('im at maya.me'),               'blocks a bare domain');

-- Contact-info filter: normal notes pass --------------------------------------------------------
select ok(not contains_contact_info('Back by 5, no big bags'),         'allows a plain note');
select ok(not contains_contact_info('Leave at 3:30, home by 5:00 PM'), 'allows times');
select ok(not contains_contact_info('Trader Joe''s and Target, 3 seats open'), 'allows a place list');
select is(contains_contact_info(null), false,                          'treats null as clean');

-- Constraints, using throwaway rows --------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3');
insert into profiles (id, campus_id, first_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'hmc', 'Maya'),
  ('00000000-0000-0000-0000-0000000000a2', 'hmc', 'Alex'),
  ('00000000-0000-0000-0000-0000000000a3', 'hmc', 'Sam');
-- Test-only coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng) values
  ('00000000-0000-0000-0000-0000000000b1', 'hmc', 'Test point', 'hub', 0, 0);

select throws_ok($$
  insert into trips (driver_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color, notes)
  values ('00000000-0000-0000-0000-0000000000a1', 'Trader Joe''s', now() + interval '1 day', 3,
          '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'text me 909-555-0123')
$$, '23514', null, 'a trip note with a phone number is rejected');

select lives_ok($$
  insert into trips (id, driver_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color, notes)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Trader Joe''s',
          now() + interval '1 day', 3, '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue', 'Back by 5')
$$, 'a clean trip note is accepted');

select throws_ok($$
  insert into trips (driver_id, destination_name, departs_at, seats_total, seats_taken, meetup_point_id, car_make, car_color)
  values ('00000000-0000-0000-0000-0000000000a1', 'Target', now() + interval '1 day', 2, 3,
          '00000000-0000-0000-0000-0000000000b1', 'Honda', 'Blue')
$$, '23514', null, 'a trip cannot have more seats taken than seats total');

select throws_ok($$
  insert into ride_requests (rider_id, destination_name, window_start, window_end, meetup_point_id, note)
  values ('00000000-0000-0000-0000-0000000000a2', 'Target', now() + interval '1 day', now() + interval '2 days',
          '00000000-0000-0000-0000-0000000000b1', 'email maya@hmc.edu')
$$, '23514', null, 'a request note with an email is rejected');

select lives_ok($$
  insert into ride_requests (rider_id, destination_name, window_start, window_end, meetup_point_id, note)
  values ('00000000-0000-0000-0000-0000000000a2', 'Target', now() + interval '1 day', now() + interval '2 days',
          '00000000-0000-0000-0000-0000000000b1', 'Just Target and back')
$$, 'a clean request note is accepted');

insert into conversations (id, trip_id, driver_id, rider_id, closes_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() + interval '2 days');
select lives_ok($$
  insert into messages (conversation_id, sender_id, body)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', 'my number is 909-555-0123')
$$, 'chat messages may contain contact details');

-- Helper functions -------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'is_admin()', 'execute'),
          'signed-out visitors cannot call is_admin');
select ok(has_function_privilege('authenticated', 'is_blocked_pair(uuid, uuid)', 'execute'),
          'signed-in users can use is_blocked_pair in policies');
insert into blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
select ok(is_blocked_pair('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1'),
          'a block counts in both directions');
select throws_ok('select assert_active_user()', 'P0001', 'not_signed_in',
          'assert_active_user rejects a call with no signed-in user');

select * from finish();
rollback;
