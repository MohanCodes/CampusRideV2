import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ReportActions } from "@/components/admin/ReportActions";
import { Icon } from "@/components/icons";
import { ErrorState } from "@/components/states";
import { campusShortName } from "@/lib/campuses";
import { requireAdmin } from "@/lib/auth/dal";
import { noShowSuggestion } from "@/lib/admin/policy";
import { getReportDetail } from "@/lib/data/admin";
import { getNow, isDemo } from "@/lib/demo";
import { formatDeparture } from "@/lib/format/time";

export const metadata = { title: "Report — CampusRide admin" };
const STATUS_LABEL: Record<string, string> = { new: "New", reviewing: "Reviewing", actioned: "Actioned", dismissed: "Dismissed" };

export default async function ReportPage({ params }: PageProps<"/admin/reports/[id]">) {
  const { id } = await params;
  if (!isDemo()) await requireAdmin(`/admin/reports/${id}`);
  const res = await getReportDetail(id);
  const now = getNow();

  if (!res.ok) {
    return <AdminShell current="/admin/reports"><ErrorState message="We couldn't load this report. Check your connection and try again." href={`/admin/reports/${id}`} /></AdminShell>;
  }
  if (!res.data) notFound();
  const d = res.data;
  const t = d.target;
  const name = t.firstName ?? "this person";
  const hint = d.report.reason === "No-show" ? noShowSuggestion(d.noShowCount) : null;
  const suspended = Boolean(t.suspendedUntil && new Date(t.suspendedUntil) > now);

  return (
    <AdminShell current="/admin/reports">
      <Link href="/admin/reports" className="inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Reports
      </Link>
      <h1 className="t-h1 mb-2 text-[2.4rem] md:text-[3rem]">{d.report.reason}: {name}</h1>
      <p className="tabular mb-6 text-muted" data-testid="report-meta">
        {STATUS_LABEL[d.report.status]} · {d.report.targetType} report · {formatDeparture(d.report.createdAt, now)}
      </p>
      <p role="note" className="card mb-6 max-w-[68ch] p-4 text-sm" data-testid="audit-note">
        Opening this page was recorded in the audit log. It shows full names and an email address, so use them only for this review.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="what-heading">
            <h2 id="what-heading" className="t-h2 mb-3">What was reported</h2>
            <dl className="divide-y divide-line border-y border-line">
              <Row label="Reason">{d.report.reason}</Row>
              <Row label="Details">{d.report.details ? <p className="whitespace-pre-wrap">{d.report.details}</p> : <span className="text-muted">None given.</span>}</Row>
              {d.trip && <Row label="Trip"><p>{d.trip.destinationName}</p><p className="tabular text-sm text-muted">{formatDeparture(d.trip.departsAt, now)} · {d.trip.status}</p></Row>}
              {d.message && <Row label="Message"><p className="whitespace-pre-wrap">&ldquo;{d.message.body}&rdquo;</p></Row>}
              <Row label="Reported by">{d.reporter.firstName} {d.reporter.lastName} · {campusShortName(d.reporter.campusId)}</Row>
            </dl>
          </section>

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="t-h2 mb-3">Other reports against {name}</h2>
            {d.otherReports.length === 0 ? (
              <p className="text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line" data-testid="other-reports">
                {d.otherReports.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/admin/reports/${o.id}`} className="link">{o.reason}</Link>
                    <span className="tabular text-sm text-muted">{STATUS_LABEL[o.status] ?? o.status} · {formatDeparture(o.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside aria-label="Person and actions" className="space-y-6">
          <section className="card p-4" aria-labelledby="person-heading" data-testid="target-profile">
            <h2 id="person-heading" className="t-label mb-3 text-muted">Person reported</h2>
            <p className="font-bold">{t.firstName} {t.lastName}</p>
            <p className="text-sm text-muted">{t.email}</p>
            <p className="mt-1 text-sm text-muted">{campusShortName(t.campusId)}{t.classYear ? ` · class of ${t.classYear}` : ""}</p>
            {t.bio && <p className="mt-2 text-sm">{t.bio}</p>}
            {suspended && <p className="tabular mt-2 text-sm font-bold">Suspended until {formatDeparture(t.suspendedUntil!, now)}</p>}
            {t.deletedAt && <p className="mt-2 text-sm font-bold">Account removed.</p>}
          </section>

          <section aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="t-h2 mb-2">Actions</h2>
            <p className="tabular mb-3 text-sm text-muted" data-testid="no-show-count">{d.noShowCount} {d.noShowCount === 1 ? "no-show" : "no-shows"} on record</p>
            {hint && <p className="mb-3 font-bold" data-testid="policy-hint">{hint}</p>}
            {!t.deletedAt && t.role !== "admin" ? (
              <ReportActions reportId={d.report.id} userId={t.id} targetName={name} status={d.report.status} suspended={suspended} />
            ) : (
              <p className="text-muted">No actions are available for this account.</p>
            )}
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="t-label pt-1 text-muted">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}
