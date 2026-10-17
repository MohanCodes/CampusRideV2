-- Step 10: reports, blocks, and the admin tools. BUILD.md 6.1, 10; WEB_FLOWS.md 5F and 6.4.

-- A reported chat message: reports.target_id is a uuid but messages.id is a bigint, so a message report
-- points at its conversation (target_id) and names the message here.
alter table reports add column message_id bigint;

-- Suspended people can't write anywhere. Every write function checks (assert_active_user); chat messages are
-- inserted directly, so the policy checks too.
create or replace function is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_until > now() from profiles where id = auth.uid()), false);
$$;
revoke execute on function is_suspended() from public, anon;
grant execute on function is_suspended() to authenticated, service_role;

drop policy messages_insert on messages;
create policy messages_insert on messages for insert to authenticated with check (
  kind = 'user'
  and sender_id = auth.uid()
  and not is_suspended()
  and exists (
    select 1 from conversations c
     where c.id = conversation_id
       and auth.uid() in (c.driver_id, c.rider_id)
       and now() < c.closes_at
       and not is_blocked_pair(c.driver_id, c.rider_id)
       and exists (select 1 from seat_requests sr
                    where sr.trip_id = c.trip_id and sr.rider_id = c.rider_id and sr.status = 'accepted')
  )
);

