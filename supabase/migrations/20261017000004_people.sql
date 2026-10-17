-- BUILD.md 5.3: people.
create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  campus_id            text not null references campuses(id),
  first_name           text check (char_length(first_name) between 1 and 40),
  last_name            text check (char_length(last_name)  between 1 and 40),
  class_year           int  check (class_year between 2020 and 2035),
  bio                  text check (char_length(bio) <= 280),
  avatar_path          text,
  role                 user_role not null default 'student',
  notification_prefs   jsonb not null default '{"requests":true,"messages":true,"reminders":true}',
  onboarded_at         timestamptz,
  suspended_until      timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now()
);

create table blocks (
  blocker_id  uuid not null references profiles(id) on delete cascade,
  blocked_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
