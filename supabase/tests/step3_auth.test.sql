-- Step 3: school-email sign-in, profile creation, and onboarding. BUILD.md Section 4 and 6.1.
-- Run with `supabase test db`. Everything rolls back.
begin;
select plan(48);

-- The auth hook: allowed domains --------------------------------------------------------------------
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@hmc.edu'))), '{}'::jsonb, 'the hook allows maya@hmc.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@g.hmc.edu'))), '{}'::jsonb, 'the hook allows maya@g.hmc.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@pomona.edu'))), '{}'::jsonb, 'the hook allows maya@pomona.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@scrippscollege.edu'))), '{}'::jsonb, 'the hook allows maya@scrippscollege.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@cmc.edu'))), '{}'::jsonb, 'the hook allows maya@cmc.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@claremontmckenna.edu'))), '{}'::jsonb, 'the hook allows maya@claremontmckenna.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@pitzer.edu'))), '{}'::jsonb, 'the hook allows maya@pitzer.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'Maya@HMC.EDU'))), '{}'::jsonb, 'the hook allows Maya@HMC.EDU');

-- The auth hook: rejected ----------------------------------------------------------------------------
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@gmail.com'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects maya@gmail.com');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@hmc.edu.evil.com'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects maya@hmc.edu.evil.com');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@evilhmc.edu'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects maya@evilhmc.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@cs.hmc.edu'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects maya@cs.hmc.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@hmc.edu@evil.com'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects maya@hmc.edu@evil.com');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'hmc.edu'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects hmc.edu');
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya @hmc.edu'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects maya @hmc.edu');
select is(hook_restrict_signup_domain('{"user": {}}'::jsonb), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'the hook rejects a missing email');

-- Domains are data, not code -------------------------------------------------------------------------
update campuses set email_domains = email_domains || array['new.edu'] where id = 'pomona';
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@new.edu'))), '{}'::jsonb, 'adding a domain to a campus row allows it with no deploy');
update campuses set active = false where id = 'pitzer';
select is(hook_restrict_signup_domain(jsonb_build_object('user', jsonb_build_object('email', 'maya@pitzer.edu'))), '{"error": {"http_code": 400, "message": "Use your school email."}}'::jsonb, 'an inactive campus''s domain is rejected');

-- Who may call what ---------------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'school_email_allowed(text)', 'execute'),
          'the sign-in form can check a domain before the person is signed in');
select ok(has_function_privilege('supabase_auth_admin', 'hook_restrict_signup_domain(jsonb)', 'execute'),
          'the auth service can run the hook');
select ok(not has_function_privilege('anon', 'hook_restrict_signup_domain(jsonb)', 'execute')
      and not has_function_privilege('authenticated', 'hook_restrict_signup_domain(jsonb)', 'execute'),
          'nobody else can run the hook');
select ok(not has_function_privilege('authenticated', 'school_domain_campus(text)', 'execute'),
          'the campus lookup is not callable from the browser');
select is(school_email_allowed('maya@hmc.edu'), true,   'the form check says yes for a school email');
select is(school_email_allowed('maya@gmail.com'), false, 'and no for a Gmail address');

-- A new auth user gets a profile -----------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'uma@hmc.edu'), ('00000000-0000-0000-0000-0000000000f2', 'vic@g.hmc.edu'), ('00000000-0000-0000-0000-0000000000f3', 'wes@pomona.edu');
select is((select campus_id from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'hmc',    'hmc.edu maps to Harvey Mudd');
select is((select campus_id from profiles where id = '00000000-0000-0000-0000-0000000000f2'), 'hmc',    'g.hmc.edu maps to Harvey Mudd');
select is((select campus_id from profiles where id = '00000000-0000-0000-0000-0000000000f3'), 'pomona', 'pomona.edu maps to Pomona');
select ok((select first_name is null and onboarded_at is null from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
          'a new profile has no name and is not onboarded yet');
select throws_ok($$ insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f5', 'gus@gmail.com') $$,
                 'P0001', 'Use your school email.', 'the database refuses a Gmail address even if the hook is off');
select is((select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000f5'), 0::bigint, 'and creates no profile for it');

-- Onboarding ----------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select throws_ok('select assert_active_user()', 'P0001', 'not_onboarded', 'a new person cannot use write functions yet');
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2028, 'hi', '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'invalid_profile', 'onboarding needs the photo to be uploaded first');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                'the person uploads their photo');
select throws_ok($$ select complete_onboarding('', 'Patel', 2028, null, '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'invalid_profile', 'a blank first name is refused');
select throws_ok($$ select complete_onboarding('Uma', '   ', 2028, null, '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'invalid_profile', 'a blank last name is refused');
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2099, null, '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'invalid_profile', 'an impossible class year is refused');
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2028, repeat('x', 281), '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'invalid_profile', 'a bio over 280 characters is refused');
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2028, null, null) $$,
                 'P0001', 'invalid_profile', 'a photo is required');
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2028, null, '00000000-0000-0000-0000-0000000000f2/profile.webp') $$,
                 'P0001', 'invalid_profile', 'a photo from someone else''s folder is refused');
select lives_ok($$ select complete_onboarding('  Uma ', 'Patel', 2028, '  Loves hiking  ', '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                'a complete profile is accepted');
select is((select first_name || ' ' || last_name || ' ' || class_year || ' ' || bio from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
          'Uma Patel 2028 Loves hiking', 'the fields are saved, trimmed');
select ok((select onboarded_at is not null from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'onboarded_at is set');
select lives_ok('select assert_active_user()', 'an onboarded person passes the write-function check');

-- Re-running keeps the first onboarded_at
reset role;
update profiles set onboarded_at = '2026-01-01 00:00:00+00' where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select lives_ok($$ select complete_onboarding('Uma', 'Patel', 2029, null, '00000000-0000-0000-0000-0000000000f1/profile.webp') $$, 'a profile can be edited later');
select is((select onboarded_at from profiles where id = '00000000-0000-0000-0000-0000000000f1'), '2026-01-01 00:00:00+00'::timestamptz,
          'and the original onboarded_at is kept');

-- Photos stay in their owner's folder -------------------------------------------------------------------
select throws_ok($$ update profiles set avatar_path = '00000000-0000-0000-0000-0000000000f2/profile.webp' where id = '00000000-0000-0000-0000-0000000000f1' $$,
                 '23514', null, 'a profile cannot point at someone else''s photo');

-- Suspended people cannot change their profile
reset role;
update profiles set suspended_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2028, null, '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'account_suspended', 'a suspended person is refused');

reset role;
set local request.jwt.claim.sub = '';
select throws_ok($$ select complete_onboarding('Uma', 'Patel', 2028, null, '00000000-0000-0000-0000-0000000000f1/profile.webp') $$,
                 'P0001', 'not_signed_in', 'a call with no signed-in user is refused');

select * from finish();
rollback;
