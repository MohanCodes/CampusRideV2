-- Step 7: chat. BUILD.md 5.4, 5.8, 6.6, 8.1, and WEB_FLOWS.md 4.9.

-- Messages are either typed by a person ('user') or written by the app ('system'): "Maya accepted Alex",
-- "Alex cancelled their seat". People can only ever insert 'user' messages, so a system message can't be forged.
alter table messages add column kind text not null default 'user' check (kind in ('user', 'system'));

create or replace function first_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(first_name, ''), 'Someone') from profiles where id = p_user;
$$;
revoke execute on function first_name_of(uuid) from public, anon, authenticated;

create or replace function add_system_message(p_conversation uuid, p_sender uuid, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into messages (conversation_id, sender_id, body, kind) values (p_conversation, p_sender, p_body, 'system');
$$;
revoke execute on function add_system_message(uuid, uuid, text) from public, anon, authenticated;

-- Who may send: a participant, while the chat is open (until 24 hours after departure), while the
-- rider's seat is still accepted, and while neither has blocked the other.
drop policy messages_insert on messages;
create policy messages_insert on messages for insert to authenticated with check (
  kind = 'user'
  and sender_id = auth.uid()
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

-- 30 messages a minute per person. A trigger, so it applies however a signed-in person inserts the row.
-- Server-side inserts (no signed-in person) are not rate limited.
create or replace function messages_before_insert() returns trigger
language plpgsql as $$
begin
  if new.kind = 'user' and auth.uid() is not null then perform check_rate('chat_message', 30, interval '1 minute'); end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on messages for each row execute function messages_before_insert();

-- At most one "new message" email per recipient per conversation per 15 minutes.
create or replace function messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; v_to uuid;
begin
  if new.kind <> 'user' then return new; end if;
  select * into c from conversations where id = new.conversation_id;
  v_to := case when new.sender_id = c.driver_id then c.rider_id else c.driver_id end;
  insert into email_outbox (to_user_id, template, payload, dedupe_key)
  values (v_to, 'new_message', jsonb_build_object('conversation_id', c.id),
          'new_message:' || c.id || ':' || v_to || ':' || floor(extract(epoch from now()) / 900)::bigint)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;
revoke execute on function messages_after_insert() from public, anon, authenticated;
create trigger messages_queue_email after insert on messages for each row execute function messages_after_insert();

-- Marks the other person's messages in a conversation as read.
create or replace function mark_conversation_read(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active_user();
  if not exists (select 1 from conversations where id = p_conversation and auth.uid() in (driver_id, rider_id)) then
    raise exception 'forbidden';
  end if;
  update messages set read_at = now()
   where conversation_id = p_conversation and sender_id <> auth.uid() and read_at is null;
end $$;

-- The Inbox badge: seat requests waiting for an answer, plus unread messages in chats that are still open.
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
  );
$$;

-- One row per chat the caller is in, with the other person, the last message, and the unread count.
-- security_invoker: a chat with someone who is blocked (either way) simply isn't there.
create view chat_threads with (security_invoker = true) as
select c.id, c.trip_id, c.driver_id, c.rider_id, c.closes_at,
       t.destination_name, t.departs_at, t.status as trip_status,
       pp.id as other_id, pp.first_name as other_first_name, pp.campus_id as other_campus_id,
       pp.class_year as other_class_year, pp.avatar_path as other_avatar_path,
       lm.body as last_body, lm.created_at as last_at, lm.sender_id as last_sender_id, lm.kind as last_kind,
       coalesce(u.n, 0) as unread
from conversations c
join trips t on t.id = c.trip_id
join public_profiles pp on pp.id = case when c.driver_id = auth.uid() then c.rider_id else c.driver_id end
left join lateral (
  select m.body, m.created_at, m.sender_id, m.kind from messages m where m.conversation_id = c.id order by m.id desc limit 1
) lm on true
left join lateral (
  select count(*)::int as n from messages m
   where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null and m.kind = 'user'
) u on true
where auth.uid() in (c.driver_id, c.rider_id);
revoke all on chat_threads from anon, authenticated;
grant select on chat_threads to authenticated;

revoke execute on function mark_conversation_read(uuid) from public, anon;
grant execute on function mark_conversation_read(uuid) to authenticated, service_role;

-- Live chat: Supabase Realtime publishes new rows (each person only receives rows they may read).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- The four seat functions again, now leaving a system message in the chat when something changes.
-- (Same logic as before; the additions are the add_system_message calls and the inserts into messages.)

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
    perform add_system_message(
      (select id from conversations where trip_id = t.id and rider_id = r.rider_id), r.rider_id,
      first_name_of(r.rider_id) || ' cancelled their seat.');
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (t.driver_id, 'rider_cancelled', jsonb_build_object('trip_id', t.id, 'request_id', r.id),
            'rider_cancelled:' || r.id || ':' || floor(extract(epoch from now()))::bigint)
    on conflict (dedupe_key) do nothing;
  else
    raise exception 'not_pending';
  end if;
end $$;

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
    on conflict (trip_id, rider_id) do update set closes_at = excluded.closes_at;
    perform add_system_message(
      (select id from conversations where trip_id = t.id and rider_id = r.rider_id), t.driver_id,
      first_name_of(t.driver_id) || ' accepted ' || first_name_of(r.rider_id) || '. You can plan the pickup here.');

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

  insert into messages (conversation_id, sender_id, body, kind)
  select c.id, t.driver_id, first_name_of(t.driver_id) || ' cancelled this trip.', 'system'
    from conversations c where c.trip_id = t.id;

  update seat_requests set status = 'cancelled', decided_at = now()
   where trip_id = t.id and status in ('pending', 'accepted');
  update ride_offers set status = 'closed' where trip_id = t.id and status = 'pending';
end $$;

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
    insert into messages (conversation_id, sender_id, body, kind)
    select c.id, t.driver_id, first_name_of(t.driver_id) || ' changed the departure time. Check the trip for the new time.', 'system'
      from conversations c where c.trip_id = t.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    select sr.rider_id, 'trip_time_changed', jsonb_build_object('trip_id', t.id),
           'trip_time_changed:' || t.id || ':' || sr.rider_id || ':' || floor(extract(epoch from now()))::bigint
      from seat_requests sr where sr.trip_id = t.id and sr.status in ('pending', 'accepted')
    on conflict (dedupe_key) do nothing;
  end if;
end $$;


revoke execute on function cancel_seat_request(uuid), respond_seat_request(uuid, boolean), cancel_trip(uuid),
  update_trip(uuid, timestamptz, timestamptz, int, text, text, boolean) from public, anon;
grant execute on function cancel_seat_request(uuid), respond_seat_request(uuid, boolean), cancel_trip(uuid),
  update_trip(uuid, timestamptz, timestamptz, int, text, text, boolean) to authenticated, service_role;
