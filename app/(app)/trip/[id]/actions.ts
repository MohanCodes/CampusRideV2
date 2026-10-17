"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";
import { performCancelSeat, performCancelTrip, performRequestSeat, performRespond, type ActionResult } from "@/lib/actions/seat";
import { getNow, isDemo } from "@/lib/demo";
import { errorCode, errorMessage } from "@/lib/errors";
import { backByDate, localToUtc } from "@/lib/format/tz";
import { updateTripSchema } from "@/lib/schemas/seat";
import { createClient } from "@/lib/supabase/server";

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; code?: string | null; fields?: Record<string, string> }
  | { status: "overlap" };

const SAMPLE = "This isn't available in sample mode.";

const asString = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Signed-in Supabase client, or a plain message about why not.
async function session() {
  const supabase = await createClient();
  if (!supabase || !(await getUser())) return { error: errorMessage("not_signed_in") as string };
  return { supabase };
}

function toState(r: ActionResult<unknown>): FormState {
  return r.ok ? { status: "idle" } : { status: "error", message: r.message, code: r.code, fields: r.fields };
}

function refresh(tripId?: string) {
  revalidatePath("/");
  revalidatePath("/rides");
  revalidatePath("/inbox");
  if (tripId) revalidatePath(`/trip/${tripId}`);
}

export async function requestSeat(_prev: FormState, formData: FormData): Promise<FormState> {
  const tripId = asString(formData.get("tripId"));
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error ?? errorMessage("not_signed_in") };
  const r = await performRequestSeat(s.supabase, { tripId, seats: formData.get("seats"), message: asString(formData.get("message")) });
  if (!r.ok) return toState(r);
  refresh(tripId);
  redirect(`/trip/${tripId}?sent=1`);
}

export async function cancelSeatRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error ?? errorMessage("not_signed_in") };
  const r = await performCancelSeat(s.supabase, { requestId: asString(formData.get("requestId")) });
  if (r.ok) refresh(asString(formData.get("tripId")));
  return toState(r);
}

// Accept or decline. The button that was pressed sends accept=1 or accept=0.
export async function respondToRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error ?? errorMessage("not_signed_in") };
  const r = await performRespond(s.supabase, { requestId: asString(formData.get("requestId")), accept: asString(formData.get("accept")) });
  // A trip that filled up or left in the meantime changes what the page should show, so refresh either way.
  refresh(asString(formData.get("tripId")));
  return toState(r);
}

export async function cancelTrip(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error ?? errorMessage("not_signed_in") };
  const tripId = asString(formData.get("tripId"));
  const r = await performCancelTrip(s.supabase, { tripId });
  if (!r.ok) return toState(r);
  refresh(tripId);
  redirect(`/trip/${tripId}`);
}

export async function updateTrip(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw: Record<string, FormDataEntryValue> = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  // Sample trips have ids like "t10", not UUIDs. Swap in a placeholder so the form's own checks still run.
  if (isDemo()) raw.tripId = "00000000-0000-4000-8000-000000000000";
  const parsed = updateTripSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { status: "error", message: parsed.error.issues[0].message, fields };
  }
  const v = parsed.data;
  const departs = localToUtc(v.date, v.time);
  if (!departs) return { status: "error", message: "That time doesn't exist. Pick another.", fields: { time: "That time doesn't exist. Pick another." } };
  if (departs <= getNow()) return { status: "error", message: errorMessage("time_in_past"), fields: { time: errorMessage("time_in_past") } };
  let backBy: Date | null = null;
  if (v.backByTime) {
    backBy = localToUtc(backByDate(v.date, v.time, v.backByTime), v.backByTime);
    if (!backBy) return { status: "error", message: "That time doesn't exist. Pick another.", fields: { backByTime: "That time doesn't exist. Pick another." } };
  }
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error ?? errorMessage("not_signed_in") };

  const { error } = await s.supabase.rpc("update_trip", {
    p_trip: v.tripId,
    p_departs_at: departs.toISOString(),
    p_back_by: backBy ? backBy.toISOString() : null,
    p_seats_total: v.seats,
    p_cost_note: v.costNote || null,
    p_notes: v.notes || null,
    p_confirm_overlap: v.confirmOverlap === "1",
  });
  if (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    if (code === "overlap") return { status: "overlap" };
    if (code === "time_in_past" || code === "trip_too_far") return { status: "error", message, fields: { time: message } };
    if (code === "seats_below_taken") return { status: "error", message, fields: { seats: message } };
    if (code === "contact_info") return { status: "error", message, fields: { notes: message } };
    return { status: "error", message, code };
  }
  refresh(v.tripId);
  redirect(`/trip/${v.tripId}`);
}
