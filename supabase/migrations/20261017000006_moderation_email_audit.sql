-- BUILD.md 5.5: moderation, email, audit.
create table reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references profiles(id),
  target_type      report_target not null,
  target_id        uuid not null,
  target_user_id   uuid references profiles(id),
  trip_id          uuid references trips(id) on delete set null,
  reason           text not null check (reason in ('Unsafe driving','Harassment','No-show','Fake profile','Other')),
  details          text check (char_length(details) <= 1000),
  status           report_status not null default 'new',
  handled_by       uuid references profiles(id),
  handled_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table email_outbox (
  id            bigint generated always as identity primary key,
  to_user_id    uuid not null references profiles(id) on delete cascade,
  template      text not null,
  payload       jsonb not null default '{}',
  send_after    timestamptz not null default now(),
  sent_at       timestamptz,
  attempts      int not null default 0,
  last_error    text,
  dedupe_key    text unique                          -- stops duplicate reminders
);

create table audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references profiles(id),
  action      text not null,
  target      text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create table rate_events (                           -- used by the rate limiter (BUILD.md 6.6)
  user_id  uuid not null,
  kind     text not null,
  at       timestamptz not null default now()
);
create index on rate_events (user_id, kind, at desc);
