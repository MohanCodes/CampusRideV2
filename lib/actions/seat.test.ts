import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { performCancelSeat, performCancelTrip, performRequestSeat, performRespond } from "./seat";

const ID = "00000000-0000-4000-8000-000000000001";
// A stand-in for the Supabase client: records the call and returns what the test says the database returned.
function stub(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("performRequestSeat", () => {
  it("calls request_seat with the cleaned-up input", async () => {
    const { client, rpc } = stub({ data: "req-1" });
    const r = await performRequestSeat(client, { tripId: ID, seats: "2", message: "  Hi  " });
    expect(r).toEqual({ ok: true, data: { requestId: "req-1" } });
    expect(rpc).toHaveBeenCalledWith("request_seat", { p_trip: ID, p_seats: 2, p_message: "Hi" });
  });
  it("sends no message when there is none", async () => {
    const { client, rpc } = stub({ data: "r" });
    await performRequestSeat(client, { tripId: ID, seats: 1, message: "" });
    expect(rpc.mock.calls[0][1].p_message).toBeNull();
  });
  it("refuses bad input before it reaches the database", async () => {
    const { client, rpc } = stub({});
    for (const bad of [{ tripId: "x", seats: 1 }, { tripId: ID, seats: 0 }, { tripId: ID, seats: 4 }, { tripId: ID, seats: 1, message: "x".repeat(301) }]) {
      const r = await performRequestSeat(client, bad);
      expect(r.ok).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps contact details out of the message, with the plain sentence", async () => {
    const { client, rpc } = stub({});
    const r = await performRequestSeat(client, { tripId: ID, seats: 1, message: "text me 909-555-0123" });
    expect(r).toMatchObject({ ok: false, message: "Keep contact details in the app chat." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["trip_full", "This trip just filled up."],
    ["already_requested", "You already asked for a seat on this trip."],
    ["own_trip", "This is your own trip."],
    ["trip_unavailable", "This trip isn't available."],
    ["account_suspended", "Your account is paused, so you can't do this right now."],
    ["rate_limited", "Too many tries. Wait a bit, then try again."],
  ])("turns %s into a plain sentence", async (code, sentence) => {
    const { client } = stub({ error: { message: code } });
    expect(await performRequestSeat(client, { tripId: ID, seats: 1 })).toEqual({ ok: false, message: sentence, code });
  });
  it("does not tell someone they were blocked", async () => {
    const { client } = stub({ error: { message: "blocked" } });
    const r = await performRequestSeat(client, { tripId: ID, seats: 1 });
    expect(r.ok === false && r.message).toBe("This isn't available.");
  });
});

describe("performRespond", () => {
  it("accepts and declines", async () => {
    const a = stub({});
    expect(await performRespond(a.client, { requestId: ID, accept: "1" })).toEqual({ ok: true, data: { accepted: true } });
    expect(a.rpc).toHaveBeenCalledWith("respond_seat_request", { p_request: ID, p_accept: true });
    const d = stub({});
    expect(await performRespond(d.client, { requestId: ID, accept: "0" })).toEqual({ ok: true, data: { accepted: false } });
    expect(d.rpc).toHaveBeenCalledWith("respond_seat_request", { p_request: ID, p_accept: false });
  });
  it("refuses anything but 1 or 0", async () => {
    const { client, rpc } = stub({});
    expect((await performRespond(client, { requestId: ID, accept: "yes" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("says the trip filled up when it did", async () => {
    const { client } = stub({ error: { message: "trip_full" } });
    expect(await performRespond(client, { requestId: ID, accept: "1" })).toMatchObject({ ok: false, code: "trip_full", message: "This trip just filled up." });
  });
  it("says a request was already answered", async () => {
    const { client } = stub({ error: { message: "not_pending" } });
    expect(await performRespond(client, { requestId: ID, accept: "1" })).toMatchObject({ ok: false, message: "That request was already answered." });
  });
});

describe("performCancelSeat and performCancelTrip", () => {
  it("call their functions", async () => {
    const s = stub({});
    expect(await performCancelSeat(s.client, { requestId: ID })).toEqual({ ok: true, data: undefined });
    expect(s.rpc).toHaveBeenCalledWith("cancel_seat_request", { p_request: ID });
    const t = stub({});
    expect(await performCancelTrip(t.client, { tripId: ID })).toEqual({ ok: true, data: undefined });
    expect(t.rpc).toHaveBeenCalledWith("cancel_trip", { p_trip: ID });
  });
  it("refuse a malformed id", async () => {
    const { client, rpc } = stub({});
    expect((await performCancelSeat(client, { requestId: "nope" })).ok).toBe(false);
    expect((await performCancelTrip(client, {})).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("report a database refusal", async () => {
    const { client } = stub({ error: { message: "forbidden" } });
    expect(await performCancelTrip(client, { tripId: ID })).toMatchObject({ ok: false, message: "You can't do that." });
  });
});
