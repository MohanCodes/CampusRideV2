// The contract between the database and the Edge Function: rows claimed through the real claim_emails()
// render properly with the real templates. For each of the 20 templates, this creates realistic data and
// an outbox row shaped like the one the real function queues, claims it, renders it, and checks that no
// email fell back to a generic placeholder. It reads DATABASE_URL (default: the local Supabase database).
import { startRun } from "../race/_helpers.mjs";
import { TEMPLATE_NAMES, renderEmail } from "../../functions/send-emails/templates.ts";

const run = await startRun();
const { admin, check, makeUser, makeTrip, makeRequest } = run;

try {
  const driver = await makeUser("Dana");
  const rider = await makeUser("Rae");
  const trip = await makeTrip(driver, 3, { hours: 3 });
  const seat = (await admin.query("insert into seat_requests (trip_id, rider_id, seats, status) values ($1, $2, 1, 'accepted') returning id", [trip, rider])).rows[0].id;
  const conv = (await admin.query("insert into conversations (trip_id, driver_id, rider_id, closes_at) values ($1, $2, $3, now() + interval '2 days') returning id", [trip, driver, rider])).rows[0].id;
  const request = await makeRequest(rider, 1, 3);
  const offer = (await admin.query("insert into ride_offers (request_id, driver_id, trip_id, status) values ($1, $2, $3, 'withdrawn') returning id", [request, driver, trip])).rows[0].id;

  // [template, recipient, payload]: the payload keys match what the real functions queue.
  const rows = [
    ["seat_requested", driver, { trip_id: trip, request_id: seat }],
    ["seat_accepted", rider, { trip_id: trip }],
    ["seat_declined", rider, { trip_id: trip }],
    ["request_expired", rider, { trip_id: trip }],
    ["request_expired", rider, { request_id: request }],
    ["trip_cancelled", rider, { trip_id: trip }],
    ["trip_time_changed", rider, { trip_id: trip }],
    ["rider_cancelled", driver, { trip_id: trip, request_id: seat }],
    ["offer_received", rider, { request_id: request, offer_id: offer, trip_id: trip }],
    ["offer_accepted", driver, { trip_id: trip, request_id: request }],
    ["offer_declined", driver, { request_id: request }],
    ["offer_closed", driver, { request_id: request, reason: "chose_another" }],
    ["offer_closed", driver, { request_id: request, reason: "request_cancelled" }],
    ["offer_closed", driver, { request_id: request, reason: "request_expired" }],
    ["offer_withdrawn", rider, { request_id: request }],
    ["match_for_rider", rider, { trip_id: trip, request_id: request }],
    ["match_for_driver", driver, { request_id: request, trip_id: trip }],
    ["request_ending_soon", rider, { request_id: request }],
    ["meetup_reminder", rider, { trip_id: trip }],
    ["meetup_reminder", driver, { trip_id: trip }],
    ["new_message", driver, { conversation_id: conv }],
    ["new_message", rider, { conversation_id: conv }],
    ["report_received", rider, {}],
    ["account_warning", rider, {}],
    ["account_suspended", rider, { until: "2026-11-01" }],
  ];
  await admin.query("delete from email_outbox where to_user_id = any($1)", [[driver, rider]]);
  let n = 0;
  for (const [template, to, payload] of rows) {
    await admin.query("insert into email_outbox (to_user_id, template, payload, dedupe_key) values ($1, $2, $3, $4)", [to, template, payload, `render:${n++}`]);
  }

  const claimed = (await admin.query("select * from claim_emails(100) where to_user_id = any($1)", [[driver, rider]])).rows;
  check(claimed.length === rows.length, `all ${rows.length} rows were claimed (got ${claimed.length})`);
  check(new Set(rows.map((r) => r[0])).size === TEMPLATE_NAMES.length, "every one of the 20 templates is covered");

  const now = new Date();
  for (const c of claimed) {
    const email = { id: Number(c.id), to_email: c.to_email, to_first_name: c.to_first_name, template: c.template, context: c.context };
    let r;
    try { r = renderEmail(email, { siteUrl: "https://campusride.example", now }); }
    catch (e) { check(false, `${c.template}: failed to render (${e.message})`); continue; }
    const all = `${r.subject}\n${r.text}`;
    const label = `${c.template} to ${c.to_first_name}`;
    check(c.to_email.endsWith("@pomona.edu"), `${label}: has the recipient's address`);
    check(r.text.startsWith(`Hi ${c.to_first_name},`), `${label}: greets by first name`);
    check(c.context.link_path?.startsWith("/"), `${label}: has a link to a page (${c.context.link_path})`);
    const needsOther = !["request_expired", "request_ending_soon", "report_received", "account_warning", "account_suspended", "meetup_reminder"].includes(c.template)
      && !(c.template === "request_expired");
    if (needsOther) check(!all.includes("Someone"), `${label}: names the other person, not "Someone"`);
    if (!["report_received", "account_warning", "account_suspended"].includes(c.template)) {
      check(all.includes("Trader Joe") || all.includes("Race trip"), `${label}: says where the trip goes (no generic "your trip")`);
      check(!/your trip, |^your trip$/m.test(all) || c.template === "meetup_reminder", `${label}: no placeholder destination`);
    }
    check(!/undefined|null|\[object/.test(all), `${label}: no "undefined" or "null" leaked into the text`);
  }

  const find = (t, to, key) => claimed.find((c) => c.template === t && c.to_user_id === to && (!key || JSON.stringify(c.context).includes(key)));
  const text = (t, to, key) => { const c = find(t, to, key); return c ? renderEmail({ id: 1, to_email: c.to_email, to_first_name: c.to_first_name, template: c.template, context: c.context }, { siteUrl: "https://x.example", now }).text : ""; };
  check(text("seat_requested", driver).includes("Rae asked for a seat"), "a seat request names the rider");
  check(text("seat_accepted", rider).includes("Dana accepted your request"), "an acceptance names the driver");
  check(text("offer_received", rider).includes("Dana can take you to"), "an offer names the driver");
  check(text("offer_withdrawn", rider).includes("Dana can't take you"), "a withdrawal names the driver who withdrew");
  check(text("meetup_reminder", rider).includes("Meet at Race point."), "a rider's reminder gives the meetup point by name");
  check(text("meetup_reminder", driver).includes("with Rae"), "a driver's reminder lists the riders by first name");
  check(text("new_message", driver).includes("Rae wrote to you"), "a new-message email names the sender");
  const leaks = claimed.filter((c) => /RACE01|Race point.*stand|last_name/i.test(JSON.stringify(c.context)));
  check(leaks.length === 0, `no context carries the plate or a last name (${leaks.length} did)`);
} finally {
  await run.finish();
}
