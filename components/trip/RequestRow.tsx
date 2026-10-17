import Link from "next/link";
import { NoShowButton } from "@/components/trip/NoShowButton";
import { RequestActions } from "@/components/trip/RequestActions";
import { FEATURES } from "@/lib/features";
import { StatusBadge } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import type { IncomingRequest } from "@/lib/data/types";
import { formatDeparture } from "@/lib/format/time";
import { seatsText } from "@/lib/format/trip";

// One rider's request, as the driver sees it: who, how many seats, their message, and the answer buttons.
// `showTrip` adds the destination and time, for the Inbox where requests from several trips mix.
// `departed` means the trip has left: no more answering, and an accepted rider can be marked as not having shown.
export function RequestRow({ request, now, showTrip = false, departed = false }: { request: IncomingRequest; now: Date; showTrip?: boolean; departed?: boolean }) {
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
      <UserRow person={r.rider} size={44} linked={!showTrip} trailing={r.status === "accepted" ? <StatusBadge status="accepted" /> : undefined} />
      <p className="tabular mt-3 text-sm">
        {r.rider.firstName} wants {seatsText(r.seats)}
        {r.status === "pending" && r.seatsLeft < r.seats ? " (only " + seatsText(r.seatsLeft) + " left)" : ""}.
      </p>
      {r.message && <p className="mt-2">&ldquo;{r.message}&rdquo;</p>}
      {r.status === "accepted" && FEATURES.chat && r.conversationId && (
        <Link href={`/chat/${r.conversationId}`} className="btn-secondary mt-3">
          Message {r.rider.firstName}
        </Link>
      )}
      {r.status === "accepted" && departed && <NoShowButton tripId={r.tripId} riderId={r.rider.id} riderName={r.rider.firstName} />}
      {r.status === "pending" && !departed && <RequestActions requestId={r.id} tripId={r.tripId} riderName={r.rider.firstName} />}
    </li>
  );
}
