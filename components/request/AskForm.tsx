"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { postRequest } from "@/app/(app)/post/ask/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { DestinationPicker, type Destination } from "@/components/post/DestinationPicker";
import { DraftBanner, useDraft } from "@/components/post/draft";
import { MeetupPointPicker } from "@/components/post/MeetupPointPicker";
import { ReviewPane, WizardFooter, WizardHeader, useWizard, type ReviewRow } from "@/components/post/Wizard";
import { FlexibilityField } from "@/components/request/FlexibilityField";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";
import type { MeetupOption, PlaceOption } from "@/lib/data/post";
import { formatDeparture } from "@/lib/format/time";
import { localToUtc } from "@/lib/format/tz";
import { FLEXIBILITY_LABEL, type Flexibility } from "@/lib/schemas/request";

type Props = {
  places: PlaceOption[]; points: MeetupOption[]; campusId: string;
  defaults: { date: string; time: string; meetupPointId: string };
  nowIso: string; maxDate: string;
};

const SEVEN_DAYS_MS = 7 * 24 * 3600_000;

const STEP_TITLES = ["Where to", "When", "Details", "Review"];
const LAST_STEP = STEP_TITLES.length - 1;
// Which server field names belong to which pane, so a refusal can send the person to the right one.
const STEP_FIELDS = [
  ["destination", "meetupPointId"],
  ["time", "date", "flexibility"],
  ["seats", "chipIn", "note"],
  [],
];

// What is kept between visits. A searched "somewhere else" place is left out (its search token expires).
type AskDraft = {
  destination: { placeId: string; name: string } | null; date: string; time: string; flex: Flexibility; seats: number;
  pointId: string; chipIn: boolean; note: string;
};

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
  const { step, setStep, headingRef, pane } = useWizard();
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
  const dirty = Boolean(destination || note || seats !== 1 || flex !== "pm30" || date !== defaults.date || time !== defaults.time || pointId !== initialPoint || !chipIn);
  const now = new Date(nowIso).getTime();
  const when = date && time ? localToUtc(date, time) : null;
  const timeError =
    date && time && !when ? "That time doesn't exist. Pick another."
    : when && when.getTime() <= now ? "That time has already passed. Pick a later one."
    : when && when.getTime() > now + SEVEN_DAYS_MS ? "Pick a time within the next 7 days."
    : fields.time;
  const noteWarn = containsContactInfo(note) ? CONTACT_INFO_MESSAGE : undefined;
  const stepReady = [Boolean(destination && pointId), Boolean(date && time && !timeError), !noteWarn, true];
  const ready = Boolean(destination && date && time && pointId && !timeError && !noteWarn);
  const reason = !destination ? "Pick where you're going." : !pointId ? "Pick a meetup point." : timeError ?? noteWarn ?? (!date || !time ? "Pick a date and time." : null);

  const reviewRows: ReviewRow[] = [
    { label: "Going to", value: destination?.name ?? "", step: 0 },
    { label: "Meetup point", value: points.find((p) => p.id === pointId)?.name ?? "", step: 0 },
    { label: "Around", value: when ? formatDeparture(when, new Date(nowIso)) : "", step: 1 },
    { label: "Flexibility", value: FLEXIBILITY_LABEL[flex], step: 1 },
    { label: "Seats you need", value: String(seats), step: 2 },
    { label: "Chipping in", value: chipIn ? "Yes" : "No", step: 2 },
    { label: "Note", value: note, step: 2 },
  ];

  function leave() {
    if (dirty && !window.confirm("Discard this request?")) return;
    draft.clear();
    router.push("/post");
  }

  const draft = useDraft<AskDraft>("draft:ask", true);
  const offered = draft.offered;
  const snapshotKey = JSON.stringify({
    destination: destination?.kind === "place" ? { placeId: destination.placeId, name: destination.name } : null,
    date, time, flex, seats, pointId, chipIn, note,
  } satisfies AskDraft);
  const { save: saveDraft, clear: clearDraft } = draft;
  useEffect(() => {
    if (offered) return; // while a saved draft is waiting to be answered, leave it alone
    if (dirty) saveDraft(JSON.parse(snapshotKey));
    else clearDraft();
    // saveDraft and clearDraft are fresh functions each render; the snapshot string is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey, dirty, offered, state]);

  function restore(d: AskDraft) {
    if (d.destination) setDestination({ kind: "place", ...d.destination });
    if (d.date >= defaults.date && d.date <= maxDate) { setDate(d.date); setTime(d.time); }
    setFlex(d.flex);
    setSeats(Math.min(3, Math.max(1, d.seats)));
    if (points.some((p) => p.id === d.pointId)) setPointId(d.pointId);
    setChipIn(d.chipIn);
    setNote(d.note);
  }

  return (
    <form action={(fd) => { clearDraft(); action(fd); }} className="grid gap-x-12 gap-y-8 lg:grid-cols-2" noValidate>
      <input type="hidden" name="destinationKind" value={destination?.kind ?? ""} />
      <input type="hidden" name="placeId" value={destination?.kind === "place" ? destination.placeId : ""} />
      <input type="hidden" name="mapboxId" value={destination?.kind === "other" ? destination.mapboxId : ""} />
      <input type="hidden" name="sessionToken" value={destination?.kind === "other" ? destination.sessionToken : ""} />
      <input type="hidden" name="meetupPointId" value={pointId} />
      <input type="hidden" name="seats" value={seats} />

{offered && (
        <DraftBanner
          noun="request"
          onContinue={() => { restore(offered); draft.dismiss(); }}
          onStartOver={() => { draft.clear(); draft.dismiss(); }}
        />
      )}

      <WizardHeader step={step} titles={STEP_TITLES} headingRef={headingRef} onCancel={leave} />

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

      <ReviewPane active={step === LAST_STEP} rows={reviewRows} onEdit={setStep} />
      </div>

<div className="space-y-8 lg:col-span-2">
{state.status === "error" && state.message && !Object.keys(fields).length && <p role="alert" className="field-error">{state.message}</p>}

      <div>
        <p className="mb-3 text-sm text-muted">You can have up to 2 open requests.</p>
        <WizardFooter
          step={step} last={LAST_STEP} canNext={stepReady[step]} onNext={() => setStep(step + 1)} onBack={() => setStep(step - 1)}
          onCancel={leave} submitLabel="Post request" pendingLabel="Posting…" ready={ready} pending={pending} reason={reason}
        />
      </div>
    </div>
</form>
  );
}
