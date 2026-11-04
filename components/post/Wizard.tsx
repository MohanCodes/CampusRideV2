"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Shared pieces for the phone "one pane at a time" forms (Offer a ride, Ask for a ride).
// From the lg breakpoint up the forms show every pane at once, and none of this appears.

export function useWizard() {
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    headingRef.current?.focus();
  }, [step]);
  // Panes that are not current are hidden on phones only.
  const pane = (i: number) => (step === i ? "" : "max-lg:hidden");
  return { step, setStep, headingRef, pane };
}

export function WizardHeader({ step, titles, headingRef, onCancel }: {
  step: number; titles: string[]; headingRef: React.RefObject<HTMLHeadingElement | null>; onCancel: () => void;
}) {
  return (
    <div className="lg:hidden lg:col-span-2" data-testid="stepper">
      <div className="flex items-center justify-between gap-3">
        <p className="t-label text-muted" aria-live="polite">Step {step + 1} of {titles.length}</p>
        <button type="button" className="link min-h-[44px] px-2 text-sm" onClick={onCancel}>Cancel</button>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {titles.map((t, i) => (
          <span key={t} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-pale"}`} />
        ))}
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="t-h2 mt-4 outline-none">{titles[step]}</h2>
    </div>
  );
}

// Desktop: Post and Cancel in a row. Phone: a bar pinned above the bottom navigation with Back and Next
// (Post on the last pane), so the main button is always in thumb reach and never scrolls away.
export function WizardFooter({ step, last, canNext, onNext, onBack, onCancel, submitLabel, pendingLabel, ready, pending, reason }: {
  step: number; last: number; canNext: boolean; onNext: () => void; onBack: () => void; onCancel: () => void;
  submitLabel: string; pendingLabel: string; ready: boolean; pending: boolean; reason: string | null;
}): ReactNode {
  return (
    <div className="max-lg:pb-28">
      <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:border-t max-lg:border-line max-lg:bg-surface max-lg:px-4 max-lg:py-3 max-md:max-lg:bottom-[57px]">
        {!ready && reason && <p className="mb-2 text-sm text-muted" data-testid="disabled-reason">{reason}</p>}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button type="button" className="btn-secondary order-first lg:hidden" onClick={onBack}>Back</button>
          )}
          {step < last && (
            <button type="button" className="btn-primary lg:hidden max-lg:flex-1 max-lg:justify-between" disabled={!canNext} onClick={onNext}>
              Next <span aria-hidden="true">→</span>
            </button>
          )}
          <button type="submit" className={`btn-primary ${step < last ? "max-lg:hidden" : "max-lg:flex-1 max-lg:justify-between"}`} disabled={!ready || pending}>
            {pending ? pendingLabel : submitLabel} <span aria-hidden="true">↗</span>
          </button>
          <button type="button" className="btn-secondary max-lg:hidden" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export type ReviewRow = { label: string; value: string; step: number };

// The last pane on phones: everything entered, each row with a way back to change it.
export function ReviewPane({ rows, onEdit, active }: { rows: ReviewRow[]; onEdit: (step: number) => void; active: boolean }) {
  return (
    <div className={active ? "lg:hidden" : "hidden"} data-testid="review">
      <dl className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <dt id={`review-${r.label}`} className="t-label text-muted">{r.label}</dt>
              <dd className="mt-1 break-words">{r.value || "—"}</dd>
            </div>
            <button type="button" className="link min-h-[44px] shrink-0 px-2 text-sm" aria-describedby={`review-${r.label}`} onClick={() => onEdit(r.step)}>
              Edit
            </button>
          </div>
        ))}
      </dl>
    </div>
  );
}
