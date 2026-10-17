import { Icon } from "@/components/icons";
import { UserRow } from "@/components/UserRow";
import type { RequestCardData } from "@/lib/data/types";
import { formatWindow } from "@/lib/format/time";
import { seatsText } from "@/lib/format/trip";

// "In search of": a rider looking for a trip. The Offer a ride action arrives with Step 8.
export function RequestCard({ request, now }: { request: RequestCardData; now: Date }) {
  return (
    <article data-testid="request-card" className="card p-4">
      <h3 className="t-h2">{request.destinationName}</h3>
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
      <div className="mt-4 border-t border-line pt-4">
        <UserRow person={request.rider} />
      </div>
    </article>
  );
}
