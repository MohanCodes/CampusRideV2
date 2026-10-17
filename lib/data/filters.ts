import { CAMPUS_TZ, isCampusId, type CampusId } from "@/lib/campuses";
import { dayKey, dayStart, nextDayKey } from "@/lib/format/time";

export const CHIPS = ["All", "Trader Joe's", "Target", "The Village", "Airport (ONT)", "LA / LAX", "Other"] as const;
export type Chip = (typeof CHIPS)[number];

export type DateFilter = { kind: "any" } | { kind: "today" } | { kind: "tomorrow" } | { kind: "day"; key: string };

export type BoardFilters = {
  tab: "rides" | "requests";
  chip: Chip;
  date: DateFilter;
  campus: CampusId | "all";
  minSeats: 1 | 2 | 3;
  q: string;
};

export const DEFAULT_FILTERS: BoardFilters = {
  tab: "rides", chip: "All", date: { kind: "any" }, campus: "all", minSeats: 1, q: "",
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the board's address bar. Anything unrecognized falls back to the default, never an error. */
export function parseFilters(params: Params): BoardFilters {
  const tab = one(params.tab) === "requests" ? "requests" : "rides";
  const chipRaw = one(params.chip);
  const chip = (CHIPS as readonly string[]).includes(chipRaw ?? "") ? (chipRaw as Chip) : "All";

  const dateRaw = one(params.date);
  const dayRaw = one(params.day);
  let date: DateFilter = { kind: "any" };
  if (dayRaw && /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) && !Number.isNaN(Date.parse(dayRaw))) date = { kind: "day", key: dayRaw };
  else if (dateRaw === "today") date = { kind: "today" };
  else if (dateRaw === "tomorrow") date = { kind: "tomorrow" };

  const campusRaw = one(params.college);
  const seats = Number(one(params.seats));
  return {
    tab, chip, date,
    campus: isCampusId(campusRaw) ? campusRaw : "all",
    minSeats: seats === 2 || seats === 3 ? seats : 1,
    q: (one(params.q) ?? "").trim().slice(0, 80),
  };
}

/** The address-bar form of a set of filters, leaving out anything at its default. */
export function filtersToQuery(f: BoardFilters, override: Partial<BoardFilters> = {}): string {
  const x = { ...f, ...override };
  const p = new URLSearchParams();
  if (x.tab !== "rides") p.set("tab", x.tab);
  if (x.chip !== "All") p.set("chip", x.chip);
  if (x.date.kind === "today" || x.date.kind === "tomorrow") p.set("date", x.date.kind);
  if (x.date.kind === "day") p.set("day", x.date.key);
  if (x.campus !== "all") p.set("college", x.campus);
  if (x.minSeats !== 1) p.set("seats", String(x.minSeats));
  if (x.q) p.set("q", x.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Anything narrower than "all upcoming trips"? Used to offer Clear filters. */
export function hasActiveFilters(f: BoardFilters): boolean {
  return f.chip !== "All" || f.date.kind !== "any" || f.campus !== "all" || f.minSeats !== 1 || f.q !== "";
}

/** Start (inclusive) and end (exclusive) of the date filter, as instants. */
export function dateRange(f: DateFilter, now: Date, tz = CAMPUS_TZ): { from: Date; to: Date | null } {
  if (f.kind === "any") return { from: now, to: null };
  const todayKey = dayKey(now, tz);
  const key = f.kind === "today" ? todayKey : f.kind === "tomorrow" ? nextDayKey(todayKey) : f.key;
  const start = dayStart(key, tz);
  return { from: start > now ? start : now, to: dayStart(nextDayKey(key), tz) };
}

export const chipSearchLabel = (f: BoardFilters) => (f.chip === "All" ? "" : f.chip);
