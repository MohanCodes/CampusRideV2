"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { getUser } from "@/lib/auth/dal";
import {
  performAdminAddPoint, performAdminRemove, performAdminSetPointStatus, performAdminSetStatus, performAdminSuspend,
  performAdminUnsuspend, performAdminUpdatePoint, performAdminWarn,
} from "@/lib/actions/moderation";
import type { ActionResult } from "@/lib/actions/seat";
import { isDemo } from "@/lib/demo";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const SAMPLE = "This isn't available in sample mode.";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const toState = (r: ActionResult<unknown>): FormState => (r.ok ? { status: "idle" } : { status: "error", message: r.message, code: r.code, fields: r.fields });

// Every admin function in the database checks the role again, so these only pass the call along.
// A person who isn't an admin gets "You can't do that." and nothing happens.
async function session() {
  const supabase = await createClient();
  return supabase && (await getUser()) ? supabase : null;
}
const needSignIn: FormState = { status: "error", message: errorMessage("not_signed_in") };

type Op = (supabase: NonNullable<Awaited<ReturnType<typeof session>>>, fd: FormData) => Promise<ActionResult<unknown>>;
async function run(formData: FormData, paths: string[], op: Op): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const supabase = await session();
  if (!supabase) return needSignIn;
  const r = await op(supabase, formData);
  if (r.ok) for (const p of paths) revalidatePath(p);
  return toState(r);
}

export async function setReportStatus(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/reports", `/admin/reports/${str(fd.get("reportId"))}`], (s) => performAdminSetStatus(s, { reportId: str(fd.get("reportId")), status: str(fd.get("status")) }));
}
export async function warnUser(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/reports", `/admin/reports/${str(fd.get("reportId"))}`], (s) => performAdminWarn(s, { userId: str(fd.get("userId")), reportId: str(fd.get("reportId")) }));
}
export async function suspendUser(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/reports", `/admin/reports/${str(fd.get("reportId"))}`], (s) => performAdminSuspend(s, { userId: str(fd.get("userId")), reportId: str(fd.get("reportId")), days: str(fd.get("days")) }));
}
export async function removeAccount(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/reports", `/admin/reports/${str(fd.get("reportId"))}`], (s) => performAdminRemove(s, { userId: str(fd.get("userId")), reportId: str(fd.get("reportId")) }));
}
export async function unsuspendUser(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/reports", `/admin/reports/${str(fd.get("reportId"))}`], (s) => performAdminUnsuspend(s, { userId: str(fd.get("userId")) }));
}
export async function addMeetupPoint(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/meetup-points"], (s) => performAdminAddPoint(s, Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"))));
}
export async function updateMeetupPoint(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/meetup-points"], (s) => performAdminUpdatePoint(s, Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"))));
}
export async function setMeetupStatus(_p: FormState, fd: FormData) {
  return run(fd, ["/admin/meetup-points"], (s) => performAdminSetPointStatus(s, { pointId: str(fd.get("pointId")), status: str(fd.get("status")) }));
}
