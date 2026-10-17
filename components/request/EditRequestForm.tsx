"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateRequest } from "@/app/(app)/request/[id]/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { FlexibilityField } from "@/components/request/FlexibilityField";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import { localToUtc } from "@/lib/format/tz";
import type { Flexibility } from "@/lib/schemas/request";

const SEVEN_DAYS_MS = 7 * 24 * 3600_000;

// Edit request: time, flexibility, seats, chipping in, and the note. A different destination is a new request.
export function EditRequestForm({ requestId, destinationName, initial, minDate, maxDate, nowIso }: {
  requestId: string; destinationName: string; minDate: string; maxDate: string; nowIso: string;
  initial: { date: string; time: string; flexibility: Flexibility; seats: number; chipIn: boolean; note: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateRequest, { status: "idle" });
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [flex, setFlex] = useState(initial.flexibility);
  const [seats, setSeats] = useState(initial.seats);
  const [chipIn, setChipIn] = useState(initial.chipIn);
  const [note, setNote] = useState(initial.note);
  const fields: Record<string, string> = state.status === "error" ? (state.fields ?? {}) : {};

  const now = new Date(nowIso).getTime();
  const when = date && time ? localToUtc(date, time) : null;
  const timeError =
    date && time && !when ? "That time doesn't exist. Pick another."
    : when && when.getTime() <= now ? "That time has already passed. Pick a later one."
    : when && when.getTime() > now + SEVEN_DAYS_MS ? "Pick a time within the next 7 days."
    : fields.time;
  const noteWarn = containsContactInfo(note) ? CONTACT_INFO_MESSAGE : undefined;

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="seats" value={seats} />
      <p className="card p-4">
        <span className="t-label block text-muted">Going to</span>
        {destinationName}
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">When</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="mb-1 block text-sm text-muted">Date</label>
            <input id="date" name="date" type="date" min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
          </div>
          <div>
            <label htmlFor="time" className="mb-1 block text-sm text-muted">Around</label>
            <input id="time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
          </div>
        </div>
        <p id="time-error" role={timeError ? "alert" : undefined} className={timeError ? "field-error" : "sr-only"}>{timeError}</p>
      </fieldset>

      <FlexibilityField value={flex} onChange={setFlex} error={fields.flexibility} />

      <div>
        <p id="seats-label" className="mb-2 text-sm font-bold">Seats you need</p>
        <div role="group" aria-labelledby="seats-label" className="inline-flex items-center gap-2">
          <button type="button" className="btn-secondary !px-0 w-11" aria-label="Fewer seats" disabled={seats <= 1} onClick={() => setSeats((s) => s - 1)}>−</button>
          <output aria-live="polite" className="tabular w-10 text-center text-xl" data-testid="seats-value">{seats}</output>
          <button type="button" className="btn-secondary !px-0 w-11" aria-label="More seats" disabled={seats >= 3} onClick={() => setSeats((s) => s + 1)}>+</button>
        </div>
      </div>

      <label className="card flex min-h-[48px] cursor-pointer items-start gap-3 px-4 py-3">
        <input type="checkbox" name="chipIn" checked={chipIn} onChange={(e) => setChipIn(e.target.checked)} className="mt-1 size-4 accent-[var(--green)]" />
        <span className="font-bold">I&apos;ll chip in</span>
      </label>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-bold">Note <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="note" name="note" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="field"
          aria-invalid={noteWarn || fields.note ? true : undefined} aria-describedby="note-help" />
        <p id="note-help" role={noteWarn || fields.note ? "alert" : undefined} className={noteWarn || fields.note ? "field-error" : "mt-1 text-sm text-muted"}>
          {noteWarn ?? fields.note ?? "No phone numbers, emails, handles, or links."}
        </p>
      </div>

      {state.status === "error" && state.message && !Object.keys(fields).length && <p role="alert" className="field-error">{state.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={Boolean(timeError) || Boolean(noteWarn) || pending}>
          {pending ? "Saving…" : "Save changes"} <span aria-hidden="true">↗</span>
        </button>
        <Link href={`/request/${requestId}`} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
