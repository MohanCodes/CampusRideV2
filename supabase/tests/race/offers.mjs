// Concurrent-session tests for "In search of" offers (BUILD.md 6.3). A rider accepting an offer
// competes with a driver accepting a seat request, with another offer, with the rider cancelling,
// and with a driver offering. Each scenario runs many times with real parallel connections.
// It reads DATABASE_URL (default: the local Supabase database).
import { connect, startRun } from "./_helpers.mjs";

const run = await startRun();
const { check, actAs, makeUser, makeTrip, makeRequest, makeOffer, pendingSeatRequest, tripState, admin } = run;

try {
  const driver = await makeUser("driver");
  const driver2 = await makeUser("driver2");

  // 1. The last seat: a rider accepts an offer while the driver accepts someone else's seat request.
  console.log("1. last seat: accept an offer vs accept a seat request");
  {
    const x = await makeUser("x");
    const y = await makeUser("y");
    const [cx, cd] = [await connect(), await connect()];
    for (let round = 0; round < 25; round++) {
      const trip = await makeTrip(driver, 1);
      const req = await makeRequest(x);
      const offer = await makeOffer(req, driver, trip);
      const seat = await pendingSeatRequest(trip, y);
      const results = await Promise.allSettled([
        actAs(cx, x, "select respond_offer($1, true)", [offer]),
        actAs(cd, driver, "select respond_seat_request($1, true)", [seat]),
      ]);
      run.noDeadlock(results, `round ${round}`);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const s = await tripState(trip);
      check(ok === 1, `round ${round}: exactly one of the two gets the last seat (got ${ok})`);
      check(s.seats_taken === 1 && s.acceptedSeats === 1, `round ${round}: one seat taken and one accepted (got ${s.seats_taken} / ${s.acceptedSeats})`);
      const r = (await admin.query("select status from ride_requests where id = $1", [req])).rows[0].status;
      check((r === "matched") === (s.acceptedCount === 1 && (await admin.query("select 1 from seat_requests where trip_id = $1 and rider_id = $2 and status = 'accepted'", [trip, x])).rowCount === 1),
        `round ${round}: the request is matched exactly when the rider got the seat`);
    }
    await cx.end(); await cd.end();
  }

  // 2. One rider accepts two different offers on the same request at once (a double tap on two cards).
  console.log("2. two offers accepted at the same moment");
  {
    const rider = await makeUser("rider2");
    const [c1, c2] = [await connect(), await connect()];
    for (let round = 0; round < 25; round++) {
      const t1 = await makeTrip(driver, 3);
      const t2 = await makeTrip(driver2, 3);
      const req = await makeRequest(rider);
      const [o1, o2] = [await makeOffer(req, driver, t1), await makeOffer(req, driver2, t2)];
      const results = await Promise.allSettled([
        actAs(c1, rider, "select respond_offer($1, true)", [o1]),
        actAs(c2, rider, "select respond_offer($1, true)", [o2]),
      ]);
      run.noDeadlock(results, `round ${round}`);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const lost = results.filter((r) => r.status === "rejected" && String(r.reason.message).includes("no_longer_available")).length;
      const seats = (await tripState(t1)).seats_taken + (await tripState(t2)).seats_taken;
      const accepted = (await admin.query("select count(*)::int as n from ride_offers where request_id = $1 and status = 'accepted'", [req])).rows[0].n;
      check(ok === 1 && lost === 1, `round ${round}: one accept wins and the other is refused (got ${ok} won, ${lost} refused)`);
      check(seats === 1, `round ${round}: only one seat is taken across both trips (got ${seats})`);
      check(accepted === 1, `round ${round}: exactly one offer is accepted (got ${accepted})`);
    }
    await c1.end(); await c2.end();
  }

  // 3. The rider cancels the request while accepting an offer on it.
  console.log("3. cancel the request while accepting an offer");
  {
    const rider = await makeUser("rider3");
    const [c1, c2] = [await connect(), await connect()];
    for (let round = 0; round < 25; round++) {
      const trip = await makeTrip(driver, 3);
      const req = await makeRequest(rider);
      const offer = await makeOffer(req, driver, trip);
      const results = await Promise.allSettled([
        actAs(c1, rider, "select respond_offer($1, true)", [offer]),
        actAs(c2, rider, "select cancel_ride_request($1)", [req]),
      ]);
      run.noDeadlock(results, `round ${round}`);
      const r = (await admin.query("select status from ride_requests where id = $1", [req])).rows[0].status;
      const o = (await admin.query("select status from ride_offers where id = $1", [offer])).rows[0].status;
      const s = await tripState(trip);
      if (r === "matched") check(o === "accepted" && s.seats_taken === 1, `round ${round}: matched means the offer is accepted and a seat is taken (got ${o}, ${s.seats_taken})`);
      else check(r === "cancelled" && o === "closed" && s.seats_taken === 0, `round ${round}: cancelled means the offer is closed and no seat is taken (got ${r}, ${o}, ${s.seats_taken})`);
    }
    await c1.end(); await c2.end();
  }

  // 4. A driver offers while the rider cancels: no live offer may be left on a cancelled request.
  console.log("4. offering while the request is cancelled");
  {
    const rider = await makeUser("rider4");
    const drv = await makeUser("driver4");
    const [c1, c2] = [await connect(), await connect()];
    for (let round = 0; round < 25; round++) {
      const trip = await makeTrip(drv, 3);
      const req = await makeRequest(rider);
      const results = await Promise.allSettled([
        actAs(c1, drv, "select send_offer($1, $2, null)", [req, trip]),
        actAs(c2, rider, "select cancel_ride_request($1)", [req]),
      ]);
      run.noDeadlock(results, `round ${round}`);
      const live = (await admin.query("select count(*)::int as n from ride_offers where request_id = $1 and status = 'pending'", [req])).rows[0].n;
      const r = (await admin.query("select status from ride_requests where id = $1", [req])).rows[0].status;
      check(r === "cancelled" && live === 0, `round ${round}: a cancelled request has no pending offers (got ${r}, ${live})`);
    }
    await c1.end(); await c2.end();
  }

  // 5. The driver cancels the trip while the rider accepts its offer.
  console.log("5. cancelling the trip while its offer is accepted");
  {
    const rider = await makeUser("rider5");
    const drv = await makeUser("driver5");
    const [c1, c2] = [await connect(), await connect()];
    for (let round = 0; round < 25; round++) {
      const trip = await makeTrip(drv, 3);
      const req = await makeRequest(rider);
      const offer = await makeOffer(req, drv, trip);
      const results = await Promise.allSettled([
        actAs(c1, rider, "select respond_offer($1, true)", [offer]),
        actAs(c2, drv, "select cancel_trip($1)", [trip]),
      ]);
      run.noDeadlock(results, `round ${round}`);
      const s = await tripState(trip);
      check(s.status === "cancelled" && s.live === 0, `round ${round}: a cancelled trip has no live seat requests (got ${s.status}, ${s.live})`);
    }
    await c1.end(); await c2.end();
  }
} finally {
  await run.finish();
}
