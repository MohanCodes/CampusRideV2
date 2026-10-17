-- Step 9: the email pipeline and the scheduled jobs. BUILD.md Sections 7 and 8.
-- Every kind of email is produced by the real functions, then claimed the way the Edge Function claims it.
-- Run with `supabase test db`. Everything rolls back. (Two claimers at once: supabase/tests/race/emails.mjs.)
begin;
select plan(75);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d01', 'dana@hmc.edu'), ('00000000-0000-0000-0000-000000000d02', 'drew@hmc.edu'), ('00000000-0000-0000-0000-000000000a01', 'rae@pomona.edu'), ('00000000-0000-0000-0000-000000000a02', 'rob@pomona.edu'),
  ('00000000-0000-0000-0000-000000000a03', 'ria@pomona.edu'), ('00000000-0000-0000-0000-000000000b01', 'stan@pomona.edu'), ('00000000-0000-0000-0000-000000000e01', 'gone@pomona.edu');
update profiles set onboarded_at = now(), last_name = 'Secretlast', first_name = 'Person';
update profiles set first_name = case id when '00000000-0000-0000-0000-000000000d01' then 'Dana' when '00000000-0000-0000-0000-000000000d02' then 'Drew' when '00000000-0000-0000-0000-000000000a01' then 'Rae' when '00000000-0000-0000-0000-000000000a02' then 'Rob' when '00000000-0000-0000-0000-000000000a03' then 'Ria' else first_name end;

-- Test-only point and coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ('00000000-0000-0000-0000-0000000000f1', 'hmc', 'Platt Campus Center', 'hub', 0, 0, true);
insert into meetup_point_details (point_id, stand_at) values ('00000000-0000-0000-0000-0000000000f1', 'Stand by the secret door');

-- Trips. T1 and T2: the main ones. T3, T4: for offers. T5 leaves in 90 minutes (reminders). T6 leaves in 20 minutes (expiry).
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000d01',  'tj-claremont', 'Trader Joe''s', now() + interval '1 day' + interval '30 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000d01',  'target-montclair', 'Target', now() + interval '3 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000d01',  'ont', 'ONT', now() + interval '1 day' + interval '10 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000d02', 'ont', 'ONT', now() + interval '1 day' + interval '20 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Mazda', 'Red'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000d01',  'lax', 'LAX', now() + interval '90 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000d01',  'lax', 'LAX', now() + interval '20 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue');
insert into trip_private (trip_id, car_plate) select id, 'PLATEX' || right(id::text, 2) from trips where driver_id in ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d02');

-- Seat flow: requested, accepted, declined, cancelled -------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select request_seat('00000000-0000-0000-0000-000000000101', 1, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select request_seat('00000000-0000-0000-0000-000000000101', 1, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), true);
select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a02'), false);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'));
select request_seat('00000000-0000-0000-0000-000000000101', 1, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), true);

-- Chat: a message each way ------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

