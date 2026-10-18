"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { postTrip, type PostTripState } from "@/app/(app)/post/actions";
import { DestinationPicker, type Destination } from "@/components/post/DestinationPicker";
import { MeetupPointPicker } from "@/components/post/MeetupPointPicker";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import type { MeetupOption, PlaceOption } from "@/lib/data/post";
import { localToUtc } from "@/lib/format/tz";

type Props = {
  places: PlaceOption[]; points: MeetupOption[]; campusId: string;
  defaults: { date: string; time: string; meetupPointId: string };
  // When the trip answers a request, its destination is already chosen and the offer goes out with it.
  forRequest?: { id: string; destination: Destination | null };
  // The server's clock when the page was made. The server checks the time again on submit.
  nowIso: string;
};

// "Offer a ride": one scrolling form with smart defaults (next half hour, 3 seats, last used meetup point).
export function OfferForm({ places, points, campusId, defaults, nowIso, forRequest }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PostTripState, FormData>(postTrip, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const initialDestination = forRequest?.destination ?? null;
  const [destination, setDestination] = useState<Destination | null>(initialDestination);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [backBy, setBackBy] = useState("");
  const [seats, setSeats] = useState(3);
  // A remembered meetup point only counts while it is still in the list of approved points.
  const initialPoint = points.some((p) => p.id === defaults.meetupPointId) ? defaults.meetupPointId : "";
  const [pointId, setPointId] = useState(initialPoint);
  const [make, setMake] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOverlap, setConfirmOverlap] = useState(false);

  const fieldErrors = state.status === "error" ? (state.fields ?? {}) : {};

  // Warn before the browser tab closes with a half-filled trip.
  const dirty = Boolean(destination !== initialDestination || backBy || make || color || plate || cost || notes || seats !== 3 || date !== defaults.date || time !== defaults.time || pointId !== initialPoint);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // A time that has already passed gets an inline error before anything is sent.
  const when = date && time ? localToUtc(date, time) : null;
  const clientTimeError =
    date && time && !when ? "That time doesn't exist. Pick another." : when && when.getTime() <= new Date(nowIso).getTime() ? "That time has already passed. Pick a later one." : undefined;
  const timeError = clientTimeError ?? fieldErrors.time;

  const costWarning = containsContactInfo(cost) ? CONTACT_INFO_MESSAGE : undefined;
  const notesWarning = containsContactInfo(notes) || containsContactInfo(`${cost} ${notes}`) ? CONTACT_INFO_MESSAGE : undefined;

  const ready = Boolean(destination && date && time && pointId && !clientTimeError);
  const disabledReason = !destination ? "Pick where you're going." : !pointId ? "Pick a meetup point." : clientTimeError ? clientTimeError : !date || !time ? "Pick a date and time." : null;

  function leave() {
    if (dirty) dialog.current?.showModal();
    else router.push("/post");
  }

  return (
    <>
      <form
        ref={form}
        action={(fd) => {
          if (confirmOverlap) fd.set("confirmOverlap", "1");
          action(fd);
        }}
        className="grid gap-x-12 gap-y-8 lg:grid-cols-2"
        noValidate
      >
        <input type="hidden" name="destinationKind" value={destination?.kind ?? ""} />
        <input type="hidden" name="placeId" value={destination?.kind === "place" ? destination.placeId : ""} />
        <input type="hidden" name="mapboxId" value={destination?.kind === "other" ? destination.mapboxId : ""} />
        <input type="hidden" name="sessionToken" value={destination?.kind === "other" ? destination.sessionToken : ""} />
        <input type="hidden" name="meetupPointId" value={pointId} />
        <input type="hidden" name="seats" value={seats} />
        {forRequest && <input type="hidden" name="forRequest" value={forRequest.id} />}

<div className="space-y-8">
        <DestinationPicker places={places} value={destination} onChange={setDestination} error={fieldErrors.destination} />

        <MeetupPointPicker points={points} campusId={campusId} value={pointId} onChange={setPointId} error={fieldErrors.meetupPointId} />
</div>

<div className="space-y-8">

        <fieldset>
          <legend className="mb-2 text-sm font-bold">When</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="date" className="mb-1 block text-sm text-muted">Date</label>
              <input id="date" name="date" type="date" min={defaults.date} value={date} onChange={(e) => setDate(e.target.value)} className="field" aria-invalid={timeError || fieldErrors.date ? true : undefined} aria-describedby="time-error" />
            </div>
            <div>
              <label htmlFor="time" className="mb-1 block text-sm text-muted">Leave at</label>
              <input id="time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
            </div>
          </div>
          <p id="time-error" role={timeError ? "alert" : undefined} className={timeError ? "field-error" : "sr-only"}>{timeError ?? fieldErrors.date}</p>
          <div className="mt-4 max-w-[220px]">
            <label htmlFor="backByTime" className="mb-1 block text-sm text-muted">Back by <span>(optional)</span></label>
            <input id="backByTime" name="backByTime" type="time" value={backBy} onChange={(e) => setBackBy(e.target.value)} className="field" aria-describedby="backby-error" aria-invalid={fieldErrors.backByTime ? true : undefined} />
            {fieldErrors.backByTime && <p id="backby-error" role="alert" className="field-error">{fieldErrors.backByTime}</p>}
          </div>
        </fieldset>

        <div>
          <p id="seats-label" className="mb-2 text-sm font-bold">Seats open</p>
          <div role="group" aria-labelledby="seats-label" className="inline-flex items-center gap-2">
            <button type="button" className="btn-secondary !px-0 w-11" aria-label="Fewer seats" disabled={seats <= 1} onClick={() => setSeats((s) => Math.max(1, s - 1))}>−</button>
            <output aria-live="polite" className="tabular w-10 text-center text-xl" data-testid="seats-value">{seats}</output>
            <button type="button" className="btn-secondary !px-0 w-11" aria-label="More seats" disabled={seats >= 6} onClick={() => setSeats((s) => Math.min(6, s + 1))}>+</button>
          </div>
          <p className="mt-1 text-sm text-muted">Up to 6.</p>
        </div>


        <fieldset>
          <legend className="mb-2 text-sm font-bold">Car</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="carMake" label="Make" value={make} onChange={setMake} error={fieldErrors.carMake} autoComplete="off" />
            <Field id="carColor" label="Color" value={color} onChange={setColor} error={fieldErrors.carColor} autoComplete="off" />
            <Field id="carPlate" label="Plate" value={plate} onChange={setPlate} error={fieldErrors.carPlate} autoComplete="off" upper />
          </div>
          <p className="mt-2 text-sm text-muted">The plate is only shown to riders you accept.</p>
        </fieldset>

        <div>
          <label htmlFor="costNote" className="mb-1 block text-sm font-bold">Cost note <span className="font-normal text-muted">(optional)</span></label>
          <input id="costNote" name="costNote" value={cost} onChange={(e) => setCost(e.target.value)} maxLength={200} className="field" placeholder="Suggested: split gas and parking, no profit" aria-invalid={costWarning || fieldErrors.costNote ? true : undefined} aria-describedby="cost-note" />
          <p id="cost-note" role={costWarning || fieldErrors.costNote ? "alert" : undefined} className={costWarning || fieldErrors.costNote ? "field-error" : "mt-1 text-sm text-muted"}>
            {costWarning ?? fieldErrors.costNote ?? "Riders and drivers settle up on their own. Suggest a split of gas and parking, never a profit."}
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-bold">Notes <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" name="notes" rows={3} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="field" aria-invalid={notesWarning || fieldErrors.notes ? true : undefined} aria-describedby="notes-help" />
          <p id="notes-help" role={notesWarning || fieldErrors.notes ? "alert" : undefined} className={notesWarning || fieldErrors.notes ? "field-error" : "mt-1 text-sm text-muted"}>
            {notesWarning ?? fieldErrors.notes ?? "No phone numbers, emails, handles, or links. Use the chat once someone joins."}
          </p>
        </div>

        </div>

<div className="space-y-8 lg:col-span-2">
{state.status === "overlap" && (
          <div role="alert" data-testid="overlap" className="card border-danger p-4">
            <p className="font-bold">You already have a trip at this time.</p>
            <p className="mt-1 text-sm text-muted">Edit this trip, or post it anyway.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className="btn-secondary" onClick={() => setConfirmOverlap(false)}>Edit trip</button>
              <button type="button" className="btn-secondary" onClick={() => { setConfirmOverlap(true); setTimeout(() => form.current?.requestSubmit(), 0); }}>Post anyway</button>
            </div>
          </div>
        )}
        {state.status === "error" && state.message && <p role="alert" className="field-error">{state.message}</p>}

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={!ready || pending}>
              {pending ? "Posting…" : "Post trip"} <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="btn-secondary" onClick={leave}>Cancel</button>
          </div>
          {!ready && disabledReason && <p className="mt-2 text-sm text-muted" data-testid="disabled-reason">{disabledReason}</p>}
        </div>
      </div>
</form>

      <dialog ref={dialog} aria-labelledby="discard-title" className="card m-auto max-w-[420px] p-6 backdrop:bg-black/40">
        <h2 id="discard-title" className="t-h2">Discard this trip?</h2>
        <p className="mt-2 text-muted">What you&apos;ve entered won&apos;t be saved.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => dialog.current?.close()} autoFocus>Keep editing</button>
          <Link href="/post" className="btn-secondary" onClick={(e) => { dialog.current?.close(); void e; }}>Discard</Link>
        </div>
      </dialog>
    </>
  );
}

function Field({ id, label, value, onChange, error, autoComplete, upper }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; upper?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">{label}</label>
      <input id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={upper ? 10 : 40} autoComplete={autoComplete}
        className={`field ${upper ? "uppercase" : ""}`} aria-invalid={error ? true : undefined} aria-describedby={`${id}-error`} />
      <p id={`${id}-error`} role={error ? "alert" : undefined} className={error ? "field-error" : "sr-only"}>{error}</p>
    </div>
  );
}

