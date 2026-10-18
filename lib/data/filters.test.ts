import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filtersToQuery, hasActiveFilters, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("returns the defaults for an empty address", () => expect(parseFilters({})).toEqual(DEFAULT_FILTERS));
  it("reads the tab, the destination chip and the search", () => {
    expect(parseFilters({ tab: "requests", chip: "Target", q: " market " })).toEqual({ tab: "requests", chip: "Target", q: "market" });
  });
  it("ignores values it does not recognize, including the old date, college and seats filters", () => {
    expect(parseFilters({ tab: "x", chip: "Costco", date: "today", day: "2026-10-24", college: "hmc", seats: "3" })).toEqual(DEFAULT_FILTERS);
  });
  it("takes the first of a repeated parameter and caps the search length", () => {
    expect(parseFilters({ chip: ["Target", "Other"] }).chip).toBe("Target");
    expect(parseFilters({ q: "x".repeat(500) }).q).toHaveLength(80);
  });
});

describe("filtersToQuery", () => {
  it("leaves out defaults", () => expect(filtersToQuery(DEFAULT_FILTERS)).toBe(""));
  it("round-trips", () => {
    const f = parseFilters({ tab: "requests", chip: "LA / LAX", q: "lax" });
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
  });
  it("applies an override", () => {
    expect(filtersToQuery(DEFAULT_FILTERS, { chip: "Other" })).toBe("?chip=Other");
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults, true for a chip or a search", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, chip: "Target" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: "lax" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, tab: "requests" })).toBe(false);
  });
});
