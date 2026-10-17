# Campus Ride Web: Backend and Infrastructure

How to build and run the backend for `WEB_FLOWS.md`. The app only matches students and picks a meetup point, so there is no location tracking, payments, ratings, or real-time ride monitoring anywhere in this file. If something here conflicts with `WEB_FLOWS.md` about what users see, `WEB_FLOWS.md` wins; if it conflicts about how data is stored or secured, this file wins.

---

## 1. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js (App Router), TypeScript, Tailwind CSS | Server rendering for the public board preview and landing page, server actions for forms |
| Database | Supabase Postgres | Row-level security, transactions, cron, one place for the rules |
| Auth | Supabase Auth, email one-time code only | School-email verification with no passwords |
| Storage | Supabase Storage (private bucket `avatars`) | Profile photos |
| Realtime | Supabase Realtime on `messages` | Live chat |
| Scheduled jobs | `pg_cron` inside Postgres | Expiry, reminders, cleanup |
| Email | Resend, called from a Supabase Edge Function | Transactional email from a queue |
| Maps | Mapbox GL JS plus the Mapbox Search API | Meetup point map and destination search |
| Validation | Zod on every server action and API route | One schema shared by form and server |
| Hosting | Vercel (web), Supabase (everything else) | Two services to run |
| Errors | Sentry | Server and browser errors |
| Tests | Vitest (unit), pgTAP (database), Playwright (end to end) | Covers the three layers |

**Rules for the whole codebase**

- Every table has row-level security on. No table is readable or writable without a policy.
- Anything that changes more than one row, checks a limit, or enforces a business rule is a Postgres function (an RPC), not client code. The browser never writes to `trips`, `seat_requests`, `ride_requests`, or `ride_offers` directly.
- The Supabase service role key is never in the Next.js app. The only code that uses it is the email Edge Function and the account-deletion Edge Function.
- Next.js talks to Supabase with the signed-in user's session (`@supabase/ssr`), so `auth.uid()` works inside every function.

---

## 2. Repository layout

```
campus-ride/
  app/
    (public)/page.tsx            landing page and read-only board preview
    (app)/                       signed-in routes from WEB_FLOWS.md Section 3
      page.tsx                   board
      post/ trip/[id]/ request/[id]/ rides/ inbox/ chat/[id]/ me/ safety/
    admin/                       meetup points, reports (admin role only)
    auth/callback/route.ts       finishes sign-in
    api/health/route.ts          uptime check
  components/                    TripCard, RequestCard, etc. (WEB_FLOWS.md Section 8)
  lib/
    supabase/{server,browser,middleware}.ts
    schemas/                     Zod schemas, one file per form
    format/                      relative times, seat text
  supabase/
    config.toml
    migrations/                  numbered SQL files (Section 5)
    seed.sql                     campuses, places, meetup points
    functions/
      send-emails/               Edge Function: drains the email queue
      delete-account/            Edge Function: removes the auth user
    tests/                       pgTAP files
  e2e/                           Playwright specs
  .github/workflows/ci.yml
  BUILD.md  WEB_FLOWS.md
```

---

## 3. Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, local | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel, local | Public key; safe in the browser because of row-level security |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Vercel, local | Public token, restricted to the site's domains in the Mapbox dashboard |
| `NEXT_PUBLIC_SITE_URL` | Vercel, local | Used in email links |
| `SENTRY_DSN` | Vercel | Error reporting |
| `RESEND_API_KEY` | Supabase Edge Function secrets | Never in Vercel |
| `EMAIL_FROM` | Supabase Edge Function secrets | For example `Campus Ride <hello@your-domain>` using the verified sending domain |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets only | Edge Functions receive it automatically |
| `EMAIL_FUNCTION_SECRET` | Supabase Vault and Edge Function secrets | Shared secret so only the cron job can call `send-emails` |
| `EMAIL_FUNCTION_URL` | Supabase Vault | Each project's `send-emails` function URL, read by the cron job |

Keep three environments: local (Supabase CLI), staging, production. Each has its own Supabase project and its own set of the values above.

---

## 4. Auth

