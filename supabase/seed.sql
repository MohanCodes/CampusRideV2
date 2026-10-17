-- BUILD.md 9: reference data. Runs after the migrations on `supabase db reset`.
--
-- Not seeded yet, and why (see the Step 1 report):
--   * meetup_points and meetup_point_details: lat/lng are NOT NULL and need geocoding (Mapbox
--     token), and the "stand here" text has to come from the team. Nothing is guessed.
--   * places.lat / places.lng are left null on purpose (MUDD.md Section 8) until geocoded.

-- Campuses: WEB_FLOWS.md Section 10 for the domains, MUDD.md Section 1 for HMC's safety line.
-- Every domain still needs confirming with each college's IT office (launch checklist).
-- safety_phone stays null for the four colleges whose number has not been confirmed.
insert into campuses (id, name, email_domains, timezone, safety_phone) values
  ('hmc',     'Harvey Mudd College',     array['hmc.edu', 'g.hmc.edu'],                  'America/Los_Angeles', '909-607-2000'),
  ('pomona',  'Pomona College',          array['pomona.edu'],                            'America/Los_Angeles', null),
  ('scripps', 'Scripps College',         array['scrippscollege.edu'],                    'America/Los_Angeles', null),
  ('cmc',     'Claremont McKenna College', array['cmc.edu', 'claremontmckenna.edu'],     'America/Los_Angeles', null),
  ('pitzer',  'Pitzer College',          array['pitzer.edu'],                            'America/Los_Angeles', null);

-- Destinations: MUDD.md Section 8. The first chips are the feed's destination chips.
insert into places (id, name, category, address, chip) values
  ('tj-claremont',     'Trader Joe''s',                                        'grocery',   '475 W Foothill Blvd, Claremont, CA 91711',          'Trader Joe''s'),
  ('target-montclair', 'Target (Montclair)',                                   'shopping',  '9052 Central Ave, Montclair, CA 91763',             'Target'),
  ('target-upland',    'Target (Upland)',                                      'shopping',  '1931 Campus Ave, Upland, CA 91784',                 'Target'),
  ('target-laverne',   'Target (La Verne)',                                    'shopping',  '2462 Foothill Blvd, La Verne, CA 91750',            'Target'),
  ('village',          'Claremont Village',                                    'food',      'Indian Hill Blvd and Yale Ave, Claremont, CA 91711', 'The Village'),
  ('farmers-market',   'Claremont Farmers Market (Sundays 8am-1pm)',           'market',    'Harvard Ave, Claremont, CA 91711',                  'The Village'),
  ('ont',              'Ontario International Airport (ONT)',                  'airport',   'Ontario, CA',                                       'Airport (ONT)'),
  ('lax',              'Los Angeles International Airport (LAX)',              'airport',   'Los Angeles, CA',                                   'LA / LAX'),
  ('union-station',    'LA Union Station',                                     'transit',   'Los Angeles, CA',                                   'LA / LAX'),
  ('claremont-depot',  'Claremont Metrolink Station',                          'transit',   '200 W 1st St, Claremont, CA 91711',                 'Other'),
  ('montclair-plaza',  'Montclair Plaza',                                      'mall',      '5060 E Montclair Plaza Ln, Montclair, CA',          'Other'),
  ('ontario-mills',    'Ontario Mills',                                        'mall',      'I-10 at I-15, Ontario, CA',                         'Other'),
  ('victoria-gardens', 'Victoria Gardens',                                     'mall',      'I-15 at Foothill Blvd, Rancho Cucamonga, CA',       'Other'),
  ('priceless-pets',   'Priceless Pets',                                       'community', 'Foothill Blvd, Claremont, CA',                      'Other');
