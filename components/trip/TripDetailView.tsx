import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import { CancelRequestButton } from "@/components/trip/CancelRequestButton";
import { CancelTripDialog } from "@/components/trip/CancelTripDialog";
import { CopyTripDetails } from "@/components/trip/CopyTripDetails";
import { RequestRow } from "@/components/trip/RequestRow";
import { RequestSeatDialog } from "@/components/trip/RequestSeatDialog";
import { Toast } from "@/components/Toast";
import { MeetupMap } from "@/components/map/MeetupMap";
import type { TripDetail } from "@/lib/data/types";
import { FEATURES } from "@/lib/features";
import { formatBackBy, formatDeparture } from "@/lib/format/time";
import { seatsLeftText, tripSummary } from "@/lib/format/trip";

export function TripDetailView({ trip, now, signedIn, demo, sent = false }: { trip: TripDetail; now: Date; signedIn: boolean; demo: boolean; sent?: boolean }) {
  const revealed = trip.state === "accepted" || trip.state === "own";
  const when = formatDeparture(trip.departsAt, now);
  const findAnother = `/?chip=${encodeURIComponent(trip.chip)}`;

  return (
    <AppShell signedIn={signedIn} demo={demo} hideBottomNav>
      <Link href="/" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Board
      </Link>

      {sent && <Toast message={`Request sent. We'll let you know when ${trip.driver.firstName} replies.`} />}
      <div className="grid gap-8 pb-28 md:pb-0 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <h1 className="t-h1 text-[2.4rem] md:text-[3rem]">{trip.destinationName}</h1>

          <div className="mt-6">
            <MeetupMap
              fallbackName={trip.meetupPoint?.name ?? "Meetup point"}
              height={200}
              points={
                trip.meetupPoint && trip.meetupPoint.lat != null && trip.meetupPoint.lng != null
                  ? [{ id: trip.id, name: trip.meetupPoint.name, lat: trip.meetupPoint.lat, lng: trip.meetupPoint.lng }]
                  : []
              }
            />
          </div>

          <dl className="mt-6 divide-y divide-line border-y border-line">
            <Row label="When">
              <p className="tabular text-[1.0625rem]">{when}</p>
              {trip.backBy && <p className="tabular text-sm text-muted">{formatBackBy(trip.backBy, trip.departsAt, now)}</p>}
              <p className="tabular mt-1 flex items-center gap-2 text-sm text-muted">
                <Icon name="users" size={16} />
                {trip.seatsLeft > 0 ? seatsLeftText(trip.seatsLeft) : "No seats left"}
              </p>
            </Row>
            <Row label="Driver" className="lg:hidden">
              <UserRow person={trip.driver} size={44} />
            </Row>
            <Row label="Meetup point">
              <p className="flex items-center gap-2">
                <Icon name="pin" size={16} />
                {trip.meetupPoint?.name ?? "Meetup point"}
              </p>
              {revealed && trip.standAt ? (
                <p data-testid="stand-at" className="mt-1 text-sm">
                  Where to stand: {trip.standAt}
                </p>
              ) : (
                <p data-testid="stand-at-hidden" className="mt-1 text-sm text-muted">
                  Exact meeting spot is shared after the driver accepts.
                </p>
              )}
            </Row>
            <Row label="Car">
              <p className="flex items-center gap-2">
                <Icon name="car" size={16} />
                {trip.carColor} {trip.carMake}
              </p>
              {revealed && trip.plate ? (
                <p data-testid="plate" className="tabular mt-1 text-sm">
                  Plate: <strong>{trip.plate}</strong>
                </p>
              ) : (
                <p data-testid="plate-hidden" className="mt-1 text-sm text-muted">
                  Plate is shown after the driver accepts.
                </p>
              )}
            </Row>
            {(trip.costNote || trip.notes) && (
              <Row label="Notes">
                {trip.costNote && <p>{trip.costNote}</p>}
                {trip.notes && <p className={trip.costNote ? "mt-1 text-muted" : ""}>{trip.notes}</p>}
              </Row>
            )}
          </dl>

          {trip.state === "own" && trip.tripStatus === "open" && trip.requests && (
            <section aria-labelledby="requests-heading" className="mt-8">
              <h2 id="requests-heading" className="t-h2 mb-3">
                Requests
              </h2>
              {trip.requests.length === 0 ? (
                <p className="text-muted" data-testid="no-requests">
                  No one has asked for a seat yet. We&apos;ll email you when someone does.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {trip.requests.map((r) => (
                    <RequestRow key={r.id} request={r} now={now} />
                  ))}
                </ul>
              )}
            </section>
          )}

        </div>

        <aside aria-label="Driver and actions" className="lg:pt-[72px]">
          <div className="card hidden p-4 lg:block">
            <p className="t-label mb-3 text-muted">Driver</p>
            <UserRow person={trip.driver} size={44} />
          </div>

          <div
            data-testid="action-area"
            className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface p-4 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0"
          >
            <ActionArea trip={trip} when={when} findAnother={findAnother} />
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

// Each state says what happened and offers one next step. Buttons for parts that aren't built yet
// are disabled with the reason shown, never hidden and never a dead link.
function ActionArea({ trip, when, findAnother }: { trip: TripDetail; when: string; findAnother: string }) {
  const first = trip.driver.firstName;
  const status = (s: "pending" | "accepted" | "declined") => <StatusBadge status={s} />;

  switch (trip.state) {
    case "none":
      return (
        <RequestSeatDialog
          tripId={trip.id} driverFirstName={first} seatsLeft={trip.seatsLeft} costNote={trip.costNote} chip={trip.chip}
        />
      );
    case "pending":
      return (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2">
            {status("pending")} Request sent. We&apos;ll let you know when {first} replies.
          </p>
          {trip.myRequestId && <CancelRequestButton requestId={trip.myRequestId} tripId={trip.id} />}
        </div>
      );
    case "accepted":
      return (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2">
            {status("accepted")} {first} accepted your request.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {FEATURES.chat && trip.conversationId ? (
              <Link href={`/chat/${trip.conversationId}`} className="btn-primary">
                Message driver <span aria-hidden="true">↗</span>
              </Link>
            ) : (
              <button type="button" className="btn-primary" disabled>
                Message driver <span aria-hidden="true">↗</span>
              </button>
            )}
            <CopyTripDetails
              text={tripSummary({
                driverFirstName: first, carMake: trip.carMake, carColor: trip.carColor, plate: trip.plate ?? "",
                destination: trip.destinationName, when, meetupPoint: trip.meetupPoint?.name ?? "the meetup point", standAt: trip.standAt,
              })}
            />
          </div>
          {!trip.conversationId && <p className="text-sm text-muted">The chat isn&apos;t ready yet. Try again in a moment.</p>}
          {trip.myRequestId && <CancelRequestButton requestId={trip.myRequestId} tripId={trip.id} label="Cancel my seat" />}
        </div>
      );
    case "declined":
      return (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2">
            {status("declined")} {first} can&apos;t take you this time.
          </p>
          <Link href={findAnother} className="btn-secondary">
            Find another trip
          </Link>
        </div>
      );
    case "unavailable":
      return (
        <div className="space-y-3">
          <p>This trip isn&apos;t available.</p>
          <Link href={findAnother} className="btn-secondary">
            Find another trip
          </Link>
        </div>
      );
    case "own":
      if (trip.tripStatus === "cancelled") {
        return (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2">
              <StatusBadge status="cancelled" /> You cancelled this trip.
            </p>
            <Link href="/post/offer" className="btn-secondary">
              Post another trip
            </Link>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <p className="text-muted">This is your trip.</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/trip/${trip.id}/edit`} className="btn-secondary">
              Edit trip
            </Link>
            <CancelTripDialog tripId={trip.id} hasRiders={(trip.requests?.length ?? 0) > 0} />
          </div>
        </div>
      );
  }
}