- **Method:** email one-time code (6 digits, valid 10 minutes). Turn off passwords, magic-link-as-default, and all social providers.
- **Domain restriction:** enforced in the database with the Supabase "Before User Created" auth hook. The hook function `hook_restrict_signup_domain` rejects any email whose domain is not in `campuses.email_domains` for an active campus, with the message "Use your school email." The login form also checks the domain first so people get the same message instantly, but the hook is the real check.
- **Allowed domains at launch:** `hmc.edu`, `g.hmc.edu`, `pomona.edu`, `scrippscollege.edu`, `cmc.edu`, `claremontmckenna.edu`, `pitzer.edu`. Adding a domain is a row update, no deploy.
- **Email delivery:** configure Supabase Auth to send through Resend SMTP so the code email comes from the app's own domain. Set up SPF, DKIM, and DMARC for that domain before launch.
- **Rate limits:** use Supabase Auth's built-in limits for code requests and verification attempts, and set the one-time code request limit to 5 per hour per email.
- **Profile row:** a trigger on `auth.users` creates a `profiles` row with the campus chosen from the email domain. The row has no name yet; `onboarded_at` stays null until the profile step is finished. Next.js middleware sends signed-in users with a null `onboarded_at` to the onboarding page.
- **Sessions:** refresh tokens through the `@supabase/ssr` middleware on every request. Sign-out clears the cookies.
- **Suspended users:** `profiles.suspended_until` in the future blocks every write RPC (they raise `account_suspended`) and the app shows a plain message.

---

## 5. Database

Write these as numbered files in `supabase/migrations/`. Names are lowercase with underscores.

### 5.1 Extensions and enums

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type user_role           as enum ('student', 'admin');
create type trip_status         as enum ('open', 'cancelled', 'past');
create type seat_request_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'expired');
create type ride_request_status as enum ('open', 'matched', 'expired', 'cancelled');
create type offer_status        as enum ('pending', 'accepted', 'declined', 'withdrawn', 'expired', 'closed');
create type flexibility_kind    as enum ('exact', 'pm30', 'pm60', 'anytime');
create type report_status       as enum ('new', 'reviewing', 'actioned', 'dismissed');
create type report_target       as enum ('user', 'trip', 'request', 'message');
create type meetup_status       as enum ('approved', 'suspended', 'retired');
```

### 5.2 Reference tables

```sql
create table campuses (
  id             text primary key,                -- 'hmc', 'pomona', 'scripps', 'cmc', 'pitzer'
  name           text not null,
  email_domains  text[] not null,
  timezone       text not null default 'America/Los_Angeles',
  safety_phone   text,
  active         boolean not null default true
);

create table places (                              -- curated destinations
  id        text primary key,                      -- 'tj-claremont'
  name      text not null,
  category  text not null,
  address   text not null,
  chip      text not null,                         -- feed chip it belongs to
  lat       double precision,
  lng       double precision,
  active    boolean not null default true
);

create table meetup_points (
  id          uuid primary key default gen_random_uuid(),
  campus_id   text not null references campuses(id),
  name        text not null,
  type        text not null,                       -- hub, academic, residence, shared, transit
  lat         double precision not null,
  lng         double precision not null,
  shared      boolean not null default false,      -- visible to every campus
  status      meetup_status not null default 'approved',
  created_at  timestamptz not null default now()
);

-- Where exactly to stand. Only visible to the driver and accepted riders (Section 5.6).
create table meetup_point_details (
  point_id  uuid primary key references meetup_points(id) on delete cascade,
  stand_at  text not null
);
```

### 5.3 People

```sql
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
```

### 5.4 Trips, requests, offers, chat

```sql
create table trips (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references profiles(id),
  place_id         text references places(id),
  destination_name text not null,                  -- copied from the place, or the "Other" result
  destination_lat  double precision,
  destination_lng  double precision,
  departs_at       timestamptz not null,
  back_by          timestamptz,
  seats_total      int not null check (seats_total between 1 and 6),
  seats_taken      int not null default 0 check (seats_taken >= 0),
  meetup_point_id  uuid not null references meetup_points(id),
  car_make         text not null,
  car_color        text not null,
  cost_note        text check (char_length(cost_note) <= 200),
  notes            text check (char_length(notes) <= 300),
  status           trip_status not null default 'open',
  from_request_id  uuid,                           -- set when posted to answer an "In search of" request
  created_at       timestamptz not null default now(),
  check (seats_taken <= seats_total),
  check (back_by is null or back_by > departs_at),
  check (not contains_contact_info(coalesce(cost_note,'') || ' ' || coalesce(notes,'')))
);

create table trip_private (                         -- plate stays hidden until a seat is accepted
  trip_id    uuid primary key references trips(id) on delete cascade,
  car_plate  text not null check (char_length(car_plate) between 2 and 10)
);

create table seat_requests (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  rider_id    uuid not null references profiles(id),
  seats       int not null check (seats between 1 and 3),
  message     text check (char_length(message) <= 300),
  status      seat_request_status not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (trip_id, rider_id)
);

