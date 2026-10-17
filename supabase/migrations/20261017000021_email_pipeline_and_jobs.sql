-- Step 9: email and scheduled jobs. BUILD.md Sections 7 and 8.
-- Functions put rows in email_outbox (never send). The send-emails Edge Function claims due rows here,
-- renders and sends them through Resend, and reports back. Every job is a plain function so it can be
-- tested, and each is safe to run twice: running one again changes nothing.

-- Which notification toggle a template follows. Sign-in codes come from Auth and always send; account
-- notices (a warning, a suspension, a report received) always send too.
create or replace function email_allowed(p_template text, p_prefs jsonb) returns boolean
language sql immutable set search_path = public as $$
  select case
    when p_template in ('account_warning', 'account_suspended', 'report_received') then true
    when p_template = 'new_message' then coalesce((p_prefs ->> 'messages')::boolean, true)
    when p_template in ('seat_accepted', 'seat_declined', 'trip_cancelled', 'trip_time_changed', 'meetup_reminder',
                        'request_ending_soon', 'request_expired') then coalesce((p_prefs ->> 'reminders')::boolean, true)
    else coalesce((p_prefs ->> 'requests')::boolean, true)
  end;
$$;
revoke execute on function email_allowed(text, jsonb) from public, anon, authenticated;

