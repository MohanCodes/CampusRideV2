import { describe, expect, it } from "vitest";
import { adminSuspendSchema, meetupPointSchema, noShowSchema, reportSchema, REPORT_REASONS } from "./moderation";

const ID = "00000000-0000-4000-8000-000000000001";
const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => [i.path.join("."), i.message]));

describe("reportSchema", () => {
  const ok = { targetType: "trip", targetId: ID, reason: "Harassment" };
  it("accepts a report and tidies the details", () => {
    const r = reportSchema.parse({ ...ok, details: "  He was rude  " });
    expect(r.details).toBe("He was rude");
    expect(r.tripId).toBe("");
  });
  it("offers exactly the five reasons from the spec", () => {
    expect([...REPORT_REASONS]).toEqual(["Unsafe driving", "Harassment", "No-show", "Fake profile", "Other"]);
    for (const reason of REPORT_REASONS) expect(reportSchema.safeParse({ ...ok, reason }).success).toBe(true);
    expect(issues(reportSchema.safeParse({ ...ok, reason: "Rude" }))[0][0]).toBe("reason");
  });
  it("only reports a person, a trip, or a request, by id", () => {
    expect(reportSchema.safeParse({ ...ok, targetType: "message" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...ok, targetId: "abc" }).success).toBe(false);
  });
  it("caps the details", () => {
    expect(issues(reportSchema.safeParse({ ...ok, details: "x".repeat(1001) }))[0]).toEqual(["details", "Keep the details under 1,000 characters."]);
  });
  it("takes an optional trip for context", () => {
    expect(reportSchema.parse({ ...ok, targetType: "user", tripId: ID }).tripId).toBe(ID);
    expect(reportSchema.safeParse({ ...ok, tripId: "nope" }).success).toBe(false);
  });
});

describe("noShowSchema", () => {
  it("needs a trip and a rider", () => {
    expect(noShowSchema.safeParse({ tripId: ID, riderId: ID }).success).toBe(true);
    expect(noShowSchema.safeParse({ tripId: ID }).success).toBe(false);
  });
});

describe("adminSuspendSchema", () => {
  it("allows 7 or 30 days only", () => {
    expect(adminSuspendSchema.safeParse({ userId: ID, days: "7" }).success).toBe(true);
    expect(adminSuspendSchema.safeParse({ userId: ID, days: "30" }).success).toBe(true);
    expect(adminSuspendSchema.safeParse({ userId: ID, days: "14" }).success).toBe(false);
  });
});

describe("meetupPointSchema", () => {
  const ok = { campusId: "hmc", name: "Platt Campus Center", type: "hub", lat: "34.106", lng: "-117.709", standAt: "Stand at the front steps." };
  it("accepts a complete point", () => expect(issues(meetupPointSchema.safeParse(ok))).toEqual([]));
  it("keeps coordinates inside Southern California, which catches a dropped minus sign", () => {
    expect(issues(meetupPointSchema.safeParse({ ...ok, lng: "117.709" }))[0][0]).toBe("lng");
    expect(issues(meetupPointSchema.safeParse({ ...ok, lat: "40.7" }))[0][0]).toBe("lat");
    expect(issues(meetupPointSchema.safeParse({ ...ok, lat: "" }))[0][0]).toBe("lat");
  });
  it("requires the stand-at text", () => {
    expect(issues(meetupPointSchema.safeParse({ ...ok, standAt: "  " }))[0][1]).toBe("Say where exactly to stand.");
  });
  it("needs a name and a real type", () => {
    expect(issues(meetupPointSchema.safeParse({ ...ok, name: "x" }))[0][0]).toBe("name");
    expect(issues(meetupPointSchema.safeParse({ ...ok, type: "park" }))[0][0]).toBe("type");
  });
});
