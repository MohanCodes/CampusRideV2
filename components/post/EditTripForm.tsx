"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { updateTrip, type FormState } from "@/app/(app)/trip/[id]/actions";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import { localToUtc } from "@/lib/format/tz";

type Initial = { date: string; time: string; backBy: string; seats: number; costNote: string; notes: string };

// Edit trip: time, back-by, seats, cost note, notes. The destination, meetup point, and car stay as
// posted, because riders agreed to those. Seats can't go below the riders already accepted.
export function EditTripForm({ tripId, initial, seatsTaken, nowIso, minDate }: { tripId: string; initial: Initial; seatsTaken: number; nowIso: string; minDate: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateTrip, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [backBy, setBackBy] = useState(initial.backBy);
  const [seats, setSeats] = useState(initial.seats);
  const [cost, setCost] = useState(initial.costNote);
  const [notes, setNotes] = useState(initial.notes);
  const [confirm, setConfirm] = useState(false);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  const when = date && time ? localToUtc(date, time) : null;
  const clientTimeError = date && time && !when ? "That time doesn't exist. Pick another." : when && when.getTime() <= new Date(nowIso).getTime() ? "That time has already passed. Pick a later one." : undefined;
  const timeError = clientTimeError ?? fields.time;
  const costWarn = containsContactInfo(cost) ? CONTACT_INFO_MESSAGE : undefined;
  const notesWarn = containsContactInfo(notes) || containsContactInfo(`${cost} ${notes}`) ? CONTACT_INFO_MESSAGE : undefined;
  const ready = !clientTimeError && !costWarn && !notesWarn && seats >= seatsTaken;

  return (
    <form ref={form} action={(fd) => { if (confirm) fd.set("confirmOverlap", "1"); action(fd); }} className="space-y-8" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="seats" value={seats} />

      <fieldset>
        <legend className="mb-2 text-sm font-bold">When</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="mb-1 block text-sm text-muted">Date</label>
            <input id="date" name="date" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
          </div>
          <div>
            <label htmlFor="time" className="mb-1 block text-sm text-muted">Leave at</label>
            <input id="time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
          </div>
        </div>
        <p id="time-error" role={timeError ? "alert" : undefined} className={timeError ? "field-error" : "sr-only"}>{timeError}</p>
        <div className="mt-4 max-w-[220px]">
          <label htmlFor="backByTime" className="mb-1 block text-sm text-muted">Back by <span>(optional)</span></label>
          <input id="backByTime" name="backByTime" type="time" value={backBy} onChange={(e) => setBackBy(e.target.value)} className="field" />
        </div>
        <p className="mt-2 text-sm text-muted">Riders who already asked will get an email if you change the time.</p>
      </fieldset>

      <div>
        <p id="seats-label" className="mb-2 text-sm font-bold">Seats open</p>
        <div role="group" aria-labelledby="seats-label" className="inline-flex items-center gap-2">
          <button type="button" className="btn-secondary !px-0 w-11" aria-label="Fewer seats" disabled={seats <= Math.max(1, seatsTaken)} onClick={() => setSeats((s) => s - 1)}>−</button>
          <output aria-live="polite" className="tabular w-10 text-center text-xl" data-testid="seats-value">{seats}</output>
          <button type="button" className="btn-secondary !px-0 w-11" aria-label="More seats" disabled={seats >= 6} onClick={() => setSeats((s) => s + 1)}>+</button>
        </div>
        <p className="mt-1 text-sm text-muted">{seatsTaken > 0 ? `${seatsTaken} already taken, so you can't go below that.` : "Up to 6."}</p>
        {fields.seats && <p role="alert" className="field-error">{fields.seats}</p>}
      </div>

      <div>
        <label htmlFor="costNote" className="mb-1 block text-sm font-bold">Cost note <span className="font-normal text-muted">(optional)</span></label>
        <input id="costNote" name="costNote" value={cost} onChange={(e) => setCost(e.target.value)} maxLength={200} className="field" aria-invalid={costWarn || fields.costNote ? true : undefined} aria-describedby="cost-note" />
        <p id="cost-note" role={costWarn || fields.costNote ? "alert" : undefined} className={costWarn || fields.costNote ? "field-error" : "mt-1 text-sm text-muted"}>
          {costWarn ?? fields.costNote ?? "Suggest a split of gas and parking, never a profit."}
        </p>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-bold">Notes <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="notes" name="notes" rows={3} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="field" aria-invalid={notesWarn || fields.notes ? true : undefined} aria-describedby="notes-help" />
        <p id="notes-help" role={notesWarn || fields.notes ? "alert" : undefined} className={notesWarn || fields.notes ? "field-error" : "mt-1 text-sm text-muted"}>
          {notesWarn ?? fields.notes ?? "No phone numbers, emails, handles, or links."}
        </p>
      </div>

      {state.status === "overlap" && (
        <div role="alert" data-testid="overlap" className="card border-danger p-4">
          <p className="font-bold">You already have a trip at this time.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => setConfirm(false)}>Edit trip</button>
            <button type="button" className="btn-secondary" onClick={() => { setConfirm(true); setTimeout(() => form.current?.requestSubmit(), 0); }}>Save anyway</button>
          </div>
        </div>
      )}
      {state.status === "error" && !Object.keys(fields).length && <p role="alert" className="field-error">{state.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!ready || pending}>
          {pending ? "Saving…" : "Save changes"} <span aria-hidden="true">↗</span>
        </button>
        <Link href={`/trip/${tripId}`} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
