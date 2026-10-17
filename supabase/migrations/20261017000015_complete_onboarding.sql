-- Step 3: finishing the profile. BUILD.md 6.1.

-- A person's photo has to be their own: the path must sit in their own folder. Without this a
-- profile could point at someone else's picture and pass as them.
alter table profiles
  add constraint profiles_avatar_in_own_folder
  check (avatar_path is null or avatar_path like id::text || '/%');

create or replace function complete_onboarding(
  p_first text, p_last text, p_class_year int, p_bio text, p_avatar_path text
) returns void language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  v_first text := btrim(coalesce(p_first, ''));
  v_last  text := btrim(coalesce(p_last, ''));
  v_bio   text := nullif(btrim(coalesce(p_bio, '')), '');
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into p from profiles where id = auth.uid() and deleted_at is null;
  if not found then raise exception 'not_onboarded'; end if;
  if p.suspended_until is not null and p.suspended_until > now() then
    raise exception 'account_suspended';
  end if;

  if char_length(v_first) not between 1 and 40
     or char_length(v_last) not between 1 and 40
     or p_class_year is null or p_class_year not between 2020 and 2035
     or (v_bio is not null and char_length(v_bio) > 280)
     or p_avatar_path is null
     or p_avatar_path not like auth.uid()::text || '/%'
     or not exists (select 1 from storage.objects
                    where bucket_id = 'avatars' and name = p_avatar_path)
  then
    raise exception 'invalid_profile';
  end if;

  update profiles
     set first_name   = v_first,
         last_name    = v_last,
         class_year   = p_class_year,
         bio          = v_bio,
         avatar_path  = p_avatar_path,
         onboarded_at = coalesce(onboarded_at, now())
   where id = auth.uid();
end $$;

revoke execute on function complete_onboarding(text, text, int, text, text) from public, anon;
grant execute on function complete_onboarding(text, text, int, text, text) to authenticated, service_role;
