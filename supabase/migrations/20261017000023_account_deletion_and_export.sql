-- Step 11: account deletion that leaves "Deleted user", and "Download my data".
--
-- Deleting the sign-in (auth.users) must not delete the person's old trips and reports, so the profile row stops
-- being tied to auth.users by a cascade. After deactivate_account() the row holds no name, bio, photo, or year,
-- only the id that old trips and reports point at. Other students already read people through public_profiles,
-- which leaves out deleted rows, and the app shows "Deleted user" in their place.
alter table profiles drop constraint profiles_id_fkey;

-- The first step of deleting an account. It clears the profile and cancels what is ahead (deactivate_account, Step 10).
-- The second step, removing the sign-in and the photo file, is the delete-account Edge Function, which runs with the
-- service role and only finishes accounts that were closed here. Safe to call twice.
create or replace function request_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from profiles where id = auth.uid() and deleted_at is null) then
    perform check_rate('delete_account', 5, interval '1 hour');
    perform deactivate_account(auth.uid());
  end if;
end $$;
revoke execute on function request_account_deletion() from public, anon;
grant execute on function request_account_deletion() to authenticated;

-- Everything the person has put into the app, as one JSON document: their profile, trips, seat requests, requests,
-- offers, messages in their chats, blocks, and reports they filed. Other people appear by first name only, as they
-- do in the app. Nothing here is kept for anyone but the caller.
create or replace function export_my_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_out jsonb;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  perform check_rate('export_data', 10, interval '1 hour');
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(x) from (
        select p.first_name, p.last_name, p.class_year, p.bio, p.campus_id, p.notification_prefs, p.created_at,
               (select u.email from auth.users u where u.id = v_me) as email
          from profiles p where p.id = v_me) x),
    'trips_i_posted', coalesce((select jsonb_agg(to_jsonb(x) order by x.departs_at desc) from (
        select t.id, t.destination_name, t.departs_at, t.back_by, t.seats_total, t.seats_taken, t.car_make, t.car_color,
               tp.car_plate, mp.name as meetup_point, t.cost_note, t.notes, t.status, t.created_at
          from trips t left join trip_private tp on tp.trip_id = t.id left join meetup_points mp on mp.id = t.meetup_point_id
         where t.driver_id = v_me) x), '[]'),
    'seats_i_asked_for', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select s.id, s.trip_id, t.destination_name, t.departs_at, s.seats, s.message, s.status, s.created_at, s.decided_at
          from seat_requests s join trips t on t.id = s.trip_id where s.rider_id = v_me) x), '[]'),
    'rides_i_asked_for', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select r.id, r.destination_name, r.window_start, r.window_end, r.flexibility, r.seats, mp.name as meetup_point,
               r.chip_in, r.note, r.status, r.created_at
          from ride_requests r left join meetup_points mp on mp.id = r.meetup_point_id where r.rider_id = v_me) x), '[]'),
    'offers_i_made', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select o.id, o.request_id, o.trip_id, o.message, o.status, o.created_at from ride_offers o where o.driver_id = v_me) x), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (
        select m.id, m.conversation_id, c.trip_id,
               case when m.sender_id = v_me then 'me' else first_name_of(m.sender_id) end as from_who,
               m.body, m.created_at
          from messages m join conversations c on c.id = m.conversation_id
         where (c.driver_id = v_me or c.rider_id = v_me) and m.kind = 'user') x), '[]'),
    'people_i_blocked', coalesce((select jsonb_agg(first_name_of(b.blocked_id) order by b.created_at) from blocks b where b.blocker_id = v_me), '[]'),
    'reports_i_filed', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select r.id, r.target_type, r.reason, r.details, r.status, r.created_at from reports r where r.reporter_id = v_me) x), '[]')
  ) into v_out;
  return v_out;
end $$;
revoke execute on function export_my_data() from public, anon;
grant execute on function export_my_data() to authenticated;

-- Settings lists the people the caller has blocked. public_profiles hides a blocked pair from each other, so this
-- reads the names itself and returns only what the list needs: a first name and college, never a last name.
create or replace function my_blocked_users() returns table (user_id uuid, first_name text, campus_id text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, coalesce(p.first_name, 'Deleted user'), p.campus_id, b.created_at
    from blocks b join profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;
revoke execute on function my_blocked_users() from public, anon;
grant execute on function my_blocked_users() to authenticated;
