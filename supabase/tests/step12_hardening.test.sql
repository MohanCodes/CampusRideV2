-- Step 12: the health check, the email backlog alert, and the standing security rules. Everything rolls back.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000e01', 'ada@hmc.edu'), ('00000000-0000-0000-0000-000000000e02', 'stu@pomona.edu');
update profiles set onboarded_at = now(), first_name = 'Person', last_name = 'Lastname';
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000e01';

-- The health check ------------------------------------------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'health()', 'execute'), 'the uptime monitor can call the health check signed out');
select is(health(), true, 'and it answers true');

-- The email backlog alert -----------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'admin_email_backlog()', 'execute'), 'signed-out visitors cannot read the email backlog');
delete from email_outbox;
insert into email_outbox (to_user_id, template, payload, send_after, dedupe_key) values
  ('00000000-0000-0000-0000-000000000e02', 'report_received', '{}', now() - interval '1 hour', 'bk:old'),
  ('00000000-0000-0000-0000-000000000e02', 'report_received', '{}', now() - interval '5 minutes', 'bk:fresh'),
  ('00000000-0000-0000-0000-000000000e02', 'report_received', '{}', now() + interval '1 hour', 'bk:later');
insert into email_outbox (to_user_id, template, payload, send_after, sent_at, dedupe_key) values
  ('00000000-0000-0000-0000-000000000e02', 'report_received', '{}', now() - interval '2 hours', now() - interval '1 hour', 'bk:sent');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e02';
select throws_ok($$ select admin_email_backlog() $$, 'P0001', 'forbidden', 'a student cannot read it');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';
select is(admin_email_backlog(), 1, 'an admin sees only the email that is overdue by 15 minutes and unsent');
reset role;
set local request.jwt.claim.sub = '';
update email_outbox set attempts = 5 where dedupe_key = 'bk:old';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000e01';
select is(admin_email_backlog(), 1, 'an email given up on after 5 tries still counts');
reset role;
set local request.jwt.claim.sub = '';

-- Standing rules ---------------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'every table in public has row-level security on');
select is((select count(*) from pg_tables t where schemaname = 'public' and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
           ), 0::bigint, 'and every one has at least one policy');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'execute')), 0::bigint, 'no admin function is callable signed out');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('deactivate_account', 'claim_emails', 'mark_email_sent', 'mark_email_failed', 'purge_old_data')
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))), 0::bigint, 'the service-only functions are closed to the browser');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0::bigint, 'every security-definer function pins its search path');
select ok(not has_table_privilege('authenticated', 'trips', 'insert') and not has_table_privilege('authenticated', 'trip_private', 'insert'), 'the browser cannot insert trips or plates directly');
select ok(not has_table_privilege('authenticated', 'seat_requests', 'insert') and not has_table_privilege('authenticated', 'ride_requests', 'insert') and not has_table_privilege('authenticated', 'ride_offers', 'insert'), 'or seat requests, requests, or offers');
select ok(not has_table_privilege('authenticated', 'blocks', 'insert') and not has_table_privilege('authenticated', 'reports', 'insert'), 'or blocks and reports');
select ok(not has_table_privilege('anon', 'profiles', 'select') and not has_table_privilege('anon', 'public_profiles', 'select'), 'signed-out visitors read no profiles');
select ok(not has_column_privilege('authenticated', 'profiles', 'role', 'update') and not has_column_privilege('authenticated', 'profiles', 'suspended_until', 'update'), 'nobody can promote themselves or lift a suspension');

select * from finish();
rollback;