insert into messages (conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-000000000a01', 'On my way' from conversations where trip_id = '00000000-0000-0000-0000-000000000101';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

insert into messages (conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-000000000d01', 'See you there' from conversations where trip_id = '00000000-0000-0000-0000-000000000101';

-- Trip changes: a new time (T1), a cancellation (T2) ------------------------------------------------------------------------------------
select update_trip('00000000-0000-0000-0000-000000000101', now() + interval '1 day' + interval '6 hours', null, 3, null, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select request_seat('00000000-0000-0000-0000-000000000102', 1, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000102' and rider_id = '00000000-0000-0000-0000-000000000a02'), true);
select cancel_trip('00000000-0000-0000-0000-000000000102');

-- Offers: received, accepted, closed (another driver), declined, withdrawn -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select post_ride_request('ont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'ont'), '00000000-0000-0000-0000-000000000103', 'Happy to');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'ont'), '00000000-0000-0000-0000-000000000104', null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select respond_offer((select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000103'), true);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select post_ride_request('ont', null, null, null, now() + interval '1 day', 'pm60', 1, '00000000-0000-0000-0000-0000000000f1', true, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d02';

select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'ont' and status = 'open'), '00000000-0000-0000-0000-000000000104', null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select respond_offer((select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000104' and request_id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'ont' and status = 'open')), false);
select post_ride_request('ont', null, null, null, now() + interval '1 day', 'pm30', 1, '00000000-0000-0000-0000-0000000000f1', true, null);
reset role;
set local request.jwt.claim.sub = '';
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color)
  values ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000d01', 'ont', 'ONT', now() + interval '1 day' + interval '5 minutes', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue');
reset role;
set local request.jwt.claim.sub = '';

insert into trip_private values ('00000000-0000-0000-0000-000000000107', 'PLATEXX07');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select send_offer((select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'ont' and status = 'open' order by created_at desc limit 1), '00000000-0000-0000-0000-000000000107', null);
select withdraw_offer((select id from ride_offers where trip_id = '00000000-0000-0000-0000-000000000107'));

-- A trip posted for a request that is already open (match_for_rider), and a request a trip already fits (match_for_driver) ---------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select post_trip('ont', null, null, null, now() + interval '1 day' + interval '15 minutes', null, 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'PLATEX99', null, null, true);
reset role;
set local request.jwt.claim.sub = '';

select matching_nudges();

-- Jobs that send: ending soon, reminders, expiry -------------------------------------------------------------------------------------------------------
update ride_requests set window_start = now() - interval '1 hour', window_end = now() + interval '30 minutes'
  where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'ont' and status = 'open' and id = (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a02' and place_id = 'ont' and status = 'open' order by created_at limit 1);
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000a01', 1, 'accepted');
update trips set seats_taken = 1 where id = '00000000-0000-0000-0000-000000000105';
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000a03', 1, 'pending');
insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id, status)
  values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000a03', 'lax', 'LAX', now() - interval '3 hours', now() - interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1', 'open');
insert into ride_offers (request_id, driver_id, trip_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000105');
select request_ending_soon();
select meetup_reminders();
select expire_seat_requests();
select expire_ride_requests();
-- Account notices come from the moderation functions in Step 10; here they are queued directly.
insert into email_outbox (to_user_id, template, payload, dedupe_key) values
  ('00000000-0000-0000-0000-000000000a03', 'report_received', '{}', 'k:report'),
  ('00000000-0000-0000-0000-000000000a03', 'account_warning', '{}', 'k:warn'),
  ('00000000-0000-0000-0000-000000000a03', 'account_suspended', '{"until": "2026-11-01"}', 'k:susp');

-- Who may call what ---------------------------------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'claim_emails(integer)', 'execute'), 'signed-in users cannot claim emails');
select ok(not has_function_privilege('anon', 'mark_email_sent(bigint)', 'execute'), 'or mark them sent');
select ok(has_function_privilege('service_role', 'claim_emails(integer)', 'execute'), 'only the Edge Function''s service role can');
select ok(not has_function_privilege('authenticated', 'purge_old_data()', 'execute'), 'and the jobs are not callable from the browser');

-- Every kind of email comes through, with an address and a link ------------------------------------------------------------------------------------------
create temp table claimed on commit drop as select * from claim_emails(500);
select is((select count(distinct template) from claimed), 20::bigint, 'all 20 templates are produced and claimed');
select is((select string_agg(distinct template, ', ' order by template) from claimed where template not in
  ('seat_requested','seat_accepted','seat_declined','request_expired','trip_cancelled','trip_time_changed','rider_cancelled','offer_received','offer_accepted',
   'offer_declined','offer_closed','offer_withdrawn','match_for_rider','match_for_driver','request_ending_soon','meetup_reminder','new_message',
   'report_received','account_warning','account_suspended')), null::text, 'and none is outside the list in BUILD.md Section 8.2');
select ok((select bool_and(to_email like '%@%.edu' and context ->> 'link_path' like '/%') from claimed), 'each has an address and a link to a page on the site');
select is((select count(*) from claimed where to_email is null), 0::bigint, 'none is missing an address');

-- What the emails may say ---------------------------------------------------------------------------------------------------------------------------------
select is((select count(*) from claimed where context::text ilike '%Secretlast%'), 0::bigint, 'no email carries anyone''s last name');
select is((select count(*) from claimed where context::text ilike '%PLATE%'), 0::bigint, 'or a plate');
select is((select count(*) from claimed where context::text ilike '%secret door%' or context::text ilike '%stand_at%'), 0::bigint, 'or the exact spot to stand');
select is((select count(*) from claimed where context::text ~ '[0-9]{3}[-. ][0-9]{3}[-. ][0-9]{4}'), 0::bigint, 'or a phone number');
select is((select context ->> 'other_first_name' from claimed where template = 'seat_requested' limit 1), 'Rae', 'a seat request email names the rider by first name');
select is((select context ->> 'destination' from claimed where template = 'seat_requested' limit 1), 'Trader Joe''s', 'and says where the trip goes');
select is((select context ->> 'link_path' from claimed where template = 'seat_requested' limit 1), '/inbox', 'and links to the inbox');
select is((select context ->> 'other_first_name' from claimed where template = 'seat_accepted' and to_user_id = '00000000-0000-0000-0000-000000000a01' limit 1), 'Dana', 'an accepted email names the driver');
select ok((select (context ->> 'link_path') like '/trip/%' from claimed where template = 'seat_accepted' limit 1), 'and links to the trip');
select is((select context ->> 'meetup_point' from claimed where template = 'seat_accepted' and to_user_id = '00000000-0000-0000-0000-000000000a01' limit 1), 'Platt Campus Center', 'with the meetup point''s name (public), not the spot');
select ok((select (context ->> 'link_path') like '/chat/%' from claimed where template = 'new_message' limit 1), 'a new-message email links to the chat');
select is((select context ->> 'link_path' from claimed where template = 'offer_received' limit 1), '/request/' || (select id from ride_requests where rider_id = '00000000-0000-0000-0000-000000000a01' and place_id = 'ont'), 'an offer email links to the request');
select ok((select context ->> 'other_first_name' from claimed where template = 'offer_received' limit 1) in ('Dana', 'Drew'), 'and names the driver');
select ok((select (context -> 'other_first_names') ? 'Rae' from claimed where template = 'meetup_reminder' and to_user_id = '00000000-0000-0000-0000-000000000d01' limit 1), 'a driver''s reminder lists the accepted riders by first name');
select is((select context ->> 'other_first_name' from claimed where template = 'meetup_reminder' and to_user_id = '00000000-0000-0000-0000-000000000a01' limit 1), 'Dana', 'a rider''s reminder names the driver');
select is((select context ->> 'until' from claimed where template = 'account_suspended' limit 1), '2026-11-01', 'a suspension email carries the end date');

-- Once only ---------------------------------------------------------------------------------------------------------------------------------------------------
select is((select count(*) from claim_emails(500)), 0::bigint, 'claiming again straight away returns nothing: claimed rows are not handed out twice');
select ok((select min(attempts) >= 1 and max(attempts) = 1 from claimed), 'each claim counts as one attempt');
select ok((select bool_and(send_after > now() + interval '30 seconds') from email_outbox where id in (select id from claimed)), 'and pushes the retry time out');
select is((select count(*) from email_outbox where sent_at is not null and last_error is null), 0::bigint, 'nothing is marked sent until the sender says so');
select lives_ok($$ select mark_email_sent(id) from claimed $$, 'the sender reports each email sent');
select is((select count(*) from email_outbox where sent_at is null and attempts > 0), 0::bigint, 'all are marked sent');
update email_outbox set send_after = now() - interval '1 minute';
select is((select count(*) from claim_emails(500)), 0::bigint, 'a sent email is never claimed again, even when its time is long past');

-- Jobs add nothing the second time ------------------------------------------------------------------------------------------------------------------------------
create temp table before_count on commit drop as select count(*) n from email_outbox;
select request_ending_soon(); select meetup_reminders(); select expire_seat_requests(); select expire_ride_requests(); select matching_nudges();
select expire_offers_for_departed(); select mark_trips_past();
select is((select count(*) from email_outbox), (select n from before_count), 'running every job again queues no duplicate emails');

-- Failures and retries ---------------------------------------------------------------------------------------------------------------------------------------------
insert into email_outbox (to_user_id, template, payload, dedupe_key) values ('00000000-0000-0000-0000-000000000a01', 'account_warning', '{}', 'k:retry');
create temp table first_try on commit drop as select * from claim_emails(10);
select is((select attempts from first_try), 1, 'a new email is claimed once');
select lives_ok($$ select mark_email_failed((select id from email_outbox where dedupe_key = 'k:retry'), repeat('x', 800)) $$, 'the sender reports a failure');
select is((select char_length(last_error) from email_outbox where dedupe_key = 'k:retry'), 500, 'the error is saved, shortened to 500 characters');
select is((select count(*) from email_outbox where dedupe_key = 'k:retry' and sent_at is null), 1::bigint, 'and the email stays unsent');
select is((select count(*) from claim_emails(10)), 0::bigint, 'it is not retried straight away');
update email_outbox set send_after = now() - interval '1 second' where dedupe_key = 'k:retry';
select is((select attempts from claim_emails(10)), 2, 'but is retried later, as attempt 2');
update email_outbox set send_after = now() - interval '1 second' where dedupe_key = 'k:retry';
select is((select attempts from claim_emails(10)), 3, 'then attempt 3');
update email_outbox set send_after = now() - interval '1 second' where dedupe_key = 'k:retry';
select is((select attempts from claim_emails(10)), 4, 'attempt 4');
update email_outbox set send_after = now() - interval '1 second' where dedupe_key = 'k:retry';
select is((select attempts from claim_emails(10)), 5, 'attempt 5');
update email_outbox set send_after = now() - interval '1 second' where dedupe_key = 'k:retry';
select is((select count(*) from claim_emails(10)), 0::bigint, 'after 5 attempts it is left for a person to review');
select is((select count(*) from email_outbox where dedupe_key = 'k:retry' and sent_at is null and attempts = 5), 1::bigint, 'still there, unsent, with its error');

-- Notification settings ---------------------------------------------------------------------------------------------------------------------------------------------
update profiles set notification_prefs = '{"requests": false, "messages": false, "reminders": false}' where id = '00000000-0000-0000-0000-000000000a02';
insert into email_outbox (to_user_id, template, payload, dedupe_key) values
  ('00000000-0000-0000-0000-000000000a02', 'offer_received', '{}', 'p:1'), ('00000000-0000-0000-0000-000000000a02', 'new_message', '{}', 'p:2'), ('00000000-0000-0000-0000-000000000a02', 'meetup_reminder', '{}', 'p:3'),
  ('00000000-0000-0000-0000-000000000a02', 'seat_accepted', '{}', 'p:4'), ('00000000-0000-0000-0000-000000000a02', 'trip_cancelled', '{}', 'p:5'), ('00000000-0000-0000-0000-000000000a02', 'account_warning', '{}', 'p:6');
create temp table prefs_claim on commit drop as select * from claim_emails(50);
select is((select string_agg(template, ',') from prefs_claim where to_user_id = '00000000-0000-0000-0000-000000000a02'), 'account_warning', 'with everything turned off, only the account notice is sent');
select is((select count(*) from email_outbox where to_user_id = '00000000-0000-0000-0000-000000000a02' and dedupe_key like 'p:%' and sent_at is not null and last_error = 'skipped: turned off in settings'),
          5::bigint, 'the others are closed as skipped, not left to retry');
select ok(email_allowed('new_message', '{"messages": true, "requests": false, "reminders": false}'), 'the chat toggle governs new messages');
select ok(not email_allowed('seat_requested', '{"requests": false}'), 'the requests toggle governs seat requests and offers');
select ok(not email_allowed('meetup_reminder', '{"reminders": false}'), 'the reminders toggle governs reminders');
select ok(not email_allowed('seat_accepted', '{"reminders": false}'), 'and acceptances, declines, and cancellations');
select ok(email_allowed('account_suspended', '{"requests": false, "messages": false, "reminders": false}'), 'account notices always send');
select ok(email_allowed('offer_received', '{}'), 'an empty settings object means everything is on');

-- A deleted account is not emailed ----------------------------------------------------------------------------------------------------------------------------------
update profiles set deleted_at = now() where id = '00000000-0000-0000-0000-000000000e01';
insert into email_outbox (to_user_id, template, payload, dedupe_key) values ('00000000-0000-0000-0000-000000000e01', 'account_warning', '{}', 'del:1');
select is((select count(*) from claim_emails(50) where to_user_id = '00000000-0000-0000-0000-000000000e01'), 0::bigint, 'nothing is sent to a deleted account');
select is((select last_error from email_outbox where dedupe_key = 'del:1'), 'skipped: account deleted', 'it is closed as skipped');

-- The jobs, one by one ------------------------------------------------------------------------------------------------------------------------------------------------
-- (Earlier steps left plenty of rows; each check below names its own.)
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color, status) values
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000d01', 'ont', 'ONT', now() - interval '3 hours', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open'),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000d01', 'ont', 'ONT', now() - interval '1 hour', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'open');
select mark_trips_past();
select is((select status::text from trips where id = '00000000-0000-0000-0000-000000000108'), 'past', 'a trip that left over 2 hours ago is marked past');
select is((select status::text from trips where id = '00000000-0000-0000-0000-000000000109'), 'open', 'one that left an hour ago stays open');

