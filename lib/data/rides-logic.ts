import type { Status } from "@/components/StatusBadge";
import type { RideRow } from "./types";

// My Rides tabs and badges. Pure, so the rules are easy to test.
export type RideTab = "upcoming" | "requests" | "past";
export const RIDE_TABS: { id: RideTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "requests", label: "Requests" },
  { id: "past", label: "Past" },
];

// A trip moves to Past automatically 2 hours after its departure time (the scheduled job in
// Step 9 records it; until then this keeps the screens honest).
export const PAST_AFTER_MS = 2 * 3600_000;

export const isRidePast = (r: RideRow, now: Date) =>
  r.tripStatus === "past" || new Date(r.trip.departsAt).getTime() + PAST_AFTER_MS <= now.getTime();

/** Which tab a row belongs on, or null when it shouldn't be listed at all. */
export function rideTab(r: RideRow, now: Date): RideTab | null {
  if (r.tripStatus === "cancelled" || isRidePast(r, now)) return r.role === "rider" && r.seatStatus === "cancelled" && r.tripStatus !== "cancelled" ? null : "past";
  if (r.role === "driver") return "upcoming";
  if (r.seatStatus === "accepted") return "upcoming";
  if (r.seatStatus === "pending" || r.seatStatus === "declined" || r.seatStatus === "expired") return "requests";
  return null; // the rider cancelled their own request on a trip that is still on
}

export function rideBadge(r: RideRow, now: Date): Status {
  if (r.tripStatus === "cancelled") return "cancelled";
  if (isRidePast(r, now)) return "past";
  if (r.role === "driver") return r.trip.seatsLeft <= 0 ? "full" : "open";
  switch (r.seatStatus) {
    case "accepted": return "accepted";
    case "pending": return "pending";
    case "declined": return "declined";
    case "expired": return "expired";
    default: return "open";
  }
}

/** Upcoming and Requests soonest first; Past most recent first. */
export function sortRides(tab: RideTab, rows: RideRow[]): RideRow[] {
  const by = (a: RideRow, b: RideRow) => a.trip.departsAt.localeCompare(b.trip.departsAt);
  return [...rows].sort(tab === "past" ? (a, b) => by(b, a) : by);
}

export function groupRides(rows: RideRow[], now: Date): Record<RideTab, RideRow[]> {
  const out: Record<RideTab, RideRow[]> = { upcoming: [], requests: [], past: [] };
  for (const r of rows) {
    const tab = rideTab(r, now);
    if (tab) out[tab].push(r);
  }
  for (const t of Object.keys(out) as RideTab[]) out[t] = sortRides(t, out[t]);
  return out;
}

export function parseRideTab(v: string | string[] | undefined): RideTab {
  const x = Array.isArray(v) ? v[0] : v;
  return x === "requests" || x === "past" ? x : "upcoming";
}