create table ride_requests (                        -- "In search of"
  id                uuid primary key default gen_random_uuid(),
  rider_id          uuid not null references profiles(id),
  place_id          text references places(id),
  destination_name  text not null,
  destination_lat   double precision,
  destination_lng   double precision,
  window_start      timestamptz not null,
  window_end        timestamptz not null,
  flexibility       flexibility_kind not null default 'pm30',
  seats             int not null default 1 check (seats between 1 and 3),
  meetup_point_id   uuid not null references meetup_points(id),
  chip_in           boolean not null default true,
  note              text check (char_length(note) <= 200 and not contains_contact_info(note)),
  status            ride_request_status not null default 'open',
  matched_trip_id   uuid references trips(id),
  created_at        timestamptz not null default now(),
  check (window_end > window_start)                -- the 7-day limit is enforced in post_ride_request
);

create table ride_offers (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references ride_requests(id) on delete cascade,
  driver_id   uuid not null references profiles(id),
  trip_id     uuid not null references trips(id) on delete cascade,
  message     text check (char_length(message) <= 300),
  status      offer_status not null default 'pending',
  created_at  timestamptz not null default now(),
  unique (request_id, trip_id)
);

create table conversations (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  driver_id   uuid not null references profiles(id),
  rider_id    uuid not null references profiles(id),
  closes_at   timestamptz not null,                -- departs_at + 24 hours
  created_at  timestamptz not null default now(),
  unique (trip_id, rider_id)
);

create table messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id),
  body             text not null check (char_length(body) between 1 and 1000),
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);
```

### 5.5 Moderation, email, audit

```sql
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

create table rate_events (                           -- used by the rate limiter (Section 6.6)
  user_id  uuid not null,
  kind     text not null,
  at       timestamptz not null default now()
);
create index on rate_events (user_id, kind, at desc);
```

### 5.6 Helper functions

```sql
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and deleted_at is null);
$$;

create or replace function is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- True when the caller is the trip's driver or has an accepted seat on it.
create or replace function can_see_trip_private(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = p_trip and driver_id = auth.uid())
      or exists (select 1 from seat_requests
                 where trip_id = p_trip and rider_id = auth.uid() and status = 'accepted');
$$;

-- Blocks phone numbers, emails, handles, and links in free-text notes.
create or replace function contains_contact_info(t text) returns boolean
language sql immutable as $$
  select coalesce(
       t ~* '(\+?\d[\d\-\s().]{8,}\d)'
    or t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    or t ~* '(^|\s)@[a-z0-9_.]{2,}'
    or t ~* '(https?://|www\.)'
    or t ~* '\m[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|app|dev)\M'
  , false);
$$;

create or replace function assert_active_user() returns void
language plpgsql stable security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into p from profiles where id = auth.uid() and deleted_at is null;
  if not found or p.onboarded_at is null then raise exception 'not_onboarded'; end if;
  if p.suspended_until is not null and p.suspended_until > now() then
    raise exception 'account_suspended';
  end if;
end $$;
```

Define `contains_contact_info` before the tables that use it in a check constraint (put the helper functions in an earlier migration than the tables).

### 5.7 Indexes

```sql
create index trips_board_idx        on trips (status, departs_at);
create index trips_driver_idx       on trips (driver_id, departs_at);
create index trips_place_idx        on trips (place_id, departs_at) where status = 'open';
create index seat_requests_trip_idx on seat_requests (trip_id, status);
create index seat_requests_rider_idx on seat_requests (rider_id, status);
create index ride_requests_open_idx on ride_requests (status, window_end);
create index ride_requests_rider_idx on ride_requests (rider_id, status);
create index ride_offers_request_idx on ride_offers (request_id, status);
create index ride_offers_driver_idx  on ride_offers (driver_id, status);
create index messages_conv_idx      on messages (conversation_id, created_at);
create index email_outbox_due_idx   on email_outbox (send_after) where sent_at is null;
create index reports_status_idx     on reports (status, created_at);
```

### 5.8 Row-level security

Turn RLS on for every table, then add the policies below. Reads go through the policies; all writes to `trips`, `trip_private`, `seat_requests`, `ride_requests`, `ride_offers`, `blocks`, and `reports` go through the RPCs in Section 6 and have no insert, update, or delete policy for normal users.

```sql
alter table profiles              enable row level security;
alter table blocks                enable row level security;
alter table campuses              enable row level security;
alter table places                enable row level security;
alter table meetup_points         enable row level security;
alter table meetup_point_details  enable row level security;
alter table trips                 enable row level security;
alter table trip_private          enable row level security;
alter table seat_requests         enable row level security;
alter table ride_requests         enable row level security;
alter table ride_offers           enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table reports               enable row level security;
alter table email_outbox          enable row level security;   -- no policies: service role only
alter table audit_log             enable row level security;
alter table rate_events           enable row level security;   -- no policies: functions only
```

| Table | Who can read | Who can write directly |
| --- | --- | --- |
| `campuses`, `places`, `meetup_points` | Any signed-in user (rows with `status = 'approved'` and `active`) | Admin only |
| `meetup_point_details` | Only when `can_see_trip_private` is true for a trip that uses the point | Admin only |
| `profiles` | The person themselves, and admins. Everyone else reads the `public_profiles` view | The person, for `first_name`, `last_name`, `class_year`, `bio`, `avatar_path`, `notification_prefs` only (enforced with column privileges) |
| `trips` | Signed-in users, when `status <> 'cancelled'` or they are the driver or an accepted rider, and `not is_blocked_pair(auth.uid(), driver_id)` | None |
| `trip_private` | `can_see_trip_private(trip_id)` | None |
| `seat_requests` | The rider, the trip's driver, admins | None |
| `ride_requests` | Signed-in users when `status = 'open'` and not a blocked pair; the rider always sees their own | None |
| `ride_offers` | The offering driver and the request's rider | None |
| `conversations` | The driver and the rider in it | None |
| `messages` | Participants of the conversation | Participants insert only, when `now() < closes_at` and no block between them (policy `with check`) |
| `blocks` | The blocker | None |
| `reports` | The reporter and admins | None |
| `audit_log` | Admins | None |

Example policies:

```sql
create policy trips_read on trips for select to authenticated using (
  not is_blocked_pair(auth.uid(), driver_id)
  and (status <> 'cancelled' or driver_id = auth.uid()
       or exists (select 1 from seat_requests s
                  where s.trip_id = trips.id and s.rider_id = auth.uid() and s.status = 'accepted'))
);

