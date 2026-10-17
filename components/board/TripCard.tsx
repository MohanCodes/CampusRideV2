import Link from "next/link";
import { Icon } from "@/components/icons";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import type { TripCardData } from "@/lib/data/types";
import { formatDeparture } from "@/lib/format/time";
import { seatsLeftText } from "@/lib/format/trip";

function statusOf(t: TripCardData): Status {
  if (t.myStatus === "accepted") return "accepted";
  if (t.myStatus === "pending") return "pending";
  if (t.myStatus === "declined") return "declined";
  return t.seatsLeft <= 0 ? "full" : "open";
}

// The card is one big link to the trip. `href={null}` makes it read-only (the sample cards on the landing page).
// `badge` overrides the status pill (My Rides passes the person's own role-aware status), `note` adds a
// line such as "2 requests waiting", and `showDriver={false}` leaves out the driver row on the person's own trips.
export function TripCard({
  trip, now, href = `/trip/${trip.id}`, badge, note, showDriver = true,
}: { trip: TripCardData; now: Date; href?: string | null; badge?: Status; note?: string; showDriver?: boolean }) {
  const title = <>{trip.destinationName}</>;
  return (
    <article data-testid="trip-card" className="card relative p-4 transition-colors hover:border-green">
      <div className="flex items-start justify-between gap-3">
        <h3 className="t-h2 min-w-0">
          {href ? (
            <Link href={href} className="stretched">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <StatusBadge status={badge ?? statusOf(trip)} />
      </div>
      <p className="tabular mt-1 text-[1.0625rem]">{formatDeparture(trip.departsAt, now)}</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <Icon name="pin" size={16} />
        <span className="min-w-0">{trip.meetupPointName}</span>
      </p>
      <p className="tabular mt-1 flex items-center gap-2 text-sm text-muted">
        <Icon name="users" size={16} />
        {seatsLeftText(trip.seatsLeft)}
      </p>
      {note && <p className="mt-3 text-sm font-bold">{note}</p>}
      {(showDriver || trip.costNote) && (
        <div className="mt-4 border-t border-line pt-4">
          {showDriver && <UserRow person={trip.driver} />}
          {trip.costNote && <p className={`${showDriver ? "mt-3 " : ""}text-sm text-muted`}>{trip.costNote}</p>}
        </div>
      )}
    </article>
  );
}
