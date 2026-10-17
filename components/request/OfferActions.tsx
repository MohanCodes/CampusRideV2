"use client";

import { useActionState } from "react";
import { respondToOffer } from "@/app/(app)/request/[id]/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { Icon } from "@/components/icons";

// Accept or decline an offer. Accepting reserves the seat, so it takes the rider straight to the trip.
export function OfferActions({ offerId, tripId, requestId, driverName }: { offerId: string; tripId: string; requestId: string; driverName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(respondToOffer, { status: "idle" });
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="accept" value="1" className="btn-secondary" disabled={pending} aria-label={`Accept ${driverName}'s offer`}>
          <Icon name="check" size={16} />
          Accept
        </button>
        <button type="submit" name="accept" value="0" className="btn-danger" disabled={pending} aria-label={`Decline ${driverName}'s offer`}>
          Decline
        </button>
      </div>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </form>
  );
}
