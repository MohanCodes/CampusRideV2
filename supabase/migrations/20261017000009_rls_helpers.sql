-- Step 2: two helpers that let the trips and seat_requests policies check each other without
-- looping. BUILD.md 5.8 has trips_read read seat_requests while seat_requests reads trips, which
-- Postgres rejects ("infinite recursion detected in policy"). Security definer skips the inner
-- table's policies. Both only ever answer about the caller (auth.uid()).
create or replace function is_trip_driver(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = p_trip and driver_id = auth.uid());
$$;

create or replace function has_accepted_seat(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from seat_requests
                 where trip_id = p_trip and rider_id = auth.uid() and status = 'accepted');
$$;

revoke execute on function is_trip_driver(uuid), has_accepted_seat(uuid) from public, anon;
grant execute on function is_trip_driver(uuid), has_accepted_seat(uuid) to authenticated, service_role;
