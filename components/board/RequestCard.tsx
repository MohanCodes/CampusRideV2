import Link from "next/link";
import { Icon } from "@/components/icons";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import type { RequestCardData } from "@/lib/data/types";
import { formatWindow } from "@/lib/format/time";
import { seatsText } from "@/lib/format/trip";

// "In search of": a rider looking for a trip. The whole card opens the request, where a driver can offer a ride.
// `badge` and `note` are for the rider's own requests (My Rides); `href={null}` makes it read-only.
export function RequestCard({
  request, now, href = `/request/${request.id}`, badge, note,
}: { request: RequestCardData; now: Date; href?: string | null; badge?: Status; note?: string }) {
  const title = <>{request.destinationName}</>;
  return (
    <article data-testid="request-card" className="card relative p-4 transition-colors hover:border-green">
      <div className="flex items-start justify-between gap-3">
        <h3 className="t-h2 min-w-0">
          {href ? <Link href={href} className="stretched">{title}</Link> : title}
        </h3>
        {badge && <StatusBadge status={badge} />}
      </div>
      <p className="tabular mt-1 text-[1.0625rem]">{formatWindow(request.windowStart, request.windowEnd, request.flexibility, now)}</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <Icon name="pin" size={16} />
        <span className="min-w-0">{request.meetupPointName}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="tabular inline-flex items-center gap-2">
          <Icon name="users" size={16} />
          Needs {seatsText(request.seats)}
        </span>
        {request.chipIn && (
          <span className="inline-flex items-center gap-1 rounded-full border border-green bg-mint px-[10px] py-[2px] text-xs font-bold text-green">
            <Icon name="check" size={14} />
            Will chip in
          </span>
        )}
      </p>
      {request.note && <p className="mt-3 text-sm">{request.note}</p>}
      {note && <p className="mt-3 text-sm font-bold">{note}</p>}
      <div className="mt-4 border-t border-line pt-4">
        {request.isOwn ? <p className="text-sm font-bold">Your request</p> : <UserRow person={request.rider} />}
        {!request.isOwn && href && (
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-green">
            Offer a ride <span aria-hidden="true">↗</span>
          </p>
        )}
      </div>
    </article>
  );
}
