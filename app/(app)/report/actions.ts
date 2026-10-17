"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { getUser } from "@/lib/auth/dal";
import { performBlock, performFileReport, performNoShow } from "@/lib/actions/moderation";
import type { ActionResult } from "@/lib/actions/seat";
import { isDemo } from "@/lib/demo";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const SAMPLE = "This isn't available in sample mode.";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const toState = (r: ActionResult<unknown>): FormState => (r.ok ? { status: "idle" } : { status: "error", message: r.message, code: r.code, fields: r.fields });

async function session() {
  const supabase = await createClient();
  return supabase && (await getUser()) ? supabase : null;
}

// Report a person, a trip, or a request. Confirms with the plain line from WEB_FLOWS.md Flow F.
export async function fileReport(_prev: FormState, formData: FormData): Promise<FormState & { sent?: boolean }> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return { status: "error", message: errorMessage("not_signed_in") };
  const r = await performFileReport(supabase, {
    targetType: str(formData.get("targetType")), targetId: str(formData.get("targetId")), tripId: str(formData.get("tripId")),
    reason: str(formData.get("reason")), details: str(formData.get("details")),
  });
  return r.ok ? { status: "idle", sent: true } : toState(r);
}

// Block someone. Responds instantly and never celebrates: they simply disappear, and the person goes back to the board.
export async function blockUser(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return { status: "error", message: errorMessage("not_signed_in") };
  const r = await performBlock(supabase, { userId: str(formData.get("userId")) });
  if (!r.ok) return toState(r);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function markNoShow(_prev: FormState, formData: FormData): Promise<FormState & { sent?: boolean }> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return { status: "error", message: errorMessage("not_signed_in") };
  const tripId = str(formData.get("tripId"));
  const r = await performNoShow(supabase, { tripId, riderId: str(formData.get("riderId")) });
  if (!r.ok) return toState(r);
  revalidatePath(`/trip/${tripId}`);
  return { status: "idle", sent: true };
}
