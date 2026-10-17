"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { sendOffer } from "@/app/(app)/request/[id]/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import type { TripOption } from "@/lib/data/types";
import { formatDeparture } from "@/lib/format/time";
import { seatsLeftText } from "@/lib/format/trip";

// "Offer a ride": pick one of your own trips that fits, or post a new trip for this request.
// Only trips the database will accept are listed, so nobody picks one that is bound to be refused.
export function OfferRideDialog({ requestId, riderName, options, nowIso }: { requestId: string; riderName: string; options: TripOption[]; nowIso: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendOffer, { status: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  const [tripId, setTripId] = useState(options[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const now = new Date(nowIso);
  const warn = containsContactInfo(message) ? CONTACT_INFO_MESSAGE : undefined;
  const error = state.status === "error" ? state : null;

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => dialog.current?.showModal()}>
        Offer a ride <span aria-hidden="true">↗</span>
      </button>
      <dialog ref={dialog} className="sheet" aria-labelledby="offer-title" data-testid="offer-dialog">
        <form action={action} noValidate>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="tripId" value={tripId} />
          <h2 id="offer-title" className="t-h2">Offer a ride to {riderName}</h2>

          {options.length > 0 ? (
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-bold">Use one of your trips</legend>
              <ul className="space-y-2">
                {options.map((t) => (
                  <li key={t.id}>
                    <label className={`card flex min-h-[48px] cursor-pointer items-start gap-3 px-4 py-3 ${tripId === t.id ? "!border-green !bg-mint" : ""}`}>
                      <input type="radio" name="tripChoice" value={t.id} checked={tripId === t.id} onChange={() => setTripId(t.id)} className="mt-1 size-4 accent-[var(--green)]" />
                      <span className="min-w-0">
                        <span className="tabular block">{formatDeparture(t.departsAt, now)}</span>
                        <span className="block text-sm text-muted">{t.meetupPointName} · {seatsLeftText(t.seatsLeft)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <p className="mt-4 text-muted" data-testid="no-fitting-trips">
              You don&apos;t have a trip that fits this request yet.
            </p>
          )}

          {options.length > 0 && (
            <div className="mt-5">
              <label htmlFor="offer-message" className="mb-1 block text-sm font-bold">
                Message <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea id="offer-message" name="message" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="field"
                aria-invalid={warn ? true : undefined} aria-describedby="offer-note" />
              <p id="offer-note" role={warn ? "alert" : undefined} className={warn ? "field-error" : "mt-1 text-sm text-muted"}>
                {warn ?? "No phone numbers, emails, handles, or links. You can chat once it's accepted."}
              </p>
            </div>
          )}

          {error && <p role="alert" data-testid="offer-error" className="field-error mt-4">{error.message}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {options.length > 0 && (
              <button type="submit" className="btn-primary" disabled={pending || Boolean(warn)}>
                {pending ? "Sending…" : "Send offer"} <span aria-hidden="true">↗</span>
              </button>
            )}
            <Link href={`/post/offer?for=${requestId}`} className="btn-secondary">
              Post a new trip for this
            </Link>
            <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
