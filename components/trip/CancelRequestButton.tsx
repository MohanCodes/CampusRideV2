"use client";

import { useActionState } from "react";
import { cancelSeatRequest, type FormState } from "@/app/(app)/trip/[id]/actions";

export function CancelRequestButton({ requestId, tripId, label = "Cancel request" }: { requestId: string; tripId: string; label?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(cancelSeatRequest, { status: "idle" });
  return (
    <form action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="tripId" value={tripId} />
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Cancelling…" : label}
      </button>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </form>
  );
}
