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
