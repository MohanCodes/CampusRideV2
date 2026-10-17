# Waiting on the team

Items the Step 1 seed cannot fill without made-up values. Nothing here is guessed.

## Meetup points (not seeded)

`meetup_points.lat` and `lng` are `NOT NULL`, and `MUDD.md` has no coordinates. They need the
geocoding pass described in `BUILD.md` Section 9, which needs the Mapbox token. Each point also
needs `stand_at` text ("where exactly to stand") from someone who has the campus map in hand.

Harvey Mudd (from `MUDD.md` Section 3): Platt Campus Center, Hoch-Shanahan Dining Commons,
Linde Activities Center, Shanahan Center, Atwood, Case, Drinkward, East, Linde, North, Sontag,
South and West Halls.

Shared (`shared = true`): Honnold/Mudd Library, Smith Campus Center, Balch Hall, Claremont Depot.

Pomona, Scripps, Claremont McKenna and Pitzer points are added through the admin page after each
college confirms where short pickups are allowed. Garrett House is private and is not a point.

## Campus safety phone numbers

Only Harvey Mudd's (909-607-2000) is verified. `safety_phone` is null for Pomona, Scripps,
Claremont McKenna and Pitzer until each is confirmed.

## Email domains

All seven domains in `seed.sql` still need confirming with each college's IT office.

## Auth settings only the Supabase dashboard can change (staging and production)

`supabase/config.toml` covers local development. For each hosted project, someone with access must:

- Turn on the **Before User Created** hook and point it at `public.hook_restrict_signup_domain`.
- Switch off password sign-in and every social provider (email one-time code only).
- Set the email code to 6 digits, valid 10 minutes, and the code request limit to 5 per hour per email.
  (Local config sets 6 digits, 10 minutes, and 30 seconds between codes; there is no per-hour,
  per-email setting in the local file.)
- Use `supabase/templates/code.html` for both the "Confirm signup" and "Magic link" emails.
- Set SMTP to Resend once the sending domain is verified (SPF, DKIM, DMARC).

## Live chat (Realtime)

The migration adds `messages` to the `supabase_realtime` publication, and the chat page also checks for new
messages every few seconds whenever the live feed isn't connected, so chat works either way. The live feed
itself could not be exercised without a Supabase project: when staging exists, open one chat in two browsers
and confirm a message appears in the other without a refresh. Realtime must be enabled for the project
(it is by default), and the Content-Security-Policy added in Step 12 must allow the project's `wss://` address.

## Email (Resend) and the scheduled jobs

Built and tested, but nothing can send until these exist (you provide them; nothing is faked):

- **Resend account and a verified sending domain**, with SPF, DKIM and DMARC records.
- **Edge Function secrets** (Supabase dashboard, or `supabase secrets set`): `RESEND_API_KEY`, `EMAIL_FROM`
  (for example `Campus Ride <hello@your-domain>`), `EMAIL_FUNCTION_SECRET` (a long random value), and
  `SITE_URL` (the site's address, used for the button in every email). `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are provided to the function automatically.
- **Vault secrets** `email_function_url` (the deployed `send-emails` function's address) and
  `email_function_secret` (the same value as `EMAIL_FUNCTION_SECRET`). Until both exist, the every-minute
  job `drain_email_outbox` quietly does nothing.
- **Deploy the function:** `supabase functions deploy send-emails` (Step 13).

The `pg_cron` schedule is created by migration 21 on a Supabase database. It could not be run here
(no Supabase), so after the first push to staging, open the Supabase dashboard (Integrations, Cron) and confirm
the nine jobs exist: `expire_seat_requests`, `expire_ride_requests`, `expire_offers_for_departed`,
`mark_trips_past`, `meetup_reminders`, `request_ending_soon`, `matching_nudges`, `drain_email_outbox`, `purge_old_data`.

Email footers link to `/me` (notification settings) and `/safety`; those pages arrive in Step 11.

## Step 10: moderation

- **Admins are set by hand.** There is no screen for it. In the Supabase SQL editor on each project, run
  `update profiles set role = 'admin' where id = '<user id>';` for the one or two people who review reports.
- **Daily digest.** `admin_report_digest` runs at 16:00 UTC and emails every admin when reports are waiting. It needs the
  email pipeline from Step 9 (Vault secrets, Resend) to deliver anything.
- **Removing an account** clears the profile and cancels what's ahead through `deactivate_account`. Deleting the person's
  sign-in and avatar file needs the `delete-account` Edge Function, which comes in Step 11.

## Step 11: Safety, legal pages, deleting an account

- **Terms and Privacy text.** Both pages say the text is pending. Counsel has to provide it (`WEB_FLOWS.md` Section 10). The
  Privacy page lists what the app does today; that list is not the policy.
- **Campus safety numbers.** The Safety page shows the signed-in person's college number from `campuses.safety_phone`. Only
  Harvey Mudd's is filled in; the others say "we don't have it yet" until you confirm them.
- **Deploy the `delete-account` Edge Function** to each hosted project (`supabase functions deploy delete-account`). It keeps
  `verify_jwt = true` and needs no secrets beyond the two Supabase provides. Until it is deployed, Delete account closes the
  account (name, bio and photo reference cleared, upcoming trips cancelled) but cannot remove the sign-in or photo file, and
  says so; trying again finishes it once the function exists.
- **Migration 23 drops the link from `profiles` to `auth.users`** so deleting the sign-in leaves the empty profile row that old
  trips and reports point at ("Deleted user"). The sign-up trigger still creates the row.
- **Profile editing** is not in the spec (Settings lists notification emails, blocked users, privacy, help, Sign out, Delete
  account), so there is no edit-profile screen. Say if you want one.

## Step 12: hardening

- **Sentry:** create a project and set `SENTRY_DSN` in Vercel (staging and production). Nothing is sent without it.
- **Mapbox under the Content-Security-Policy:** add the token, open a trip with the meetup map, and check the browser console
  for blocked requests. See `docs/SECURITY_CHECKLIST.md`.
- **Uptime monitor** on `/api/health`, **Supabase backups with point-in-time recovery**, a rehearsed restore on staging, and
  the Mapbox token's URL restriction: all in `docs/SECURITY_CHECKLIST.md` under "Operations".

## Admin location picker (Leaflet)

The "Add a meetup point" form has a click-to-pick map built on Leaflet with OpenStreetMap tiles: no account or token. It is
admin-only; the map riders see is still Mapbox. OpenStreetMap's public tile servers are meant for light use with the
attribution the map already shows, which fits an admin page. If it ever gets heavy use, switch the tile address in
`components/admin/LocationPicker.tsx` (and `lib/csp.ts`) to a tile provider you pay for.
