"use client";

import { useActionState } from "react";
import { respondToRequest, type FormState } from "@/app/(app)/trip/[id]/actions";
import { Icon } from "@/components/icons";

// Accept and Decline for one seat request. The pressed button tells the server which one.
export function RequestActions({ requestId, tripId, riderName }: { requestId: string; tripId: string; riderName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(respondToRequest, { status: "idle" });
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="tripId" value={tripId} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="accept" value="1" className="btn-secondary" disabled={pending} aria-label={`Accept ${riderName}`}>
          <Icon name="check" size={16} />
          Accept
        </button>
        <button type="submit" name="accept" value="0" className="btn-danger" disabled={pending} aria-label={`Decline ${riderName}`}>
          Decline
        </button>
      </div>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </form>
  );
}
