import { describe, expect, it } from "vitest";
import { dayKey } from "@/lib/format/time";
import { applyRequestFilters, applyTripFilters, groupByDay } from "./apply";
import { DEFAULT_FILTERS, parseFilters } from "./filters";
import { demoRequests, demoTripDetail, demoTrips } from "./mock";

const NOW = new Date("2026-10-17T20:00:00Z");
const trips = demoTrips(NOW);

describe("demo trips", () => {
  it("never include full, cancelled, or past trips", () => {
    expect(trips.every((t) => t.seatsLeft >= 1)).toBe(true);
    expect(trips.find((t) => t.destinationName === "Claremont Village")).toBeUndefined(); // cancelled
    expect(trips.find((t) => t.destinationName === "Target (Upland)")).toBeUndefined(); // past
  });
});

describe("applyTripFilters", () => {
  it("sorts by departure time", () => {
    const out = applyTripFilters(trips, DEFAULT_FILTERS, NOW);
    expect(out.map((t) => t.departsAt)).toEqual([...out.map((t) => t.departsAt)].sort());
  });
  it("filters by destination chip", () => {
    const out = applyTripFilters(trips, parseFilters({ chip: "Target" }), NOW);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((t) => t.chip === "Target")).toBe(true);
  });
  it("puts places outside the chips under Other", () => {
    const out = applyTripFilters(trips, parseFilters({ chip: "Other" }), NOW);
    expect(out.map((t) => t.destinationName)).toContain("Ontario Mills");
  });
  it("filters by college of the driver", () => {
    const out = applyTripFilters(trips, parseFilters({ college: "hmc" }), NOW);
    expect(out.every((t) => t.driver.campusId === "hmc")).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
  it("filters by the date, in campus time", () => {
    const out = applyTripFilters(trips, parseFilters({ date: "today" }), NOW);
    expect(out.every((t) => dayKey(t.departsAt) === "2026-10-17")).toBe(true);
    const tomorrow = applyTripFilters(trips, parseFilters({ date: "tomorrow" }), NOW);
    expect(tomorrow.every((t) => dayKey(t.departsAt) === "2026-10-18")).toBe(true);
  });
  it("filters by seats needed", () => {
    const out = applyTripFilters(trips, parseFilters({ seats: "3" }), NOW);
    expect(out.every((t) => t.seatsLeft >= 3)).toBe(true);
  });
  it("searches destination, meetup point, and driver", () => {
    expect(applyTripFilters(trips, parseFilters({ q: "airport" }), NOW).length).toBeGreaterThan(0);
    expect(applyTripFilters(trips, parseFilters({ q: "platt" }), NOW).length).toBeGreaterThan(0);
    expect(applyTripFilters(trips, parseFilters({ q: "maya" }), NOW).length).toBeGreaterThan(0);
    expect(applyTripFilters(trips, parseFilters({ q: "zzz-nothing" }), NOW)).toEqual([]);
  });
  it("hides a trip that has already left", () => {
    const later = new Date(NOW.getTime() + 4 * 3600_000);
    expect(applyTripFilters(trips, DEFAULT_FILTERS, later).find((t) => t.id === "t1")).toBeUndefined();
  });
  it("combines filters", () => {
    expect(applyTripFilters(trips, parseFilters({ chip: "Target", college: "scripps" }), NOW)).toEqual([]);
  });
});

describe("applyRequestFilters", () => {
  const reqs = demoRequests(NOW);
  it("sorts and filters requests by chip", () => {
    expect(applyRequestFilters(reqs, parseFilters({ chip: "Airport (ONT)" }), NOW).map((r) => r.id)).toEqual(["r2"]);
  });
  it("drops requests whose window has ended", () => {
    const later = new Date(NOW.getTime() + 30 * 3600_000);
    expect(applyRequestFilters(reqs, DEFAULT_FILTERS, later).find((r) => r.id === "r1")).toBeUndefined();
  });
});

describe("groupByDay", () => {
  it("groups consecutive items under their day", () => {
    const g = groupByDay(applyTripFilters(trips, DEFAULT_FILTERS, NOW), (t) => t.departsAt, (i) => dayKey(i));
    expect(g.length).toBeGreaterThan(1);
    expect(new Set(g.map((x) => x.key)).size).toBe(g.length);
  });
});

describe("demo trip detail", () => {
  it("hides the plate and exact spot until the driver accepts", () => {
    const d = demoTripDetail("t1", NOW)!;
    expect(d.state).toBe("none");
    expect(d.plate).toBeNull();
    expect(d.standAt).toBeNull();
  });
  it("reveals both once accepted, and for the driver", () => {
    const a = demoTripDetail("t3", NOW)!;
    expect(a.state).toBe("accepted");
    expect(a.plate).toBe("DEV1003");
    expect(a.standAt).toBeTruthy();
    expect(demoTripDetail("t10", NOW)!.state).toBe("own");
  });
  it("never reveals them in the other views", () => {
    for (const view of ["none", "pending", "declined", "unavailable"] as const) {
      const d = demoTripDetail("t3", NOW, view)!;
      expect(d.plate, view).toBeNull();
      expect(d.standAt, view).toBeNull();
    }
  });
  it("marks a cancelled or past trip unavailable", () => {
    expect(demoTripDetail("t8", NOW)!.state).toBe("unavailable");
    expect(demoTripDetail("t9", NOW)!.state).toBe("unavailable");
  });
  it("returns null for an unknown trip", () => expect(demoTripDetail("nope", NOW)).toBeNull());
});
