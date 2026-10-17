import "server-only";
import { getNow, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { demoAuditLog, demoMeetupPoints, demoReportDetail, demoReportQueue } from "./mock";
import type { AdminPoint, AdminReportDetail, AdminReportRow, AuditRow, Result } from "./types";

// Admin reads go through admin_* database functions, which check the role themselves and log what they open.
type QueueRow = {
  id: string; created_at: string; status: AdminReportRow["status"]; reason: string; target_type: AdminReportRow["targetType"];
  details: string | null; reporter_first_name: string; target_user_id: string; target_first_name: string; target_report_count: number; target_no_show_count: number;
};

export async function getReportQueue(filters: { status?: string; reason?: string }): Promise<Result<AdminReportRow[]>> {
  if (isDemo()) return { ok: true, data: demoReportQueue(filters, getNow()) };
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false };
    const { data, error } = await supabase.rpc("admin_report_queue", { p_status: filters.status || null, p_reason: filters.reason || null, p_limit: 200 });
    if (error) return { ok: false };
    return {
      ok: true,
      data: ((data ?? []) as QueueRow[]).map((r) => ({
        id: r.id, createdAt: r.created_at, status: r.status, reason: r.reason, targetType: r.target_type, details: r.details,
        reporterFirstName: r.reporter_first_name, targetUserId: r.target_user_id, targetFirstName: r.target_first_name,
        reportCount: r.target_report_count, noShowCount: r.target_no_show_count,
      })),
    };
  } catch {
    return { ok: false };
  }
}

type Raw = Record<string, unknown>;
export async function getReportDetail(id: string): Promise<Result<AdminReportDetail | null>> {
  if (isDemo()) return { ok: true, data: demoReportDetail(id, getNow()) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false };
    const { data, error } = await supabase.rpc("admin_report_detail", { p_report: id });
    if (error) return error.message.includes("not_found") ? { ok: true, data: null } : { ok: false };
    const d = data as Raw & { report: Raw; reporter: Raw; target: Raw; trip: Raw | null; message: Raw | null; other_reports: Raw[]; no_show_count: number };
    return {
      ok: true,
      data: {
        report: { id: d.report.id as string, createdAt: d.report.created_at as string, status: d.report.status as AdminReportRow["status"], reason: d.report.reason as string, targetType: d.report.target_type as AdminReportRow["targetType"], details: d.report.details as string | null, handledAt: d.report.handled_at as string | null },
        reporter: { id: d.reporter.id as string, firstName: d.reporter.first_name as string, lastName: d.reporter.last_name as string | null, campusId: d.reporter.campus_id as string },
        target: {
          id: d.target.id as string, firstName: d.target.first_name as string | null, lastName: d.target.last_name as string | null, email: d.target.email as string,
          campusId: d.target.campus_id as string, classYear: d.target.class_year as number | null, bio: d.target.bio as string | null, role: d.target.role as string,
          suspendedUntil: d.target.suspended_until as string | null, deletedAt: d.target.deleted_at as string | null, createdAt: d.target.created_at as string,
        },
        trip: d.trip ? { id: d.trip.id as string, destinationName: d.trip.destination_name as string, departsAt: d.trip.departs_at as string, status: d.trip.status as string } : null,
        message: d.message ? { id: d.message.id as number, body: d.message.body as string, createdAt: d.message.created_at as string } : null,
        otherReports: (d.other_reports ?? []).map((o) => ({ id: o.id as string, reason: o.reason as string, status: o.status as string, createdAt: o.created_at as string })),
        noShowCount: d.no_show_count,
      },
    };
  } catch {
    return { ok: false };
  }
}

type PointRow = { id: string; campus_id: string; name: string; type: string; lat: number; lng: number; shared: boolean; status: AdminPoint["status"]; stand_at: string | null; trips_using: number };
export async function getMeetupPoints(): Promise<Result<AdminPoint[]>> {
  if (isDemo()) return { ok: true, data: demoMeetupPoints() };
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false };
    const { data, error } = await supabase.rpc("admin_meetup_points");
    if (error) return { ok: false };
    return {
      ok: true,
      data: ((data ?? []) as PointRow[]).map((p) => ({
        id: p.id, campusId: p.campus_id, name: p.name, type: p.type, lat: p.lat, lng: p.lng, shared: p.shared, status: p.status, standAt: p.stand_at, tripsUsing: Number(p.trips_using),
      })),
    };
  } catch {
    return { ok: false };
  }
}

type AuditRaw = { id: number; created_at: string; actor_first_name: string | null; action: string; target: string | null; details: Record<string, unknown> | null };
export async function getAuditLog(): Promise<Result<AuditRow[]>> {
  if (isDemo()) return { ok: true, data: demoAuditLog(getNow()) };
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false };
    const { data, error } = await supabase.rpc("admin_audit_log", { p_limit: 200 });
    if (error) return { ok: false };
    return { ok: true, data: ((data ?? []) as AuditRaw[]).map((a) => ({ id: Number(a.id), createdAt: a.created_at, actorFirstName: a.actor_first_name, action: a.action, target: a.target, details: a.details })) };
  } catch {
    return { ok: false };
  }
}
