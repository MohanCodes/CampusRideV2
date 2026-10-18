import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { BoardTabs } from "@/components/board/BoardTabs";
import { DestinationChips } from "@/components/board/DestinationChips";
import { RequestCard } from "@/components/board/RequestCard";
import { SearchBar } from "@/components/board/SearchBar";
import { TripCard } from "@/components/board/TripCard";
import { EmptyState, ErrorState, SkeletonGrid } from "@/components/states";
import { listRequests, listTrips } from "@/lib/data/board";
import { groupByDay } from "@/lib/data/apply";
import { filtersToQuery, hasActiveFilters, type BoardFilters } from "@/lib/data/filters";
import { getNow, isDemo } from "@/lib/demo";
import { FEATURES } from "@/lib/features";
import { dayKey, formatDayHeader } from "@/lib/format/time";

export function BoardPage({ filters, signedIn, forceError = false }: { filters: BoardFilters; signedIn: boolean; forceError?: boolean }) {
  const now = getNow();
  const addressKey = filtersToQuery(filters);
  return (
    <AppShell signedIn={signedIn} demo={isDemo()}>
      <p className="t-label mt-2 text-muted">The 5Cs community</p>
      <h1 className="t-h1 mb-6 mt-2 text-[2.4rem] md:text-[3rem]">Claremont Colleges</h1>

      <BoardTabs filters={filters} />
      <div className="mt-6">
        <DestinationChips filters={filters} />
      </div>

      <div className="mt-6">
        <SearchBar filters={filters} />
      </div>

      <section aria-label={filters.tab === "rides" ? "Rides" : "In search of"} className="mt-8">
        <Suspense key={addressKey} fallback={<SkeletonGrid />}>
          <BoardResults filters={filters} now={now} href={`/${addressKey}`} forceError={forceError} />
        </Suspense>
      </section>
    </AppShell>
  );
}

async function BoardResults({ filters, now, href, forceError }: { filters: BoardFilters; now: Date; href: string; forceError: boolean }) {
  const rides = filters.tab === "rides";
  const [tripsRes, requestsRes] = await Promise.all([
    rides ? listTrips(filters) : null,
    rides ? null : listRequests(filters),
  ]);
  const res = tripsRes ?? requestsRes;
  if (forceError || !res || !res.ok) {
    return <ErrorState message="We couldn't load the board. Check your connection and try again." href={href} />;
  }

  if (res.data.length === 0) {
    const place = filters.chip === "All" ? "" : ` to ${filters.chip}`;
    const clear = hasActiveFilters(filters) && (
      <Link
        href={`/${filtersToQuery(filters, { chip: "All", q: "" })}`}
        className="btn-secondary"
      >
        Clear search
      </Link>
    );
    return rides ? (
      <EmptyState
        title={`No rides${place} yet`}
        body={FEATURES.post ? "Be the first to post one." : "Check back soon, or try a different day."}
      >
        {FEATURES.post && (
          <Link href="/post" className="btn-primary">
            Post a trip <span aria-hidden="true">↗</span>
          </Link>
        )}
        {FEATURES.inSearchOf && (
          <Link href="/post/ask" className="btn-secondary">
            Ask for a ride
          </Link>
        )}
        {clear}
      </EmptyState>
    ) : (
      <EmptyState title={`No one is looking for a ride${place} yet`} body="When a student asks for a ride, it shows up here.">
        {clear}
      </EmptyState>
    );
  }

  const count = res.data.length;
  const label = rides ? (count === 1 ? "1 ride" : `${count} rides`) : count === 1 ? "1 request" : `${count} requests`;

  return (
    <div className="space-y-8">
      <p aria-live="polite" className="sr-only">
        {label} found
      </p>
      {tripsRes?.ok &&
        groupByDay(tripsRes.data, (t) => t.departsAt, (iso) => dayKey(iso)).map((g) => (
          <DayGroup key={g.key} dayKey={g.key} now={now}>
            {g.items.map((t) => (
              <TripCard key={t.id} trip={t} now={now} />
            ))}
          </DayGroup>
        ))}
      {requestsRes?.ok &&
        groupByDay(requestsRes.data, (r) => r.windowStart, (iso) => dayKey(iso)).map((g) => (
          <DayGroup key={g.key} dayKey={g.key} now={now}>
            {g.items.map((r) => (
              <RequestCard key={r.id} request={r} now={now} />
            ))}
          </DayGroup>
        ))}
    </div>
  );
}

function DayGroup({ dayKey: key, now, children }: { dayKey: string; now: Date; children: ReactNode }) {
  return (
    <section aria-labelledby={`day-${key}`}>
      <h2 id={`day-${key}`} className="t-h2 mb-3 border-b border-line pb-2">
        {formatDayHeader(key, now)}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">{children}</div>
    </section>
  );
}
