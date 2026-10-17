import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, dateRange, filtersToQuery, hasActiveFilters, parseFilters } from "./filters";

const NOW = new Date("2026-10-17T20:00:00Z"); // Sat 1:00 PM in LA

describe("parseFilters", () => {
  it("returns the defaults for an empty address", () => expect(parseFilters({})).toEqual(DEFAULT_FILTERS));
  it("reads every filter", () => {
    expect(parseFilters({ tab: "requests", chip: "Target", date: "tomorrow", college: "pomona", seats: "2", q: " market " })).toEqual({
      tab: "requests", chip: "Target", date: { kind: "tomorrow" }, campus: "pomona", minSeats: 2, q: "market",
    });
  });
  it("lets a picked day win over the date shortcut", () => {
    expect(parseFilters({ date: "today", day: "2026-10-24" }).date).toEqual({ kind: "day", key: "2026-10-24" });
  });
  it("ignores values it does not recognize", () => {
    expect(parseFilters({ tab: "x", chip: "Costco", date: "next-year", day: "2026-13-45", college: "mit", seats: "9" })).toEqual(DEFAULT_FILTERS);
  });
  it("takes the first of a repeated parameter and caps the search length", () => {
    expect(parseFilters({ chip: ["Target", "Other"] }).chip).toBe("Target");
    expect(parseFilters({ q: "x".repeat(500) }).q).toHaveLength(80);
  });
});

describe("filtersToQuery", () => {
  it("leaves out defaults", () => expect(filtersToQuery(DEFAULT_FILTERS)).toBe(""));
  it("round-trips", () => {
    const f = parseFilters({ tab: "requests", chip: "LA / LAX", date: "today", college: "hmc", seats: "3", q: "lax" });
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
  });
  it("applies an override", () => {
    expect(filtersToQuery(DEFAULT_FILTERS, { chip: "Other" })).toBe("?chip=Other");
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults, true for anything narrower", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, minSeats: 2 })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, tab: "requests" })).toBe(false);
  });
});

describe("dateRange", () => {
  it("any date starts now and has no end", () => expect(dateRange({ kind: "any" }, NOW)).toEqual({ from: NOW, to: null }));
  it("today runs from now to the end of the LA day", () => {
    const r = dateRange({ kind: "today" }, NOW);
    expect(r.from).toEqual(NOW);
    expect(r.to?.toISOString()).toBe("2026-10-18T07:00:00.000Z");
  });
  it("tomorrow is the whole next LA day", () => {
    const r = dateRange({ kind: "tomorrow" }, NOW);
    expect(r.from.toISOString()).toBe("2026-10-18T07:00:00.000Z");
    expect(r.to?.toISOString()).toBe("2026-10-19T07:00:00.000Z");
  });
  it("a past day starts now rather than reaching back", () => {
    expect(dateRange({ kind: "day", key: "2026-10-01" }, NOW).from).toEqual(NOW);
  });
});
