import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState } from "@/components/states";
import { requireAdmin } from "@/lib/auth/dal";
import { getAuditLog } from "@/lib/data/admin";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { formatDeparture } from "@/lib/format/time";

export const metadata = { title: "Audit log — CampusRide admin" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  if (!isDemo()) await requireAdmin("/admin/audit");
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getAuditLog();
  const now = getNow();
  return (
    <AdminShell current="/admin/audit">
      <h1 className="t-h1 mb-2 text-[2.4rem] md:text-[3rem]">Audit log</h1>
      <p className="mb-6 max-w-[64ch] text-muted">Every admin action, and every time a report or a full profile was opened. Newest first. Nothing here can be edited.</p>
      {!res.ok ? (
        <ErrorState message="We couldn't load the audit log. Check your connection and try again." href="/admin/audit" />
      ) : res.data.length === 0 ? (
        <EmptyState title="Nothing logged yet" />
      ) : (
        <ul className="divide-y divide-line border-y border-line" aria-label="Audit log">
          {res.data.map((a) => (
            <li key={a.id} data-testid="audit-row" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <span className="min-w-0"><strong>{a.actorFirstName ?? "Someone"}</strong> · {a.action.replaceAll("_", " ")}{a.target ? ` · ${a.target}` : ""}</span>
              <span className="tabular text-sm text-muted">{formatDeparture(a.createdAt, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
