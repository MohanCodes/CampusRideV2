-- Step 5: posting a trip. BUILD.md 6.1, 6.4, 6.6.

-- The rate limiter every write function calls. Records the attempt and refuses when the caller has
-- made more than p_max of this kind inside the window. A refused call rolls back, so refusals are
-- not counted against the person. (purge_old_data clears events after 2 days.)
create or replace function check_rate(p_kind text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into rate_events (user_id, kind) values (auth.uid(), p_kind);
  select count(*) into v_count
    from rate_events where user_id = auth.uid() and kind = p_kind and at > now() - p_window;
  if v_count > p_max then raise exception 'rate_limited'; end if;
end $$;
revoke execute on function check_rate(text, int, interval) from public, anon;
grant execute on function check_rate(text, int, interval) to authenticated, service_role;

create or replace function post_trip(
  p_place_id           text,
  p_destination_name   text,
  p_destination_lat    double precision,
  p_destination_lng    double precision,
  p_departs_at         timestamptz,
  p_back_by            timestamptz,
  p_seats_total        int,
  p_meetup_point_id    uuid,
  p_car_make           text,
  p_car_color          text,
  p_car_plate          text,
  p_cost_note          text,
  p_notes              text,
  p_confirm_overlap    boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me        profiles;
  mp        meetup_points;
  pl        places;
  v_name    text;
  v_lat     double precision;
  v_lng     double precision;
  v_cost    text := nullif(btrim(coalesce(p_cost_note, '')), '');
  v_notes   text := nullif(btrim(coalesce(p_notes, '')), '');
  v_make    text := btrim(coalesce(p_car_make, ''));
  v_color   text := btrim(coalesce(p_car_color, ''));
  v_plate   text := upper(btrim(coalesce(p_car_plate, '')));
  v_trip    uuid;
begin
  perform assert_active_user();
  perform check_rate('post_trip', 10, interval '1 day');
  select * into me from profiles where id = auth.uid();

  -- When
  if p_departs_at is null or p_departs_at <= now() then raise exception 'time_in_past'; end if;
  if p_departs_at > now() + interval '60 days' then raise exception 'trip_too_far'; end if;
  if p_back_by is not null and p_back_by <= p_departs_at then raise exception 'invalid_trip'; end if;
  if p_seats_total is null or p_seats_total not between 1 and 6 then raise exception 'invalid_trip'; end if;

  -- Where to meet: an approved point that belongs to the driver's campus or is shared.
  select * into mp from meetup_points
   where id = p_meetup_point_id and status = 'approved' and (campus_id = me.campus_id or shared);
  if not found then raise exception 'meetup_not_allowed'; end if;

  -- Where to go: a curated place, or an "Other" point of interest the app already verified.
  if p_place_id is not null then
    select * into pl from places where id = p_place_id and active;
    if not found then raise exception 'invalid_trip'; end if;
    v_name := pl.name; v_lat := pl.lat; v_lng := pl.lng;
  else
    v_name := btrim(coalesce(p_destination_name, ''));
    v_lat := p_destination_lat; v_lng := p_destination_lng;
    if char_length(v_name) not between 2 and 120
       or v_lat is null or v_lng is null
       or v_lat not between 32.0 and 35.9 or v_lng not between -121.0 and -114.0   -- Southern California
    then raise exception 'invalid_trip'; end if;
  end if;

  -- Notes: no phone numbers, emails, handles, or links. Contact stays in the app chat.
  if (v_cost is not null and char_length(v_cost) > 200) or (v_notes is not null and char_length(v_notes) > 300)
  then raise exception 'invalid_trip'; end if;
  if contains_contact_info(coalesce(v_cost, '') || ' ' || coalesce(v_notes, '')) then
    raise exception 'contact_info';
  end if;

  -- Car. The plate stays hidden until a rider is accepted.
  if char_length(v_make) not between 1 and 40 or char_length(v_color) not between 1 and 40
     or v_plate !~ '^[A-Z0-9][A-Z0-9 -]{0,8}[A-Z0-9]$'
  then raise exception 'invalid_trip'; end if;

  -- A driver can't be in two places at once, unless they confirm.
  if not coalesce(p_confirm_overlap, false) and exists (
    select 1 from trips t
     where t.driver_id = auth.uid() and t.status = 'open'
       and tstzrange(t.departs_at, coalesce(t.back_by, t.departs_at + interval '2 hours'))
        && tstzrange(p_departs_at, coalesce(p_back_by, p_departs_at + interval '2 hours'))
  ) then raise exception 'overlap'; end if;

  insert into trips (driver_id, place_id, destination_name, destination_lat, destination_lng, departs_at, back_by,
                     seats_total, meetup_point_id, car_make, car_color, cost_note, notes)
  values (auth.uid(), p_place_id, v_name, v_lat, v_lng, p_departs_at, p_back_by,
          p_seats_total, mp.id, v_make, v_color, v_cost, v_notes)
  returning id into v_trip;

  insert into trip_private (trip_id, car_plate) values (v_trip, v_plate);

  -- Tell riders whose open request this trip fits: same place, departing inside their window,
  -- and room for them. Once per rider per trip.
  if p_place_id is not null then
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    select r.rider_id, 'match_for_rider', jsonb_build_object('trip_id', v_trip, 'request_id', r.id),
           'match_for_rider:' || r.id || ':' || v_trip
      from ride_requests r
     where r.status = 'open' and r.place_id = p_place_id
       and r.window_end > now()
       and p_departs_at between r.window_start and r.window_end
       and r.seats <= p_seats_total
       and r.rider_id <> auth.uid()
       and not is_blocked_pair(auth.uid(), r.rider_id)
    on conflict (dedupe_key) do nothing;
  end if;

  return v_trip;
end $$;

revoke execute on function post_trip(text, text, double precision, double precision, timestamptz, timestamptz,
  int, uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function post_trip(text, text, double precision, double precision, timestamptz, timestamptz,
  int, uuid, text, text, text, text, text, boolean) to authenticated, service_role;
