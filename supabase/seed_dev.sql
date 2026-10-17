-- DEV AND TEST DATA ONLY. Fake people, fake places to stand, fake coordinates.
-- Loaded by `supabase db reset` for local work (see sql_paths in config.toml). It is never run in
-- production, and staging holds only this fake data. Nothing here is real or approved.
-- Times are relative to when the database is reset, so the board always has upcoming trips.

-- Six fake students across the colleges. Creating the auth user also creates the profile (trigger).
insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at) values
  ('d0000000-0000-0000-0000-000000000001', 'maya.dev@hmc.edu',               'authenticated', 'authenticated', now(), now(), now()),
  ('d0000000-0000-0000-0000-000000000002', 'alex.dev@pomona.edu',            'authenticated', 'authenticated', now(), now(), now()),
  ('d0000000-0000-0000-0000-000000000003', 'sam.dev@scrippscollege.edu',     'authenticated', 'authenticated', now(), now(), now()),
  ('d0000000-0000-0000-0000-000000000004', 'jordan.dev@cmc.edu',             'authenticated', 'authenticated', now(), now(), now()),
  ('d0000000-0000-0000-0000-000000000005', 'riley.dev@pitzer.edu',           'authenticated', 'authenticated', now(), now(), now()),
  ('d0000000-0000-0000-0000-000000000006', 'admin.dev@hmc.edu',              'authenticated', 'authenticated', now(), now(), now());

-- Fake profiles are marked onboarded with no photo, so the app's initials fallback gets exercised.
update profiles p
   set first_name = v.f, last_name = v.l, class_year = v.y, bio = v.b, onboarded_at = now(), role = v.r::user_role
  from (values
    ('d0000000-0000-0000-0000-000000000001', 'Maya',   'Dev', 2027, 'Drives to Trader Joe''s most Saturdays.', 'student'),
    ('d0000000-0000-0000-0000-000000000002', 'Alex',   'Dev', 2028, null,                                      'student'),
    ('d0000000-0000-0000-0000-000000000003', 'Sam',    'Dev', 2026, 'Flying out of ONT at every break.',        'student'),
    ('d0000000-0000-0000-0000-000000000004', 'Jordan', 'Dev', 2029, null,                                      'student'),
    ('d0000000-0000-0000-0000-000000000005', 'Riley',  'Dev', 2027, null,                                      'student'),
    ('d0000000-0000-0000-0000-000000000006', 'Admin',  'Dev', 2026, null,                                      'admin')
  ) as v(id, f, l, y, b, r)
 where p.id = v.id::uuid;

-- DEV ONLY meetup points. Coordinates are one rough spot for all of them; real points come from
-- the geocoding pass (see PENDING.md). The stand-at text is placeholder wording.
insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values
  ('d1000000-0000-0000-0000-000000000001', 'hmc',    'Platt Campus Center',          'hub',    34.1060, -117.7090, false),
  ('d1000000-0000-0000-0000-000000000002', 'hmc',    'Hoch-Shanahan Dining Commons', 'hub',    34.1062, -117.7092, false),
  ('d1000000-0000-0000-0000-000000000003', 'pomona', 'Smith Campus Center',          'hub',    34.0975, -117.7110, true),
  ('d1000000-0000-0000-0000-000000000004', 'scripps','Balch Hall',                   'hub',    34.1000, -117.7100, true),
  ('d1000000-0000-0000-0000-000000000005', 'hmc',    'Honnold/Mudd Library',         'shared', 34.1020, -117.7115, true);
insert into meetup_point_details (point_id, stand_at) values
  ('d1000000-0000-0000-0000-000000000001', 'DEV PLACEHOLDER: stand at the front steps.'),
  ('d1000000-0000-0000-0000-000000000002', 'DEV PLACEHOLDER: stand at the main doors.'),
  ('d1000000-0000-0000-0000-000000000003', 'DEV PLACEHOLDER: stand by the fountain.'),
  ('d1000000-0000-0000-0000-000000000004', 'DEV PLACEHOLDER: stand at the entrance gate.'),
  ('d1000000-0000-0000-0000-000000000005', 'DEV PLACEHOLDER: stand by the bike racks.');

