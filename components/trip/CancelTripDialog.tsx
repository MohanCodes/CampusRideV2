"use client";

import { useActionState, useRef } from "react";
import { cancelTrip, type FormState } from "@/app/(app)/trip/[id]/actions";

export function CancelTripDialog({ tripId, hasRiders }: { tripId: string; hasRiders: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(cancelTrip, { status: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn-danger" onClick={() => dialog.current?.showModal()}>
        Cancel trip
      </button>
      <dialog ref={dialog} className="sheet" aria-labelledby="cancel-trip-title" data-testid="cancel-trip-dialog">
        <form action={action}>
          <input type="hidden" name="tripId" value={tripId} />
          <h2 id="cancel-trip-title" className="t-h2">Cancel this trip?</h2>
          <p className="mt-2 text-muted">
            {hasRiders ? "Everyone who asked for a seat will be told. " : "Nobody has asked for a seat yet. "}You can&apos;t undo this.
          </p>
          {state.status === "error" && <p role="alert" className="field-error mt-3">{state.message}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={() => dialog.current?.close()} autoFocus>
              Keep trip
            </button>
            <button type="submit" className="btn-danger" disabled={pending}>
              {pending ? "Cancelling…" : "Cancel trip"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
