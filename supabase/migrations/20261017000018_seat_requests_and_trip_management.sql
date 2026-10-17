-- Step 6: asking for a seat, answering, cancelling. BUILD.md 6.1 and 6.2.
-- Lock order is always trip first, then the request, so two people acting on the same trip can't
-- deadlock and the last seat can never be given twice.

-- A rider keeps seeing a trip that was cancelled after they had a seat on it, so the email link and
-- "Cancelled" in My Rides still work. cancel_trip marks their request cancelled, so the old policy
-- ("accepted seat") would have hidden it. The plate and exact spot still need an accepted seat.
create or replace function had_seat(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from seat_requests
                 where trip_id = p_trip and rider_id = auth.uid() and status in ('accepted', 'cancelled'));
$$;
revoke execute on function had_seat(uuid) from public, anon;
grant execute on function had_seat(uuid) to authenticated, service_role;

drop policy trips_read on trips;
create policy trips_read on trips for select to authenticated using (
  not is_blocked_pair(auth.uid(), driver_id)
  and (status <> 'cancelled' or driver_id = auth.uid() or had_seat(id))
);

-- Rider asks for a seat. Creates a pending request, or revives one the rider cancelled earlier.
create or replace function request_seat(p_trip uuid, p_seats int, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t     trips;
  v_id  uuid;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  perform assert_active_user();
  perform check_rate('request_seat', 20, interval '1 day');

  if p_seats is null or p_seats not between 1 and 3 then raise exception 'invalid_request'; end if;
  if v_msg is not null and char_length(v_msg) > 300 then raise exception 'invalid_request'; end if;
  if contains_contact_info(v_msg) then raise exception 'contact_info'; end if;

  select * into t from trips where id = p_trip for share;
  if not found then raise exception 'trip_unavailable'; end if;
  if t.driver_id = auth.uid() then raise exception 'own_trip'; end if;
  if is_blocked_pair(auth.uid(), t.driver_id) then raise exception 'blocked'; end if;
  -- Requests close 30 minutes before departure, when unanswered ones expire anyway.
  if t.status <> 'open' or t.departs_at <= now() + interval '30 minutes' then raise exception 'trip_unavailable'; end if;
  if t.seats_taken + p_seats > t.seats_total then raise exception 'trip_full'; end if;

  insert into seat_requests (trip_id, rider_id, seats, message)
  values (p_trip, auth.uid(), p_seats, v_msg)
  on conflict (trip_id, rider_id) do update
     set seats = excluded.seats, message = excluded.message,
         status = 'pending', created_at = now(), decided_at = null
   where seat_requests.status in ('cancelled', 'expired')
  returning id into v_id;
  -- A pending, accepted, or declined request already exists, so nothing was written.
  if v_id is null then raise exception 'already_requested'; end if;

  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (t.driver_id, 'seat_requested', jsonb_build_object('trip_id', t.id, 'request_id', v_id),
          'seat_requested:' || v_id || ':' || floor(extract(epoch from now()))::bigint)
  on conflict (dedupe_key) do nothing;
  return v_id;
end $$;

-- Rider cancels. If the seat was already accepted, the seats go back and the driver is told.
create or replace function cancel_seat_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_trip uuid; r seat_requests; t trips;
begin
  perform assert_active_user();
  select trip_id into v_trip from seat_requests where id = p_request;
  if v_trip is null then raise exception 'not_found'; end if;

  select * into t from trips where id = v_trip for update;
  select * into r from seat_requests where id = p_request for update;
  if r.rider_id <> auth.uid() then raise exception 'forbidden'; end if;

  if r.status = 'pending' then
    update seat_requests set status = 'cancelled', decided_at = now() where id = r.id;
  elsif r.status = 'accepted' then
    if t.departs_at <= now() then raise exception 'trip_unavailable'; end if;
    update trips set seats_taken = seats_taken - r.seats where id = t.id;
    update seat_requests set status = 'cancelled', decided_at = now() where id = r.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (t.driver_id, 'rider_cancelled', jsonb_build_object('trip_id', t.id, 'request_id', r.id),
            'rider_cancelled:' || r.id || ':' || floor(extract(epoch from now()))::bigint)
    on conflict (dedupe_key) do nothing;
  else
    raise exception 'not_pending';
  end if;
end $$;

-- Driver accepts or declines. Accepting reserves the seats, opens the chat, and (through
-- row-level security) reveals the plate and exact meetup spot to that rider, all in one transaction.
create or replace function respond_seat_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_trip_id uuid; r seat_requests; t trips;
begin
  perform assert_active_user();
  select trip_id into v_trip_id from seat_requests where id = p_request;
  if v_trip_id is null then raise exception 'not_found'; end if;

  select * into t from trips where id = v_trip_id for update;
  select * into r from seat_requests where id = p_request for update;

  if t.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.status <> 'pending' then raise exception 'not_pending'; end if;

  if p_accept then
    if t.status <> 'open' or t.departs_at <= now() then raise exception 'trip_unavailable'; end if;
    if t.seats_taken + r.seats > t.seats_total then raise exception 'trip_full'; end if;

    update trips set seats_taken = seats_taken + r.seats where id = t.id;
    update seat_requests set status = 'accepted', decided_at = now() where id = r.id;

    insert into conversations (trip_id, driver_id, rider_id, closes_at)
    values (t.id, t.driver_id, r.rider_id, t.departs_at + interval '24 hours')
    on conflict (trip_id, rider_id) do nothing;

    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (r.rider_id, 'seat_accepted', jsonb_build_object('trip_id', t.id),
            'seat_accepted:' || r.id || ':' || floor(extract(epoch from now()))::bigint)
    on conflict (dedupe_key) do nothing;
  else
    update seat_requests set status = 'declined', decided_at = now() where id = r.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (r.rider_id, 'seat_declined', jsonb_build_object('trip_id', t.id),
            'seat_declined:' || r.id)
    on conflict (dedupe_key) do nothing;
  end if;
end $$;

-- Driver cancels the trip. Every pending and accepted rider is cancelled and emailed once.
-- Calling it again on a cancelled trip does nothing.
create or replace function cancel_trip(p_trip uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t trips;
begin
  perform assert_active_user();
  select * into t from trips where id = p_trip for update;
  if not found then raise exception 'not_found'; end if;
  if t.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if t.status = 'cancelled' then return; end if;
  if t.status <> 'open' or t.departs_at <= now() then raise exception 'trip_unavailable'; end if;

  update trips set status = 'cancelled' where id = t.id;

  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select sr.rider_id, 'trip_cancelled', jsonb_build_object('trip_id', t.id), 'trip_cancelled:' || t.id || ':' || sr.rider_id
    from seat_requests sr where sr.trip_id = t.id and sr.status in ('pending', 'accepted')
  on conflict (dedupe_key) do nothing;

  update seat_requests set status = 'cancelled', decided_at = now()
   where trip_id = t.id and status in ('pending', 'accepted');
  update ride_offers set status = 'closed' where trip_id = t.id and status = 'pending';
end $$;

-- Driver edits time, notes, cost note, or seats. Riders already on the trip are told about a new time.
create or replace function update_trip(
  p_trip uuid, p_departs_at timestamptz, p_back_by timestamptz, p_seats_total int,
  p_cost_note text, p_notes text, p_confirm_overlap boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  t       trips;
  v_cost  text := nullif(btrim(coalesce(p_cost_note, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  perform assert_active_user();
  select * into t from trips where id = p_trip for update;
  if not found then raise exception 'not_found'; end if;
  if t.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if t.status <> 'open' or t.departs_at <= now() then raise exception 'trip_unavailable'; end if;

  if p_departs_at is null or p_departs_at <= now() then raise exception 'time_in_past'; end if;
  if p_departs_at > now() + interval '60 days' then raise exception 'trip_too_far'; end if;
  if p_back_by is not null and p_back_by <= p_departs_at then raise exception 'invalid_trip'; end if;
  if p_seats_total is null or p_seats_total not between 1 and 6 then raise exception 'invalid_trip'; end if;
  if p_seats_total < t.seats_taken then raise exception 'seats_below_taken'; end if;
  if (v_cost is not null and char_length(v_cost) > 200) or (v_notes is not null and char_length(v_notes) > 300)
  then raise exception 'invalid_trip'; end if;
  if contains_contact_info(coalesce(v_cost, '') || ' ' || coalesce(v_notes, '')) then raise exception 'contact_info'; end if;

  if not coalesce(p_confirm_overlap, false) and exists (
    select 1 from trips o
     where o.driver_id = auth.uid() and o.status = 'open' and o.id <> t.id
       and tstzrange(o.departs_at, coalesce(o.back_by, o.departs_at + interval '2 hours'))
        && tstzrange(p_departs_at, coalesce(p_back_by, p_departs_at + interval '2 hours'))
  ) then raise exception 'overlap'; end if;

  update trips set departs_at = p_departs_at, back_by = p_back_by, seats_total = p_seats_total,
                   cost_note = v_cost, notes = v_notes
   where id = t.id;

  if p_departs_at <> t.departs_at then
    update conversations set closes_at = p_departs_at + interval '24 hours' where trip_id = t.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    select sr.rider_id, 'trip_time_changed', jsonb_build_object('trip_id', t.id),
           'trip_time_changed:' || t.id || ':' || sr.rider_id || ':' || floor(extract(epoch from now()))::bigint
      from seat_requests sr where sr.trip_id = t.id and sr.status in ('pending', 'accepted')
    on conflict (dedupe_key) do nothing;
  end if;
end $$;

-- The number on the Inbox badge: seat requests waiting for the caller to answer.
create or replace function inbox_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from seat_requests sr join trips t on t.id = sr.trip_id
   where t.driver_id = auth.uid() and sr.status = 'pending' and t.status = 'open' and t.departs_at > now();
$$;

-- Trips in any state, shaped like board cards, for My Rides. security_invoker keeps row-level
-- security in force: a rider sees a cancelled trip only if they had an accepted seat on it.
create view trip_cards with (security_invoker = true) as
select t.id, t.driver_id, t.place_id, t.destination_name, t.departs_at, t.back_by, t.status,
       t.seats_total, t.seats_taken, (t.seats_total - t.seats_taken) as seats_left,
       t.meetup_point_id, mp.name as meetup_point_name, t.cost_note, t.created_at,
       coalesce(pl.chip, 'Other') as chip,
       pp.first_name as driver_first_name, pp.campus_id as driver_campus_id,
       pp.class_year as driver_class_year, pp.avatar_path as driver_avatar_path
from trips t
join public_profiles pp on pp.id = t.driver_id
left join meetup_points mp on mp.id = t.meetup_point_id
left join places pl on pl.id = t.place_id;
revoke all on trip_cards from anon, authenticated;
grant select on trip_cards to authenticated;

revoke execute on function request_seat(uuid, int, text), cancel_seat_request(uuid), respond_seat_request(uuid, boolean),
  cancel_trip(uuid), update_trip(uuid, timestamptz, timestamptz, int, text, text, boolean), inbox_count() from public, anon;
grant execute on function request_seat(uuid, int, text), cancel_seat_request(uuid), respond_seat_request(uuid, boolean),
  cancel_trip(uuid), update_trip(uuid, timestamptz, timestamptz, int, text, text, boolean), inbox_count() to authenticated, service_role;
