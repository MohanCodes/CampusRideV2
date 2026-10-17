"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { getUser } from "@/lib/auth/dal";
import { getNow, isDemo } from "@/lib/demo";
import { errorCode, errorMessage } from "@/lib/errors";
import { localToUtc } from "@/lib/format/tz";
import { retrieveDestination } from "@/lib/mapbox";
import { postRequestSchema } from "@/lib/schemas/request";
import { createClient } from "@/lib/supabase/server";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// "Ask for a ride". Mirrors postTrip: check the form, verify an "Other" place with Mapbox, then one database call.
export async function postRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = postRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { status: "error", message: parsed.error.issues[0].message, fields };
  }
  const v = parsed.data;
  const when = localToUtc(v.date, v.time);
  if (!when) return { status: "error", message: "That time doesn't exist. Pick another.", fields: { time: "That time doesn't exist. Pick another." } };
  if (when <= getNow()) return { status: "error", message: errorMessage("time_in_past"), fields: { time: errorMessage("time_in_past") } };
  if (isDemo()) return { status: "error", message: "Asking for a ride isn't available in sample mode." };

  const supabase = await createClient();
  if (!supabase || !(await getUser())) return { status: "error", message: errorMessage("not_signed_in") };

  let name: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  if (v.destinationKind === "other") {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return { status: "error", message: "", fields: { destination: "Searching other places isn't set up yet. Pick one from the list." } };
    const found = await retrieveDestination(v.mapboxId, v.sessionToken, token, siteUrl());
    if (!found) return { status: "error", message: "", fields: { destination: "We couldn't confirm that place. Pick another." } };
    ({ name, lat, lng } = found);
  }

  const { data, error } = await supabase.rpc("post_ride_request", {
    p_place_id: v.destinationKind === "place" ? v.placeId : null,
    p_destination_name: name,
    p_destination_lat: lat,
    p_destination_lng: lng,
    p_when: when.toISOString(),
    p_flexibility: v.flexibility,
    p_seats: v.seats,
    p_meetup_point_id: v.meetupPointId,
    p_chip_in: v.chipIn === "on",
    p_note: v.note || null,
  });
  if (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    if (code === "time_in_past" || code === "too_far_ahead") return { status: "error", message, fields: { time: message } };
    if (code === "meetup_not_allowed") return { status: "error", message, fields: { meetupPointId: message } };
    if (code === "contact_info") return { status: "error", message, fields: { note: message } };
    return { status: "error", message, code };
  }
  revalidatePath("/");
  revalidatePath("/rides");
  redirect(`/request/${data}?posted=1`);
}
