-- BUILD.md 5.6: helper functions that read tables. contains_contact_info is in an earlier migration.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and deleted_at is null);
$$;

create or replace function is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- True when the caller is the trip's driver or has an accepted seat on it.
create or replace function can_see_trip_private(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = p_trip and driver_id = auth.uid())
      or exists (select 1 from seat_requests
                 where trip_id = p_trip and rider_id = auth.uid() and status = 'accepted');
$$;

create or replace function assert_active_user() returns void
language plpgsql stable security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into p from profiles where id = auth.uid() and deleted_at is null;
  if not found or p.onboarded_at is null then raise exception 'not_onboarded'; end if;
  if p.suspended_until is not null and p.suspended_until > now() then
    raise exception 'account_suspended';
  end if;
end $$;

-- Functions in public are callable as RPCs by default. These are for policies and other
-- functions, so signed-out visitors (anon) get no access.
revoke execute on function is_admin(), is_blocked_pair(uuid, uuid),
  can_see_trip_private(uuid), assert_active_user() from public, anon;
grant execute on function is_admin(), is_blocked_pair(uuid, uuid),
  can_see_trip_private(uuid), assert_active_user() to authenticated, service_role;
