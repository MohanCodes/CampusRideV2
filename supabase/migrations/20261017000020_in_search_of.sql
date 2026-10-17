-- Step 8: "In search of": ride requests and offers. BUILD.md 6.1, 6.3, WEB_FLOWS.md 4.6 and 4.7.
-- Lock order is always trip, then request, then offer. send_offer takes the same order (trip, then
-- request) so a rider accepting and a driver offering at the same moment can't deadlock.

-- Where to: a curated place, or an "Other" point of interest the app already verified. Same rules as post_trip.
create or replace function check_destination(p_place_id text, p_name text, p_lat double precision, p_lng double precision)
returns table (dest_name text, dest_lat double precision, dest_lng double precision)
language plpgsql security definer set search_path = public as $$
declare pl places; v_name text;
begin
  if p_place_id is not null then
    select * into pl from places where id = p_place_id and active;
    if not found then raise exception 'invalid_request'; end if;
    return query select pl.name, pl.lat, pl.lng;
  else
    v_name := btrim(coalesce(p_name, ''));
    if char_length(v_name) not between 2 and 120 or p_lat is null or p_lng is null
       or p_lat not between 32.0 and 35.9 or p_lng not between -121.0 and -114.0
    then raise exception 'invalid_request'; end if;
    return query select v_name, p_lat, p_lng;
  end if;
end $$;
revoke execute on function check_destination(text, text, double precision, double precision) from public, anon, authenticated;

-- When the rider can go, as a window. "Exactly" is a 10-minute window (the table needs an end after
-- the start); plus or minus 30 or 60 minutes; or the whole local day.
create or replace function request_window(p_when timestamptz, p_flex flexibility_kind, p_tz text)
returns table (win_start timestamptz, win_end timestamptz)
language sql immutable set search_path = public as $$
  select case p_flex
           when 'exact'   then p_when
           when 'pm30'    then p_when - interval '30 minutes'
           when 'pm60'    then p_when - interval '60 minutes'
           else date_trunc('day', p_when at time zone p_tz) at time zone p_tz
         end,
         case p_flex
           when 'exact'   then p_when + interval '10 minutes'
           when 'pm30'    then p_when + interval '30 minutes'
           when 'pm60'    then p_when + interval '60 minutes'
           else (date_trunc('day', p_when at time zone p_tz) + interval '1 day') at time zone p_tz
         end;
$$;
revoke execute on function request_window(timestamptz, flexibility_kind, text) from public, anon, authenticated;

