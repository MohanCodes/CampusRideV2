import { describe, expect, it } from "vitest";
import { groupRides, rideBadge, rideTab, sortRides } from "./rides-logic";
import type { RideRow, SeatStatus, TripStatus } from "./types";

const NOW = new Date("2026-10-17T20:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();
const row = (o: { role?: "driver" | "rider"; tripStatus?: TripStatus; seat?: SeatStatus | null; at?: number; left?: number }): RideRow => ({
  role: o.role ?? "driver",
  tripStatus: o.tripStatus ?? "open",
  seatStatus: o.seat ?? null,
  pendingRequests: 0,
  trip: {
    id: Math.random().toString(36), destinationName: "Trader Joe's", chip: "Trader Joe's", departsAt: hours(o.at ?? 5), backBy: null,
    seatsLeft: o.left ?? 2, seatsTotal: 3, meetupPointName: "Platt", costNote: null,
    driver: { id: "d", firstName: "Maya", campusId: "hmc", classYear: 2027, avatarUrl: null }, isOwn: false, myStatus: null,
  },
});

describe("rideTab", () => {
  it("lists a driver's open upcoming trip under Upcoming", () => expect(rideTab(row({}), NOW)).toBe("upcoming"));
  it("lists an accepted ride under Upcoming", () => expect(rideTab(row({ role: "rider", seat: "accepted" }), NOW)).toBe("upcoming"));
  it.each(["pending", "declined", "expired"] as const)("lists a %s request under Requests", (seat) =>
    expect(rideTab(row({ role: "rider", seat }), NOW)).toBe("requests"));
  it("hides a request the rider cancelled themselves", () => expect(rideTab(row({ role: "rider", seat: "cancelled" }), NOW)).toBeNull());
  it("moves a trip to Past two hours after it leaves, not before", () => {
    expect(rideTab(row({ at: -1.9 }), NOW)).toBe("upcoming");
    expect(rideTab(row({ at: -2 }), NOW)).toBe("past");
    expect(rideTab(row({ at: -3, role: "rider", seat: "accepted" }), NOW)).toBe("past");
  });
  it("puts cancelled trips under Past for the driver and for riders who had a seat", () => {
    expect(rideTab(row({ tripStatus: "cancelled" }), NOW)).toBe("past");
    expect(rideTab(row({ role: "rider", seat: "cancelled", tripStatus: "cancelled" }), NOW)).toBe("past");
  });
  it("respects a trip the database already marked past", () => expect(rideTab(row({ tripStatus: "past" }), NOW)).toBe("past"));
});

describe("rideBadge", () => {
  it("says Open or Full for a driver", () => {
    expect(rideBadge(row({}), NOW)).toBe("open");
    expect(rideBadge(row({ left: 0 }), NOW)).toBe("full");
  });
  it("says what happened to a rider's request", () => {
    expect(rideBadge(row({ role: "rider", seat: "accepted" }), NOW)).toBe("accepted");
    expect(rideBadge(row({ role: "rider", seat: "pending" }), NOW)).toBe("pending");
    expect(rideBadge(row({ role: "rider", seat: "declined" }), NOW)).toBe("declined");
    expect(rideBadge(row({ role: "rider", seat: "expired" }), NOW)).toBe("expired");
  });
  it("says Cancelled and Past over everything else", () => {
    expect(rideBadge(row({ role: "rider", seat: "accepted", tripStatus: "cancelled" }), NOW)).toBe("cancelled");
    expect(rideBadge(row({ role: "rider", seat: "accepted", at: -5 }), NOW)).toBe("past");
  });
});

describe("groupRides", () => {
  const rows = [row({ at: 30 }), row({ at: 5 }), row({ at: -10 }), row({ at: -50 }), row({ role: "rider", seat: "pending", at: 8 })];
  const g = groupRides(rows, NOW);
  it("splits rows across the three tabs", () => {
    expect(g.upcoming).toHaveLength(2);
    expect(g.requests).toHaveLength(1);
    expect(g.past).toHaveLength(2);
  });
  it("sorts Upcoming soonest first and Past most recent first", () => {
    expect(g.upcoming.map((r) => r.trip.departsAt)).toEqual([hours(5), hours(30)]);
    expect(g.past.map((r) => r.trip.departsAt)).toEqual([hours(-10), hours(-50)]);
  });
  it("sortRides does not change its input", () => {
    const before = [...rows];
    sortRides("past", rows);
    expect(rows).toEqual(before);
  });
});
