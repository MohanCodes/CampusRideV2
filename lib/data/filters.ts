export const CHIPS = ["All", "Trader Joe's", "Target", "The Village", "Airport (ONT)", "LA / LAX", "Other"] as const;
export type Chip = (typeof CHIPS)[number];

export type BoardFilters = {
  tab: "rides" | "requests";
  chip: Chip;
  q: string;
};

export const DEFAULT_FILTERS: BoardFilters = { tab: "rides", chip: "All", q: "" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the board's address bar. Anything unrecognized falls back to the default, never an error. */
export function parseFilters(params: Params): BoardFilters {
  const tab = one(params.tab) === "requests" ? "requests" : "rides";
  const chipRaw = one(params.chip);
  const chip = (CHIPS as readonly string[]).includes(chipRaw ?? "") ? (chipRaw as Chip) : "All";

  return { tab, chip, q: (one(params.q) ?? "").trim().slice(0, 80) };
}

/** The address-bar form of a set of filters, leaving out anything at its default. */
export function filtersToQuery(f: BoardFilters, override: Partial<BoardFilters> = {}): string {
  const x = { ...f, ...override };
  const p = new URLSearchParams();
  if (x.tab !== "rides") p.set("tab", x.tab);
  if (x.chip !== "All") p.set("chip", x.chip);
  if (x.q) p.set("q", x.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Anything narrower than "all upcoming trips"? Used to offer Clear. */
export function hasActiveFilters(f: BoardFilters): boolean {
  return f.chip !== "All" || f.q !== "";
}

export const chipSearchLabel = (f: BoardFilters) => (f.chip === "All" ? "" : f.chip);
