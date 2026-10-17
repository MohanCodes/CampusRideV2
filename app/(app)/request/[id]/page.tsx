import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { OfferCard } from "@/components/request/OfferCard";
import { OfferRideDialog } from "@/components/request/OfferRideDialog";
import { RequestOwnActions } from "@/components/request/RequestOwnActions";
import { SafetyMenu } from "@/components/safety/SafetyMenu";
import { FEATURES } from "@/lib/features";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState } from "@/components/states";
import { Toast } from "@/components/Toast";
import { UserRow } from "@/components/UserRow";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getRequestDetail, parseDemoRequestView } from "@/lib/data/requests";
import { getNow, isDemo } from "@/lib/demo";
import { formatWindow } from "@/lib/format/time";
import { seatsText } from "@/lib/format/trip";

export const metadata = { title: "Request — CampusRide" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RequestPage({ params, searchParams }: PageProps<"/request/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/request/${id}`);
  const signedIn = Boolean(await getUser());
  const res = await getRequestDetail(id, parseDemoRequestView(one(sp.as)));

  if (!res.ok) {
    return <AppShell signedIn={signedIn} demo={demo}><div className="mt-8"><ErrorState message="We couldn't load this request. Check your connection and try again." href={`/request/${id}`} /></div></AppShell>;
  }
  if (!res.data) notFound();
  const d = res.data;
  const r = d.request;
  const now = getNow();
  const open = d.status === "open";
  const pendingOffers = d.offers.filter((o) => o.status === "pending");
  const pastOffers = d.offers.filter((o) => o.status !== "pending");

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      {one(sp.posted) === "1" && <Toast message="Request posted. Drivers going your way will see it." />}
      {one(sp.offered) === "1" && <Toast message={`Offer sent. We'll let ${r.rider.firstName} know.`} />}

      <div className="mt-2 flex items-center justify-between gap-3">
        <Link href="/?tab=requests" className="inline-flex min-h-[44px] items-center gap-1 text-sm">
          <Icon name="back" size={16} />
          In search of
        </Link>
        {FEATURES.report && !d.isOwn && <SafetyMenu target={{ type: "request", id: r.id }} noun="request" person={{ id: r.rider.id, firstName: r.rider.firstName }} />}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-h1 text-[2.4rem] md:text-[3rem]">{r.destinationName}</h1>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={d.status === "matched" ? "matched" : d.status === "open" ? "open" : d.status === "expired" ? "expired" : "cancelled"} />
            <span className="tabular text-[1.0625rem]">{formatWindow(r.windowStart, r.windowEnd, r.flexibility, now)}</span>
          </p>

          <dl className="mt-6 divide-y divide-line border-y border-line">
            <Row label="Needs">
              <p className="tabular flex items-center gap-2"><Icon name="users" size={16} />{seatsText(r.seats)}</p>
              {r.chipIn && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-green bg-mint px-[10px] py-[2px] text-xs font-bold text-green">
                  <Icon name="check" size={14} />
                  Will chip in
                </p>
              )}
            </Row>
            <Row label="Meetup point">
              <p className="flex items-center gap-2"><Icon name="pin" size={16} />{r.meetupPointName}</p>
              <p className="mt-1 text-sm text-muted">The exact spot is shared once a ride is accepted.</p>
            </Row>
            {r.note && <Row label="Note"><p>{r.note}</p></Row>}
            <Row label="Rider" className="lg:hidden"><UserRow person={r.rider} size={44} linked /></Row>
          </dl>

          {d.isOwn && open && (
            <section aria-labelledby="offers-heading" className="mt-8">
              <h2 id="offers-heading" className="t-h2 mb-3">Offers</h2>
              {pendingOffers.length === 0 ? (
                <p className="text-muted" data-testid="no-offers">No offers yet. Drivers going your way will see your request, and we&apos;ll email you when one offers.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {pendingOffers.map((o) => <OfferCard key={o.id} offer={o} now={now} mode="rider" />)}
                </ul>
              )}
              {pastOffers.length > 0 && (
                <>
                  <h3 className="t-label mb-2 mt-8 text-muted">Answered</h3>
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {pastOffers.map((o) => <OfferCard key={o.id} offer={o} now={now} mode="rider" />)}
                  </ul>
                </>
              )}
            </section>
          )}

          {d.isOwn && d.status === "matched" && (
            <section className="mt-8 card p-4" data-testid="matched">
              <p className="flex items-center gap-2 font-bold"><StatusBadge status="matched" /> You have a ride.</p>
              <p className="mt-1 text-muted">The plate and the exact meetup spot are on the trip page.</p>
              {d.matchedTripId && <Link href={`/trip/${d.matchedTripId}`} className="btn-primary mt-4">View trip <span aria-hidden="true">↗</span></Link>}
            </section>
          )}
        </div>

        <aside aria-label="Rider and actions" className="lg:pt-[72px]">
          <div className="card hidden p-4 lg:block">
            <p className="t-label mb-3 text-muted">Rider</p>
            <UserRow person={r.rider} size={44} linked />
          </div>

          <div data-testid="request-actions" className="mt-4 space-y-3">
            {d.isOwn && open && <RequestOwnActions requestId={r.id} hasOffers={pendingOffers.length > 0} />}
            {d.isOwn && !open && d.status !== "matched" && (
              <>
                <p>This request is closed.</p>
                <Link href="/post/ask" className="btn-secondary">Ask for another ride</Link>
              </>
            )}
            {!d.isOwn && open && !d.myOffer && (
              <OfferRideDialog requestId={r.id} riderName={r.rider.firstName} options={d.tripOptions} nowIso={now.toISOString()} />
            )}
            {!d.isOwn && open && d.myOffer && (
              <div>
                <p className="mb-2 font-bold">You offered a ride.</p>
                <ul><OfferCard offer={d.myOffer} now={now} mode="driver" /></ul>
              </div>
            )}
            {!d.isOwn && !open && <p>This request isn&apos;t open anymore.</p>}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4 ${className}`}>
      <dt className="t-label pt-1 text-muted">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}
