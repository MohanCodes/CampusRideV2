import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TripCard } from "@/components/board/TripCard";
import { EmptyState, ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getMyRides } from "@/lib/data/rides";
import { RIDE_TABS, groupRides, parseRideTab, rideBadge, type RideTab } from "@/lib/data/rides-logic";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { FEATURES } from "@/lib/features";

export const metadata = { title: "My Rides — CampusRide" };

const EMPTY: Record<RideTab, { title: string; body: string }> = {
  upcoming: { title: "No rides yet", body: "Find a ride or post one." },
  requests: { title: "No requests yet", body: "When you ask for a seat, it shows up here until the driver answers." },
  past: { title: "No past rides yet", body: "Trips you've driven or ridden on show up here after they happen." },
};

export default async function RidesPage({ searchParams }: PageProps<"/rides">) {
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded("/rides");
  const signedIn = Boolean(await getUser());
  const tab = parseRideTab(sp.tab);
  const now = getNow();
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getMyRides();
  const groups = res.ok ? groupRides(res.data, now) : null;

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <h1 className="t-h1 mb-6 mt-4 text-[2.4rem] md:text-[3rem]">My Rides</h1>

      <nav aria-label="My Rides sections" className="border-b border-line">
        <ul className="flex gap-6">
          {RIDE_TABS.map((t) => {
            const current = tab === t.id;
            return (
              <li key={t.id}>
                <Link
                  href={t.id === "upcoming" ? "/rides" : `/rides?tab=${t.id}`}
                  aria-current={current ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-[44px] items-center gap-2 border-b-2 px-1 text-[1.0625rem] ${current ? "border-green font-bold text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {t.label}
                  {groups && groups[t.id].length > 0 && <span className="tabular text-sm font-normal text-muted">{groups[t.id].length}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        {!groups ? (
          <ErrorState message="We couldn't load your rides. Check your connection and try again." href={`/rides${tab === "upcoming" ? "" : `?tab=${tab}`}`} />
        ) : groups[tab].length === 0 ? (
          <EmptyState title={EMPTY[tab].title} body={EMPTY[tab].body}>
            {tab === "upcoming" && (
              <>
                {FEATURES.post && (
                  <Link href="/post" className="btn-primary">
                    Post a trip <span aria-hidden="true">↗</span>
                  </Link>
                )}
                <Link href="/" className="btn-secondary">
                  Find a ride
                </Link>
              </>
            )}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-label={RIDE_TABS.find((t) => t.id === tab)!.label}>
            {groups[tab].map((r) => (
              <li key={r.trip.id + r.role} data-testid="ride-row" data-role={r.role}>
                <TripCard
                  trip={r.trip}
                  now={now}
                  badge={rideBadge(r, now)}
                  showDriver={r.role === "rider"}
                  note={
                    r.role === "driver"
                      ? r.pendingRequests > 0 && r.tripStatus === "open"
                        ? `${r.pendingRequests} ${r.pendingRequests === 1 ? "request" : "requests"} waiting`
                        : "You're driving"
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