-- Reporting -------------------------------------------------------------------------------------------------------------
-- A report goes to the moderation queue. The person reported never learns who reported them: reports are readable
-- only by the reporter and by admins. `p_trip` adds context to a report about a person (for example from a chat).
create or replace function file_report(
  p_type report_target, p_target uuid, p_reason text, p_details text,
  p_trip uuid default null, p_message_id bigint default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_trip uuid := p_trip; v_id uuid;
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  perform assert_active_user();
  perform check_rate('file_report', 10, interval '1 day');
  if p_reason is null or p_reason not in ('Unsafe driving', 'Harassment', 'No-show', 'Fake profile', 'Other') then
    raise exception 'invalid_request';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then raise exception 'invalid_request'; end if;

  if p_type = 'user' then
    select id into v_user from profiles where id = p_target and deleted_at is null;
  elsif p_type = 'trip' then
    select driver_id, id into v_user, v_trip from trips where id = p_target;
  elsif p_type = 'request' then
    select rider_id into v_user from ride_requests where id = p_target;
  elsif p_type = 'message' then
    select m.sender_id, c.trip_id into v_user, v_trip
      from messages m join conversations c on c.id = m.conversation_id
     where m.id = p_message_id and c.id = p_target and auth.uid() in (c.driver_id, c.rider_id);
  end if;
  if v_user is null or v_user = auth.uid() then raise exception 'invalid_target'; end if;
  if v_trip is not null and not exists (select 1 from trips where id = v_trip) then v_trip := null; end if;

  insert into reports (reporter_id, target_type, target_id, target_user_id, trip_id, reason, details, message_id)
  values (auth.uid(), p_type, p_target, v_user, v_trip, p_reason, v_details, p_message_id)
  returning id into v_id;

  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (auth.uid(), 'report_received', jsonb_build_object('report_id', v_id), 'report_received:' || v_id)
  on conflict (dedupe_key) do nothing;
  return v_id;
end $$;

-- A driver says a rider didn't show, after the departure time. One report per rider per trip.
create or replace function mark_no_show(p_trip uuid, p_rider uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare t trips; v_id uuid;
begin
  perform assert_active_user();
  select * into t from trips where id = p_trip;
  if not found or t.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if t.departs_at > now() then raise exception 'too_early'; end if;
  if not exists (select 1 from seat_requests where trip_id = p_trip and rider_id = p_rider and status = 'accepted') then
    raise exception 'forbidden';
  end if;
  select id into v_id from reports
   where reporter_id = auth.uid() and target_user_id = p_rider and trip_id = p_trip and reason = 'No-show';
  if v_id is not null then return v_id; end if;

  perform check_rate('file_report', 10, interval '1 day');
  insert into reports (reporter_id, target_type, target_id, target_user_id, trip_id, reason)
  values (auth.uid(), 'user', p_rider, p_rider, p_trip, 'No-show') returning id into v_id;
  return v_id;
end $$;

-- Blocking ------------------------------------------------------------------------------------------------------------------
-- Pending requests and offers between the two are cancelled. Accepted rides stay; the chat closes by itself
-- (a blocked pair can't message), and each of them disappears from the other's board, Inbox, and chats.
create or replace function block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active_user();
  if p_user is null or p_user = auth.uid() or not exists (select 1 from profiles where id = p_user and deleted_at is null) then
    raise exception 'invalid_target';
  end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;

  update seat_requests set status = 'cancelled', decided_at = now()
   where status = 'pending' and (
        (rider_id = auth.uid() and trip_id in (select id from trips where driver_id = p_user))
     or (rider_id = p_user and trip_id in (select id from trips where driver_id = auth.uid())));
  update ride_offers set status = 'closed'
   where status = 'pending' and (
        (driver_id = p_user and request_id in (select id from ride_requests where rider_id = auth.uid()))
     or (driver_id = auth.uid() and request_id in (select id from ride_requests where rider_id = p_user)));
end $$;

create or replace function unblock_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active_user();
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_user;
end $$;

-- Removing an account's activity (shared with account deletion in Step 11) ----------------------------------------------------
-- Clears the person's name, bio and photo, and cancels everything still ahead of them: trips (telling riders),
-- seats they hold, and requests and offers. Past trips and reports stay, showing "Deleted user".
create or replace function deactivate_account(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  -- Trips they drive: cancel and tell the riders, as cancel_trip does.
  for t in select id from trips where driver_id = p_user and status = 'open' and departs_at > now() for update loop
    update trips set status = 'cancelled' where id = t.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    select sr.rider_id, 'trip_cancelled', jsonb_build_object('trip_id', t.id), 'trip_cancelled:' || t.id || ':' || sr.rider_id
      from seat_requests sr where sr.trip_id = t.id and sr.status in ('pending', 'accepted')
    on conflict (dedupe_key) do nothing;
    insert into messages (conversation_id, sender_id, body, kind)
    select c.id, p_user, first_name_of(p_user) || ' cancelled this trip.', 'system' from conversations c where c.trip_id = t.id;
    update seat_requests set status = 'cancelled', decided_at = now() where trip_id = t.id and status in ('pending', 'accepted');
    update ride_offers set status = 'closed' where trip_id = t.id and status = 'pending';
  end loop;

  -- Seats they hold on other people's trips: give the seats back.
  for t in select sr.id, sr.trip_id, sr.seats, sr.status from seat_requests sr join trips tr on tr.id = sr.trip_id
            where sr.rider_id = p_user and sr.status in ('pending', 'accepted') and tr.departs_at > now() loop
    if t.status = 'accepted' then update trips set seats_taken = seats_taken - t.seats where id = t.trip_id; end if;
    update seat_requests set status = 'cancelled', decided_at = now() where id = t.id;
  end loop;

  -- Requests and offers
  update ride_offers set status = 'closed'
   where status = 'pending' and (driver_id = p_user or request_id in (select id from ride_requests where rider_id = p_user));
  update ride_requests set status = 'cancelled' where rider_id = p_user and status = 'open';

  delete from blocks where blocker_id = p_user or blocked_id = p_user;
  update profiles
     set first_name = null, last_name = null, bio = null, avatar_path = null, class_year = null, deleted_at = now()
   where id = p_user;
end $$;
revoke execute on function deactivate_account(uuid) from public, anon, authenticated;
grant execute on function deactivate_account(uuid) to service_role;

-- Admin tools -----------------------------------------------------------------------------------------------------------------------
-- Admins are set directly in the database; there is no sign-up path to the role. Every function checks the
-- role again, and every action writes audit_log.
create or replace function assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
end $$;
revoke execute on function assert_admin() from public, anon, authenticated;

create or replace function audit(p_action text, p_target text, p_details jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, target, details) values (auth.uid(), p_action, p_target, p_details);
$$;
revoke execute on function audit(text, text, jsonb) from public, anon, authenticated;

-- The queue: newest first, filterable. First names only here; a full profile opens only inside a report.
create or replace function admin_report_queue(p_status text default null, p_reason text default null, p_limit int default 100)
returns table (
  id uuid, created_at timestamptz, status report_status, reason text, target_type report_target, details text,
  reporter_first_name text, target_user_id uuid, target_first_name text, target_report_count int, target_no_show_count int
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query
  select r.id, r.created_at, r.status, r.reason, r.target_type, r.details,
         first_name_of(r.reporter_id), r.target_user_id, first_name_of(r.target_user_id),
         (select count(*)::int from reports o where o.target_user_id = r.target_user_id and o.status <> 'dismissed'),
         (select count(*)::int from reports o where o.target_user_id = r.target_user_id and o.reason = 'No-show' and o.status <> 'dismissed')
    from reports r
   where (p_status is null or r.status::text = p_status) and (p_reason is null or r.reason = p_reason)
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 500);
end $$;

-- One report in full: the reporter, the person reported (full profile, email included), the trip, the message,
-- and every other report against that person. Opening it is logged.
create or replace function admin_report_detail(p_report uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r reports; v jsonb;
begin
  perform assert_admin();
  select * into r from reports where id = p_report;
  if not found then raise exception 'not_found'; end if;
  perform audit('view_report', p_report::text, jsonb_build_object('target_user', r.target_user_id));
  perform audit('view_profile', r.target_user_id::text, jsonb_build_object('report', p_report));

  select jsonb_build_object(
    'report', to_jsonb(r),
    'reporter', (select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'campus_id', p.campus_id)
                   from profiles p where p.id = r.reporter_id),
    'target', (select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'email', u.email,
                        'campus_id', p.campus_id, 'class_year', p.class_year, 'bio', p.bio, 'role', p.role,
                        'suspended_until', p.suspended_until, 'deleted_at', p.deleted_at, 'created_at', p.created_at)
                 from profiles p join auth.users u on u.id = p.id where p.id = r.target_user_id),
    'trip', (select jsonb_build_object('id', t.id, 'destination_name', t.destination_name, 'departs_at', t.departs_at, 'status', t.status)
               from trips t where t.id = r.trip_id),
    'message', (select jsonb_build_object('id', m.id, 'body', m.body, 'created_at', m.created_at) from messages m where m.id = r.message_id),
    'other_reports', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'reason', o.reason, 'status', o.status, 'created_at', o.created_at) order by o.created_at desc)
                        from reports o where o.target_user_id = r.target_user_id and o.id <> r.id), '[]'::jsonb),
    'no_show_count', (select count(*) from reports o where o.target_user_id = r.target_user_id and o.reason = 'No-show' and o.status <> 'dismissed')
  ) into v;
  return v;
