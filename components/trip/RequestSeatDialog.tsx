"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { requestSeat, type FormState } from "@/app/(app)/trip/[id]/actions";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import { seatsText } from "@/lib/format/trip";

// "Request a seat": a bottom sheet on phones and a modal on larger screens, over the trip page.
export function RequestSeatDialog({
  tripId, driverFirstName, seatsLeft, costNote, chip,
}: {
  tripId: string; driverFirstName: string; seatsLeft: number; costNote: string | null; chip: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestSeat, { status: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  const [seats, setSeats] = useState(1);
  const [message, setMessage] = useState("");
  const max = Math.max(1, Math.min(3, seatsLeft));

  const warn = containsContactInfo(message) ? CONTACT_INFO_MESSAGE : undefined;
  const error = state.status === "error" ? state : null;
  const messageError = warn ?? error?.fields?.message;
  const gone = error?.code === "trip_full" || error?.code === "trip_unavailable";

  return (
    <>
      <button type="button" className="btn-primary w-full justify-between md:w-auto" onClick={() => dialog.current?.showModal()}>
        Request a seat <span aria-hidden="true">↗</span>
      </button>

      <dialog ref={dialog} className="sheet" aria-labelledby="request-title" data-testid="request-dialog">
        <form action={action} noValidate>
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="seats" value={seats} />
          <h2 id="request-title" className="t-h2">Request a seat</h2>
          <p className="mt-1 text-muted">{driverFirstName} will get your request and can accept or decline.</p>

          <div className="mt-5">
            <p id="req-seats-label" className="mb-2 text-sm font-bold">Seats you need</p>
            <div role="group" aria-labelledby="req-seats-label" className="inline-flex items-center gap-2">
              <button type="button" className="btn-secondary !px-0 w-11" aria-label="Fewer seats" disabled={seats <= 1} onClick={() => setSeats((s) => Math.max(1, s - 1))}>−</button>
              <output aria-live="polite" className="tabular w-10 text-center text-xl" data-testid="request-seats">{seats}</output>
              <button type="button" className="btn-secondary !px-0 w-11" aria-label="More seats" disabled={seats >= max} onClick={() => setSeats((s) => Math.min(max, s + 1))}>+</button>
            </div>
            <p className="mt-1 text-sm text-muted">{seatsText(seatsLeft)} left on this trip.</p>
          </div>

          <div className="mt-5">
            <label htmlFor="request-message" className="mb-1 block text-sm font-bold">
              Message <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="request-message" name="message" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi, I just need Trader Joe's and back, no big bags" className="field"
              aria-invalid={messageError ? true : undefined} aria-describedby="request-message-note"
            />
            <p id="request-message-note" role={messageError ? "alert" : undefined} className={messageError ? "field-error" : "mt-1 text-sm text-muted"}>
              {messageError ?? "No phone numbers, emails, handles, or links. You can chat once you're accepted."}
            </p>
          </div>

          <p className="mt-4 text-sm text-muted" data-testid="cost-reminder">
            {costNote ? `${costNote}. ` : "Suggested: split gas and parking. "}You settle up with {driverFirstName} yourselves.
          </p>

          {error && !error.fields?.message && (
            <div role="alert" className="field-error mt-4" data-testid="request-error">
              {error.message}
              {gone && (
                <>
                  {" "}
                  <Link href={`/?chip=${encodeURIComponent(chip)}`} className="link">Find another trip</Link>
                </>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={pending || Boolean(warn)}>
              {pending ? "Sending…" : "Send request"} <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
