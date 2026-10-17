# AGENTS.md: Instructions for building Campus Ride Web

Read this file first, then the other files in the order below. This file tells you how to work; the other files tell you what to build.

---

## 1. What you are building

Campus Ride is a student carpooling website for the Claremont Colleges (the 5Cs). It does one job: help students **find each other** and **choose an approved public place to meet**. The ride itself, and any money, happen outside the app.

The app has no location tracking, no live trip sharing, no PIN, no SOS button, no ratings, no payments, and no emergency contacts. Do not add any of these, even if they seem useful. If you think something is missing, ask.

---

## 2. Files and what each one decides

Read them in this order before writing any code.

| File | What it decides | If it conflicts with another file |
| --- | --- | --- |
| `AGENTS.md` (this file) | How you work | Wins on process |
| `WEB_FLOWS.md` | Screens, flows, copy, visual design, acceptance criteria | Wins on anything users see or do |
| `BUILD.md` | Stack, database, security, jobs, email, tests, build order | Wins on how data is stored and secured |
| `MUDD.md` | Real destinations and Harvey Mudd meetup points, used for seed data | Wins on place and meetup facts |
| The landing page HTML (`landing.html`) | The look and feel the design section is based on | `WEB_FLOWS.md` Section 7 wins if they differ |

If two files disagree on something not covered above, stop and ask. Do not pick one quietly.

If a file is missing, say so before you start. Do not invent its contents.

---

## 3. How to work

1. **Follow the build order in `BUILD.md` Section 15, one step at a time.** Do not start a step until the one before it is finished and checked.
2. **Before each step, say in two or three sentences what you are about to build.** Then build it.
3. **After each step, check it against its "done when" line** in `BUILD.md`, and against the matching acceptance criteria in `WEB_FLOWS.md` Section 9. Run the tests. Show the result.
4. **Then stop and wait for the person to say continue.** Do not roll into the next step on your own, unless they have told you to run several steps in a row.
5. **Commit after each step** with a short message that names the step ("Step 3: auth and onboarding"). One step, one commit, at minimum.
6. **Do not rewrite or reformat work from earlier steps** unless a test or a bug requires it, and say so when you do.
7. **Use mock data first where `BUILD.md` says to**, so the screens can be judged before the backend exists.
8. If a step turns out to be much bigger than described, split it and say how.

---

## 4. Rules you must not break

**Security**

- Every table has row-level security on. A table without a policy is a bug.
- The browser never writes directly to `trips`, `trip_private`, `seat_requests`, `ride_requests`, `ride_offers`, `blocks`, or `reports`. Those changes go through the Postgres functions in `BUILD.md` Section 6.
- The Supabase service role key never appears in the Next.js app, in any `NEXT_PUBLIC_*` variable, in logs, or in a commit. It is only used by the two Edge Functions.
- Never commit secrets. Use `.env.local` for local values and add it to `.gitignore` on day one. Commit a `.env.example` with variable names and no values.
- Other students never see a last name or an email. They read `public_profiles`, not `profiles`.
- The car's plate and the exact meetup spot are hidden until the driver accepts. Test this; do not assume it.
- Validate every server action's input with Zod before it reaches the database.

**Product**

- Meetups only happen at approved meetup points. There is no free-text meetup address anywhere in the app, in forms, or in the database.
- "Other" destinations come from Mapbox results of type point of interest, place, or airport only. Reject addresses.
- Notes on trips and requests cannot contain phone numbers, emails, handles, or links. Chat can.
- Never write copy that promises monitoring, safety, or help. The Safety page wording in `WEB_FLOWS.md` Section 6.3 is exact; use it as written.
- Never ask the browser for the user's location.

**Design**

- Use only the design tokens in `WEB_FLOWS.md` Section 7. No hard-coded colors, no new fonts, no new icon styles. Ask before adding any.
- Use one filled primary (Ink) button per screen.
- Every screen needs loading, empty, error, and offline states.
- Every screen works at 360 px wide, in Light and Dark, with keyboard only, and with reduced motion on.
- Copy follows the voice rules: short, plain, first names, no blame, no exclamation marks in errors.

---

## 5. Things you cannot do yourself

Stop and ask the person to do these. Tell them exactly what you need, then wait.