end $$;

create or replace function admin_set_report_status(p_report uuid, p_status report_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update reports set status = p_status,
         handled_by = case when p_status in ('dismissed', 'actioned') then auth.uid() else handled_by end,
         handled_at = case when p_status in ('dismissed', 'actioned') then now() else handled_at end
   where id = p_report;
  if not found then raise exception 'not_found'; end if;
  perform audit('report_' || p_status, p_report::text);
end $$;

create or replace function admin_close_report(p_report uuid) returns void
language sql security definer set search_path = public as $$
  update reports set status = 'actioned', handled_by = auth.uid(), handled_at = now() where id = p_report and p_report is not null;
$$;
revoke execute on function admin_close_report(uuid) from public, anon, authenticated;

create or replace function admin_warn_user(p_user uuid, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  if not exists (select 1 from profiles where id = p_user and deleted_at is null) then raise exception 'not_found'; end if;
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (p_user, 'account_warning', jsonb_build_object('report_id', p_report), 'account_warning:' || p_user || ':' || floor(extract(epoch from now()))::bigint);
  perform audit('warn_user', p_user::text, jsonb_build_object('report', p_report));
  perform admin_close_report(p_report);
end $$;

create or replace function admin_suspend_user(p_user uuid, p_days int, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  perform assert_admin();
  if p_days not in (7, 30) then raise exception 'invalid_request'; end if;
  if not exists (select 1 from profiles where id = p_user and deleted_at is null) then raise exception 'not_found'; end if;
  if exists (select 1 from profiles where id = p_user and role = 'admin') then raise exception 'forbidden'; end if;
  v_until := now() + make_interval(days => p_days);
  update profiles set suspended_until = v_until where id = p_user;
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (p_user, 'account_suspended', jsonb_build_object('until', to_char(v_until at time zone 'America/Los_Angeles', 'FMMonth FMDD, YYYY')),
          'account_suspended:' || p_user || ':' || floor(extract(epoch from now()))::bigint);
  perform audit('suspend_user', p_user::text, jsonb_build_object('days', p_days, 'report', p_report));
  perform admin_close_report(p_report);
end $$;

create or replace function admin_unsuspend_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update profiles set suspended_until = null where id = p_user;
  perform audit('unsuspend_user', p_user::text);
end $$;

create or replace function admin_remove_account(p_user uuid, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  if not exists (select 1 from profiles where id = p_user and deleted_at is null) then raise exception 'not_found'; end if;
  if exists (select 1 from profiles where id = p_user and role = 'admin') then raise exception 'forbidden'; end if;
  perform deactivate_account(p_user);
  perform audit('remove_account', p_user::text, jsonb_build_object('report', p_report));
  perform admin_close_report(p_report);
end $$;

-- Meetup points: add, edit, suspend, retire. Suspending takes a point off new trips; existing trips keep it.
create or replace function admin_add_meetup_point(
  p_campus text, p_name text, p_type text, p_lat double precision, p_lng double precision, p_shared boolean, p_stand_at text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_admin();
  perform admin_check_point(p_campus, p_name, p_type, p_lat, p_lng, p_stand_at);
  insert into meetup_points (campus_id, name, type, lat, lng, shared)
  values (p_campus, btrim(p_name), p_type, p_lat, p_lng, coalesce(p_shared, false)) returning id into v_id;
  insert into meetup_point_details (point_id, stand_at) values (v_id, btrim(p_stand_at));
  perform audit('add_meetup_point', v_id::text, jsonb_build_object('name', btrim(p_name), 'campus', p_campus));
  return v_id;
end $$;

create or replace function admin_check_point(p_campus text, p_name text, p_type text, p_lat double precision, p_lng double precision, p_stand_at text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from campuses where id = p_campus)
     or char_length(btrim(coalesce(p_name, ''))) not between 2 and 80
     or p_type is null or p_type not in ('hub', 'academic', 'residence', 'shared', 'transit')
     or p_lat is null or p_lng is null or p_lat not between 32.0 and 35.9 or p_lng not between -121.0 and -114.0
     or char_length(btrim(coalesce(p_stand_at, ''))) not between 3 and 200
  then raise exception 'invalid_request'; end if;
end $$;
revoke execute on function admin_check_point(text, text, text, double precision, double precision, text) from public, anon, authenticated;

create or replace function admin_update_meetup_point(
  p_id uuid, p_name text, p_type text, p_lat double precision, p_lng double precision, p_shared boolean, p_stand_at text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_campus text;
begin
  perform assert_admin();
  select campus_id into v_campus from meetup_points where id = p_id;
  if v_campus is null then raise exception 'not_found'; end if;
  perform admin_check_point(v_campus, p_name, p_type, p_lat, p_lng, p_stand_at);
  update meetup_points set name = btrim(p_name), type = p_type, lat = p_lat, lng = p_lng, shared = coalesce(p_shared, shared) where id = p_id;
  insert into meetup_point_details (point_id, stand_at) values (p_id, btrim(p_stand_at))
  on conflict (point_id) do update set stand_at = excluded.stand_at;
  perform audit('update_meetup_point', p_id::text, jsonb_build_object('name', btrim(p_name)));
end $$;

create or replace function admin_set_meetup_status(p_id uuid, p_status meetup_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update meetup_points set status = p_status where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform audit('meetup_point_' || p_status, p_id::text);
end $$;

-- Admin pages read these (an admin sees every point, whatever its status, with its stand-at text).
create or replace function admin_meetup_points() returns table (
  id uuid, campus_id text, name text, type text, lat double precision, lng double precision, shared boolean,
  status meetup_status, stand_at text, trips_using bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query
  select p.id, p.campus_id, p.name, p.type, p.lat, p.lng, p.shared, p.status, d.stand_at,
         (select count(*) from trips t where t.meetup_point_id = p.id)
    from meetup_points p left join meetup_point_details d on d.point_id = p.id
   order by p.campus_id, p.status, p.name;
end $$;

create or replace function admin_audit_log(p_limit int default 100) returns table (
  id bigint, created_at timestamptz, actor_first_name text, action text, target text, details jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query select a.id, a.created_at, first_name_of(a.actor_id), a.action, a.target, a.details
    from audit_log a order by a.id desc limit least(greatest(p_limit, 1), 500);
end $$;

-- A daily email to each admin when reports are still marked new.
create or replace function admin_report_digest() returns void
language sql security definer set search_path = public as $$
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  select a.id, 'admin_digest', jsonb_build_object('count', n.c), 'admin_digest:' || current_date || ':' || a.id
    from profiles a, (select count(*)::int c from reports where status = 'new') n
   where a.role = 'admin' and a.deleted_at is null and n.c > 0
  on conflict (dedupe_key) do nothing;
$$;

-- The admin digest always sends, and its email says how many reports are waiting.
create or replace function email_allowed(p_template text, p_prefs jsonb) returns boolean
language sql immutable set search_path = public as $$
  select case
    when p_template in ('account_warning', 'account_suspended', 'report_received', 'admin_digest') then true
    when p_template = 'new_message' then coalesce((p_prefs ->> 'messages')::boolean, true)
    when p_template in ('seat_accepted', 'seat_declined', 'trip_cancelled', 'trip_time_changed', 'meetup_reminder',
                        'request_ending_soon', 'request_expired') then coalesce((p_prefs ->> 'reminders')::boolean, true)
    else coalesce((p_prefs ->> 'requests')::boolean, true)
  end;
$$;
revoke execute on function email_allowed(text, jsonb) from public, anon, authenticated;

revoke execute on function file_report(report_target, uuid, text, text, uuid, bigint), mark_no_show(uuid, uuid), block_user(uuid), unblock_user(uuid),
  admin_report_queue(text, text, int), admin_report_detail(uuid), admin_set_report_status(uuid, report_status), admin_warn_user(uuid, uuid),
  admin_suspend_user(uuid, int, uuid), admin_unsuspend_user(uuid), admin_remove_account(uuid, uuid),
  admin_add_meetup_point(text, text, text, double precision, double precision, boolean, text),
  admin_update_meetup_point(uuid, text, text, double precision, double precision, boolean, text),
  admin_set_meetup_status(uuid, meetup_status), admin_meetup_points(), admin_audit_log(int) from public, anon;
grant execute on function file_report(report_target, uuid, text, text, uuid, bigint), mark_no_show(uuid, uuid), block_user(uuid), unblock_user(uuid),
  admin_report_queue(text, text, int), admin_report_detail(uuid), admin_set_report_status(uuid, report_status), admin_warn_user(uuid, uuid),
  admin_suspend_user(uuid, int, uuid), admin_unsuspend_user(uuid), admin_remove_account(uuid, uuid),
  admin_add_meetup_point(text, text, text, double precision, double precision, boolean, text),
  admin_update_meetup_point(uuid, text, text, double precision, double precision, boolean, text),
  admin_set_meetup_status(uuid, meetup_status), admin_meetup_points(), admin_audit_log(int) to authenticated, service_role;
revoke execute on function admin_report_digest() from public, anon, authenticated;
grant execute on function admin_report_digest() to service_role;

-- email_context again, now with the admin digest (a link to the queue, and how many reports are waiting).
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
    when 'admin_digest' then v_link := '/admin/reports';
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
    'until', p_payload ->> 'until',
    'count', nullif(p_payload ->> 'count', '')::int
  ));
end $$;
revoke execute on function email_context(text, jsonb, uuid) from public, anon, authenticated;

revoke execute on function email_context(text, jsonb, uuid) from public, anon, authenticated;

-- Daily at 16:00 UTC (9 a.m. Pacific). Skipped where pg_cron isn't installed.
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.schedule('admin_report_digest', '0 16 * * *', 'select admin_report_digest()');
  end if;
end $$;
