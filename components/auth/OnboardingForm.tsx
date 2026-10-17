"use client";

import { useActionState, useEffect, useState } from "react";
import {
  finishOnboarding,
  saveProfileStep,
  type FinishState,
  type ProfileStepState,
} from "@/app/onboarding/actions";

type Defaults = { firstName: string; lastName: string; classYear: string; bio: string; hasPhoto: boolean };

export function OnboardingForm({
  campusName,
  defaults,
  classYears,
  next,
}: {
  campusName: string;
  defaults: Defaults;
  classYears: number[];
  next: string;
}) {
  const [step1, saveStep, saving] = useActionState<ProfileStepState, FormData>(saveProfileStep, { status: "idle" });
  const [done, finish, finishing] = useActionState<FinishState, FormData>(finishOnboarding, { status: "idle" });
  const [bioLength, setBioLength] = useState(defaults.bio.length);
  const [preview, setPreview] = useState<string | null>(null);
  const [goingBack, setGoingBack] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const fields = step1.status === "error" ? (step1.fields ?? {}) : {};

  if (step1.status === "ok" && !goingBack) {
    const v = step1.values;
    return (
      <div>
        <p className="t-label text-muted">Step 2 of 2</p>
        <h1 className="t-h1 mt-2 text-[2.4rem]">Community pledge</h1>
        <p className="mt-4 text-lg">Meet at approved spots, be on time, and report anything off.</p>
        <form action={finish} className="mt-6">
          <input type="hidden" name="firstName" value={v.firstName} />
          <input type="hidden" name="lastName" value={v.lastName} />
          <input type="hidden" name="classYear" value={v.classYear} />
          <input type="hidden" name="bio" value={v.bio} />
          <input type="hidden" name="avatarPath" value={v.avatarPath} />
          <input type="hidden" name="next" value={next} />
          {done.status === "error" && (
            <p role="alert" className="field-error mb-4">
              {done.message}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn-primary" disabled={finishing}>
              {finishing ? "Saving…" : "I agree"} <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="btn-secondary" onClick={() => setGoingBack(true)} disabled={finishing}>
              Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <p className="t-label text-muted">Step 1 of 2</p>
      <h1 className="t-h1 mt-2 text-[2.4rem]">Your profile</h1>
      <p className="mt-3 text-muted">Other students see your first name, college, class year, bio, and photo.</p>

      <form
        action={(fd) => {
          setGoingBack(false);
          saveStep(fd);
        }}
        className="mt-6 space-y-5"
        noValidate
      >
        <div>
          <label htmlFor="photo" className="mb-2 block text-sm font-bold">
            Photo
          </label>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-mint text-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview ? <img src={preview} alt="" className="size-full object-cover" /> : "↗"}
            </span>
            <div className="min-w-0 flex-1">
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="field !py-[9px] text-sm"
                aria-invalid={fields.photo ? true : undefined}
                aria-describedby="photo-help"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
              />
            </div>
          </div>
          <p id="photo-help" className={fields.photo ? "field-error" : "mt-2 text-sm text-muted"} role={fields.photo ? "alert" : undefined}>
            {fields.photo ?? "A clear photo of your face, so the person you're meeting can recognize you."}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="firstName" label="First name" autoComplete="given-name" defaultValue={defaults.firstName} error={fields.firstName} />
          <TextField id="lastName" label="Last name" autoComplete="family-name" defaultValue={defaults.lastName} error={fields.lastName} help="Only you and the team see this." />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold">College</p>
            <p className="field flex items-center bg-pale">{campusName}</p>
          </div>
          <div>
            <label htmlFor="classYear" className="mb-2 block text-sm font-bold">
              Class year
            </label>
            <select
              id="classYear"
              name="classYear"
              className="field"
              defaultValue={defaults.classYear}
              aria-invalid={fields.classYear ? true : undefined}
              aria-describedby={fields.classYear ? "classYear-error" : undefined}
            >
              <option value="" disabled>
                Pick one
              </option>
              {classYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {fields.classYear && (
              <p id="classYear-error" role="alert" className="field-error">
                {fields.classYear}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="bio" className="mb-2 block text-sm font-bold">
            Bio <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={280}
            className="field"
            defaultValue={defaults.bio}
            onChange={(e) => setBioLength(e.target.value.length)}
            aria-invalid={fields.bio ? true : undefined}
            aria-describedby="bio-count"
          />
          <p id="bio-count" className={fields.bio ? "field-error" : "mt-1 text-right text-sm text-muted tabular"}>
            {fields.bio ?? `${bioLength}/280`}
          </p>
        </div>

        {step1.status === "error" && step1.message && (
          <p role="alert" className="field-error">
            {step1.message}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Continue"} <span aria-hidden="true">↗</span>
        </button>
      </form>
    </div>
  );
}

function TextField({
  id, label, autoComplete, defaultValue, error, help,
}: {
  id: string; label: string; autoComplete: string; defaultValue: string; error?: string; help?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        autoComplete={autoComplete}
        maxLength={40}
        defaultValue={defaultValue}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-note`}
      />
      <p id={`${id}-note`} role={error ? "alert" : undefined} className={error ? "field-error" : "mt-1 text-sm text-muted"}>
        {error ?? help}
      </p>
    </div>
  );
}