-- What an email may say. The first name of the other person, the trip line, the meetup point's NAME, and a
-- link to the right page. Never a last name, a phone number, the plate, or the exact spot to stand.
create or replace function email_context(p_template text, p_payload jsonb, p_to uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_trip uuid := nullif(p_payload ->> 'trip_id', '')::uuid;
  v_req  uuid := nullif(p_payload ->> 'request_id', '')::uuid;
  v_conv uuid := nullif(p_payload ->> 'conversation_id', '')::uuid;
  v_offer uuid := nullif(p_payload ->> 'offer_id', '')::uuid;
  t trips; r ride_requests; c conversations; sr seat_requests;
  v_other uuid; v_others text[]; v_link text; v_conv_id uuid;
begin
  if p_template in ('seat_requested', 'rider_cancelled') then
    select * into sr from seat_requests where id = v_req;
    v_trip := coalesce(v_trip, sr.trip_id);
    v_other := sr.rider_id;
  elsif v_req is not null and p_template not in ('request_expired') then
    select * into r from ride_requests where id = v_req;
  elsif p_template = 'request_expired' and v_trip is null and v_req is not null then
    select * into r from ride_requests where id = v_req;
  end if;

  if v_trip is not null then select * into t from trips where id = v_trip; end if;
  if v_conv is not null then
    select * into c from conversations where id = v_conv;
    v_trip := c.trip_id;
    select * into t from trips where id = v_trip;
    v_other := case when p_to = c.driver_id then c.rider_id else c.driver_id end;
  end if;

  case p_template
    when 'seat_requested' then v_link := '/inbox';
    when 'rider_cancelled' then v_link := '/trip/' || t.id;
    when 'seat_accepted', 'trip_time_changed', 'trip_cancelled' then v_other := t.driver_id; v_link := '/trip/' || t.id;
    when 'seat_declined' then v_other := t.driver_id; v_link := '/';
    when 'request_expired' then
      if t.id is not null then v_other := t.driver_id; v_link := '/'; else v_link := '/post/ask'; end if;
    when 'offer_received' then
      select * into t from trips where id = (select trip_id from ride_offers where id = v_offer);
      v_other := t.driver_id; v_link := '/request/' || v_req;
    when 'offer_accepted' then
      select * into r from ride_requests where id = v_req;
      v_other := r.rider_id; v_link := '/trip/' || t.id;
    when 'offer_declined' then v_other := r.rider_id; v_link := '/rides';
    when 'offer_closed' then v_other := r.rider_id; v_link := '/';
    when 'offer_withdrawn' then
      v_other := (select driver_id from ride_offers where request_id = v_req and status = 'withdrawn' order by id desc limit 1);
      v_link := '/request/' || v_req;
    when 'match_for_rider' then
      select * into r from ride_requests where id = v_req;
      v_other := t.driver_id; v_link := '/trip/' || t.id;
    when 'match_for_driver' then v_other := r.rider_id; v_link := '/request/' || v_req;
    when 'request_ending_soon' then v_link := '/request/' || v_req;
    when 'meetup_reminder' then
      if p_to = t.driver_id then
        select array_agg(first_name_of(sr2.rider_id) order by sr2.created_at) into v_others
          from seat_requests sr2 where sr2.trip_id = t.id and sr2.status = 'accepted';
        v_link := '/trip/' || t.id;
      else
        v_other := t.driver_id;
        select id into v_conv_id from conversations where trip_id = t.id and rider_id = p_to;
        v_link := case when v_conv_id is not null then '/chat/' || v_conv_id else '/trip/' || t.id end;
      end if;
    when 'new_message' then v_link := '/chat/' || c.id;
    else v_link := '/me';
  end case;

  return jsonb_strip_nulls(jsonb_build_object(
    'link_path', v_link,
    'other_first_name', case when v_other is not null then first_name_of(v_other) end,
    'other_first_names', to_jsonb(v_others),
    'destination', coalesce(t.destination_name, r.destination_name),
    'departs_at', t.departs_at,
    'window_end', r.window_end,
    'meetup_point', (select name from meetup_points where id = t.meetup_point_id),
    'reason', p_payload ->> 'reason',
    'until', p_payload ->> 'until'
  ));
end $$;
revoke execute on function email_context(text, jsonb, uuid) from public, anon, authenticated;

-- The Edge Function's door. Returns up to p_limit emails that are due, with the recipient's address and
-- the context above. Rows for someone who has opted out of that kind of email, or who deleted their
-- account, are closed as skipped instead. Claiming bumps attempts and pushes send_after out (1, 4, 9, 16
-- minutes), so a worker that crashes mid-batch gets the email retried later, never twice at once.
-- After 5 attempts a row is left alone for a person to look at.
create or replace function claim_emails(p_limit int default 50)
returns table (id bigint, to_user_id uuid, to_email text, to_first_name text, template text, context jsonb, attempts int)
language plpgsql security definer set search_path = public as $$
begin
  update email_outbox o
     set sent_at = now(),
         last_error = case when p.deleted_at is not null then 'skipped: account deleted' else 'skipped: turned off in settings' end
    from profiles p
   where p.id = o.to_user_id and o.sent_at is null and o.send_after <= now() and o.attempts < 5
     and (p.deleted_at is not null or not email_allowed(o.template, p.notification_prefs));

  return query
  with due as (
    select o.id from email_outbox o
     where o.sent_at is null and o.send_after <= now() and o.attempts < 5
     order by o.send_after, o.id
     limit p_limit
       for update skip locked
  ), claimed as (
    update email_outbox o
       set attempts = o.attempts + 1,
           send_after = now() + make_interval(mins => (o.attempts + 1) * (o.attempts + 1))
      from due where o.id = due.id
    returning o.id, o.to_user_id, o.template, o.payload, o.attempts
  )
  select c.id, c.to_user_id, u.email::text, p.first_name, c.template,
         email_context(c.template, c.payload, c.to_user_id), c.attempts
    from claimed c
    join profiles p on p.id = c.to_user_id
    join auth.users u on u.id = c.to_user_id
   order by c.id;
end $$;

create or replace function mark_email_sent(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update email_outbox set sent_at = now(), last_error = null where id = p_id and sent_at is null;
$$;
create or replace function mark_email_failed(p_id bigint, p_error text) returns void
language sql security definer set search_path = public as $$
  update email_outbox set last_error = left(coalesce(p_error, 'unknown error'), 500) where id = p_id and sent_at is null;
$$;
revoke execute on function claim_emails(int), mark_email_sent(bigint), mark_email_failed(bigint, text) from public, anon, authenticated;
grant execute on function claim_emails(int), mark_email_sent(bigint), mark_email_failed(bigint, text) to service_role;

-- Scheduled jobs ----------------------------------------------------------------------------------------------------------

-- Pending seat requests on a trip that leaves in under 30 minutes expire, and the rider is told.
create or replace function expire_seat_requests() returns void
language sql security definer set search_path = public as $$
  with expired as (
    update seat_requests sr set status = 'expired', decided_at = now()
      from trips t
     where t.id = sr.trip_id and sr.status = 'pending' and t.departs_at < now() + interval '30 minutes'
    returning sr.id, sr.rider_id, sr.trip_id
  )
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select rider_id, 'request_expired', jsonb_build_object('trip_id', trip_id), 'request_expired:seat:' || id from expired
  on conflict (dedupe_key) do nothing;
$$;

-- Requests whose time has passed expire. Offers waiting on them expire too, and those drivers are told.
create or replace function expire_ride_requests() returns void
language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  with expired as (
    update ride_requests set status = 'expired' where status = 'open' and window_end < now() returning id, rider_id
  ), ins as (
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    select rider_id, 'request_expired', jsonb_build_object('request_id', id), 'request_expired:ride:' || id from expired
    on conflict (dedupe_key) do nothing
  )
  select array_agg(id) into v_ids from expired;

  if v_ids is not null then
    with closed as (
      update ride_offers set status = 'expired' where request_id = any(v_ids) and status = 'pending' returning id, driver_id, request_id
    )
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    select driver_id, 'offer_closed', jsonb_build_object('request_id', request_id, 'reason', 'request_expired'), 'offer_closed:' || id from closed
    on conflict (dedupe_key) do nothing;
  end if;
end $$;

create or replace function expire_offers_for_departed() returns void
language sql security definer set search_path = public as $$
  update ride_offers o set status = 'expired'
    from trips t where t.id = o.trip_id and o.status = 'pending' and t.departs_at < now();
$$;

create or replace function mark_trips_past() returns void
language sql security definer set search_path = public as $$
  update trips set status = 'past' where status = 'open' and departs_at < now() - interval '2 hours';
$$;

-- Two hours before departure, the driver and each accepted rider get a reminder, once.
create or replace function meetup_reminders() returns void
language sql security definer set search_path = public as $$
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select t.driver_id, 'meetup_reminder', jsonb_build_object('trip_id', t.id), 'meetup_reminder:' || t.id || ':' || t.driver_id
    from trips t
   where t.status = 'open' and t.departs_at > now() and t.departs_at <= now() + interval '2 hours'
     and exists (select 1 from seat_requests sr where sr.trip_id = t.id and sr.status = 'accepted')
  union all
  select sr.rider_id, 'meetup_reminder', jsonb_build_object('trip_id', t.id), 'meetup_reminder:' || t.id || ':' || sr.rider_id
    from trips t join seat_requests sr on sr.trip_id = t.id and sr.status = 'accepted'
   where t.status = 'open' and t.departs_at > now() and t.departs_at <= now() + interval '2 hours'
  on conflict (dedupe_key) do nothing;
$$;

-- An open request with an hour left and no offers waiting gets one "extend or cancel" email.
create or replace function request_ending_soon() returns void
language sql security definer set search_path = public as $$
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select r.rider_id, 'request_ending_soon', jsonb_build_object('request_id', r.id), 'request_ending_soon:' || r.id
    from ride_requests r
   where r.status = 'open' and r.window_end > now() and r.window_end <= now() + interval '1 hour'
     and not exists (select 1 from ride_offers o where o.request_id = r.id and o.status = 'pending')
  on conflict (dedupe_key) do nothing;
$$;

-- Data kept for the periods in BUILD.md Section 11, then removed.
create or replace function purge_old_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from messages where created_at < now() - interval '12 months';
  update ride_requests set matched_trip_id = null
   where matched_trip_id in (select id from trips where created_at < now() - interval '24 months');
  delete from ride_requests where created_at < now() - interval '24 months';
  delete from trips where created_at < now() - interval '24 months';        -- seat requests, offers, chats go with them
  delete from email_outbox where sent_at is not null and sent_at < now() - interval '30 days';
  delete from rate_events where at < now() - interval '2 days';
end $$;

-- Wakes the Edge Function through pg_net, with the shared secret from Vault. Does nothing where pg_net or the
-- Vault secrets don't exist (a fresh local database before they are set).
create or replace function drain_email_outbox() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then return; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''email_function_url''' into v_url;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''email_function_secret''' into v_secret;
  if v_url is null or v_secret is null then return; end if;
  execute 'select net.http_post(url := $1, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-function-secret'', $2))'
    using v_url, v_secret;
end $$;

revoke execute on function expire_seat_requests(), expire_ride_requests(), expire_offers_for_departed(), mark_trips_past(),
  meetup_reminders(), request_ending_soon(), purge_old_data(), drain_email_outbox() from public, anon, authenticated;
grant execute on function expire_seat_requests(), expire_ride_requests(), expire_offers_for_departed(), mark_trips_past(),
  meetup_reminders(), request_ending_soon(), purge_old_data(), drain_email_outbox() to service_role;

-- The schedule (BUILD.md Section 7). pg_cron exists on Supabase; elsewhere this is skipped.
do $$
declare j record;
begin
  if to_regnamespace('cron') is null then return; end if;
  for j in select * from (values
    ('expire_seat_requests',       '*/5 * * * *',  'select expire_seat_requests()'),
    ('expire_ride_requests',       '*/5 * * * *',  'select expire_ride_requests()'),
    ('expire_offers_for_departed', '*/5 * * * *',  'select expire_offers_for_departed()'),
    ('mark_trips_past',            '*/10 * * * *', 'select mark_trips_past()'),
    ('meetup_reminders',           '*/5 * * * *',  'select meetup_reminders()'),
    ('request_ending_soon',        '*/10 * * * *', 'select request_ending_soon()'),
    ('matching_nudges',            '*/10 * * * *', 'select matching_nudges()'),
    ('drain_email_outbox',         '* * * * *',    'select drain_email_outbox()'),
    ('purge_old_data',             '0 3 * * *',    'select purge_old_data()')
  ) as v(name, schedule, command) loop
    perform cron.schedule(j.name, j.schedule, j.command);   -- scheduling an existing name replaces it
  end loop;
end $$;
