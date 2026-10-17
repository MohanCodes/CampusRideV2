import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { performCancelRequest, performExtendRequest, performRespondOffer, performSendOffer, performWithdrawOffer } from "./offer";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
function stub(result: { data?: unknown; error?: { message: string } | null } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("performSendOffer", () => {
  it("calls send_offer", async () => {
    const { client, rpc } = stub({ data: "offer-1" });
    expect(await performSendOffer(client, { requestId: A, tripId: B, message: " Happy to " })).toEqual({ ok: true, data: { offerId: "offer-1" } });
    expect(rpc).toHaveBeenCalledWith("send_offer", { p_request: A, p_trip: B, p_message: "Happy to" });
  });
  it("refuses contact details before they reach the database", async () => {
    const { client, rpc } = stub();
    expect(await performSendOffer(client, { requestId: A, tripId: B, message: "me@hmc.edu" })).toMatchObject({ ok: false, message: "Keep contact details in the app chat." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["trip_mismatch", "This trip doesn't match that request."],
    ["too_many_offers", "You have 10 offers waiting. Wait for replies or withdraw one."],
    ["already_offered", "You already offered this trip for that request."],
    ["not_open", "This request isn't open anymore."],
  ])("says %s plainly", async (code, sentence) => {
    const { client } = stub({ error: { message: code } });
    expect(await performSendOffer(client, { requestId: A, tripId: B })).toEqual({ ok: false, message: sentence, code });
  });
  it("does not reveal a block", async () => {
    const { client } = stub({ error: { message: "blocked" } });
    const r = await performSendOffer(client, { requestId: A, tripId: B });
    expect(r.ok === false && r.message).toBe("This isn't available.");
  });
});

describe("performRespondOffer", () => {
  it("accepts and declines", async () => {
    const a = stub();
    expect(await performRespondOffer(a.client, { offerId: A, accept: "1" })).toEqual({ ok: true, data: { accepted: true } });
    expect(a.rpc).toHaveBeenCalledWith("respond_offer", { p_offer: A, p_accept: true });
    const d = stub();
    expect(await performRespondOffer(d.client, { offerId: A, accept: "0" })).toEqual({ ok: true, data: { accepted: false } });
  });
  it("explains an offer that is no longer good", async () => {
    const { client } = stub({ error: { message: "no_longer_available" } });
    expect(await performRespondOffer(client, { offerId: A, accept: "1" })).toMatchObject({ ok: false, message: "This ride isn't available anymore." });
  });
  it("refuses anything but 1 or 0", async () => {
    const { client, rpc } = stub();
    expect((await performRespondOffer(client, { offerId: A, accept: "true" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("withdraw, cancel, extend", () => {
  it("call their functions", async () => {
    const w = stub(); await performWithdrawOffer(w.client, { offerId: A });
    expect(w.rpc).toHaveBeenCalledWith("withdraw_offer", { p_offer: A });
    const c = stub(); await performCancelRequest(c.client, { requestId: A });
    expect(c.rpc).toHaveBeenCalledWith("cancel_ride_request", { p_request: A });
    const e = stub(); await performExtendRequest(e.client, { requestId: A });
    expect(e.rpc).toHaveBeenCalledWith("extend_ride_request", { p_request: A });
  });
  it("refuse a malformed id", async () => {
    const { client, rpc } = stub();
    expect((await performWithdrawOffer(client, { offerId: "x" })).ok).toBe(false);
    expect((await performCancelRequest(client, {})).ok).toBe(false);
    expect((await performExtendRequest(client, { requestId: 5 })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("report a refusal", async () => {
    const { client } = stub({ error: { message: "forbidden" } });
    expect(await performCancelRequest(client, { requestId: A })).toMatchObject({ ok: false, message: "You can't do that." });
  });
});
