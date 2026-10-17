-- Step 2: is_blocked_pair is callable by any signed-in user (policies need that), so as written
-- it let anyone ask whether two other people had blocked each other. A signed-in caller now only
-- gets a real answer for pairs that include themselves. Server jobs (no signed-in user) are
-- unaffected. Policies and RPCs always ask about the caller, so nothing else changes.
create or replace function is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (
       select 1 from blocks
       where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
     );
$$;
