"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { postRequest } from "@/app/(app)/post/ask/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { DestinationPicker, type Destination } from "@/components/post/DestinationPicker";
import { MeetupPointPicker } from "@/components/post/MeetupPointPicker";
import { FlexibilityField } from "@/components/request/FlexibilityField";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import type { MeetupOption, PlaceOption } from "@/lib/data/post";
import { localToUtc } from "@/lib/format/tz";
import type { Flexibility } from "@/lib/schemas/request";

type Props = {
  places: PlaceOption[]; points: MeetupOption[]; campusId: string;
  defaults: { date: string; time: string; meetupPointId: string };
  nowIso: string; maxDate: string;
};

const SEVEN_DAYS_MS = 7 * 24 * 3600_000;

const STEP_TITLES = ["Where to", "When", "Details"];
const LAST_STEP = STEP_TITLES.length - 1;
// Which server field names belong to which pane, so a refusal can send the person to the right one.
const STEP_FIELDS = [
  ["destination", "meetupPointId"],
  ["time", "date", "flexibility"],
  ["seats", "chipIn", "note"],
];

// "Ask for a ride" (one pane at a time on phones): where to, when, how flexible, seats, a meetup point, and whether you'll chip in.
// There is no price field: riders and drivers settle up themselves.
export function AskForm({ places, points, campusId, defaults, nowIso, maxDate }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(postRequest, { status: "idle" });
  const [destination, setDestination] = useState<Destination | null>(null);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [flex, setFlex] = useState<Flexibility>("pm30");
  const [seats, setSeats] = useState(1);
  const initialPoint = points.some((p) => p.id === defaults.meetupPointId) ? defaults.meetupPointId : "";
  const [pointId, setPointId] = useState(initialPoint);
  const [chipIn, setChipIn] = useState(true);
  const [note, setNote] = useState("");

  const fields: Record<string, string> = state.status === "error" ? (state.fields ?? {}) : {};

  // On phones the form shows one pane at a time. From the lg breakpoint up, every pane shows at once.
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    stepHeading.current?.focus();
  }, [step]);
  // After a refused post, go to the first pane that has a problem (adjusted while rendering, not in an effect).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.status === "error" && state.fields) {
      const keys = Object.keys(state.fields);
      const found = STEP_FIELDS.findIndex((names) => names.some((n) => keys.includes(n)));
      if (found >= 0) setStep(found);
    }
  }
  const pane = (i: number) => (step === i ? "" : "max-lg:hidden");
  const dirty = Boolean(destination || note || seats !== 1 || flex !== "pm30" || date !== defaults.date || time !== defaults.time || pointId !== initialPoint || !chipIn);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const now = new Date(nowIso).getTime();
  const when = date && time ? localToUtc(date, time) : null;
  const timeError =
    date && time && !when ? "That time doesn't exist. Pick another."
    : when && when.getTime() <= now ? "That time has already passed. Pick a later one."
    : when && when.getTime() > now + SEVEN_DAYS_MS ? "Pick a time within the next 7 days."
    : fields.time;
  const noteWarn = containsContactInfo(note) ? CONTACT_INFO_MESSAGE : undefined;
  const stepReady = [Boolean(destination && pointId), Boolean(date && time && !timeError), !noteWarn];
  const ready = Boolean(destination && date && time && pointId && !timeError && !noteWarn);
  const reason = !destination ? "Pick where you're going." : !pointId ? "Pick a meetup point." : timeError ?? noteWarn ?? (!date || !time ? "Pick a date and time." : null);

  return (
    <form action={action} className="grid gap-x-12 gap-y-8 lg:grid-cols-2" noValidate>
      <input type="hidden" name="destinationKind" value={destination?.kind ?? ""} />
      <input type="hidden" name="placeId" value={destination?.kind === "place" ? destination.placeId : ""} />
      <input type="hidden" name="mapboxId" value={destination?.kind === "other" ? destination.mapboxId : ""} />
      <input type="hidden" name="sessionToken" value={destination?.kind === "other" ? destination.sessionToken : ""} />
      <input type="hidden" name="meetupPointId" value={pointId} />
      <input type="hidden" name="seats" value={seats} />

<div className="lg:hidden lg:col-span-2" data-testid="stepper">
        <p className="t-label text-muted" aria-live="polite">Step {step + 1} of {STEP_TITLES.length}</p>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {STEP_TITLES.map((t, i) => (
            <span key={t} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-pale"}`} />
          ))}
        </div>
        <h2 ref={stepHeading} tabIndex={-1} className="t-h2 mt-4 outline-none">{STEP_TITLES[step]}</h2>
      </div>

<div className={`space-y-8 ${pane(0)}`}>
      <DestinationPicker places={places} value={destination} onChange={setDestination} error={fields.destination} />

      <MeetupPointPicker points={points} campusId={campusId} value={pointId} onChange={setPointId} error={fields.meetupPointId} />
</div>

<div className="space-y-8">

      <div className={`space-y-8 ${pane(1)}`}>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">When</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="mb-1 block text-sm text-muted">Date</label>
            <input id="date" name="date" type="date" min={defaults.date} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
          </div>
          <div>
            <label htmlFor="time" className="mb-1 block text-sm text-muted">Around</label>
            <input id="time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field" aria-invalid={timeError ? true : undefined} aria-describedby="time-error" />
          </div>
        </div>
        <p id="time-error" role={timeError ? "alert" : undefined} className={timeError ? "field-error" : "mt-1 text-sm text-muted"}>
          {timeError ?? "Up to 7 days ahead."}
        </p>
      </fieldset>

      <FlexibilityField value={flex} onChange={setFlex} error={fields.flexibility} />
      </div>

      <div className={`space-y-8 ${pane(2)}`}>
      <div>
        <p id="seats-label" className="mb-2 text-sm font-bold">Seats you need</p>
        <div role="group" aria-labelledby="seats-label" className="inline-flex items-center gap-2">
          <button type="button" className="btn-secondary !px-0 w-11" aria-label="Fewer seats" disabled={seats <= 1} onClick={() => setSeats((s) => s - 1)}>−</button>
          <output aria-live="polite" className="tabular w-10 text-center text-xl" data-testid="seats-value">{seats}</output>
          <button type="button" className="btn-secondary !px-0 w-11" aria-label="More seats" disabled={seats >= 3} onClick={() => setSeats((s) => s + 1)}>+</button>
        </div>
        <p className="mt-1 text-sm text-muted">Up to 3.</p>
      </div>


      <div>
        <label className="card flex min-h-[48px] cursor-pointer items-start gap-3 px-4 py-3">
          <input type="checkbox" name="chipIn" checked={chipIn} onChange={(e) => setChipIn(e.target.checked)} className="mt-1 size-4 accent-[var(--green)]" />
          <span>
            <span className="block font-bold">I&apos;ll chip in</span>
            <span className="block text-sm text-muted">Drivers see that you plan to share gas and parking. There is no price to set: you settle up with the driver yourselves.</span>
          </span>
        </label>
      </div>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-bold">Note <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="note" name="note" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="field"
          aria-invalid={noteWarn || fields.note ? true : undefined} aria-describedby="note-help" />
        <p id="note-help" role={noteWarn || fields.note ? "alert" : undefined} className={noteWarn || fields.note ? "field-error" : "mt-1 text-sm text-muted"}>
          {noteWarn ?? fields.note ?? "No phone numbers, emails, handles, or links. Use the chat once someone offers."}
        </p>
      </div>

      </div>
      </div>

<div className="space-y-8 lg:col-span-2">
{state.status === "error" && state.message && !Object.keys(fields).length && <p role="alert" className="field-error">{state.message}</p>}

      <div>
        <div className="flex flex-wrap items-center gap-3">
          {step < LAST_STEP && (
            <button type="button" className="btn-primary lg:hidden" disabled={!stepReady[step]} onClick={() => setStep(step + 1)}>
              Next <span aria-hidden="true">→</span>
            </button>
          )}
          <button type="submit" className={`btn-primary ${step < LAST_STEP ? "max-lg:hidden" : ""}`} disabled={!ready || pending}>
            {pending ? "Posting…" : "Post request"} <span aria-hidden="true">↗</span>
          </button>
          {step > 0 && (
            <button type="button" className="btn-secondary lg:hidden" onClick={() => setStep(step - 1)}>Back</button>
          )}
          <button type="button" className="btn-secondary" onClick={() => (dirty && !window.confirm("Discard this request?") ? undefined : router.push("/post"))}>Cancel</button>
        </div>
        {!ready && reason && <p className="mt-2 text-sm text-muted" data-testid="disabled-reason">{reason}</p>}
        <p className="mt-2 text-sm text-muted">You can have up to 2 open requests.</p>
      </div>
    </div>
</form>
  );
}
