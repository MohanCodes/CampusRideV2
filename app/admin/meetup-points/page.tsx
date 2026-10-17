import { AdminShell } from "@/components/admin/AdminShell";
import { MeetupPointForm } from "@/components/admin/MeetupPointForm";
import { PointStatusButtons } from "@/components/admin/PointStatusButtons";
import { ErrorState } from "@/components/states";
import { campusShortName } from "@/lib/campuses";
import { requireAdmin } from "@/lib/auth/dal";
import { getMeetupPoints } from "@/lib/data/admin";
import type { AdminPoint } from "@/lib/data/types";
import { demoForcesError, isDemo } from "@/lib/demo";

export const metadata = { title: "Meetup points — CampusRide admin" };
const BADGE: Record<string, string> = { approved: "border-green bg-mint text-green", suspended: "border-line text-muted", retired: "border-line text-muted" };

export default async function MeetupPointsPage({ searchParams }: PageProps<"/admin/meetup-points">) {
  const sp = await searchParams;
  if (!isDemo()) await requireAdmin("/admin/meetup-points");
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getMeetupPoints();
  const byCampus = new Map<string, AdminPoint[]>();
  if (res.ok) for (const p of res.data) byCampus.set(p.campusId, [...(byCampus.get(p.campusId) ?? []), p]);

  return (
    <AdminShell current="/admin/meetup-points">
      <h1 className="t-h1 mb-2 text-[2.4rem] md:text-[3rem]">Meetup points</h1>
      <p className="mb-6 max-w-[64ch] text-muted">Trips and requests can only use an approved point. Suspending one takes it off new trips; trips that already use it keep it.</p>

      <details className="card mb-8 p-4" data-testid="add-point">
        <summary className="min-h-[44px] cursor-pointer font-bold leading-[44px]">Add a meetup point</summary>
        <div className="mt-4"><MeetupPointForm /></div>
      </details>

      {!res.ok ? (
        <ErrorState message="We couldn't load the meetup points. Check your connection and try again." href="/admin/meetup-points" />
      ) : (
        [...byCampus.entries()].map(([campus, points]) => (
          <section key={campus} aria-labelledby={`campus-${campus}`} className="mb-10">
            <h2 id={`campus-${campus}`} className="t-h2 mb-3 border-b border-line pb-2">{campusShortName(campus)}</h2>
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {points.map((p) => (
                <li key={p.id} data-testid="point-row" data-status={p.status} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="t-h2 min-w-0">{p.name}</h3>
                    <span className={`inline-flex shrink-0 rounded-full border px-[10px] py-[2px] text-xs font-bold ${BADGE[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="tabular mt-1 text-sm text-muted">{p.type}{p.shared ? " · shared" : ""} · {p.tripsUsing} {p.tripsUsing === 1 ? "trip uses" : "trips use"} it</p>
                  <p className="mt-2 text-sm">{p.standAt ?? <span className="text-muted">No stand-at text yet.</span>}</p>
                  <div className="mt-4"><PointStatusButtons pointId={p.id} status={p.status} /></div>
                  <details className="mt-3">
                    <summary className="min-h-[44px] cursor-pointer text-sm font-bold leading-[44px]">Edit</summary>
                    <div className="mt-3"><MeetupPointForm point={p} /></div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </AdminShell>
  );
}
