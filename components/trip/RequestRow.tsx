import Link from "next/link";
import { RequestActions } from "@/components/trip/RequestActions";
import { StatusBadge } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import type { IncomingRequest } from "@/lib/data/types";
import { formatDeparture } from "@/lib/format/time";
import { seatsText } from "@/lib/format/trip";

// One rider's request, as the driver sees it: who, how many seats, their message, and the answer buttons.
// `showTrip` adds the destination and time, for the Inbox where requests from several trips mix.
export function RequestRow({ request, now, showTrip = false }: { request: IncomingRequest; now: Date; showTrip?: boolean }) {
  const r = request;
  return (
    <li data-testid="seat-request" className="card p-4">
      {showTrip && (
        <p className="mb-3 text-sm text-muted">
          <Link href={`/trip/${r.tripId}`} className="link">
            {r.tripName}
          </Link>
          {" · "}
          <span className="tabular">{formatDeparture(r.departsAt, now)}</span>
        </p>
      )}
      <UserRow person={r.rider} size={44} trailing={r.status === "accepted" ? <StatusBadge status="accepted" /> : undefined} />
      <p className="tabular mt-3 text-sm">
        {r.rider.firstName} wants {seatsText(r.seats)}
        {r.status === "pending" && r.seatsLeft < r.seats ? " (only " + seatsText(r.seatsLeft) + " left)" : ""}.
      </p>
      {r.message && <p className="mt-2">&ldquo;{r.message}&rdquo;</p>}
      {r.status === "pending" && <RequestActions requestId={r.id} tripId={r.tripId} riderName={r.rider.firstName} />}
    </li>
  );
}
