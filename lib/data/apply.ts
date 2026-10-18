import type { BoardFilters } from "./filters";
import type { RequestCardData, TripCardData } from "./types";

// The same rules the database queries use, written once as plain code. Demo mode runs these
// directly, and the tests pin down what "matches the filters" means.
const matchesText = (q: string, ...fields: (string | null)[]) =>
  !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()));

export function applyTripFilters(trips: TripCardData[], f: BoardFilters, now: Date): TripCardData[] {
  return trips
    .filter((t) => {
      const at = new Date(t.departsAt);
      return (
        at > now &&
        t.seatsLeft >= 1 &&
        (f.chip === "All" || t.chip === f.chip) &&
        matchesText(f.q, t.destinationName, t.meetupPointName, t.driver.firstName)
      );
    })
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt));
}

export function applyRequestFilters(reqs: RequestCardData[], f: BoardFilters, now: Date): RequestCardData[] {
  return reqs
    .filter((r) => {
      const end = new Date(r.windowEnd);
      return (
        end > now &&
        (f.chip === "All" || r.chip === f.chip) &&
        matchesText(f.q, r.destinationName, r.meetupPointName, r.rider.firstName)
      );
    })
    .sort((a, b) => a.windowStart.localeCompare(b.windowStart));
}

/** Groups already-sorted items under their campus-time day, for the date headers. */
export function groupByDay<T>(items: T[], getTime: (t: T) => string, dayOf: (iso: string) => string): { key: string; items: T[] }[] {
  const groups: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayOf(getTime(item));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}
