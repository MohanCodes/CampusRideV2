// Mapbox Search Box API, for "Other" destinations. BUILD.md 6.5: limited to a box around Southern
// California and to points of interest and places. Street addresses are rejected, so a private
// residence can't be chosen. Functions take the token and fetch as arguments so they can be tested.

// minLon, minLat, maxLon, maxLat. Matches the check inside post_trip.
export const SOCAL_BBOX = [-121.0, 32.0, -114.0, 35.9] as const;
export const ALLOWED_FEATURE_TYPES = ["poi", "place"] as const;

export type DestinationSuggestion = { mapboxId: string; name: string; detail: string };
export type VerifiedDestination = { mapboxId: string; name: string; lat: number; lng: number };

const BASE = "https://api.mapbox.com/search/searchbox/v1";
type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const isAllowedType = (t: unknown) => (ALLOWED_FEATURE_TYPES as readonly unknown[]).includes(t);
const inBox = (lat: number, lng: number) =>
  lng >= SOCAL_BBOX[0] && lat >= SOCAL_BBOX[1] && lng <= SOCAL_BBOX[2] && lat <= SOCAL_BBOX[3];

export function suggestUrl(query: string, sessionToken: string, token: string): string {
  const p = new URLSearchParams({
    q: query,
    access_token: token,
    session_token: sessionToken,
    types: ALLOWED_FEATURE_TYPES.join(","),
    bbox: SOCAL_BBOX.join(","),
    country: "us",
    language: "en",
    limit: "6",
  });
  return `${BASE}/suggest?${p}`;
}

export function retrieveUrl(mapboxId: string, sessionToken: string, token: string): string {
  const p = new URLSearchParams({ access_token: token, session_token: sessionToken });
  return `${BASE}/retrieve/${encodeURIComponent(mapboxId)}?${p}`;
}

export function parseSuggestions(json: unknown): DestinationSuggestion[] {
  const list = (json as { suggestions?: unknown[] } | null)?.suggestions;
  if (!Array.isArray(list)) return [];
  const out: DestinationSuggestion[] = [];
  for (const s of list as Record<string, unknown>[]) {
    if (!isAllowedType(s.feature_type)) continue; // drops addresses, streets, and everything else
    if (typeof s.mapbox_id !== "string" || typeof s.name !== "string") continue;
    out.push({ mapboxId: s.mapbox_id, name: s.name, detail: typeof s.place_formatted === "string" ? s.place_formatted : "" });
  }
  return out;
}

export function parseRetrieve(json: unknown): VerifiedDestination | null {
  const f = (json as { features?: Record<string, unknown>[] } | null)?.features?.[0];
  const props = f?.properties as Record<string, unknown> | undefined;
  const coords = (f?.geometry as { coordinates?: unknown } | undefined)?.coordinates;
  if (!props || !Array.isArray(coords)) return null;
  const [lng, lat] = coords as number[];
  if (!isAllowedType(props.feature_type)) return null;
  if (typeof props.mapbox_id !== "string" || typeof props.name !== "string") return null;
  if (typeof lat !== "number" || typeof lng !== "number" || !inBox(lat, lng)) return null;
  return { mapboxId: props.mapbox_id, name: props.name, lat, lng };
}

// Mapbox checks the URL restrictions on the token against the Referer, so server calls send the site's address.
export async function searchDestinations(
  query: string, sessionToken: string, token: string, site: string, fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<DestinationSuggestion[] | null> {
  try {
    const res = await fetchImpl(suggestUrl(query, sessionToken, token), { headers: { Referer: site }, signal: AbortSignal.timeout(5000) });
    return res.ok ? parseSuggestions(await res.json()) : null;
  } catch {
    return null;
  }
}

export async function retrieveDestination(
  mapboxId: string, sessionToken: string, token: string, site: string, fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<VerifiedDestination | null> {
  try {
    const res = await fetchImpl(retrieveUrl(mapboxId, sessionToken, token), { headers: { Referer: site }, signal: AbortSignal.timeout(5000) });
    return res.ok ? parseRetrieve(await res.json()) : null;
  } catch {
    return null;
  }
}
