import Link from "next/link";
import { Icon } from "@/components/icons";
import { OfferActions } from "@/components/request/OfferActions";
import { WithdrawOfferButton } from "@/components/request/WithdrawOfferButton";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { UserRow } from "@/components/UserRow";
import type { OfferCardData } from "@/lib/data/types";
import { formatBackBy, formatDeparture } from "@/lib/format/time";
import { seatsLeftText } from "@/lib/format/trip";

const BADGE: Partial<Record<OfferCardData["status"], Status>> = {
  accepted: "accepted", declined: "declined", withdrawn: "cancelled", closed: "past", expired: "expired",
};
const BADGE_LABEL: Partial<Record<OfferCardData["status"], string>> = { closed: "Closed", withdrawn: "Withdrawn" };

// One driver's offer: who, which trip (time, meetup point, car), and their message. The plate and the exact
// spot are not here: they come with an accepted seat.
// `mode` is the viewer: the rider answers an offer; the driver can take their own back.
export function OfferCard({ offer, now, mode, showRequest = false }: { offer: OfferCardData; now: Date; mode: "rider" | "driver"; showRequest?: boolean }) {
  const o = offer;
  return (
    <li data-testid="offer" data-status={o.status} className="card p-4">
      {showRequest && o.requestName && (
        <p className="mb-3 text-sm text-muted">
          For your request to{" "}
          <Link href={`/request/${o.requestId}`} className="link">
            {o.requestName}
          </Link>
        </p>
      )}
      <UserRow person={o.driver} size={44} trailing={o.status !== "pending" && BADGE[o.status] ? <BadgeWithLabel status={o.status} /> : undefined} />
      <p className="t-h2 mt-4">{o.tripName}</p>
      <p className="tabular mt-1">
        {formatDeparture(o.departsAt, now)}
        {o.backBy && <span className="text-sm text-muted"> · {formatBackBy(o.backBy, o.departsAt, now)}</span>}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <Icon name="pin" size={16} />
        {o.meetupPointName}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        <Icon name="car" size={16} />
        {o.carColor} {o.carMake} · <span className="tabular">{seatsLeftText(o.seatsLeft)}</span>
      </p>
      {o.costNote && <p className="mt-1 text-sm text-muted">{o.costNote}</p>}
      {o.message && <p className="mt-3">&ldquo;{o.message}&rdquo;</p>}
      {o.status === "pending" && mode === "rider" && (
        <OfferActions offerId={o.id} tripId={o.tripId} requestId={o.requestId} driverName={o.driver.firstName} />
      )}
      {o.status === "pending" && mode === "driver" && <WithdrawOfferButton offerId={o.id} requestId={o.requestId} />}
    </li>
  );
}

function BadgeWithLabel({ status }: { status: OfferCardData["status"] }) {
  const label = BADGE_LABEL[status];
  if (!label) return <StatusBadge status={BADGE[status]!} />;
  return <span className="inline-flex shrink-0 items-center rounded-full border border-line px-[10px] py-[2px] text-xs font-bold text-muted">{label}</span>;
}
