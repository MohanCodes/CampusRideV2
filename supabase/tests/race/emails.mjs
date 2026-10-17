// Concurrent-session tests for the email pipeline (BUILD.md Section 8): "every email sends once; reminders
// never duplicate". Several workers claim at the same moment, and several copies of the same scheduled job
// run at the same moment. It reads DATABASE_URL (default: the local Supabase database).
import { connect, startRun } from "./_helpers.mjs";

const run = await startRun();
const { check, admin, makeUser, makeTrip, pendingSeatRequest } = run;

try {
  const driver = await makeUser("mdriver");

  // 1. Many workers claim from one queue. No email is handed to two of them, and none is lost.
  console.log("1. concurrent claims");
  {
    const rider = await makeUser("mrider");
    const total = 240;
    for (let round = 0; round < 8; round++) {
      await admin.query("delete from email_outbox where to_user_id = $1", [rider]);
      await admin.query(
        `insert into email_outbox (to_user_id, template, payload, dedupe_key)
         select $1, 'account_warning', '{}'::jsonb, 'race:' || $2 || ':' || g from generate_series(1, $3) g`, [rider, round, total]);
      const workers = await Promise.all(Array.from({ length: 6 }, connect));
      const results = await Promise.all(workers.map((w) => w.query("select id from claim_emails(50)")));
      const ids = results.flatMap((r) => r.rows.map((x) => String(x.id)));
      check(new Set(ids).size === ids.length, `round ${round}: no email was claimed by two workers (${ids.length} claimed, ${new Set(ids).size} distinct)`);
      // Drain the rest in turn: afterwards each email was claimed exactly once.
      const rest = (await admin.query("select id from claim_emails(500)")).rows.map((x) => String(x.id));
      const all = new Set([...ids, ...rest]);
      check(all.size === total && ids.length + rest.length === total, `round ${round}: all ${total} claimed exactly once (got ${ids.length + rest.length}, ${all.size} distinct)`);
      const attempts = (await admin.query("select max(attempts)::int as m from email_outbox where to_user_id = $1", [rider])).rows[0].m;
      check(attempts === 1, `round ${round}: each counted as a single attempt (max ${attempts})`);
      await Promise.all(workers.map((w) => w.end()));
    }
  }

  // 2. The same scheduled job running several times at once queues each email once.
  console.log("2. concurrent jobs");
  {
    const passenger = await makeUser("mpassenger");
    for (let round = 0; round < 8; round++) {
      const trip = await makeTrip(driver, 3, { hours: 1, offsetMinutes: round });
      const seat = await pendingSeatRequest(trip, passenger);
      await admin.query("update seat_requests set status = 'accepted' where id = $1", [seat]);
      const workers = await Promise.all(Array.from({ length: 5 }, connect));
      await Promise.all(workers.map((w) => w.query("select meetup_reminders()")));
      const n = (await admin.query("select count(*)::int as n from email_outbox where template = 'meetup_reminder' and payload ->> 'trip_id' = $1", [trip])).rows[0].n;
      check(n === 2, `round ${round}: five jobs at once queued one reminder for the driver and one for the rider (got ${n})`);
      await Promise.all(workers.map((w) => w.end()));
      await admin.query("delete from seat_requests where id = $1", [seat]);
    }
  }

  // 3. Jobs that change rows, run together with claims, never lose or double an email.
  console.log("3. jobs and claims together");
  {
    const rider = await makeUser("mrider3");
    for (let round = 0; round < 8; round++) {
      const trip = await makeTrip(driver, 3, { hours: 0, offsetMinutes: 20 + round });
      await pendingSeatRequest(trip, rider);
      const [a, b, c] = await Promise.all([connect(), connect(), connect()]);
      const [, , claimed] = await Promise.all([a.query("select expire_seat_requests()"), b.query("select expire_seat_requests()"), c.query("select id from claim_emails(500)")]);
      const later = (await admin.query("select id from claim_emails(500)")).rows;
      const queued = (await admin.query("select count(*)::int as n from email_outbox where template = 'request_expired' and to_user_id = $1 and payload ->> 'trip_id' = $2", [rider, trip])).rows[0].n;
      check(queued === 1, `round ${round}: one expiry email for one expired request (got ${queued})`);
      const seen = new Set([...claimed.rows, ...later].map((x) => String(x.id)));
      check(seen.size === claimed.rows.length + later.length, `round ${round}: nothing claimed twice`);
      await Promise.all([a.end(), b.end(), c.end()]);
    }
  }
} finally {
  await run.finish();
}