-- Rider asks for a ride.
create or replace function post_ride_request(
  p_place_id text, p_destination_name text, p_destination_lat double precision, p_destination_lng double precision,
  p_when timestamptz, p_flexibility flexibility_kind, p_seats int, p_meetup_point_id uuid, p_chip_in boolean, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me profiles; mp meetup_points; d record; w record;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_tz   text;
  v_id   uuid;
begin
  perform assert_active_user();
  perform check_rate('post_ride_request', 5, interval '1 day');
  select * into me from profiles where id = auth.uid();

  if p_when is null or p_when <= now() then raise exception 'time_in_past'; end if;
  if p_when > now() + interval '7 days' then raise exception 'too_far_ahead'; end if;
  if p_flexibility is null or p_seats is null or p_seats not between 1 and 3 then raise exception 'invalid_request'; end if;
  if (select count(*) from ride_requests where rider_id = auth.uid() and status = 'open' and window_end > now()) >= 2 then
    raise exception 'too_many_requests';
  end if;

  select * into mp from meetup_points
   where id = p_meetup_point_id and status = 'approved' and (campus_id = me.campus_id or shared);
  if not found then raise exception 'meetup_not_allowed'; end if;

  select * into d from check_destination(p_place_id, p_destination_name, p_destination_lat, p_destination_lng);

  if v_note is not null and char_length(v_note) > 200 then raise exception 'invalid_request'; end if;
  if contains_contact_info(v_note) then raise exception 'contact_info'; end if;

  select timezone into v_tz from campuses where id = me.campus_id;
  select * into w from request_window(p_when, p_flexibility, v_tz);

  insert into ride_requests (rider_id, place_id, destination_name, destination_lat, destination_lng,
                             window_start, window_end, flexibility, seats, meetup_point_id, chip_in, note)
  values (auth.uid(), p_place_id, d.dest_name, d.dest_lat, d.dest_lng,
          w.win_start, w.win_end, p_flexibility, p_seats, mp.id, coalesce(p_chip_in, true), v_note)
  returning id into v_id;
  return v_id;
end $$;

-- Rider edits an open request: time, flexibility, seats, chipping in, note. (A new destination is a new request.)
create or replace function update_ride_request(
  p_request uuid, p_when timestamptz, p_flexibility flexibility_kind, p_seats int, p_chip_in boolean, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r ride_requests; me profiles; w record; v_tz text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform assert_active_user();
  select * into r from ride_requests where id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if r.rider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.status <> 'open' then raise exception 'not_open'; end if;

  if p_when is null or p_when <= now() then raise exception 'time_in_past'; end if;
  if p_when > now() + interval '7 days' then raise exception 'too_far_ahead'; end if;
  if p_flexibility is null or p_seats is null or p_seats not between 1 and 3 then raise exception 'invalid_request'; end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception 'invalid_request'; end if;
  if contains_contact_info(v_note) then raise exception 'contact_info'; end if;

  select * into me from profiles where id = auth.uid();
  select timezone into v_tz from campuses where id = me.campus_id;
  select * into w from request_window(p_when, p_flexibility, v_tz);

  update ride_requests
     set window_start = w.win_start, window_end = w.win_end, flexibility = p_flexibility,
         seats = p_seats, chip_in = coalesce(p_chip_in, chip_in), note = v_note
   where id = r.id;
end $$;

-- Rider cancels. Offers waiting on it are closed and their drivers told, once. Cancelling twice does nothing.
create or replace function cancel_ride_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r ride_requests;
begin
  perform assert_active_user();
  select * into r from ride_requests where id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if r.rider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.status = 'cancelled' then return; end if;
  if r.status <> 'open' then raise exception 'not_open'; end if;

  update ride_requests set status = 'cancelled' where id = r.id;
  with closed as (
    update ride_offers set status = 'closed' where request_id = r.id and status = 'pending' returning id, driver_id
  )
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select driver_id, 'offer_closed', jsonb_build_object('request_id', r.id, 'reason', 'request_cancelled'), 'offer_closed:' || id from closed
  on conflict (dedupe_key) do nothing;
end $$;

-- Rider gives an open request 2 more hours.
create or replace function extend_ride_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r ride_requests;
begin
  perform assert_active_user();
  select * into r from ride_requests where id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if r.rider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.status <> 'open' then raise exception 'not_open'; end if;
  update ride_requests set window_end = greatest(window_end, now()) + interval '2 hours' where id = r.id;
end $$;

-- Driver offers one of their trips for a request.
create or replace function send_offer(p_request uuid, p_trip uuid, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t trips; r ride_requests; v_id uuid;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  perform assert_active_user();
  perform check_rate('send_offer', 30, interval '1 day');
  if v_msg is not null and char_length(v_msg) > 300 then raise exception 'invalid_request'; end if;
  if contains_contact_info(v_msg) then raise exception 'contact_info'; end if;

  select * into t from trips where id = p_trip for share;          -- trip first, then the request
  if not found then raise exception 'trip_mismatch'; end if;
  select * into r from ride_requests where id = p_request for share;
  if not found then raise exception 'not_found'; end if;

  if t.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.rider_id = auth.uid() then raise exception 'forbidden'; end if;
  if is_blocked_pair(auth.uid(), r.rider_id) then raise exception 'blocked'; end if;
  if r.status <> 'open' or r.window_end <= now() then raise exception 'not_open'; end if;
  if t.status <> 'open' or t.departs_at <= now() then raise exception 'trip_mismatch'; end if;
  if not (
       (r.place_id is not null and t.place_id = r.place_id)
    or (r.place_id is null and t.place_id is null and lower(t.destination_name) = lower(r.destination_name))
  ) or t.departs_at not between r.window_start and r.window_end
    or t.seats_total - t.seats_taken < r.seats
  then raise exception 'trip_mismatch'; end if;
  if (select count(*) from ride_offers where driver_id = auth.uid() and status = 'pending') >= 10 then
    raise exception 'too_many_offers';
  end if;

  insert into ride_offers (request_id, driver_id, trip_id, message) values (r.id, auth.uid(), t.id, v_msg)
  on conflict (request_id, trip_id) do nothing
  returning id into v_id;
  if v_id is null then raise exception 'already_offered'; end if;

  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (r.rider_id, 'offer_received', jsonb_build_object('request_id', r.id, 'offer_id', v_id, 'trip_id', t.id), 'offer_received:' || v_id)
  on conflict (dedupe_key) do nothing;
  return v_id;
end $$;

-- Driver takes an offer back.
create or replace function withdraw_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ride_offers; v_rider uuid;
begin
  perform assert_active_user();
  select * into o from ride_offers where id = p_offer for update;
  if not found then raise exception 'not_found'; end if;
  if o.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if o.status <> 'pending' then raise exception 'no_longer_available'; end if;
  update ride_offers set status = 'withdrawn' where id = o.id;
  select rider_id into v_rider from ride_requests where id = o.request_id;
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (v_rider, 'offer_withdrawn', jsonb_build_object('request_id', o.request_id), 'offer_withdrawn:' || o.id)
  on conflict (dedupe_key) do nothing;
end $$;

-- Rider accepts or declines an offer. Accepting is ONE transaction that reserves the seat, matches the
-- request, closes every other offer, opens the chat, and queues the emails. If any step fails, none of it happens.
create or replace function respond_offer(p_offer uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req uuid; v_trip uuid; t trips; r ride_requests; o ride_offers; v_sr uuid; v_conv uuid;
begin
  perform assert_active_user();
  select request_id, trip_id into v_req, v_trip from ride_offers where id = p_offer;
  if v_req is null then raise exception 'not_found'; end if;

  select * into t from trips where id = v_trip for update;           -- trip, then request, then offer
  select * into r from ride_requests where id = v_req for update;
  select * into o from ride_offers where id = p_offer for update;

  if r.rider_id <> auth.uid() then raise exception 'forbidden'; end if;

  if not p_accept then
    if o.status <> 'pending' then raise exception 'no_longer_available'; end if;
    update ride_offers set status = 'declined' where id = o.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (o.driver_id, 'offer_declined', jsonb_build_object('request_id', r.id), 'offer_declined:' || o.id)
    on conflict (dedupe_key) do nothing;
    return;
  end if;

  if r.status <> 'open' or o.status <> 'pending' or t.status <> 'open' or t.departs_at <= now()
     or t.seats_taken + r.seats > t.seats_total
  then raise exception 'no_longer_available'; end if;
  if is_blocked_pair(auth.uid(), t.driver_id) then raise exception 'blocked'; end if;

  -- The seat: new, or an earlier request on this trip that was pending, declined, cancelled, or expired.
  insert into seat_requests (trip_id, rider_id, seats, status, decided_at)
  values (t.id, r.rider_id, r.seats, 'accepted', now())
  on conflict (trip_id, rider_id) do update
     set seats = excluded.seats, status = 'accepted', decided_at = now()
   where seat_requests.status <> 'accepted'
  returning id into v_sr;
  if v_sr is null then raise exception 'no_longer_available'; end if;   -- they already have a seat on this trip

  update trips set seats_taken = seats_taken + r.seats where id = t.id;
  update ride_requests set status = 'matched', matched_trip_id = t.id where id = r.id;
  update ride_offers set status = 'accepted' where id = o.id;

  with closed as (
    update ride_offers set status = 'closed' where request_id = r.id and id <> o.id and status = 'pending' returning id, driver_id
  )
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select driver_id, 'offer_closed', jsonb_build_object('request_id', r.id, 'reason', 'chose_another'), 'offer_closed:' || id from closed
  on conflict (dedupe_key) do nothing;

  insert into conversations (trip_id, driver_id, rider_id, closes_at)
  values (t.id, t.driver_id, r.rider_id, t.departs_at + interval '24 hours')
  on conflict (trip_id, rider_id) do update set closes_at = excluded.closes_at
  returning id into v_conv;
  perform add_system_message(v_conv, t.driver_id,
    first_name_of(r.rider_id) || ' accepted ' || first_name_of(t.driver_id) || '''s offer. You can plan the pickup here.');

  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (t.driver_id, 'offer_accepted', jsonb_build_object('trip_id', t.id, 'request_id', r.id), 'offer_accepted:' || o.id)
  on conflict (dedupe_key) do nothing;
end $$;

-- Remembers that a trip was posted to answer a request (the trip stays a normal trip on the board).
create or replace function link_trip_to_request(p_trip uuid, p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active_user();
  if not exists (select 1 from trips where id = p_trip and driver_id = auth.uid()) then raise exception 'forbidden'; end if;
  if not exists (select 1 from ride_requests where id = p_request and status = 'open' and rider_id <> auth.uid()) then
    raise exception 'not_open';
  end if;
  update trips set from_request_id = p_request where id = p_trip;
end $$;

-- Cron: tells drivers about open requests their trips already fit. Safe to run again and again.
create or replace function matching_nudges() returns void
language sql security definer set search_path = public as $$
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select t.driver_id, 'match_for_driver', jsonb_build_object('request_id', r.id, 'trip_id', t.id), 'match_for_driver:' || r.id || ':' || t.id
    from ride_requests r
    join trips t on (
         (r.place_id is not null and t.place_id = r.place_id)
      or (r.place_id is null and t.place_id is null and lower(t.destination_name) = lower(r.destination_name))
    )
   where r.status = 'open' and r.window_end > now()
     and t.status = 'open' and t.departs_at > now()
     and t.departs_at between r.window_start and r.window_end
     and t.seats_total - t.seats_taken >= r.seats
     and t.driver_id <> r.rider_id
     and not exists (select 1 from blocks b where (b.blocker_id = t.driver_id and b.blocked_id = r.rider_id)
                                                or (b.blocker_id = r.rider_id and b.blocked_id = t.driver_id))
     and not exists (select 1 from ride_offers o where o.request_id = r.id and o.trip_id = t.id)
  on conflict (dedupe_key) do nothing;
$$;

-- The Inbox badge also counts offers waiting for the rider to answer.
create or replace function inbox_count() returns int
language sql stable security definer set search_path = public as $$
  select (
    select count(*)::int from seat_requests sr join trips t on t.id = sr.trip_id
     where t.driver_id = auth.uid() and sr.status = 'pending' and t.status = 'open' and t.departs_at > now()
  ) + (
    select count(*)::int from messages m join conversations c on c.id = m.conversation_id
     where auth.uid() in (c.driver_id, c.rider_id) and m.sender_id <> auth.uid()
       and m.read_at is null and m.kind = 'user' and now() < c.closes_at
       and not is_blocked_pair(c.driver_id, c.rider_id)
  ) + (
    select count(*)::int from ride_offers o join ride_requests r on r.id = o.request_id
     where r.rider_id = auth.uid() and o.status = 'pending' and r.status = 'open'
  );
$$;

-- Requests in any state, for My Rides and the request page. security_invoker: a rider sees their own;
-- others see open requests only (the ride_requests policy), and a blocked person's requests are hidden.
create view request_cards with (security_invoker = true) as
select r.id, r.rider_id, r.place_id, r.destination_name, r.window_start, r.window_end, r.flexibility, r.seats,
       r.meetup_point_id, mp.name as meetup_point_name, r.chip_in, r.note, r.status, r.matched_trip_id, r.created_at,
       coalesce(pl.chip, 'Other') as chip,
       pp.first_name as rider_first_name, pp.campus_id as rider_campus_id,
       pp.class_year as rider_class_year, pp.avatar_path as rider_avatar_path,
       (select count(*)::int from ride_offers o where o.request_id = r.id and o.status = 'pending') as pending_offers
from ride_requests r
join public_profiles pp on pp.id = r.rider_id
left join meetup_points mp on mp.id = r.meetup_point_id
left join places pl on pl.id = r.place_id;

-- Offers with the trip and driver, for the rider's Inbox and request page, and the driver's own offers.
-- No plate and no exact spot: those still need an accepted seat.
create view offer_cards with (security_invoker = true) as
select o.id, o.request_id, o.trip_id, o.driver_id, o.status, o.message, o.created_at,
       r.rider_id, r.destination_name as request_destination, r.seats as request_seats,
       t.destination_name, t.departs_at, t.back_by, t.seats_total, (t.seats_total - t.seats_taken) as seats_left,
       t.car_make, t.car_color, t.cost_note, t.status as trip_status,
       mp.name as meetup_point_name,
       pp.first_name as driver_first_name, pp.campus_id as driver_campus_id,
       pp.class_year as driver_class_year, pp.avatar_path as driver_avatar_path
from ride_offers o
join ride_requests r on r.id = o.request_id
join trips t on t.id = o.trip_id
join public_profiles pp on pp.id = o.driver_id
left join meetup_points mp on mp.id = t.meetup_point_id;

revoke all on request_cards, offer_cards from anon, authenticated;
grant select on request_cards, offer_cards to authenticated;

revoke execute on function post_ride_request(text, text, double precision, double precision, timestamptz, flexibility_kind, int, uuid, boolean, text),
  update_ride_request(uuid, timestamptz, flexibility_kind, int, boolean, text), cancel_ride_request(uuid), extend_ride_request(uuid),
  send_offer(uuid, uuid, text), withdraw_offer(uuid), respond_offer(uuid, boolean), link_trip_to_request(uuid, uuid), inbox_count() from public, anon;
grant execute on function post_ride_request(text, text, double precision, double precision, timestamptz, flexibility_kind, int, uuid, boolean, text),
  update_ride_request(uuid, timestamptz, flexibility_kind, int, boolean, text), cancel_ride_request(uuid), extend_ride_request(uuid),
  send_offer(uuid, uuid, text), withdraw_offer(uuid), respond_offer(uuid, boolean), link_trip_to_request(uuid, uuid), inbox_count() to authenticated, service_role;
revoke execute on function matching_nudges() from public, anon, authenticated;
grant execute on function matching_nudges() to service_role;
