"use client";

import { useActionState } from "react";
import { withdrawOffer } from "@/app/(app)/request/[id]/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";

export function WithdrawOfferButton({ offerId, requestId }: { offerId: string; requestId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(withdrawOffer, { status: "idle" });
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Withdrawing…" : "Withdraw offer"}
      </button>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </form>
  );
}
