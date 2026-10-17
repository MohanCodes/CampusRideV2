# Running the database tests without Docker

`npm run db:test:local` starts a throwaway PostgreSQL (the `embedded-postgres` package), builds the
database from `supabase/migrations`, loads `seed.sql` and `seed_dev.sql`, then runs:

- every `supabase/tests/*.test.sql` file (written for pgTAP), through a small stand-in for pgTAP
  (`shim.sql`), and
- every `supabase/tests/race/*.mjs` file, which open several real connections at once to test locks
  and races (for example, two drivers accepting the last seat at the same moment).

## What it proves, and what it doesn't

It runs real PostgreSQL, so row-level security, locking, constraints and functions behave as they do
in production. It does **not** include Supabase itself: `stubs.sql` fakes only the roles, `auth.uid()`,
a minimal `auth.users` and `storage`, and `pg_cron` and `pg_net` are skipped. So it does not check the
auth hook wiring, the real storage service, scheduled jobs, or the security advisor.

The authoritative checks are `supabase db reset` and `supabase test db` (real Supabase, real pgTAP).
CI runs them. Run those too when Docker is available.