- Create the Supabase projects (local runs through the CLI; staging and production need the person's account) and give you the URL and public key.
- Create the Vercel project and connect the repository.
- Create the Resend account, verify the sending domain, and add its DNS records.
- Create the Mapbox token and restrict it to the site's domains.
- Turn on the Before User Created auth hook in the Supabase dashboard, switch off password and social sign-in, and set SMTP to Resend.
- Set the Vault secrets `email_function_url` and `email_function_secret` and the Edge Function secrets listed in `BUILD.md` Section 3.
- Provide the meetup points and "stand here" text for Pomona, Scripps, Claremont McKenna, and Pitzer, and the stand-at text for every point.
- Provide legal text for the terms and privacy pages. Until it exists, build the pages with a clear note that the text is pending and do not make it up.
- Make any decision marked as needing counsel in `WEB_FLOWS.md` Section 10.

Do not fake these with made-up values. If something is blocked, build everything that does not depend on it and say what is waiting.

---

## 6. Supabase connection

The person has connected you to Supabase through MCP. Use it carefully.

- **Staging only.** The connection points at the staging project. Never connect to, query, or change the production project unless the person says so in that message, and even then prefer read-only access. If you are not sure which project you are connected to, check the project name and ID first and say it out loud before changing anything.
- **Migrations, not ad hoc SQL.** Every schema change is a numbered file in `supabase/migrations/`, committed to the repo, then applied. Do not create or alter tables, policies, functions, or cron jobs by running SQL directly through the connection without a matching migration file. If you ever do run something directly, write the migration for it immediately and tell the person.
- **Prove it from scratch.** After any database change, run `supabase db reset` locally to confirm the migrations and seed load from nothing. The connected project must match what the repo produces.
- **Allowed uses of the connection:** looking at tables and policies, running read-only queries, checking logs and advisors (security and performance), confirming the auth hook and cron jobs exist, and running the pgTAP tests against the real project.
- **Never do through the connection:** delete or truncate data, drop tables, change auth settings that are not in `BUILD.md`, create or rotate API keys, or change billing or organization settings. Ask the person to do these in the dashboard.
- **Secrets.** The connection has its own login, so you do not need the service role key. Do not ask for it, print it, or store it anywhere. If a tool output shows a key, do not repeat it.
- **After applying changes,** run the Supabase security advisor if it is available and fix any warnings about missing row-level security or exposed functions before calling the step done.
- **Real people's data.** Staging should only hold fake data from `seed_dev.sql`. If you see real student emails or messages in the connected project, stop and tell the person.

---

## 7. Testing and quality

- Run lint, type check, unit tests, and the database tests before every commit. Do not commit with failing tests.
- Write the database tests listed in `BUILD.md` Section 14 as you build the matching feature, not at the end. The overbooking race test and the "stranger can't read private data" tests are required before Step 6 is called done.
- The SQL in `BUILD.md` has not been run. Expect errors. Fix them in the migrations, keep the intent, and tell the person what you changed and why.
- Use `supabase db reset` to prove migrations and seed data load from nothing, at the end of every step that touches the database.
- Keep migrations forward-only. Never edit a migration that has already been applied to staging or production; add a new one.
- Use Playwright to check the flows in `WEB_FLOWS.md` Section 5 once the screens exist, at phone and desktop widths.

---

## 8. How to report

After each step, send a short message with:

1. What you built, in one or two sentences.
2. Whether the "done when" check passed, and the test results.
3. Anything you changed from the spec, and why.
4. Anything that is blocked and what you need from the person.
5. The next step, named, and a question: "Continue?"

Do not paste long code back into the message. Point to the files and commit instead. Do not describe each thing you tried along the way.

If you are unsure, ask one clear question. Do not ask several at once, and do not ask about things the files already answer.

---

## 9. Finishing

The app is done when:

- Every acceptance criterion in `WEB_FLOWS.md` Section 9 passes.
- The security checklist in `BUILD.md` Section 12 is fully checked.
- The end-to-end flows pass on a staging deployment.
- The launch checklist in `WEB_FLOWS.md` Section 10 has been handed to the person, with each item marked done, not applicable, or waiting on them.

Do not deploy to production, or tell the person it is ready to launch, before all four are true.