create policy trip_private_read on trip_private for select to authenticated
  using (can_see_trip_private(trip_id));

create policy messages_read on messages for select to authenticated using (
  exists (select 1 from conversations c
          where c.id = conversation_id and auth.uid() in (c.driver_id, c.rider_id))
);

create policy messages_insert on messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from conversations c
              where c.id = conversation_id
                and auth.uid() in (c.driver_id, c.rider_id)
                and now() < c.closes_at
                and not is_blocked_pair(c.driver_id, c.rider_id))
);
```

**The `public_profiles` view.** Other people only ever see first name, college, class year, bio, and photo, never last name or email.

```sql
create view public_profiles as
  select id, first_name, campus_id, class_year, bio, avatar_path
  from profiles
  where deleted_at is null
    and onboarded_at is not null
    and not is_blocked_pair(auth.uid(), id);
-- Created by the migration owner, so it bypasses profiles RLS on purpose; the where clause is the filter.
grant select on public_profiles to authenticated;
```

Deleted accounts appear as "Deleted user" in the app: the app shows that label wherever a joined profile is missing.

**The exact meetup spot.** Clients read it through one function, so the check is in one place:

```sql
create or replace function get_trip_meetup_detail(p_trip uuid)
returns text language sql stable security definer set search_path = public as $$
  select d.stand_at
  from trips t join meetup_point_details d on d.point_id = t.meetup_point_id
  where t.id = p_trip and can_see_trip_private(p_trip);
