-- Step 2: what other students see of a person, and the one door to the exact meetup spot.

-- Other people only ever see first name, college, class year, bio, and photo: never last name
-- or email. The view runs with its owner's rights on purpose, so it can read profiles past that
-- table's RLS; the where clause is the filter. (Supabase's security advisor flags
-- security-definer views; this one is the intended exception.)
create view public_profiles as
  select id, first_name, campus_id, class_year, bio, avatar_path
  from profiles
  where deleted_at is null
    and onboarded_at is not null
    and not is_blocked_pair(auth.uid(), id);

revoke all on public_profiles from anon, authenticated;
grant select on public_profiles to authenticated;

-- The exact "stand here" text, readable only by the driver and accepted riders.
create or replace function get_trip_meetup_detail(p_trip uuid)
returns text language sql stable security definer set search_path = public as $$
  select d.stand_at
  from trips t join meetup_point_details d on d.point_id = t.meetup_point_id
  where t.id = p_trip and can_see_trip_private(p_trip);
$$;

revoke execute on function get_trip_meetup_detail(uuid) from public, anon;
grant execute on function get_trip_meetup_detail(uuid) to authenticated, service_role;
