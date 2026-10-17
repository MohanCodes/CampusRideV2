// Concurrent-session tests for seat requests (BUILD.md Section 14, AGENTS.md Section 7).
// pgTAP runs in one session, so races need their own test: this opens several real connections and
// makes them act at the same moment. It needs a database with the migrations applied and reads
// DATABASE_URL (default: the local Supabase database).
//
//   1. Two drivers' accepts for the last seat: exactly one wins, the other gets trip_full.
//      Checked deterministically: session B is held on the trip's row lock until session A commits.
//   2. A stampede: many accepts at once for a few seats. Never more accepted than seats.
//   3. A rider cancelling while the driver accepts someone else: seats_taken always matches.
//   4. The same rider asking twice at once (a double click): one request, one error.
//   5. The driver cancelling the trip while riders ask and are accepted: nothing is left live.
import { randomUUID } from "node:crypto";
import pg from "pg";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connect = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };

const admin = await connect();
const created = { users: [], trips: [], points: [] };
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log(`  FAIL ${msg}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(25); }
  failures++; console.log(`  FAIL timed out waiting for: ${what}`);
  return false;
}

// --- Setup ---------------------------------------------------------------------------------------
const tag = randomUUID().slice(0, 8);
async function makeUser(label) {
  const id = randomUUID();
  await admin.query("insert into auth.users (id, email) values ($1, $2)", [id, `race-${tag}-${label}@pomona.edu`]);
  await admin.query("update profiles set first_name = $2, onboarded_at = now() where id = $1", [id, label]);
  created.users.push(id);
  return id;
}
const driver = await makeUser("driver");
const point = randomUUID();
await admin.query("insert into meetup_points (id, campus_id, name, type, lat, lng, shared) values ($1, 'pomona', 'Race point', 'hub', 0, 0, true)", [point]);
created.points.push(point);

async function makeTrip(seats) {
  const id = randomUUID();
  await admin.query(
    `insert into trips (id, driver_id, place_id, destination_name, departs_at, seats_total, meetup_point_id, car_make, car_color)
     values ($1, $2, 'tj-claremont', 'Race trip', now() + interval '3 days', $3, $4, 'Honda', 'Blue')`, [id, driver, seats, point]);
  await admin.query("insert into trip_private (trip_id, car_plate) values ($1, 'RACE01')", [id]);
  created.trips.push(id);
  return id;
}
async function makePendingRequest(trip, rider, seats = 1) {
  const { rows } = await admin.query(
    "insert into seat_requests (trip_id, rider_id, seats) values ($1, $2, $3) returning id", [trip, rider, seats]);
  return rows[0].id;
}

// Runs one statement as a signed-in person, in its own transaction.
async function actAs(client, uid, sql, params = []) {
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
}
const state = async (trip) => {
  const t = (await admin.query("select seats_taken, seats_total, status from trips where id = $1", [trip])).rows[0];
  const acc = (await admin.query("select coalesce(sum(seats), 0)::int as n, count(*)::int as c from seat_requests where trip_id = $1 and status = 'accepted'", [trip])).rows[0];
  const live = (await admin.query("select count(*)::int as n from seat_requests where trip_id = $1 and status in ('pending','accepted')", [trip])).rows[0].n;
  return { ...t, acceptedSeats: acc.n, acceptedCount: acc.c, live };
};

try {
  // --- 1. Two accepts for the last seat, held on the lock -------------------------------------------
  console.log("1. two accepts for the last seat");
  {
    const trip = await makeTrip(1);
    const [r1, r2] = [await makeUser("r1"), await makeUser("r2")];
    const [q1, q2] = [await makePendingRequest(trip, r1), await makePendingRequest(trip, r2)];
    const [a, b] = [await connect(), await connect()];
    const bPid = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;

    await a.query("begin");
    await a.query("set local role authenticated");
    await a.query("select set_config('request.jwt.claim.sub', $1, true)", [driver]);
    await a.query("select respond_seat_request($1, true)", [q1]);          // A holds the trip's row lock

    await b.query("begin");
    await b.query("set local role authenticated");
    await b.query("select set_config('request.jwt.claim.sub', $1, true)", [driver]);
    const bResult = b.query("select respond_seat_request($1, true)", [q2]).then(() => "accepted", (e) => e.message);

    const blocked = await waitFor(
      async () => (await admin.query("select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'", [bPid])).rowCount > 0,
      "the second accept to be held on the trip's lock");
    await a.query("commit");
    const outcome = await bResult;
    await b.query("rollback").catch(() => {});
    check(blocked, "the second accept waits for the first instead of running alongside it");
    check(outcome.includes("trip_full"), `the second accept is refused with trip_full (got: ${outcome})`);
    const s = await state(trip);
    check(s.seats_taken === 1 && s.acceptedCount === 1, `one seat taken, one request accepted (got ${s.seats_taken} / ${s.acceptedCount})`);
    await a.end(); await b.end();
  }

  // --- 2. A stampede -----------------------------------------------------------------------------------
  console.log("2. a stampede of accepts for 3 seats");
  {
    const riders = [];
    for (let i = 0; i < 8; i++) riders.push(await makeUser(`s${i}`));
    const clients = await Promise.all(riders.map(connect));
    for (let round = 0; round < 15; round++) {
      const trip = await makeTrip(3);
      const reqs = [];
      for (const r of riders) reqs.push(await makePendingRequest(trip, r));
      const results = await Promise.allSettled(clients.map((c, i) => actAs(c, driver, "select respond_seat_request($1, true)", [reqs[i]])));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const refused = results.filter((r) => r.status === "rejected" && String(r.reason.message).includes("trip_full")).length;
      const s = await state(trip);
      check(ok === 3 && refused === 5, `round ${round}: 3 accepted, 5 refused with trip_full (got ${ok} / ${refused})`);
      check(s.seats_taken === 3 && s.acceptedSeats === 3, `round ${round}: seats_taken is 3 (got ${s.seats_taken}, accepted seats ${s.acceptedSeats})`);
      const convos = (await admin.query("select count(*)::int as n from conversations where trip_id = $1", [trip])).rows[0].n;
      check(convos === 3, `round ${round}: three chats opened (got ${convos})`);
    }
    await Promise.all(clients.map((c) => c.end()));
  }

  // --- 3. A rider cancels while the driver accepts someone else -----------------------------------------------
  console.log("3. cancel and accept at the same moment");
  {
    const [x, y] = [await makeUser("x"), await makeUser("y")];
    const [cx, cd] = [await connect(), await connect()];
    for (let round = 0; round < 20; round++) {
      const trip = await makeTrip(2);
      const qx = await makePendingRequest(trip, x);
      const qy = await makePendingRequest(trip, y);
      await actAs(cd, driver, "select respond_seat_request($1, true)", [qx]);      // x is accepted first
      await Promise.allSettled([
        actAs(cx, x, "select cancel_seat_request($1)", [qx]),
        actAs(cd, driver, "select respond_seat_request($1, true)", [qy]),
      ]);
      const s = await state(trip);
      check(s.seats_taken === s.acceptedSeats, `round ${round}: seats_taken (${s.seats_taken}) equals the seats actually accepted (${s.acceptedSeats})`);
      check(s.seats_taken <= s.seats_total, `round ${round}: never more than the trip's seats`);
    }
    await cx.end(); await cd.end();
  }

  // --- 4. A double click ---------------------------------------------------------------------------------------
  console.log("4. the same rider asking twice at once");
  {
    const rider = await makeUser("dbl");
    const [c1, c2] = [await connect(), await connect()];
    for (let round = 0; round < 15; round++) {
      const trip = await makeTrip(3);
      const results = await Promise.allSettled([
        actAs(c1, rider, "select request_seat($1, 1, null)", [trip]),
        actAs(c2, rider, "select request_seat($1, 1, null)", [trip]),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const dup = results.filter((r) => r.status === "rejected" && String(r.reason.message).includes("already_requested")).length;
      const rows = (await admin.query("select count(*)::int as n from seat_requests where trip_id = $1 and rider_id = $2", [trip, rider])).rows[0].n;
      check(ok === 1 && dup === 1 && rows === 1, `round ${round}: one request made, one refused as already_requested (got ${ok} ok, ${dup} dup, ${rows} rows)`);
    }
    await c1.end(); await c2.end();
  }

  // --- 5. The driver cancels while riders ask and are accepted ---------------------------------------------------
  console.log("5. cancelling a trip while requests arrive");
  {
    const riders = [];
    for (let i = 0; i < 4; i++) riders.push(await makeUser(`c${i}`));
    const clients = await Promise.all([...riders, driver].map(connect));
    for (let round = 0; round < 15; round++) {
      const trip = await makeTrip(3);
      const pre = await makePendingRequest(trip, riders[0]);
      await Promise.allSettled([
        actAs(clients[4], driver, "select cancel_trip($1)", [trip]),
        actAs(clients[1], riders[1], "select request_seat($1, 1, null)", [trip]),
        actAs(clients[2], riders[2], "select request_seat($1, 1, null)", [trip]),
        actAs(clients[3], driver, "select respond_seat_request($1, true)", [pre]),
      ]);
      const s = await state(trip);
      check(s.status === "cancelled", `round ${round}: the trip ends cancelled`);
      check(s.live === 0, `round ${round}: no request is left pending or accepted on a cancelled trip (got ${s.live})`);
    }
    await Promise.all(clients.map((c) => c.end()));
  }
} finally {
  // Clean up everything this run created, so the database is as it was.
  const ids = created.trips;
  await admin.query("delete from messages where conversation_id in (select id from conversations where trip_id = any($1))", [ids]).catch(() => {});
  await admin.query("delete from conversations where trip_id = any($1)", [ids]).catch(() => {});
  await admin.query("delete from seat_requests where trip_id = any($1)", [ids]).catch(() => {});
  await admin.query("delete from trip_private where trip_id = any($1)", [ids]).catch(() => {});
  await admin.query("delete from trips where id = any($1)", [ids]).catch(() => {});
  await admin.query("delete from email_outbox where to_user_id = any($1)", [created.users]).catch(() => {});
  await admin.query("delete from rate_events where user_id = any($1)", [created.users]).catch(() => {});
  await admin.query("delete from meetup_points where id = any($1)", [created.points]).catch(() => {});
  await admin.query("delete from auth.users where id = any($1)", [created.users]).catch(() => {});
  await admin.end();
}

console.log(failures === 0 ? "all concurrency checks passed" : `${failures} concurrency check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
