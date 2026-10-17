-- Step 7: chat. Messages, system messages, closing, blocks, rate limit, unread, and email.
-- Run with `supabase test db`. Everything rolls back.
begin;
select plan(56);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d01', 'dana@hmc.edu'), ('00000000-0000-0000-0000-000000000a01', 'rae@pomona.edu'), ('00000000-0000-0000-0000-000000000a02', 'r2@pomona.edu'), ('00000000-0000-0000-0000-000000000b01', 'stan@pomona.edu'),
  ('00000000-0000-0000-0000-000000000b02', 'blake@pomona.edu'), ('00000000-0000-0000-0000-000000000a03', 'r3@pomona.edu');
update profiles set first_name = initcap(split_part((select email from auth.users u where u.id = profiles.id), '@', 1)), onboarded_at = now();
update profiles set first_name = case id when '00000000-0000-0000-0000-000000000d01' then 'Dana' when '00000000-0000-0000-0000-000000000a01' then 'Rae' when '00000000-0000-0000-0000-000000000a02' then 'Rob' else first_name end;

-- Test-only point and coordinates. Real meetup points are not seeded yet (see supabase/PENDING.md).
insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ('00000000-0000-0000-0000-0000000000f1', 'hmc', 'Test point', 'hub', 0, 0, true);
insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '2 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000d01', 'tj-claremont', 'Trader Joe''s', now() + interval '5 days', 3, '00000000-0000-0000-0000-0000000000f1', 'Honda', 'Blue');
insert into trip_private (trip_id, car_plate) values ('00000000-0000-0000-0000-000000000101', 'ABC123'), ('00000000-0000-0000-0000-000000000102', 'DEF456');

-- A rider asks and the driver accepts: that opens the chat.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select request_seat('00000000-0000-0000-0000-000000000101', 1, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select request_seat('00000000-0000-0000-0000-000000000101', 1, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), true);
reset role;
set local request.jwt.claim.sub = '';


-- The chat opens with a system message -----------------------------------------------------------------------------------------
select is((select count(*) from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'accepting opens a chat');
select is((select count(*) from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a02'), 0::bigint, 'a pending rider has no chat');
select is((select kind || ': ' || body from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 'system: Dana accepted Rae. You can plan the pickup here.',
          'the chat starts with a plain system message');
select ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') = 1,
          'new messages are published to Realtime');
delete from email_outbox where template = 'new_message';

-- Sending ---------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'On my way') $$, 'the accepted rider can send');
select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'call me 909-555-0123') $$, 'chat may carry contact details (only notes are filtered)');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000d01', 'See you at the north door') $$, 'the driver can send');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01') and kind = 'user'), 3::bigint, 'three typed messages are saved');
select is((select string_agg(distinct kind, ',') from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01') and sender_id = '00000000-0000-0000-0000-000000000a01' and body = 'On my way'), 'user', 'as ordinary user messages');

-- Bad messages and forgeries ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', '') $$, '23514', null, 'an empty message is refused');
select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', repeat('x', 1001)) $$, '23514', null, 'a message over 1000 characters is refused');
select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000d01', 'pretending') $$, '42501', null, 'nobody can send as someone else');
select throws_ok($$ insert into messages (conversation_id, sender_id, body, kind) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'Dana cancelled this trip.', 'system') $$, '42501', null, 'nobody can forge a system message');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000b01', 'hi') $$, '42501', null, 'a stranger cannot send into the chat');
select is((select count(*) from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 0::bigint, 'or read it');
select is((select count(*) from chat_threads), 0::bigint, 'or see it in their chat list');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a02', 'hi') $$, '42501', null, 'another rider cannot send into someone else''s chat');
select is((select count(*) from chat_threads), 0::bigint, 'and a pending rider has no chats');

-- Chats close ------------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

update conversations set closes_at = now() - interval '1 minute' where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'too late') $$, '42501', null, 'nothing can be sent after the chat closes');
select is((select count(*) from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 4::bigint, 'but the history stays readable');
reset role;
set local request.jwt.claim.sub = '';

update conversations set closes_at = (select departs_at + interval '24 hours' from trips where id = '00000000-0000-0000-0000-000000000101') where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01');

-- Blocks --------------------------------------------------------------------------------------------------------------------------
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a01');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'hello?') $$, '42501', null, 'a blocked rider cannot message the driver');
select is((select count(*) from chat_threads), 0::bigint, 'and the chat disappears from their list');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000d01', 'hello?') $$, '42501', null, 'the blocker cannot message either');
select is((select count(*) from chat_threads), 0::bigint, 'and it is gone from theirs');
reset role;
set local request.jwt.claim.sub = '';

delete from blocks where blocker_id = '00000000-0000-0000-0000-000000000d01';

-- Email: one "new message" per recipient per 15 minutes -----------------------------------------------------------------------------
delete from email_outbox where template = 'new_message';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'first') $$, 'the rider sends one message');
select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'second') $$, 'and a second right after');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from email_outbox where template = 'new_message' and to_user_id = '00000000-0000-0000-0000-000000000d01'), 1::bigint, 'the driver is emailed once');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000d01', 'reply') $$, 'the driver replies');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from email_outbox where template = 'new_message' and to_user_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'and the rider is emailed once');
select is((select count(*) from email_outbox where template = 'new_message'), 2::bigint, 'system messages sent no email');

