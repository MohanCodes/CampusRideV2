import { describe, expect, it } from "vitest";
import {
  SOCAL_BBOX, parseRetrieve, parseSuggestions, retrieveDestination, retrieveUrl, searchDestinations, suggestUrl,
} from "./mapbox";

// Response shapes follow Mapbox's Search Box API documentation. They have not been checked against
// the live service yet (that needs a token), so the first real call should be watched.
const suggest = {
  suggestions: [
    { name: "Rancho Santa Ana Botanic Garden", mapbox_id: "poi.1", feature_type: "poi", place_formatted: "Claremont, California" },
    { name: "Upland", mapbox_id: "place.2", feature_type: "place", place_formatted: "California" },
    { name: "123 Oak Street", mapbox_id: "addr.3", feature_type: "address", place_formatted: "Claremont, California" },
    { name: "Oak Street", mapbox_id: "street.4", feature_type: "street" },
    { name: "Missing id", feature_type: "poi" },
  ],
};

describe("urls", () => {
  it("limit the search to places and points of interest inside the Southern California box", () => {
    const u = new URL(suggestUrl("botanic", "sess", "pk.test"));
    expect(u.searchParams.get("types")).toBe("poi,place");
    expect(u.searchParams.get("bbox")).toBe(SOCAL_BBOX.join(","));
    expect(u.searchParams.get("country")).toBe("us");
    expect(u.searchParams.get("q")).toBe("botanic");
  });
  it("encode an id that has odd characters", () => {
    expect(retrieveUrl("a/b c", "s", "t")).toContain("/retrieve/a%2Fb%20c?");
  });
});

describe("parseSuggestions", () => {
  it("keeps points of interest and places, and drops addresses and streets", () => {
    expect(parseSuggestions(suggest).map((s) => s.name)).toEqual(["Rancho Santa Ana Botanic Garden", "Upland"]);
  });
  it("copes with garbage", () => {
    for (const v of [null, undefined, {}, { suggestions: "x" }, 5]) expect(parseSuggestions(v)).toEqual([]);
  });
});

describe("parseRetrieve", () => {
  const feature = (type: string, coords: unknown) => ({
    features: [{ geometry: { coordinates: coords }, properties: { name: "Garden", mapbox_id: "poi.1", feature_type: type } }],
  });
  it("returns the verified name and coordinates", () => {
    expect(parseRetrieve(feature("poi", [-117.7, 34.1]))).toEqual({ mapboxId: "poi.1", name: "Garden", lat: 34.1, lng: -117.7 });
  });
  it("rejects an address even if asked for by id", () => expect(parseRetrieve(feature("address", [-117.7, 34.1]))).toBeNull());
  it("rejects a point outside Southern California", () => expect(parseRetrieve(feature("poi", [-74, 40.7]))).toBeNull());
  it("rejects malformed responses", () => {
    for (const v of [null, {}, { features: [] }, feature("poi", "nope"), feature("poi", [1])]) expect(parseRetrieve(v)).toBeNull();
  });
});

describe("network calls", () => {
  const ok = (body: unknown) => async () => ({ ok: true, json: async () => body });
  it("send the site as the Referer so the token's URL restriction passes", async () => {
    let seen: Record<string, string> | undefined;
    await searchDestinations("garden", "s", "t", "https://campusride.example", async (_u, init) => {
      seen = init?.headers;
      return { ok: true, json: async () => suggest };
    });
    expect(seen).toEqual({ Referer: "https://campusride.example" });
  });
  it("return suggestions, or null when Mapbox fails", async () => {
    expect((await searchDestinations("g", "s", "t", "x", ok(suggest)))?.length).toBe(2);
    expect(await searchDestinations("g", "s", "t", "x", async () => ({ ok: false, json: async () => ({}) }))).toBeNull();
    expect(await searchDestinations("g", "s", "t", "x", async () => { throw new Error("offline"); })).toBeNull();
  });
  it("retrieve and verify a destination", async () => {
    const body = { features: [{ geometry: { coordinates: [-117.7, 34.1] }, properties: { name: "Garden", mapbox_id: "poi.1", feature_type: "poi" } }] };
    expect(await retrieveDestination("poi.1", "s", "t", "x", ok(body))).toMatchObject({ name: "Garden" });
    expect(await retrieveDestination("poi.1", "s", "t", "x", async () => ({ ok: false, json: async () => body }))).toBeNull();
  });
});
