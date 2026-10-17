import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState } from "@/components/states";
import { requireAdmin } from "@/lib/auth/dal";
import { getReportQueue } from "@/lib/data/admin";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { formatDeparture } from "@/lib/format/time";
import { noShowSuggestion } from "@/lib/admin/policy";
import { REPORT_REASONS, REPORT_STATUSES } from "@/lib/schemas/moderation";
import { notFound } from "next/navigation";

export const metadata = { title: "Reports — CampusRide admin" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const STATUS_LABEL: Record<string, string> = { new: "New", reviewing: "Reviewing", actioned: "Actioned", dismissed: "Dismissed" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  if (isDemo() && one(sp.as) === "student") notFound(); // lets the not-found gate be reviewed in sample mode
  if (!isDemo()) await requireAdmin("/admin/reports");

  const status = REPORT_STATUSES.includes(one(sp.status) as never) ? one(sp.status) : undefined;
  const reason = REPORT_REASONS.includes(one(sp.reason) as never) ? one(sp.reason) : undefined;
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getReportQueue({ status, reason });
  const now = getNow();

  return (
    <AdminShell current="/admin/reports">
      <h1 className="t-h1 mb-6 text-[2.4rem] md:text-[3rem]">Reports</h1>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-4" aria-label="Filter reports">
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-bold">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="field">
            <option value="">All</option>
            {REPORT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="reason" className="mb-1 block text-sm font-bold">Reason</label>
          <select id="reason" name="reason" defaultValue={reason ?? ""} className="field">
            <option value="">All</option>
            {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Apply filters</button>
        {(status || reason) && <Link href="/admin/reports" className="link min-h-[44px] content-center text-sm">Clear filters</Link>}
      </form>

      {!res.ok ? (
        <ErrorState message="We couldn't load the reports. Check your connection and try again." href="/admin/reports" />
      ) : res.data.length === 0 ? (
        <EmptyState title="No reports" body={status || reason ? "Nothing matches these filters." : "Nothing has been reported."} />
      ) : (
        <ul className="grid grid-cols-1 gap-4" aria-label="Reports, newest first">
          {res.data.map((r) => {
            const hint = r.reason === "No-show" ? noShowSuggestion(r.noShowCount) : null;
            return (
              <li key={r.id} data-testid="report-row" data-status={r.status} className="card relative p-4 transition-colors hover:border-green">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="t-h2 min-w-0">
                    <Link href={`/admin/reports/${r.id}`} className="stretched">{r.reason}: {r.targetFirstName}</Link>
                  </h2>
                  <span className="inline-flex shrink-0 rounded-full border border-line px-[10px] py-[2px] text-xs font-bold">{STATUS_LABEL[r.status]}</span>
                </div>
                <p className="tabular mt-1 text-sm text-muted">
                  {r.targetType} report from {r.reporterFirstName} · {formatDeparture(r.createdAt, now)}
                </p>
                {r.details && <p className="mt-2 line-clamp-2">{r.details}</p>}
                <p className="tabular mt-3 text-sm">
                  {r.reportCount} {r.reportCount === 1 ? "report" : "reports"} against {r.targetFirstName}
                  {r.noShowCount > 0 && ` · ${r.noShowCount} ${r.noShowCount === 1 ? "no-show" : "no-shows"}`}
                </p>
                {hint && <p className="mt-1 text-sm font-bold" data-testid="policy-hint">{hint}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