$$;
```

### 5.9 Storage

- Private bucket `avatars`, 5 MB limit, allowed types `image/jpeg`, `image/png`, `image/webp`.
- Files live at `avatars/{user_id}/profile.{ext}`. Policy: a user can insert, update, and delete only inside their own folder; any signed-in user can read.
- The app shows photos with short-lived signed URLs (60 minutes), created on the server.
- A server action resizes uploads to 512 px on the long edge and strips metadata (use `sharp`) before saving.

---

## 6. Server logic (RPCs)

Every function below is `security definer`, sets `search_path = public`, starts with `perform assert_active_user();`, and runs the rate limit check from Section 6.6. Next.js server actions call them with `supabase.rpc(...)` and map the error codes to the plain messages from `WEB_FLOWS.md`.

### 6.1 Function list

| Function | What it does | Error codes |
| --- | --- | --- |
| `complete_onboarding(first, last, class_year, bio, avatar_path)` | Sets profile fields and `onboarded_at` | `invalid_profile` |
| `post_trip(...)` | Creates the trip and its `trip_private` row; requires an approved meetup point visible to the driver's campus; departure in the future and within 60 days; warns on overlap | `meetup_not_allowed`, `time_in_past`, `overlap` (overridable with `p_confirm_overlap`) |
| `update_trip(id, ...)` | Driver edits time, notes, cost note, seats (not below `seats_taken`); notifies accepted riders if time changes | `forbidden`, `seats_below_taken` |
| `cancel_trip(id)` | Marks cancelled, cancels pending and accepted seat requests, closes offers, emails riders | `forbidden` |
| `request_seat(trip, seats, message)` | Creates a pending seat request | `own_trip`, `trip_unavailable`, `trip_full`, `already_requested`, `blocked` |
| `cancel_seat_request(id)` | Rider cancels; if it was accepted, frees the seats and emails the driver | `forbidden` |
| `respond_seat_request(id, accept)` | Driver accepts or declines (Section 6.2) | `forbidden`, `not_pending`, `trip_full`, `trip_unavailable` |
| `post_ride_request(...)` | Creates an "In search of" request; enforces max 2 open, not in the past, within 7 days | `too_many_requests`, `time_in_past`, `too_far_ahead` |
| `update_ride_request(id, ...)` | Edits time and note while open; changing destination closes pending offers (the app confirms first) | `forbidden`, `not_open` |
| `cancel_ride_request(id)`, `extend_ride_request(id)` | Cancel, or extend the window by 2 hours | `forbidden` |
| `send_offer(request, trip, message)` | Driver offers an existing trip that matches destination, falls inside the window, and has enough seats; max 10 pending per driver | `trip_mismatch`, `too_many_offers`, `blocked` |
| `withdraw_offer(id)` | Driver withdraws a pending offer | `forbidden` |
| `respond_offer(id, accept)` | Rider accepts or declines (Section 6.3) | `forbidden`, `no_longer_available` |
| `mark_no_show(trip, rider)` | Driver files a "No-show" report after departure time | `too_early`, `forbidden` |
| `block_user(id)`, `unblock_user(id)` | Adds or removes a block; blocking cancels pending requests and offers between the two | none |
| `file_report(type, target, reason, details)` | Creates a report | `invalid_target` |
| `admin_*` | Meetup point add, edit, suspend, retire; report status change; suspend or unsuspend a user. Each checks `is_admin()` and writes `audit_log` | `forbidden` |
| `matching_nudges()` | Used by cron (Section 7): finds new matches and queues emails | none |
| `request_account_deletion()` | Marks `deleted_at`, clears names and photo path, cancels future trips and requests, then calls the `delete-account` Edge Function | none |

### 6.2 Accepting a seat request

Lock order is always trip first, then the request, so two drivers' or riders' actions on the same trip can't deadlock and the last seat can never be given twice.

```sql
create or replace function respond_seat_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_trip_id uuid; r seat_requests; t trips;
begin
  perform assert_active_user();
  select trip_id into v_trip_id from seat_requests where id = p_request;
  if v_trip_id is null then raise exception 'not_found'; end if;

  select * into t from trips where id = v_trip_id for update;
  select * into r from seat_requests where id = p_request for update;

  if t.driver_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.status <> 'pending'     then raise exception 'not_pending'; end if;

  if p_accept then
    if t.status <> 'open' or t.departs_at <= now() then raise exception 'trip_unavailable'; end if;
    if t.seats_taken + r.seats > t.seats_total      then raise exception 'trip_full'; end if;

    update trips set seats_taken = seats_taken + r.seats where id = t.id;
    update seat_requests set status = 'accepted', decided_at = now() where id = r.id;

    insert into conversations (trip_id, driver_id, rider_id, closes_at)
    values (t.id, t.driver_id, r.rider_id, t.departs_at + interval '24 hours')
    on conflict (trip_id, rider_id) do nothing;

    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (r.rider_id, 'seat_accepted', jsonb_build_object('trip_id', t.id),
            'seat_accepted:' || r.id);
  else
    update seat_requests set status = 'declined', decided_at = now() where id = r.id;
    insert into email_outbox (to_user_id, template, payload, dedupe_key)
    values (r.rider_id, 'seat_declined', jsonb_build_object('trip_id', t.id),
            'seat_declined:' || r.id);
  end if;