select is((select status::text from seat_requests where trip_id = '00000000-0000-0000-0000-000000000106' and rider_id = '00000000-0000-0000-0000-000000000a03'), 'expired', 'a pending seat request on a trip leaving in 20 minutes expired');
select is((select count(*) from email_outbox where template = 'request_expired' and to_user_id = '00000000-0000-0000-0000-000000000a03' and dedupe_key like 'request_expired:seat:%'), 1::bigint, 'and the rider was told once');
select is((select status::text from ride_requests where id = '00000000-0000-0000-0000-00000000c001'), 'expired', 'a request whose time passed expired');
select is((select status::text from ride_offers where request_id = '00000000-0000-0000-0000-00000000c001'), 'expired', 'with its waiting offer');
select is((select count(*) from email_outbox where template = 'offer_closed' and to_user_id = '00000000-0000-0000-0000-000000000d01' and payload ->> 'reason' = 'request_expired'), 1::bigint, 'and that driver was told');

select is((select count(*) from email_outbox where template = 'request_ending_soon' and to_user_id = '00000000-0000-0000-0000-000000000a02'), 1::bigint, 'a request with an hour left and no offers got one ending-soon email');
select is((select count(*) from email_outbox where template = 'meetup_reminder' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000105'), 2::bigint, 'a trip leaving in 90 minutes reminds the driver and the accepted rider');
select is((select count(*) from email_outbox where template = 'meetup_reminder' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000102'), 0::bigint, 'a cancelled trip is not reminded about');
select is((select count(*) from email_outbox where template = 'meetup_reminder' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000103'), 0::bigint, 'nor one far in the future');
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000a02', 1, 'accepted');
select meetup_reminders();
select is((select count(*) from email_outbox where template = 'meetup_reminder' and payload ->> 'trip_id' = '00000000-0000-0000-0000-000000000105'), 3::bigint, 'a rider who joins later gets their reminder, and nobody gets a second one');

-- Purging old data -----------------------------------------------------------------------------------------------------------------------------------------------------
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color, status, created_at) values
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000d01', 'ont', 'ONT', now() - interval '25 months', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'past', now() - interval '25 months'),
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000d01', 'ont', 'ONT', now() - interval '23 months', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue', 'past', now() - interval '23 months');
insert into trip_private values ('00000000-0000-0000-0000-000000000110', 'OLD1'), ('00000000-0000-0000-0000-000000000111', 'OLD2');
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000a01', 1, 'accepted');
insert into conversations (id, trip_id, driver_id, rider_id, closes_at) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a01', now() - interval '24 months');
insert into seat_requests (trip_id, rider_id, seats, status) values ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000a01', 1, 'accepted');
insert into conversations (id, trip_id, driver_id, rider_id, closes_at) values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a01', now() - interval '22 months');
insert into messages (conversation_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000000a01', 'old message', now() - interval '13 months'), ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000000a01', 'newer message', now() - interval '11 months'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000a01', 'goes with its trip', now() - interval '2 months');
insert into ride_requests (id, rider_id, destination_name, window_start, window_end, seats, meetup_point_id, status, matched_trip_id, created_at) values
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000a01', 'ONT', now() - interval '25 months', now() - interval '25 months' + interval '1 hour', 1, '00000000-0000-0000-0000-0000000000f1', 'matched', '00000000-0000-0000-0000-000000000111', now() - interval '25 months');
insert into email_outbox (to_user_id, template, payload, sent_at, dedupe_key) values
  ('00000000-0000-0000-0000-000000000a01', 'seat_accepted', '{}', now() - interval '31 days', 'old:sent'), ('00000000-0000-0000-0000-000000000a01', 'seat_accepted', '{}', now() - interval '29 days', 'new:sent');
insert into email_outbox (to_user_id, template, payload, send_after, dedupe_key) values ('00000000-0000-0000-0000-000000000a01', 'seat_accepted', '{}', now() - interval '40 days', 'old:unsent');
insert into rate_events (user_id, kind, at) values ('00000000-0000-0000-0000-000000000a01', 'x', now() - interval '3 days'), ('00000000-0000-0000-0000-000000000a01', 'x', now() - interval '1 day');
select purge_old_data();
select is((select count(*) from messages where body = 'old message'), 0::bigint, 'a message older than 12 months is purged');
select is((select count(*) from messages where body = 'newer message'), 1::bigint, 'one from 11 months ago is kept');
select is((select count(*) from trips where id = '00000000-0000-0000-0000-000000000110'), 0::bigint, 'a trip older than 24 months is purged');
select is((select count(*) from seat_requests where trip_id = '00000000-0000-0000-0000-000000000110') + (select count(*) from conversations where id = '00000000-0000-0000-0000-00000000d001') + (select count(*) from messages where body = 'goes with its trip'), 0::bigint, 'with its requests, chat, and messages');
select is((select count(*) from trips where id = '00000000-0000-0000-0000-000000000111'), 1::bigint, 'a 23-month-old trip is kept');
select is((select count(*) from ride_requests where id = '00000000-0000-0000-0000-00000000c002'), 0::bigint, 'an old request is purged (even though it pointed at a kept trip)');
select is((select count(*) from email_outbox where dedupe_key = 'old:sent'), 0::bigint, 'a sent email older than 30 days is purged');
select is((select count(*) from email_outbox where dedupe_key in ('new:sent', 'old:unsent')), 2::bigint, 'a recent one, and an unsent one, are kept');
select is((select count(*) from rate_events where kind = 'x'), 1::bigint, 'rate events older than 2 days are purged');

-- The job that wakes the sender is harmless without pg_net and Vault ---------------------------------------------------------------------------------------------------
select lives_ok($$ select drain_email_outbox() $$, 'it does nothing, quietly, where the secrets are not set');

select * from finish();
rollback;
