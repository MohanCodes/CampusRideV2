# Launch: what is built, what is waiting on you

Written for the person launching Campus Ride. Everything the code can do is done and tested. What remains needs your
accounts, your decisions, or people outside the project. Nothing below was filled in with a guess.

**Status of the four finishing conditions (AGENTS.md Section 9)**

| Condition | Status |
| --- | --- |
| Every acceptance criterion in `WEB_FLOWS.md` Section 9 passes | Passes against sample data and a local database. Rows marked * need staging to confirm (table below). |
| The security checklist in `BUILD.md` Section 12 is fully checked | 8 of 10 done; 2 need you (`docs/SECURITY_CHECKLIST.md`). |
| The end-to-end flows pass on a staging deployment | **Not done: there is no staging deployment yet.** Needs Part A. |
| The launch checklist is handed over, each item done, not applicable, or waiting | This file (Part C). |

So **the site is not ready to launch**, and production has not been touched.

---

## Part A. Set up, in this order

Each step is yours; I cannot do them. Tell me when one is done and I will run the matching checks.

1. **Docker Desktop** on the machine you build on. Needed for `supabase db reset` and `supabase test db` against the real
   Supabase image. (Until now the database tests ran on a real PostgreSQL instead; `npm run db:test:local`.)
2. **Supabase staging project.** Give me the project URL and the public (anon) key. Nothing else: not the service role key.
3. **Dashboard settings on staging** (list in `supabase/PENDING.md`, "Auth settings"): turn on the Before User Created hook
   (`public.hook_restrict_signup_domain`), switch off password and social sign-in, 6-digit codes valid 10 minutes with 5 per
   hour per email, the email template from `supabase/templates/code.html`, SMTP set to Resend.
4. **Resend:** an account, a verified sending domain (SPF, DKIM, DMARC), an API key.
5. **Supabase secrets on staging:** Edge Function secrets `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FUNCTION_SECRET`, `SITE_URL`; Vault
   secrets `email_function_url` and `email_function_secret` (same value as `EMAIL_FUNCTION_SECRET`).
6. **Mapbox token**, restricted to the site's domains. Gives the meetup map and "Other" destination search.
7. **Vercel project** connected to this repository; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `SENTRY_DSN`. Never set the service role key there.
8. **GitHub:** repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and a `SUPABASE_PROJECT_REF` variable in each of
   two environments, `staging` and `production` (protect `production` with a required reviewer). `.github/workflows/deploy.yml`
   then runs migrations and deploys both Edge Functions on merge to `main` (staging) and on a `v*` tag (production).
9. **Meetup points.** Admins add them in `/admin/meetup-points`, and each needs a "stand here" line. I have the Harvey Mudd names
   from `MUDD.md` but no coordinates or stand-at text, and nothing for Pomona, Scripps, Claremont McKenna or Pitzer.
   Give me the list (name, which college, where exactly to stand) and I will turn it into seed data, or add them in the admin page.
10. **First admin.** After you sign in once on staging, run in the SQL editor:
    `update profiles set role = 'admin' where id = '<your user id>';`
11. **Legal text** for Terms and Privacy. Both pages currently say the text is pending.

When 2 to 8 are done I will deploy staging and run the end-to-end flow in Part B.

## Part B. The end-to-end check on staging (the done-when for Step 13)

Two real school email addresses (a driver and a rider), on two browsers:

1. Both sign in with an emailed code and finish onboarding with a photo.
2. Driver posts a trip to an approved meetup point. The rider finds it on the board.
3. Rider requests a seat. Driver gets the email once, accepts. Rider sees the plate and exact spot only now.
4. They message each other; the message arrives without a refresh.
5. Rider "In search of" request; driver offers the trip; rider accepts.
6. Report and Block from a profile; the report appears in `/admin/reports` for the admin.
7. Rider downloads their data, then deletes their account: the driver's history shows "Deleted user", the photo file is gone.
8. `/api/health` returns 200; check the map loads under the Content-Security-Policy.

Do not call the site ready until all eight pass.

---

## Part C. Launch checklist (`WEB_FLOWS.md` Section 10)

| Item | Status |
| --- | --- |
| Confirm each college's email domain with its IT office | **Waiting on you.** All seven are in `seed.sql`, unconfirmed. |
| Written approval or no objection from each college's Dean of Students | **Waiting on you.** |
| Confirm each college's campus safety number and show it on the Safety page | **Partly done.** Page shows it (tested). Only Harvey Mudd's (909-607-2000) is in the data; the other four are waiting on you. |
| Confirm where a short pickup is allowed at each approved point | **Waiting on you.** |
| Counsel review: terms, Safety wording, cost-sharing language, retention, driver insurance disclosures, under-18 use | **Waiting on you.** Terms and Privacy say so on the page. The Safety sentence is the exact one from `WEB_FLOWS.md` 6.3. |
| Seed the board with a few real trips | **Waiting on you.** Needs staging and real students; the board is never empty for visitors (labeled sample cards), but the real board starts empty. |

## Part D. Acceptance criteria (`WEB_FLOWS.md` Section 9)

| Criterion | Evidence |
| --- | --- |
| Signed-out visitor can browse the board but must sign in to request, post, or message | Met by a decision of mine: signed-out visitors see labeled sample cards, because the database only lets signed-in students read trips. **Your call:** keep this, or make real trips visible to everyone (needs a new database rule). |
| Only allowed school emails can sign in | Auth hook tested (`step3`). * Turn the hook on in the dashboard (Part A.3). |
| Request a seat in two clicks from the board | `e2e/trip.spec.ts`, `seats.spec.ts`. |
| Posting uses approved points only; no free-text meetup address | `step5` SQL tests, `e2e/post.spec.ts`. |
| Exact spot and plate hidden until accept | `step2`, `step6` SQL tests. |
| Accepting reserves the seat, reveals the spot, opens chat in one transaction; no overbooking | `step6`; `race/overbooking.mjs`, `race/offers.mjs`. |
| Max 2 open requests, none past or beyond 7 days; contact info blocked in notes | `step5`, `step8`; `lib/contact` tests. |
| Trips move to Past 2 hours after departure; chats close 24 hours after | `step7`, `step9`. |
| Report and Block on every profile, trip, request, and chat | `e2e/safety.spec.ts`. |
| Safety page linked from footer and every trip, states the site does not supervise | `e2e/account.spec.ts`. |
| No location, tracking, PIN, SOS, rating, or payment | `lib/security.test.ts` (no geolocation); none built. |
| Every page works at 360 px, Light and Dark, keyboard only, reduced motion | `e2e/*.spec.ts` at four looks; `e2e/a11y.spec.ts`: axe (WCAG A and AA, contrast), keyboard walk, visible focus, reduced motion. |

## Part E. Not verified yet (needs the real services)

- The Mapbox map and destination search (no token).
- The live chat feed over Realtime (chat also polls, and works either way).
- The every-minute email job calling the Edge Function, and the other `pg_cron` schedules, on a hosted project.
- `supabase test db` and the Supabase security advisor (Docker and the staging project).
- The map under the Content-Security-Policy.
- Real email delivery and the sign-in code email.
