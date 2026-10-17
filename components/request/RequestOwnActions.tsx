"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { cancelRequest, extendRequest } from "@/app/(app)/request/[id]/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";

// What the rider can do with their own open request: change it, keep it open longer, or cancel it.
export function RequestOwnActions({ requestId, hasOffers }: { requestId: string; hasOffers: boolean }) {
  const [extendState, extend, extending] = useActionState<FormState, FormData>(extendRequest, { status: "idle" });
  const [cancelState, cancel, cancelling] = useActionState<FormState, FormData>(cancelRequest, { status: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/request/${requestId}/edit`} className="btn-secondary">Edit request</Link>
        <form action={extend}>
          <input type="hidden" name="requestId" value={requestId} />
          <button type="submit" className="btn-secondary" disabled={extending}>{extending ? "Extending…" : "Keep open 2 more hours"}</button>
        </form>
        <button type="button" className="btn-danger" onClick={() => dialog.current?.showModal()}>Cancel request</button>
      </div>
      {extendState.status === "error" && <p role="alert" className="field-error">{extendState.message}</p>}

      <dialog ref={dialog} className="sheet" aria-labelledby="cancel-request-title" data-testid="cancel-request-dialog">
        <form action={cancel}>
          <input type="hidden" name="requestId" value={requestId} />
          <h2 id="cancel-request-title" className="t-h2">Cancel this request?</h2>
          <p className="mt-2 text-muted">{hasOffers ? "Drivers who offered will be told. " : ""}You can post a new request any time.</p>
          {cancelState.status === "error" && <p role="alert" className="field-error mt-3">{cancelState.message}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => dialog.current?.close()} autoFocus>Keep request</button>
            <button type="submit" className="btn-danger" disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel request"}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
