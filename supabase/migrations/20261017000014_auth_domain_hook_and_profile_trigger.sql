-- Step 3: school-email sign-in. BUILD.md Section 4.

-- Which campus an email belongs to, or null. Domains live in campuses.email_domains, so adding
-- one is a row update with no deploy. Only the hook, the trigger, and the form check use this.
create or replace function school_domain_campus(p_email text) returns text
language sql stable security definer set search_path = public as $$
  select c.id
  from campuses c
  where c.active
    and p_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
    and lower(split_part(p_email, '@', 2)) in (select lower(d) from unnest(c.email_domains) d)
  limit 1;
$$;
revoke execute on function school_domain_campus(text) from public, anon, authenticated;

-- The sign-in form checks the domain first so people get the message instantly.
-- This is only a convenience: the hook below is the real check.
create or replace function school_email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select school_domain_campus(p_email) is not null;
$$;
revoke execute on function school_email_allowed(text) from public;
grant execute on function school_email_allowed(text) to anon, authenticated, service_role;

-- Supabase "Before User Created" auth hook. Returns {} to allow, or an error to reject.
create or replace function hook_restrict_signup_domain(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if school_domain_campus(event -> 'user' ->> 'email') is null then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'Use your school email.'));
  end if;
  return '{}'::jsonb;
end $$;

grant usage on schema public to supabase_auth_admin;
revoke execute on function hook_restrict_signup_domain(jsonb) from public, anon, authenticated;
grant execute on function hook_restrict_signup_domain(jsonb) to supabase_auth_admin;

-- Every new auth user gets a profile row with the campus from their email domain. The row has
-- no name yet; onboarded_at stays null until complete_onboarding runs. If the hook is ever off,
-- this still refuses a non-school address.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_campus text := school_domain_campus(new.email);
begin
  if v_campus is null then
    raise exception 'Use your school email.';
  end if;
  insert into profiles (id, campus_id) values (new.id, v_campus);
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
