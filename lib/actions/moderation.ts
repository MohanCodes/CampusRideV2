import type { SupabaseClient } from "@supabase/supabase-js";
import { errorCode, errorMessage } from "@/lib/errors";
import {
  adminReportStatusSchema, adminSuspendSchema, adminUserActionSchema, meetupPointSchema, meetupPointUpdateSchema,
  meetupStatusSchema, noShowSchema, reportSchema, userIdSchema,
} from "@/lib/schemas/moderation";
import type { ActionResult } from "./seat";

// The logic behind Report, Block, and the admin buttons, with the Supabase client passed in so it can be tested.
const bad = (issues: { path: PropertyKey[]; message: string }[]): ActionResult<never> => {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[String(i.path[0])] ??= i.message;
  return { ok: false, message: issues[0]?.message ?? errorMessage("invalid_request"), code: "invalid", fields };
};
const rpcFail = (error: unknown): ActionResult<never> => ({ ok: false, message: errorMessage(error), code: errorCode(error) });
const done: ActionResult = { ok: true, data: undefined };

export async function performFileReport(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = reportSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("file_report", {
    p_type: p.data.targetType, p_target: p.data.targetId, p_reason: p.data.reason,
    p_details: p.data.details || null, p_trip: p.data.tripId || null,
  });
  return error ? rpcFail(error) : done;
}

export async function performBlock(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = userIdSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("block_user", { p_user: p.data.userId });
  return error ? rpcFail(error) : done;
}

export async function performUnblock(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = userIdSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("unblock_user", { p_user: p.data.userId });
  return error ? rpcFail(error) : done;
}

export async function performNoShow(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = noShowSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("mark_no_show", { p_trip: p.data.tripId, p_rider: p.data.riderId });
  return error ? rpcFail(error) : done;
}

// Admin ----------------------------------------------------------------------------------------------------------------------
export async function performAdminSetStatus(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = adminReportStatusSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_set_report_status", { p_report: p.data.reportId, p_status: p.data.status });
  return error ? rpcFail(error) : done;
}

export async function performAdminWarn(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = adminUserActionSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_warn_user", { p_user: p.data.userId, p_report: p.data.reportId || null });
  return error ? rpcFail(error) : done;
}

export async function performAdminSuspend(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = adminSuspendSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_suspend_user", { p_user: p.data.userId, p_days: p.data.days, p_report: p.data.reportId || null });
  return error ? rpcFail(error) : done;
}

export async function performAdminRemove(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = adminUserActionSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_remove_account", { p_user: p.data.userId, p_report: p.data.reportId || null });
  return error ? rpcFail(error) : done;
}

export async function performAdminUnsuspend(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = userIdSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_unsuspend_user", { p_user: p.data.userId });
  return error ? rpcFail(error) : done;
}

export async function performAdminAddPoint(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = meetupPointSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_add_meetup_point", {
    p_campus: p.data.campusId, p_name: p.data.name, p_type: p.data.type, p_lat: p.data.lat, p_lng: p.data.lng,
    p_shared: p.data.shared === "on", p_stand_at: p.data.standAt,
  });
  return error ? rpcFail(error) : done;
}

export async function performAdminUpdatePoint(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = meetupPointUpdateSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_update_meetup_point", {
    p_id: p.data.pointId, p_name: p.data.name, p_type: p.data.type, p_lat: p.data.lat, p_lng: p.data.lng,
    p_shared: p.data.shared === "on", p_stand_at: p.data.standAt,
  });
  return error ? rpcFail(error) : done;
}

export async function performAdminSetPointStatus(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = meetupStatusSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("admin_set_meetup_status", { p_id: p.data.pointId, p_status: p.data.status });
  return error ? rpcFail(error) : done;
}
