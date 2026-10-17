import { describe, expect, it, vi } from "vitest";
import { processBatch, secretsMatch, type Deps } from "./process.ts";
import type { ClaimedEmail } from "./templates.ts";

const NOW = new Date("2026-10-17T20:00:00Z");
const mail = (id: number, template = "seat_requested"): ClaimedEmail => ({
  id, to_email: `p${id}@pomona.edu`, to_first_name: "Alex", template,
  context: { link_path: "/inbox", other_first_name: "Maya", destination: "Trader Joe's", departs_at: "2026-10-17T22:30:00Z" },
});

function deps(over: Partial<Deps> & { batch?: ClaimedEmail[] } = {}) {
  const calls = { sent: [] as string[], marked: [] as number[], failed: [] as [number, string][] };
  const d: Deps = {
    claim: vi.fn(async () => over.batch ?? [mail(1), mail(2), mail(3)]),
    send: vi.fn(async (m) => { calls.sent.push(m.to); }),
    markSent: vi.fn(async (id) => { calls.marked.push(id); }),
    markFailed: vi.fn(async (id, e) => { calls.failed.push([id, e]); }),
    siteUrl: "https://campusride.example",
    now: () => NOW,
    ...over,
  };
  return { d, calls };
}

describe("processBatch", () => {
  it("sends each claimed email once and reports it sent", async () => {
    const { d, calls } = deps();
    expect(await processBatch(d)).toEqual({ claimed: 3, sent: 3, failed: 0 });
    expect(calls.sent).toEqual(["p1@pomona.edu", "p2@pomona.edu", "p3@pomona.edu"]);
    expect(calls.marked).toEqual([1, 2, 3]);
  });
  it("asks for the batch size it is given", async () => {
    const { d } = deps();
    await processBatch(d, 25);
    expect(d.claim).toHaveBeenCalledWith(25);
  });
  it("marks a failed send as failed, and keeps going with the rest", async () => {
    const { d, calls } = deps({ send: vi.fn(async (m) => { if (m.to === "p2@pomona.edu") throw new Error("Resend refused the email (429)"); }) });
    expect(await processBatch(d)).toEqual({ claimed: 3, sent: 2, failed: 1 });
    expect(calls.marked).toEqual([1, 3]);
    expect(calls.failed).toEqual([[2, "Resend refused the email (429)"]]);
  });
  it("never marks an email sent when the send failed", async () => {
    const { d, calls } = deps({ batch: [mail(7)], send: vi.fn(async () => { throw new Error("boom"); }) });
    await processBatch(d);
    expect(calls.marked).toEqual([]);
  });
  it("marks an email it can't render as failed, without sending anything", async () => {
    const { d, calls } = deps({ batch: [mail(9, "not_a_template"), mail(10)] });
    expect(await processBatch(d)).toEqual({ claimed: 2, sent: 1, failed: 1 });
    expect(calls.failed[0][0]).toBe(9);
    expect(calls.failed[0][1]).toMatch(/unknown email template/);
    expect(calls.sent).toEqual(["p10@pomona.edu"]);
  });
  it("does nothing when nothing is due", async () => {
    const { d } = deps({ batch: [] });
    expect(await processBatch(d)).toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(d.send).not.toHaveBeenCalled();
  });
  it("survives a failure to report a failure", async () => {
    const { d } = deps({ batch: [mail(1)], send: vi.fn(async () => { throw new Error("x"); }), markFailed: vi.fn(async () => { throw new Error("db down"); }) });
    expect(await processBatch(d)).toEqual({ claimed: 1, sent: 0, failed: 1 });
  });
  it("pauses between sends", async () => {
    const pause = vi.fn(async () => {});
    const { d } = deps({ pause });
    await processBatch(d);
    expect(pause).toHaveBeenCalledTimes(3);
  });
  it("sends the rendered email, to the right address, from the right page", async () => {
    const { d } = deps({ batch: [mail(1)] });
    await processBatch(d);
    const sent = (d.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.to).toBe("p1@pomona.edu");
    expect(sent.subject).toBe("Maya wants a seat");
    expect(sent.html).toContain("https://campusride.example/inbox");
    expect(sent.text).toContain("Trader Joe's, Today 3:30 PM");
  });
});

describe("secretsMatch", () => {
  it("matches equal secrets", () => expect(secretsMatch("abc123", "abc123")).toBe(true));
  it("refuses different, shorter, longer, and missing secrets", () => {
    expect(secretsMatch("abc123", "abc124")).toBe(false);
    expect(secretsMatch("abc", "abc123")).toBe(false);
    expect(secretsMatch("abc123", "abc")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch(null, "x")).toBe(false);
    expect(secretsMatch("x", undefined)).toBe(false);
  });
});
