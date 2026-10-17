import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sortPlaces, sortPoints } = await import("./post");

describe("sortPlaces", () => {
  it("follows the chip order, then name", () => {
    const out = sortPlaces([
      { id: "a", name: "Zebra Mall", chip: "Other", category: "mall" },
      { id: "b", name: "LAX", chip: "LA / LAX", category: "airport" },
      { id: "c", name: "Trader Joe's", chip: "Trader Joe's", category: "grocery" },
      { id: "d", name: "Target (Upland)", chip: "Target", category: "shopping" },
      { id: "e", name: "Target (La Verne)", chip: "Target", category: "shopping" },
    ]);
    expect(out.map((p) => p.id)).toEqual(["c", "e", "d", "b", "a"]);
  });
});

describe("sortPoints", () => {
  const pt = (id: string, campusId: string, shared: boolean) => ({ id, name: id, campusId, shared, type: "hub", lat: 0, lng: 0 });
  it("puts the driver's own campus first, then shared points", () => {
    const out = sortPoints([pt("shared-b", "pomona", true), pt("own-b", "hmc", false), pt("own-a", "hmc", false), pt("shared-a", "hmc", true)], "hmc");
    expect(out.map((p) => p.id)).toEqual(["own-a", "own-b", "shared-a", "shared-b"]);
  });
});