end $$;
```

When `seats_taken` reaches `seats_total`, the board query excludes the trip (it only lists trips where `seats_taken < seats_total`), so no separate "full" status is stored.

### 6.3 Accepting an offer

One transaction, same lock order (trip, then request, then offer):

1. Load the offer, then lock its trip, its request, and the offer.
2. Confirm the caller is the request's rider, the request is `open`, the offer is `pending`, the trip is `open`, in the future, and has `seats_taken + request.seats <= seats_total`. Otherwise raise `no_longer_available`.
3. Insert a `seat_requests` row for the rider with status `accepted` (or update an existing pending one), add the seats to `trips.seats_taken`.
4. Set the request to `matched` with `matched_trip_id`; set this offer to `accepted`; set every other pending offer on the request to `closed`.
5. Create the conversation, queue emails: `offer_accepted` to the driver, `offer_closed` ("chose another ride") to each other driver.

Declining sets the offer to `declined` and queues `offer_declined`. A trip a driver posted only to answer the request stays on the board as a normal trip.

### 6.4 Posting a trip

`post_trip` also does the following inside the transaction: verifies the meetup point is `approved` and either belongs to the driver's campus or has `shared = true`; copies the destination name and coordinates from `places` (or from the validated "Other" result); inserts `trips` and `trip_private`; and queues a `match_for_rider` email to any rider whose open request matches (same place, trip departs inside the window, seats left), once per rider per trip using `dedupe_key`.

### 6.5 Destinations: curated list plus "Other"

- Normal destinations are rows in `places`, managed by admins. The seed (Section 9) includes the Trader Joe's, Target, Village, ONT, LAX, and other places from the Mudd localization file.
- "Other" uses the Mapbox Search API from the server, limited to a bounding box around Southern California and to results of type `poi`, `place`, or `airport`. Results of type `address` are rejected, so a private residence can't be chosen. The chosen name and coordinates are sent to `post_trip` and stored on the trip.

### 6.6 Rate limiting and abuse

The `check_rate(kind, max, window)` helper inserts into `rate_events` and raises `rate_limited` when the user is over the limit.

| Action | Limit |
| --- | --- |
| Post a trip | 10 per day |
| Post a ride request | 5 per day (and max 2 open) |
| Send a seat request | 20 per day |
| Send an offer | 30 per day (and max 10 pending) |
| Send a chat message | 30 per minute |
| File a report | 10 per day |

Sign-in code limits are in Section 4. Also: Next.js middleware adds basic per-IP limits on `/auth/*` (use Vercel's firewall rules), and chat messages are plain text only (the app escapes everything it renders).

---

## 7. Scheduled jobs (`pg_cron`)

All jobs are idempotent: running one twice changes nothing.

| Job | Schedule | What it does |
| --- | --- | --- |
| `expire_seat_requests` | every 5 min | Pending seat requests whose trip departs in under 30 minutes become `expired`; queue `request_expired` |
| `expire_ride_requests` | every 5 min | Open requests with `window_end < now()` become `expired`; their pending offers become `expired`; queue emails |
| `expire_offers_for_departed` | every 5 min | Pending offers whose trip has departed become `expired` |
| `mark_trips_past` | every 10 min | Open trips with `departs_at < now() - interval '2 hours'` become `past` |
| `meetup_reminders` | every 5 min | Queue `meetup_reminder` for the driver and each accepted rider of trips departing in 2 hours (deduped) |
| `request_ending_soon` | every 10 min | For open requests with 1 hour left and no pending offers, queue the "extend or cancel" email once |
| `matching_nudges` | every 10 min | Queue matches for newly posted requests against the driver's open trips (deduped) |
| `drain_email_outbox` | every minute | Calls the `send-emails` Edge Function with `net.http_post` and the shared secret |
| `purge_old_data` | daily 03:00 | Deletes messages older than 12 months, and trips, requests, offers, and seat requests older than 24 months; deletes `email_outbox` rows sent over 30 days ago and `rate_events` older than 2 days |

```sql
select cron.schedule('mark_trips_past', '*/10 * * * *', $$
  update trips set status = 'past'
  where status = 'open' and departs_at < now() - interval '2 hours'
$$);

select cron.schedule('drain_email_outbox', '* * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
    headers := jsonb_build_object(
                 'Content-Type','application/json',
                 'x-function-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_secret'))
  )
