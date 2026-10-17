-- Step 12: the health check and the email backlog alert.

-- /api/health runs this through the public key. It reads nothing and says nothing but "the database answered".
create or replace function health() returns boolean
language sql stable security definer set search_path = public as $$ select true $$;
revoke execute on function health() from public;
grant execute on function health() to anon, authenticated;

-- Emails that were due more than 15 minutes ago and still haven't gone out, including ones given up on after 5 tries
-- (BUILD.md Section 13). Admin pages show
-- a notice when this is above zero. Counts only; no addresses or names.
create or replace function admin_email_backlog() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return (select count(*)::int from email_outbox where sent_at is null and send_after < now() - interval '15 minutes');
end $$;
revoke execute on function admin_email_backlog() from public, anon;
grant execute on function admin_email_backlog() to authenticated;

-- Two tables are only for the database's own functions. They had row-level security on and no policy, which already
-- keeps everyone out; these say so out loud, so "a table without a policy" stays a clear red flag.
create policy rate_events_closed on rate_events for all to authenticated, anon using (false) with check (false);
create policy email_outbox_closed on email_outbox for all to authenticated, anon using (false) with check (false);