-- Trips: a spread of destinations, plus one full, one cancelled, and one already gone.
insert into trips (id, driver_id, place_id, destination_name, departs_at, back_by, seats_total, seats_taken,
                   meetup_point_id, car_make, car_color, cost_note, notes, status) values
  ('d2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tj-claremont', 'Trader Joe''s',
     now() + interval '3 hours',   now() + interval '5 hours',  3, 1, 'd1000000-0000-0000-0000-000000000001', 'Honda Civic',  'Blue',   'Split gas and parking', 'Room for grocery bags.', 'open'),
  ('d2000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'target-montclair', 'Target (Montclair)',
     now() + interval '1 day',     now() + interval '1 day 3 hours', 4, 0, 'd1000000-0000-0000-0000-000000000003', 'Toyota RAV4', 'White',  null, null, 'open'),
  ('d2000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'ont', 'Ontario International Airport (ONT)',
     now() + interval '2 days',    null,                        3, 2, 'd1000000-0000-0000-0000-000000000004', 'Subaru Outback', 'Green', 'Split gas, about $5 each', 'One carry-on each please.', 'open'),
  ('d2000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'farmers-market', 'Claremont Farmers Market (Sundays 8am-1pm)',
     now() + interval '4 days',    now() + interval '4 days 3 hours', 2, 0, 'd1000000-0000-0000-0000-000000000005', 'Mazda 3', 'Red', null, null, 'open'),
  ('d2000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'lax', 'Los Angeles International Airport (LAX)',
     now() + interval '5 days',    null,                        3, 0, 'd1000000-0000-0000-0000-000000000003', 'Ford Escape', 'Gray', 'Split gas and parking', null, 'open'),
  ('d2000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'tj-claremont', 'Trader Joe''s',
     now() + interval '1 day 4 hours', null,                    2, 2, 'd1000000-0000-0000-0000-000000000002', 'Honda Civic', 'Blue', null, 'Already full.', 'open'),
  ('d2000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000002', 'village', 'Claremont Village',
     now() + interval '2 days 5 hours', null,                   3, 0, 'd1000000-0000-0000-0000-000000000003', 'Toyota RAV4', 'White', null, null, 'cancelled'),
  ('d2000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000004', 'target-upland', 'Target (Upland)',
     now() - interval '1 day',     null,                        3, 1, 'd1000000-0000-0000-0000-000000000003', 'Mazda 3', 'Red', null, null, 'past'),
  (  'd2000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000005', null, 'The Ontario Mills outlet',
     now() + interval '3 days',    null,                        3, 0, 'd1000000-0000-0000-0000-000000000003', 'Ford Escape', 'Gray', null, 'An "Other" destination.', 'open');
insert into trip_private (trip_id, car_plate) values
  ('d2000000-0000-0000-0000-000000000001', 'DEV1001'), ('d2000000-0000-0000-0000-000000000002', 'DEV1002'),
  ('d2000000-0000-0000-0000-000000000003', 'DEV1003'), ('d2000000-0000-0000-0000-000000000004', 'DEV1004'),
  ('d2000000-0000-0000-0000-000000000005', 'DEV1005'), ('d2000000-0000-0000-0000-000000000006', 'DEV1006'),
  ('d2000000-0000-0000-0000-000000000007', 'DEV1007'), ('d2000000-0000-0000-0000-000000000008', 'DEV1008'),
  ('d2000000-0000-0000-0000-000000000009', 'DEV1009');

-- "In search of" requests.
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, flexibility, seats,
                           meetup_point_id, chip_in, note) values
  ('d3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'tj-claremont', 'Trader Joe''s',
     now() + interval '1 day', now() + interval '1 day 1 hour', 'pm30', 1, 'd1000000-0000-0000-0000-000000000003', true, 'Just a few bags.'),
  ('d3000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'ont', 'Ontario International Airport (ONT)',
     now() + interval '3 days', now() + interval '3 days 12 hours', 'anytime', 2, 'd1000000-0000-0000-0000-000000000003', true, null),
  ('d3000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', null, 'Rancho Santa Ana Botanic Garden',
     now() + interval '2 days', now() + interval '2 days 2 hours', 'pm60', 1, 'd1000000-0000-0000-0000-000000000003', false, null);
