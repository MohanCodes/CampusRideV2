"use client";

import { useActionState, useRef } from "react";
import { markNoShow } from "@/app/(app)/report/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";

type Sent = FormState & { sent?: boolean };

// "Rider didn't show": a driver files this after the departure time. It goes to the team; it does not
// charge anyone or change the trip (WEB_FLOWS.md Flow E).
export function NoShowButton({ tripId, riderId, riderName }: { tripId: string; riderId: string; riderName: string }) {
  const [state, action, pending] = useActionState<Sent, FormData>(markNoShow, { status: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  if (state.status === "idle" && state.sent) {
    return <p role="status" className="mt-3 text-sm text-muted" data-testid="no-show-sent">Thanks. We noted that {riderName} didn&apos;t show.</p>;
  }
  return (
    <>
      <button type="button" className="btn-secondary mt-3" onClick={() => dialog.current?.showModal()}>
        Rider didn&apos;t show
      </button>
      <dialog ref={dialog} className="sheet" aria-labelledby={`noshow-${riderId}`} data-testid="no-show-dialog">
        <form action={action}>
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="riderId" value={riderId} />
          <h2 id={`noshow-${riderId}`} className="t-h2">{riderName} didn&apos;t show?</h2>
          <p className="mt-2 text-muted">We&apos;ll send this to the team. Repeat no-shows get a warning, then a short pause.</p>
          {state.status === "error" && <p role="alert" className="field-error mt-3">{state.message}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()} autoFocus>Cancel</button>
            <button type="submit" className="btn-danger" disabled={pending}>{pending ? "Sending…" : "Send to the team"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
