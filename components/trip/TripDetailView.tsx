import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { SafetyNotice } from "@/components/SafetyNotice";
import { StatusBadge } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import { CopyTripDetails } from "@/components/trip/CopyTripDetails";
import { MeetupPointMap } from "@/components/trip/MeetupPointMap";
import type { TripDetail } from "@/lib/data/types";
import { FEATURES } from "@/lib/features";
import { formatBackBy, formatDeparture } from "@/lib/format/time";
import { seatsLeftText, tripSummary } from "@/lib/format/trip";

export function TripDetailView({ trip, now, signedIn, demo }: { trip: TripDetail; now: Date; signedIn: boolean; demo: boolean }) {
  const revealed = trip.state === "accepted" || trip.state === "own";
  const when = formatDeparture(trip.departsAt, now);
  const findAnother = `/?chip=${encodeURIComponent(trip.chip)}`;

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href="/" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Board
      </Link>

      <div className="grid gap-8 pb-28 md:pb-0 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <h1 className="t-h1 text-[2.4rem] md:text-[3rem]">{trip.destinationName}</h1>

          <div className="mt-6">
            <MeetupPointMap name={trip.meetupPoint?.name ?? "Meetup point"} />
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

          <div className="mt-8">
            <SafetyNotice />
          </div>
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
        <div>
          <button type="button" className="btn-primary w-full justify-between md:w-auto" disabled={!FEATURES.requestSeat}>
            Request a seat <span aria-hidden="true">↗</span>
          </button>
          {!FEATURES.requestSeat && <p className="mt-2 text-sm text-muted">Seat requests aren&apos;t open yet.</p>}
        </div>
      );
    case "pending":
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-2">
            {status("pending")} Request sent. We&apos;ll let you know when {first} replies.
          </p>
          <button type="button" className="btn-secondary" disabled={!FEATURES.requestSeat}>
            Cancel request
          </button>
        </div>
      );
    case "accepted":
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-2">
            {status("accepted")} {first} accepted your request.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={!FEATURES.chat}>
              Message driver <span aria-hidden="true">↗</span>
            </button>
            <CopyTripDetails
              text={tripSummary({
                driverFirstName: first, carMake: trip.carMake, carColor: trip.carColor, plate: trip.plate ?? "",
                destination: trip.destinationName, when, meetupPoint: trip.meetupPoint?.name ?? "the meetup point", standAt: trip.standAt,
              })}
            />
          </div>
          {!FEATURES.chat && <p className="text-sm text-muted">Chat isn&apos;t open yet.</p>}
        </div>
      );
    case "declined":
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-2">
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
      return (
        <div className="space-y-3">
          <p className="text-muted">This is your trip.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" disabled={!FEATURES.post}>
              Edit trip
            </button>
            <button type="button" className="btn-secondary" disabled={!FEATURES.requestSeat}>
              Cancel trip
            </button>
          </div>
          <p className="text-sm text-muted">Editing, cancelling, and seat requests aren&apos;t open yet.</p>
        </div>
      );
  }
}
