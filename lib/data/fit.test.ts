import { describe, expect, it } from "vitest";
import { tripFitsRequest } from "./fit";

const NOW = new Date("2026-10-17T20:00:00Z");
const h = (n: number) => new Date(NOW.getTime() + n * 3600_000).toISOString();
const request = { placeId: "tj", destinationName: "Trader Joe's", windowStart: h(23), windowEnd: h(25), seats: 1 };
const trip = { placeId: "tj", destinationName: "Trader Joe's", departsAt: h(24), seatsLeft: 2, status: "open" };
const fits = (t = {}, r = {}) => tripFitsRequest({ trip: { ...trip, ...t }, request: { ...request, ...r }, now: NOW });

describe("tripFitsRequest", () => {
  it("accepts a trip to the same place, inside the window, with room", () => expect(fits()).toBe(true));
  it("includes the edges of the window", () => {
    expect(fits({ departsAt: h(23) })).toBe(true);
    expect(fits({ departsAt: h(25) })).toBe(true);
  });
  it("refuses a trip outside the window", () => {
    expect(fits({ departsAt: h(22.9) })).toBe(false);
    expect(fits({ departsAt: h(25.1) })).toBe(false);
  });
  it("refuses another place", () => expect(fits({ placeId: "ont" })).toBe(false));
  it("refuses a trip without enough seats", () => {
    expect(fits({ seatsLeft: 1 }, { seats: 2 })).toBe(false);
    expect(fits({ seatsLeft: 2 }, { seats: 2 })).toBe(true);
    expect(fits({ seatsLeft: 0 })).toBe(false);
  });
  it("refuses a trip that is not open or has already left", () => {
    expect(fits({ status: "cancelled" })).toBe(false);
    expect(fits({ departsAt: h(-1) }, { windowStart: h(-2) })).toBe(false);
  });
  it("matches an 'Other' destination by name, ignoring case, and only to a trip with no curated place", () => {
    const other = { placeId: null, destinationName: "Ontario Mills" };
    expect(fits({ placeId: null, destinationName: "ontario mills" }, other)).toBe(true);
    expect(fits({ placeId: null, destinationName: "Victoria Gardens" }, other)).toBe(false);
    expect(fits({ placeId: "tj", destinationName: "Ontario Mills" }, other)).toBe(false);
  });
});
