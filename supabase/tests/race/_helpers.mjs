// Shared setup for the concurrent-session tests in this folder (files starting with "_" are not run).
import { randomUUID } from "node:crypto";
import pg from "pg";

export const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const connect = async () => {
  const c = new pg.Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One test run: an admin connection, helpers to create people and trips, a pass/fail counter, and cleanup.
export async function startRun() {
  const admin = await connect();
  const created = { users: [], trips: [], points: [], requests: [] };
  const run = { admin, created, failures: 0 };
  const tag = randomUUID().slice(0, 8);

  run.check = (cond, msg) => { if (!cond) { run.failures++; console.log(`  FAIL ${msg}`); } };
  run.waitFor = async (fn, what, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await sleep(25); }
    run.failures++; console.log(`  FAIL timed out waiting for: ${what}`);
    return false;
  };

  run.makeUser = async (label) => {
    const id = randomUUID();
    await admin.query("insert into auth.users (id, email) values ($1, $2)", [id, `race-${tag}-${label}@pomona.edu`]);
    await admin.query("update profiles set first_name = $2, onboarded_at = now() where id = $1", [id, label]);
    created.users.push(id);
    return id;
  };

  const point = randomUUID();
  await admin.query("insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ($1, 'pomona', 'Race point', 'hub', 0, 0, true)", [point]);
  created.points.push(point);

  run.makeTrip = async (driver, seats, { hours = 72, place = "tj-claremont", offsetMinutes = 0 } = {}) => {
    const id = randomUUID();
    await admin.query(
      `insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color)
       values ($1, $2, $3, 'Race trip', now() + ($4 || ' hours')::interval + ($5 || ' minutes')::interval, $6, $7, 'Honda', 'Blue')`,
      [id, driver, place, String(hours), String(offsetMinutes), seats, point]);
    await admin.query("insert into trip_private (trip_id, car_plate) values ($1, 'RACE01')", [id]);
    created.trips.push(id);
    return id;
  };
  run.pendingSeatRequest = async (trip, rider, seats = 1) =>
    (await admin.query("insert into seat_requests (trip_id, rider_id, seats) values ($1, $2, $3) returning id", [trip, rider, seats])).rows[0].id;
  // An open ride request for Trader Joe's with a window that covers `hours` from now.
  run.makeRequest = async (rider, seats = 1, hours = 72) => {
    const id = randomUUID();
    await admin.query(
      `insert into ride_requests (id, rider_id, place_id, destination_name, window_start, window_end, seats, meetup_point_id)
       values ($1, $2, 'tj-claremont', 'Race trip', now() + ($3 || ' hours')::interval - interval '2 hours', now() + ($3 || ' hours')::interval + interval '2 hours', $4, $5)`,
      [id, rider, String(hours), seats, point]);
    created.requests.push(id);
    return id;
  };
  run.makeOffer = async (request, driver, trip) =>
    (await admin.query("insert into ride_offers (request_id, driver_id, trip_id) values ($1, $2, $3) returning id", [request, driver, trip])).rows[0].id;

  // Runs one statement as a signed-in person, in its own transaction.
  run.actAs = async (client, uid, sql, params = []) => {
    await client.query("begin");
    try {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
      const r = await client.query(sql, params);
      await client.query("commit");
      return r;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    }
  };
  // The same, but leaves the transaction open and returns it, so a test can hold locks.
  run.beginAs = async (client, uid) => {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
  };

  run.tripState = async (trip) => {
    const t = (await admin.query("select seats_taken, seats_total, status from trips where id = $1", [trip])).rows[0];
    const acc = (await admin.query("select coalesce(sum(seats), 0)::int as n, count(*)::int as c from seat_requests where trip_id = $1 and status = 'accepted'", [trip])).rows[0];
    const live = (await admin.query("select count(*)::int as n from seat_requests where trip_id = $1 and status in ('pending','accepted')", [trip])).rows[0].n;
    return { ...t, acceptedSeats: acc.n, acceptedCount: acc.c, live };
  };
  run.noDeadlock = (results, label) => {
    for (const r of results) {
      if (r.status === "rejected" && /deadlock/i.test(String(r.reason?.message))) run.check(false, `${label}: deadlock detected (${r.reason.message})`);
    }
  };

  run.finish = async () => {
    const ids = created.trips;
    const q = (sql, params) => admin.query(sql, params).catch(() => {});
    await q("delete from messages where conversation_id in (select id from conversations where trip_id = any($1))", [ids]);
    await q("delete from conversations where trip_id = any($1)", [ids]);
    await q("delete from ride_offers where trip_id = any($1) or request_id = any($2)", [ids, created.requests]);
    await q("update trips set from_request_id = null where id = any($1)", [ids]);
    await q("delete from ride_requests where id = any($1) or rider_id = any($2)", [created.requests, created.users]);
    await q("delete from seat_requests where trip_id = any($1)", [ids]);
    await q("delete from trip_private where trip_id = any($1)", [ids]);
    await q("delete from trips where id = any($1)", [ids]);
    await q("delete from email_outbox where to_user_id = any($1)", [created.users]);
    await q("delete from rate_events where user_id = any($1)", [created.users]);
    await q("delete from meetup_points where id = any($1)", [created.points]);
    await q("delete from auth.users where id = any($1)", [created.users]);
    await admin.end();
    console.log(run.failures === 0 ? "all concurrency checks passed" : `${run.failures} concurrency check(s) failed`);
    process.exit(run.failures === 0 ? 0 : 1);
  };
  return run;
}
