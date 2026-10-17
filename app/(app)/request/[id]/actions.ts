"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { getUser } from "@/lib/auth/dal";
import { performCancelRequest, performExtendRequest, performRespondOffer, performSendOffer, performWithdrawOffer } from "@/lib/actions/offer";
import type { ActionResult } from "@/lib/actions/seat";
import { getNow, isDemo } from "@/lib/demo";
import { errorCode, errorMessage } from "@/lib/errors";
import { localToUtc } from "@/lib/format/tz";
import { updateRequestSchema } from "@/lib/schemas/request";
import { createClient } from "@/lib/supabase/server";

const SAMPLE = "This isn't available in sample mode.";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function session() {
  const supabase = await createClient();
  if (!supabase || !(await getUser())) return null;
  return supabase;
}
const needSignIn: FormState = { status: "error", message: errorMessage("not_signed_in") };
const toState = (r: ActionResult<unknown>): FormState => (r.ok ? { status: "idle" } : { status: "error", message: r.message, code: r.code, fields: r.fields });

function refresh(requestId?: string) {
  revalidatePath("/");
  revalidatePath("/rides");
  revalidatePath("/inbox");
  if (requestId) revalidatePath(`/request/${requestId}`);
}

export async function sendOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;
  const requestId = str(formData.get("requestId"));
  const r = await performSendOffer(supabase, { requestId, tripId: str(formData.get("tripId")), message: str(formData.get("message")) });
  if (!r.ok) return toState(r);
  refresh(requestId);
  redirect(`/request/${requestId}?offered=1`);
}

export async function withdrawOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;
  const r = await performWithdrawOffer(supabase, { offerId: str(formData.get("offerId")) });
  if (r.ok) refresh(str(formData.get("requestId")));
  return toState(r);
}

// Accept or decline an offer. Accepting takes the rider to the trip, where the plate and exact spot now show.
export async function respondToOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;
  const r = await performRespondOffer(supabase, { offerId: str(formData.get("offerId")), accept: str(formData.get("accept")) });
  refresh(str(formData.get("requestId")));
  if (r.ok && r.data.accepted) redirect(`/trip/${str(formData.get("tripId"))}`);
  return toState(r);
}

export async function cancelRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;
  const requestId = str(formData.get("requestId"));
  const r = await performCancelRequest(supabase, { requestId });
  if (!r.ok) return toState(r);
  refresh(requestId);
  redirect(`/request/${requestId}`);
}

export async function extendRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;
  const requestId = str(formData.get("requestId"));
  const r = await performExtendRequest(supabase, { requestId });
  if (r.ok) refresh(requestId);
  return toState(r);
}

export async function updateRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw: Record<string, FormDataEntryValue> = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  if (isDemo()) raw.requestId = "00000000-0000-4000-8000-000000000000"; // sample ids aren't UUIDs; keep the form's own checks
  const parsed = updateRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { status: "error", message: parsed.error.issues[0].message, fields };
  }
  const v = parsed.data;
  const when = localToUtc(v.date, v.time);
  if (!when) return { status: "error", message: "That time doesn't exist. Pick another.", fields: { time: "That time doesn't exist. Pick another." } };
  if (when <= getNow()) return { status: "error", message: errorMessage("time_in_past"), fields: { time: errorMessage("time_in_past") } };
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;

  const { error } = await supabase.rpc("update_ride_request", {
    p_request: v.requestId, p_when: when.toISOString(), p_flexibility: v.flexibility, p_seats: v.seats, p_chip_in: v.chipIn === "on", p_note: v.note || null,
  });
  if (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    if (code === "time_in_past" || code === "too_far_ahead") return { status: "error", message, fields: { time: message } };
    if (code === "contact_info") return { status: "error", message, fields: { note: message } };
    return { status: "error", message, code };
  }
  refresh(v.requestId);
  redirect(`/request/${v.requestId}`);
}