$$);
```

Each environment stores two Vault secrets, `email_function_url` (that project's `send-emails` function URL) and `email_function_secret`, so the same migration works in local, staging, and production.

---

## 8. Email

### 8.1 Pipeline

1. Functions insert rows into `email_outbox` (never send directly).
2. `send-emails` (Deno Edge Function) claims up to 50 due rows with `for update skip locked` through a small RPC, renders each template, sends through Resend, and sets `sent_at`. On failure it increments `attempts`, stores `last_error`, and retries with a growing delay; after 5 attempts the row is left for review.
3. Before sending, it checks the recipient's `notification_prefs`. Message and request emails respect the toggle; `seat_accepted`, `seat_declined`, `trip_cancelled`, and `meetup_reminder` respect the "reminders" toggle too, but sign-in codes always send.
4. Chat messages queue at most one `new_message` email per conversation per 15 minutes while the other person has unread messages.

### 8.2 Templates (React Email, plain and short, same voice as `WEB_FLOWS.md`)

`seat_requested`, `seat_accepted`, `seat_declined`, `request_expired`, `trip_cancelled`, `trip_time_changed`, `offer_received`, `offer_accepted`, `offer_declined`, `offer_closed`, `offer_withdrawn`, `match_for_rider`, `match_for_driver`, `request_ending_soon`, `meetup_reminder`, `new_message`, `report_received`, `account_warning`, `account_suspended`.

Every email has the first name of the other person, the trip line ("Trader Joe's, Today 3:30 PM"), one button to the right page, and a footer link to notification settings and the Safety page. Emails never include a last name, a phone number, the plate, or the exact meetup spot; those are only on the site after sign-in.

---

## 9. Seed data

`supabase/seed.sql` contains:

- The five campuses with their email domains and time zone.
- Every place from `MUDD.md` Section 8 (Trader Joe's, the three Targets, the Village, Farmers Market, ONT, LAX, Union Station, Metrolink station, Montclair Plaza, Ontario Mills, Victoria Gardens, Priceless Pets), with coordinates filled in by a one-time geocoding script that runs before the seed is committed.
- The Harvey Mudd meetup points from `MUDD.md` Section 3 plus the shared points (Honnold/Mudd Library, Smith Campus Center, Balch Hall, Claremont Depot) with `shared = true`, each with a `stand_at` description written with the college's campus map in hand.
- Pickup points for Pomona, Scripps, Claremont McKenna, and Pitzer are added through the admin page after each college confirms where short pickups are allowed. Until a campus has its own points, its students can use the shared ones.

A second file, `supabase/seed_dev.sql`, adds fake students, trips, and requests for local development and tests only. It is never run in production.

---

## 10. Admin

- Route group `/admin`, visible only when `profiles.role = 'admin'`. The server component checks the role on every request, and every `admin_*` function checks `is_admin()` again.
- **Meetup points:** list by campus, add, edit, suspend, retire; add or edit the `stand_at` text. Suspending removes the point from new trips; existing trips keep it.
- **Reports:** a queue sorted by newest, with filters for status and reason. Opening a report shows the reported person, the trip or request or message, and the other reports against that person. Actions: dismiss, warn (queues `account_warning`), suspend for 7 days, suspend for 30 days, remove account. Each action writes `audit_log`.
- **No-show policy:** the second No-show report against the same person triggers a warning, the third a 7-day suspension (done by the admin with one click from the queue, not automatically).
- Admins are set directly in the database; there is no sign-up path to the role.
- The team reviews new reports within 24 hours. A daily email to admins lists reports still marked `new`.

---

## 11. Privacy and data handling

- **Collected:** school email, name, class year, college, optional bio, photo, trips, requests, offers, chat messages, reports, block list, email preferences. **Never collected:** device location, route data, payment details, contacts, ratings.
- **Who sees what:** other students see first name, college, class year, bio, and photo. Last name and email are never shown to other students. Admins can see full profiles only inside the admin pages, and opening one writes `audit_log`.
- **Retention:** messages 12 months; trips, requests, offers, seat requests 24 months; email outbox 30 days after sending; reports kept until handled plus 24 months.
- **Deleting an account:** `request_account_deletion()` clears the person's names, bio, and photo, cancels their future trips, requests, and offers, and deletes the auth user (Edge Function with the service role). Past trips and reports remain with "Deleted user" in place of the name. The photo file is deleted from storage.
- **Data export:** a "Download my data" button in Settings returns a JSON file of the person's profile, trips, requests, and messages.
- **Backups:** use a Supabase plan with daily backups for production and turn on point-in-time recovery before launch. Restore is rehearsed once on staging.
- **Terms and privacy policy pages** are static pages linked from the footer and the sign-in screen, written with counsel (see the launch checklist in `WEB_FLOWS.md`).

---

## 12. Security checklist

- [ ] RLS enabled on every table; a pgTAP test fails the build if any table in `public` has RLS off.
- [ ] No service role key in the Next.js app or in any `NEXT_PUBLIC_*` variable.
- [ ] Every server action validates input with Zod before calling an RPC.
- [ ] All user text is rendered escaped; no `dangerouslySetInnerHTML` anywhere except the static legal pages.
- [ ] Content-Security-Policy header allows only the app, Supabase, Mapbox, and Sentry; `frame-ancestors 'none'`.
- [ ] Cookies are `Secure`, `HttpOnly`, `SameSite=Lax`.
- [ ] Mapbox token is URL-restricted; Resend sending domain has SPF, DKIM, and DMARC.
- [ ] Storage policies tested: a user can't write into another user's folder.
- [ ] Signing up with a non-school email fails at the auth hook, not only in the form.
- [ ] Dependabot or Renovate enabled; `npm audit` runs in CI.

---

## 13. Deployment and operations

- **Environments:** local (Supabase CLI and `next dev`), staging (Vercel preview plus the staging Supabase project), production.
- **Migrations:** only through `supabase db push` from CI. Nobody edits the production database by hand. Every migration is forward-only; a bad one is fixed by a new migration.
- **CI** (`.github/workflows/ci.yml`) runs on every pull request: install, lint, type check, Vitest, `supabase db reset` then pgTAP, build, and Playwright against the preview URL. Merging to `main` deploys staging; a tagged release deploys production and runs migrations first.
- **Monitoring:** Sentry for errors; `/api/health` (returns 200 only if it can run a trivial query) checked every minute by an uptime monitor that emails the team; Supabase log alerts on repeated RPC errors; an alert if `email_outbox` has unsent rows older than 15 minutes.
- **Domains:** the app on the main domain, the email sending domain with its DNS records, and a `www` redirect.
- **Analytics:** Vercel Analytics only (no cookies, no personal data). No third-party trackers.

---

## 14. Testing

**Database (pgTAP)** runs on every pull request:

- A stranger cannot read `trip_private`, `meetup_point_details`, another person's `seat_requests`, or any `conversations` or `messages` they're not in.
- Blocked users can't see each other's trips, requests, offers, or profiles.
- A non-school email can't sign up.
- Notes with a phone number, email, handle, or link are rejected on trips and ride requests, and allowed in chat.
- A rider can't have more than 2 open requests, or a request in the past or more than 7 days ahead; a driver can't have more than 10 pending offers.
- **Overbooking race:** two database sessions try to accept the last seat on one trip at the same moment; exactly one succeeds and the other gets `trip_full`.
- Accepting an offer reserves the seat, matches the request, closes other offers, and opens a conversation, all or nothing (kill the transaction midway and check nothing changed).
- Messages can't be sent after `closes_at`.
- Every table in `public` has RLS enabled.

**Unit (Vitest):** Zod schemas, relative-time formatting, error-code-to-message mapping, the contact-info filter mirrored in TypeScript so forms warn before submit.

**End to end (Playwright):** the flows in `WEB_FLOWS.md` Section 5: first visit to first request, post a trip, handle a request, ask for a ride and accept an offer, meetup day reminders, report and block. Run each at 360 px and at desktop width, in Light and Dark.

---

## 15. Build order

Build in this order. Each step ends with something you can check.

| Step | Work | Done when |
| --- | --- | --- |
| 0 | Repo, Next.js, Tailwind with the design tokens from `WEB_FLOWS.md` Section 7, Supabase CLI, CI skeleton | The landing page renders in Light and Dark and CI is green |
| 1 | Migrations for Sections 5.1 to 5.7, seed, helper functions | `supabase db reset` loads the seed with no errors |
| 2 | RLS policies, `public_profiles`, storage policies, pgTAP tests for them | The leak tests in Section 14 pass |
| 3 | Auth: email code, auth hook, onboarding, avatar upload | A school email can sign in and finish onboarding; a Gmail address can't |
| 4 | Board and Trip detail (read only) with mock rows from `seed_dev.sql` | Chips, filters, and cards match the design |
| 5 | `post_trip`, place search, meetup point picker with the map | A trip posts only with an approved point |
| 6 | Seat requests: `request_seat`, `respond_seat_request`, cancel flows, My Rides, Inbox | The overbooking race test passes; plate and exact spot appear only after accept |
| 7 | Chat with Realtime, closing after departure plus 24 hours | Messages arrive live; a blocked pair can't message |
| 8 | In search of: requests, offers, `respond_offer`, matching | The full transaction test passes |
| 9 | Email outbox, Edge Function, templates, all cron jobs | Every email in Section 8.2 sends once; reminders never duplicate |
| 10 | Report, block, admin pages, audit log | A report reaches the queue; a suspended user's writes fail |
| 11 | Safety page, terms and privacy pages, account deletion, data export | Deleting an account leaves "Deleted user" and removes the photo |
| 12 | Hardening: rate limits, CSP, Sentry, health check, backups | The Section 12 checklist is fully checked |
| 13 | Deploy staging, then production; run the launch checklist in `WEB_FLOWS.md` Section 10 | A real trip is posted, requested, accepted, and chatted about end to end |

---

## 16. Decisions this file makes

- **One Postgres function per business action** instead of client-side logic, so the rules can't be bypassed from the browser.
- **No stored "full" status.** A trip is full when `seats_taken = seats_total`; the board query hides it.
- **Email only, queued.** Nothing sends mail inside a request, so a slow provider never blocks a user.
- **No location, ever.** Meetup points are fixed rows with coordinates; the app never asks the browser for the user's location.
- **Curated destinations first.** "Other" is limited to points of interest, so private addresses can't be chosen.
- **Plain text chat.** No attachments or links in chat at launch, which also removes most abuse and storage risk. (Links and phone numbers are blocked in notes; chat is plain text only and the app doesn't turn anything in it into a link.)
