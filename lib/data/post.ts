import "server-only";
import { CAMPUS_IDS, type CampusId } from "@/lib/campuses";
import { getUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { CHIPS } from "./filters";
import type { Result } from "./types";

export type PlaceOption = { id: string; name: string; chip: string; category: string };
export type MeetupOption = { id: string; name: string; campusId: string; shared: boolean; type: string; lat: number; lng: number };
export type PostFormData = { places: PlaceOption[]; points: MeetupOption[]; campusId: string; lastMeetupPointId: string | null };

const chipRank = (chip: string) => {
  const i = (CHIPS as readonly string[]).indexOf(chip);
  return i === -1 ? CHIPS.length : i;
};

// "Recent and popular first". With no trip history yet, the chip order (Trader Joe's, Target, the
// Village, the airports) stands in for popular; recent places are added once there is history.
export function sortPlaces(places: PlaceOption[]): PlaceOption[] {
  return [...places].sort((a, b) => chipRank(a.chip) - chipRank(b.chip) || a.name.localeCompare(b.name));
}

// The picker shows the driver's own campus first, then shared points. No browser location is used,
// so there is no "nearest" ordering; the list stays in a steady, predictable order instead.
export function sortPoints(points: MeetupOption[], campusId: string): MeetupOption[] {
  const rank = (p: MeetupOption) => (p.campusId === campusId && !p.shared ? 0 : p.shared ? 1 : 2);
  return [...points].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

const DEMO_PLACES: PlaceOption[] = [
  { id: "tj-claremont", name: "Trader Joe's", chip: "Trader Joe's", category: "grocery" },
  { id: "target-montclair", name: "Target (Montclair)", chip: "Target", category: "shopping" },
  { id: "village", name: "Claremont Village", chip: "The Village", category: "food" },
  { id: "farmers-market", name: "Claremont Farmers Market (Sundays 8am-1pm)", chip: "The Village", category: "market" },
  { id: "ont", name: "Ontario International Airport (ONT)", chip: "Airport (ONT)", category: "airport" },
  { id: "lax", name: "Los Angeles International Airport (LAX)", chip: "LA / LAX", category: "airport" },
  { id: "montclair-plaza", name: "Montclair Plaza", chip: "Other", category: "mall" },
];
const DEMO_POINTS: MeetupOption[] = [
  { id: "00000000-0000-4000-8000-0000000000a1", name: "Platt Campus Center", campusId: "hmc", shared: false, type: "hub", lat: 34.106, lng: -117.709 },
  { id: "00000000-0000-4000-8000-0000000000a2", name: "Hoch-Shanahan Dining Commons", campusId: "hmc", shared: false, type: "hub", lat: 34.1062, lng: -117.7092 },
  { id: "00000000-0000-4000-8000-0000000000a3", name: "Honnold/Mudd Library", campusId: "hmc", shared: true, type: "shared", lat: 34.102, lng: -117.7115 },
  { id: "00000000-0000-4000-8000-0000000000a4", name: "Smith Campus Center", campusId: "pomona", shared: true, type: "hub", lat: 34.0975, lng: -117.711 },
];

export async function getPostFormData(): Promise<Result<PostFormData>> {
  if (isDemo()) {
    return { ok: true, data: { places: sortPlaces(DEMO_PLACES), points: sortPoints(DEMO_POINTS, "hmc"), campusId: "hmc", lastMeetupPointId: DEMO_POINTS[0].id } };
  }
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };

    const { data: me } = await supabase.from("profiles").select("campus_id").eq("id", user.id).maybeSingle();
    const campusId = (me?.campus_id as CampusId | undefined) ?? CAMPUS_IDS[0];

    const [placesRes, pointsRes, lastRes] = await Promise.all([
      supabase.from("places").select("id, name, chip, category").eq("active", true),
      supabase.from("meetup_points").select("id, name, campus_id, shared, type, lat, lng")
        .eq("status", "approved").or(`campus_id.eq.${campusId},shared.eq.true`),
      supabase.from("trips").select("meetup_point_id").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]);
    if (placesRes.error || pointsRes.error) return { ok: false };

    const points: MeetupOption[] = (pointsRes.data ?? []).map((p) => ({
      id: p.id, name: p.name, campusId: p.campus_id, shared: p.shared, type: p.type, lat: p.lat, lng: p.lng,
    }));
    const last = lastRes.data?.[0]?.meetup_point_id ?? null;
    return {
      ok: true,
      data: {
        places: sortPlaces((placesRes.data ?? []) as PlaceOption[]),
        points: sortPoints(points, campusId),
        campusId,
        lastMeetupPointId: points.some((p) => p.id === last) ? last : null,
      },
    };
  } catch {
    return { ok: false };
  }
}
