"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";
import { getNow, isDemo } from "@/lib/demo";
import { errorCode, errorMessage } from "@/lib/errors";
import { backByDate, localToUtc } from "@/lib/format/tz";
import { retrieveDestination, searchDestinations, type DestinationSuggestion } from "@/lib/mapbox";
import { performSendOffer } from "@/lib/actions/offer";
import { postTripSchema, searchOtherSchema } from "@/lib/schemas/post";
import { createClient } from "@/lib/supabase/server";

type Field = "destination" | "date" | "time" | "backByTime" | "seats" | "meetupPointId" | "carMake" | "carColor" | "carPlate" | "costNote" | "notes";

export type PostTripState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields?: Partial<Record<Field, string>> }
  | { status: "overlap" };

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function postTrip(_prev: PostTripState, formData: FormData): Promise<PostTripState> {
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = postTripSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) fields[issue.path[0] as Field] ??= issue.message;
    return { status: "error", fields };
  }
  const v = parsed.data;

  const departs = localToUtc(v.date, v.time);
  if (!departs) return { status: "error", fields: { time: "That time doesn't exist. Pick another." } };
  if (departs <= getNow()) return { status: "error", fields: { time: errorMessage("time_in_past") } };
  let backBy: Date | null = null;
  if (v.backByTime) {
    backBy = localToUtc(backByDate(v.date, v.time, v.backByTime), v.backByTime);
    if (!backBy) return { status: "error", fields: { backByTime: "That time doesn't exist. Pick another." } };
  }

  if (isDemo()) return { status: "error", message: "Posting isn't available in sample mode." };

  const supabase = await createClient();
  if (!supabase || !(await getUser())) return { status: "error", message: errorMessage("not_signed_in") };

  // An "Other" destination is checked again here, from Mapbox, by its id. The browser's word for its
  // name and coordinates is never used, so only a real point of interest or place can be chosen.
  let placeId: string | null = null;
  let name: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  if (v.destinationKind === "place") {
    placeId = v.placeId;
  } else {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return { status: "error", fields: { destination: "Searching other places isn't set up yet. Pick one from the list." } };
    const found = await retrieveDestination(v.mapboxId, v.sessionToken, token, siteUrl());
    if (!found) return { status: "error", fields: { destination: "We couldn't confirm that place. Pick another." } };
    ({ name, lat, lng } = found);
  }

  const { data, error } = await supabase.rpc("post_trip", {
    p_place_id: placeId,
    p_destination_name: name,
    p_destination_lat: lat,
    p_destination_lng: lng,
    p_departs_at: departs.toISOString(),
    p_back_by: backBy ? backBy.toISOString() : null,
    p_seats_total: v.seats,
    p_meetup_point_id: v.meetupPointId,
    p_car_make: v.carMake,
    p_car_color: v.carColor,
    p_car_plate: v.carPlate,
    p_cost_note: v.costNote || null,
    p_notes: v.notes || null,
    p_confirm_overlap: v.confirmOverlap === "1",
  });

  if (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    if (code === "overlap") return { status: "overlap" };
    if (code === "time_in_past" || code === "trip_too_far") return { status: "error", fields: { time: message } };
    if (code === "meetup_not_allowed") return { status: "error", fields: { meetupPointId: message } };
    if (code === "contact_info") return { status: "error", fields: { notes: message } };
    return { status: "error", message };
  }

  revalidatePath("/");
  // Posted to answer a request: remember the link and send the offer right away.
  let tail = "";
  if (v.forRequest) {
    await supabase.rpc("link_trip_to_request", { p_trip: data, p_request: v.forRequest });
    const offer = await performSendOffer(supabase, { requestId: v.forRequest, tripId: String(data), message: "" });
    tail = `?offered=${offer.ok ? "1" : "0"}&for=${encodeURIComponent(v.forRequest)}`;
    revalidatePath(`/request/${v.forRequest}`);
  }
  redirect(`/post/confirmed/${data}${tail}`);
}

export type OtherSearchResult =
  | { ok: true; suggestions: DestinationSuggestion[] }
  | { ok: false; reason: "unavailable" | "signin" | "invalid" };

const DEMO_OTHERS: DestinationSuggestion[] = [
  { mapboxId: "demo.botanic", name: "Rancho Santa Ana Botanic Garden", detail: "Claremont, California" },
  { mapboxId: "demo.mills", name: "Ontario Mills", detail: "Ontario, California" },
  { mapboxId: "demo.gardens", name: "Victoria Gardens", detail: "Rancho Cucamonga, California" },
];

// Type-ahead for "somewhere else". Only signed-in people can search, and only points of interest
// and places come back (see lib/mapbox.ts).
export async function searchOtherPlaces(query: string, sessionToken: string): Promise<OtherSearchResult> {
  const parsed = searchOtherSchema.safeParse({ query, sessionToken });
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (isDemo()) {
    const q = parsed.data.query.toLowerCase();
    return { ok: true, suggestions: DEMO_OTHERS.filter((s) => s.name.toLowerCase().includes(q)) };
  }
  if (!(await getUser())) return { ok: false, reason: "signin" };
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return { ok: false, reason: "unavailable" };
  const suggestions = await searchDestinations(parsed.data.query, parsed.data.sessionToken, token, siteUrl());
  return suggestions ? { ok: true, suggestions } : { ok: false, reason: "unavailable" };
}
