import { describe, expect, it } from "vitest";
import { postRequestSchema, respondOfferSchema, sendOfferSchema } from "./request";

const valid = {
  destinationKind: "place", placeId: "tj-claremont", date: "2026-10-18", time: "15:30", flexibility: "pm30", seats: "1",
  meetupPointId: "00000000-0000-4000-8000-000000000001",
};
const issues = (s: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, v: object) => {
  const r = s.safeParse(v);
  return r.success ? [] : r.error!.issues.map((i) => [i.path.join("."), i.message]);
};

describe("postRequestSchema", () => {
  it("accepts a complete request", () => {
    const r = postRequestSchema.parse(valid);
    expect(r.seats).toBe(1);
    expect(r.chipIn).toBe("");
  });
  it("has no price field: anything extra is ignored, never stored", () => {
    expect(Object.keys(postRequestSchema.parse({ ...valid, price: "20" }))).not.toContain("price");
  });
  it("needs a destination of the right kind", () => {
    expect(issues(postRequestSchema, { ...valid, placeId: "" })).toContainEqual(["destination", "Pick where you're going."]);
    expect(issues(postRequestSchema, { ...valid, destinationKind: "other", placeId: "", mapboxId: "" })).toContainEqual(["destination", "Pick where you're going."]);
  });
  it("allows 1 to 3 seats and the four flexibilities only", () => {
    expect(issues(postRequestSchema, { ...valid, seats: "0" })[0][0]).toBe("seats");
    expect(issues(postRequestSchema, { ...valid, seats: "4" })[0][0]).toBe("seats");
    for (const flexibility of ["exact", "pm30", "pm60", "anytime"]) expect(issues(postRequestSchema, { ...valid, flexibility })).toEqual([]);
    expect(issues(postRequestSchema, { ...valid, flexibility: "whenever" })[0][0]).toBe("flexibility");
  });
  it("only takes an id for the meetup point, never an address", () => {
    expect(issues(postRequestSchema, { ...valid, meetupPointId: "123 Main St" })[0][0]).toBe("meetupPointId");
  });
  it("keeps contact details out of the note", () => {
    expect(issues(postRequestSchema, { ...valid, note: "call 909-555-0123" })).toContainEqual(["note", "Keep contact details in the app chat."]);
    expect(issues(postRequestSchema, { ...valid, note: "just a few bags" })).toEqual([]);
    expect(issues(postRequestSchema, { ...valid, note: "x".repeat(201) })[0][0]).toBe("note");
  });
});

describe("offers", () => {
  const ids = { requestId: "00000000-0000-4000-8000-000000000001", tripId: "00000000-0000-4000-8000-000000000002" };
  it("accepts an offer with an optional message", () => expect(issues(sendOfferSchema, ids)).toEqual([]));
  it("keeps contact details out of the offer message", () => {
    expect(issues(sendOfferSchema, { ...ids, message: "text 909-555-0123" })[0][1]).toBe("Keep contact details in the app chat.");
  });
  it("turns 1 and 0 into accept and decline, and nothing else", () => {
    const o = "00000000-0000-4000-8000-000000000003";
    expect(respondOfferSchema.parse({ offerId: o, accept: "1" }).accept).toBe(true);
    expect(respondOfferSchema.parse({ offerId: o, accept: "0" }).accept).toBe(false);
    expect(issues(respondOfferSchema, { offerId: o, accept: "yes" }).length).toBe(1);
  });
});
