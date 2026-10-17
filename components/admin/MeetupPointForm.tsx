"use client";

import { useActionState, useState } from "react";
import { addMeetupPoint, updateMeetupPoint } from "@/app/admin/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { CAMPUS_IDS, CAMPUS_SHORT } from "@/lib/campuses";
import type { AdminPoint } from "@/lib/data/types";
import { MEETUP_TYPES } from "@/lib/schemas/moderation";

// Add a point, or edit one. Every point needs coordinates and the "stand here" text riders see after they're accepted.
export function MeetupPointForm({ point }: { point?: AdminPoint }) {
  const [state, action, pending] = useActionState<FormState, FormData>(point ? updateMeetupPoint : addMeetupPoint, { status: "idle" });
  const [done, setDone] = useState(false);
  const fields: Record<string, string> = state.status === "error" ? (state.fields ?? {}) : {};
  const id = point?.id ?? "new";
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="mb-1 block text-sm font-bold">{label}</label>
      <input id={`${id}-${name}`} name={name} className="field" aria-invalid={fields[name] ? true : undefined} aria-describedby={`${id}-${name}-error`} {...props} />
      <p id={`${id}-${name}-error`} role={fields[name] ? "alert" : undefined} className={fields[name] ? "field-error" : "sr-only"}>{fields[name]}</p>
    </div>
  );

  return (
    <form action={(fd) => { setDone(false); action(fd); }} className="grid gap-4 sm:grid-cols-2" noValidate>
      {point && <input type="hidden" name="pointId" value={point.id} />}
      {!point && (
        <div>
          <label htmlFor={`${id}-campusId`} className="mb-1 block text-sm font-bold">College</label>
          <select id={`${id}-campusId`} name="campusId" className="field" defaultValue="hmc">
            {CAMPUS_IDS.map((c) => <option key={c} value={c}>{CAMPUS_SHORT[c]}</option>)}
          </select>
        </div>
      )}
      {field("name", "Name", { defaultValue: point?.name, maxLength: 80 })}
      <div>
        <label htmlFor={`${id}-type`} className="mb-1 block text-sm font-bold">Type</label>
        <select id={`${id}-type`} name="type" className="field" defaultValue={point?.type ?? "hub"}>
          {MEETUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {field("lat", "Latitude", { defaultValue: point?.lat, inputMode: "decimal", placeholder: "34.1060" })}
      {field("lng", "Longitude", { defaultValue: point?.lng, inputMode: "decimal", placeholder: "-117.7090" })}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-standAt`} className="mb-1 block text-sm font-bold">Where to stand</label>
        <input id={`${id}-standAt`} name="standAt" defaultValue={point?.standAt ?? ""} maxLength={200} className="field" aria-invalid={fields.standAt ? true : undefined} aria-describedby={`${id}-standAt-help`} />
        <p id={`${id}-standAt-help`} role={fields.standAt ? "alert" : undefined} className={fields.standAt ? "field-error" : "mt-1 text-sm text-muted"}>
          {fields.standAt ?? "Shown to the driver and accepted riders only."}
        </p>
      </div>
      <label className="card flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2 sm:col-span-2">
        <input type="checkbox" name="shared" defaultChecked={point?.shared} className="size-4 accent-[var(--green)]" />
        Shared: visible to every college
      </label>
      {state.status === "error" && !Object.keys(fields).length && <p role="alert" className="field-error sm:col-span-2">{state.message}</p>}
      {!pending && state.status === "idle" && done && <p role="status" className="sm:col-span-2 text-sm text-muted">Saved.</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn-secondary" disabled={pending} onClick={() => setDone(true)}>{pending ? "Saving…" : point ? "Save changes" : "Add meetup point"}</button>
      </div>
    </form>
  );
}
