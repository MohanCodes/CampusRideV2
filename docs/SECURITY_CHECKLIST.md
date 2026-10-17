# Security checklist (BUILD.md Section 12)

`[x]` = built and tested here. `[ ]` = waiting on something only the team can do. Nothing is checked on a guess.

- [x] **RLS on every table, and a test fails the build if one doesn't have it.** `supabase/tests/step2_security.test.sql` and
      `step12_hardening.test.sql` fail if any table in `public` has row-level security off or has no policy. The two tables only
      the database's own functions use (`rate_events`, `email_outbox`) have a deny-everyone policy.
- [x] **No service role key in the web app or any `NEXT_PUBLIC_*` variable.** `lib/security.test.ts` fails if the app's source
      mentions it, or puts a secret-looking name in a public variable. Only the two Edge Functions
      (`send-emails`, `delete-account`) receive it, from Supabase.
- [x] **Every server action validates input with Zod before an RPC.** Each `"use server"` file hands input to a `perform*`
      function that parses with a schema in `lib/schemas/`; `lib/security.test.ts` fails if a new action file does neither.
- [x] **No raw HTML.** `dangerouslySetInnerHTML` and `innerHTML =` appear nowhere (tested). The Terms and Privacy pages are
      ordinary components, so there is no exception to make.
- [x] **Content-Security-Policy** allows only the app, Supabase (API and `wss://`), Mapbox and Sentry; `frame-ancestors 'none'`;
      scripts run only with a per-response nonce. `lib/csp.ts`, `proxy.ts`; unit tests in `lib/csp.test.ts`; `e2e/security.spec.ts`
      checks the built site sends it, no page breaks under it, and injected inline handlers don't run.
      *Not yet seen:* the Mapbox map under the policy with a real token (no token yet). If the map fails on staging, check the
      browser console for the blocked address and add it to `lib/csp.ts`.
- [x] **Other headers:** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS (production), and a
      `Permissions-Policy` that switches geolocation, camera, microphone and payment off.
- [x] **Cookies HttpOnly, SameSite=Lax, Secure in production.** `lib/supabase/cookies.ts` (unit tested).
      *Confirm on staging* by signing in and looking at the cookies in the browser's dev tools.
- [x] **Storage policies tested.** `step2_security.test.sql`, "Storage folders": a user can write only into their own folder.
- [x] **A non-school email fails at the auth hook, not only in the form.** `step3_auth.test.sql` calls
      `hook_restrict_signup_domain` directly. *Still to do by hand:* turn the hook on in each hosted project (`supabase/PENDING.md`).
- [x] **Dependabot and `npm audit`.** `.github/dependabot.yml` (weekly, security updates as advisories appear); CI runs
      `npm run audit:prod` on every pull request.
- [ ] **Mapbox token restricted to the site's domains.** Only the Mapbox dashboard can do this.
- [ ] **Resend sending domain has SPF, DKIM and DMARC.** Only the DNS provider can do this.

## Also tested in Step 12

- Rate limits on every write that can be spammed: posting trips, asking for seats, requests, offers, chat messages, reports,
  deleting an account, exporting data (`check_rate`; Steps 5 to 11 tests).
- The browser can't write the protected tables, can't promote itself or lift a suspension, and signed-out visitors read no
  profiles (`step12_hardening.test.sql`).
- Every security-definer function pins its search path, and the service-only functions are closed to the browser.
- Errors go to Sentry with cookies, headers, request bodies, query strings, users and email addresses removed
  (`lib/sentry.ts`, tested). Nothing is sent unless `SENTRY_DSN` is set.

## Operations

- **Uptime:** point a monitor at `https://<site>/api/health` every minute, alerting the team's email. It returns `200 {"ok":true}`
  only if the database answers, and `503 {"ok":false}` otherwise (also when the database settings are missing).
- **Stuck email:** admin pages show a notice when any email has been due for more than 15 minutes and is unsent
  (`admin_email_backlog()`). Add a Supabase log alert on repeated RPC errors in the dashboard.
- **Backups:** production needs a Supabase plan with daily backups and point-in-time recovery turned on (dashboard, Database →
  Backups). Rehearse one restore on staging before launch and write down how long it took. Only the project owner can do these.
- **Migrations:** `supabase db push` from CI only; never edit production by hand; every migration is forward-only.