-- Unread and the Inbox badge -----------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select is((select unread from chat_threads where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 4, 'the driver has four unread messages from the rider (system messages do not count)');
select is(inbox_count(), 5, 'the Inbox badge counts them, plus the pending request from the other rider');
select is((select last_body from chat_threads where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 'reply', 'the thread shows the latest message');
select is((select other_first_name from chat_threads where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 'Rae', 'and the other person''s first name');
select lives_ok($$ select mark_conversation_read((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')) $$, 'the driver opens the chat');
select is((select unread from chat_threads where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 0, 'so nothing is unread for them');
select is(inbox_count(), 1, 'and the badge drops to the pending request');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select is((select unread from chat_threads where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 2, 'the rider''s unread is untouched (two replies to read)');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';

select throws_ok($$ select mark_conversation_read((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')) $$, 'P0001', 'forbidden', 'a stranger cannot mark someone else''s chat read');

-- Rate limit: 30 a minute ------------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from rate_events where user_id = '00000000-0000-0000-0000-000000000a01' and kind = 'chat_message';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ insert into messages (conversation_id, sender_id, body) select (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'msg ' || g from generate_series(1, 30) g $$,
          'thirty messages in a minute are fine');
select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'one too many') $$, 'P0001', 'rate_limited', 'the thirty-first is refused');

-- Changes leave a system message ------------------------------------------------------------------------------------------------------------
reset role;
set local request.jwt.claim.sub = '';

delete from rate_events where kind = 'chat_message';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select update_trip('00000000-0000-0000-0000-000000000101', now() + interval '2 days 3 hours', null, 3, null, null) $$, 'the driver moves the departure time');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01') and kind = 'system' and body like 'Dana changed the departure time.%'), 1::bigint,
          'the chat says so');
select is((select closes_at = (select departs_at + interval '24 hours' from trips where id = '00000000-0000-0000-0000-000000000101') from conversations where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), true, 'and closes 24 hours after the new time');

-- The rider cancels: the chat closes for both ----------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select cancel_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')) $$, 'the rider cancels their seat');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01') and body = 'Rae cancelled their seat.' and kind = 'system'), 1::bigint, 'the chat says so');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'wait') $$, '42501', null, 'the rider can no longer send');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000d01', 'wait') $$, '42501', null, 'nor can the driver');
select is((select count(*) from chat_threads where id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01')), 1::bigint, 'but the thread is still listed, with its history');

-- Asking again and being accepted again reopens the same chat -----------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ select request_seat('00000000-0000-0000-0000-000000000101', 1, null) $$, 'the rider asks again');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select respond_seat_request((select id from seat_requests where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), true) $$, 'and is accepted again');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'still one chat, not a second');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select lives_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'back again') $$, 'and it works again');

-- Cancelling the trip tells everyone and closes the chat ------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000d01';

select lives_ok($$ select cancel_trip('00000000-0000-0000-0000-000000000101') $$, 'the driver cancels the trip');
reset role;
set local request.jwt.claim.sub = '';

select is((select count(*) from messages where conversation_id = (select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01') and body = 'Dana cancelled this trip.' and kind = 'system'), 1::bigint, 'the chat says so');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';

select throws_ok($$ insert into messages (conversation_id, sender_id, body) values ((select id from conversations where trip_id = '00000000-0000-0000-0000-000000000101' and rider_id = '00000000-0000-0000-0000-000000000a01'), '00000000-0000-0000-0000-000000000a01', 'oh no') $$, '42501', null, 'and nothing more can be sent');

select * from finish();
rollback;
