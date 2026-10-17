"use client";

import { useActionState, useRef, useState } from "react";
import { blockUser, fileReport } from "@/app/(app)/report/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { Icon } from "@/components/icons";
import { REPORT_REASONS, type ReportTarget } from "@/lib/schemas/moderation";

type Sent = FormState & { sent?: boolean };

// The menu on every profile, trip, request, and chat: Report and Block, one tap away (WEB_FLOWS.md Flow F).
// `noun` names what is being reported ("trip", "request", "person"); `person` is who would be blocked.
export function SafetyMenu({
  target, noun, person, tripId,
}: { target: { type: ReportTarget; id: string }; noun: string; person: { id: string; firstName: string }; tripId?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const blockDialog = useRef<HTMLDialogElement>(null);
  const [report, sendReport, reporting] = useActionState<Sent, FormData>(fileReport, { status: "idle" });
  const [block, sendBlock, blocking] = useActionState<FormState, FormData>(blockUser, { status: "idle" });
  const [details, setDetails] = useState("");
  const [reason, setReason] = useState("");

  const open = (d: HTMLDialogElement | null) => {
    if (menu.current) menu.current.open = false;
    d?.showModal();
  };
  const reasonError = report.status === "error" ? (report.fields?.reason ?? null) : null;

  return (
    <>
      <details ref={menu} className="relative">
        <summary className="btn-secondary list-none [&::-webkit-details-marker]:hidden" aria-label="More options">
          <Icon name="sliders" size={16} />
          More
        </summary>
        <ul role="menu" className="card absolute right-0 z-20 mt-2 min-w-[200px] p-2" data-testid="safety-menu">
          <li role="none">
            <button type="button" role="menuitem" className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left hover:bg-pale" onClick={() => open(reportDialog.current)}>
              Report {noun}
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-danger hover:bg-pale" onClick={() => open(blockDialog.current)}>
              Block {person.firstName}
            </button>
          </li>
        </ul>
      </details>

      <dialog ref={reportDialog} className="sheet" aria-labelledby="report-title" data-testid="report-dialog">
        {report.status === "idle" && report.sent ? (
          <div>
            <h2 id="report-title" className="t-h2">Report sent</h2>
            <p className="mt-2" data-testid="report-thanks">Thanks. Our team will review this.</p>
            <button type="button" className="btn-secondary mt-6" onClick={() => reportDialog.current?.close()}>Close</button>
          </div>
        ) : (
          <form action={sendReport} noValidate>
            <input type="hidden" name="targetType" value={target.type} />
            <input type="hidden" name="targetId" value={target.id} />
            {tripId && <input type="hidden" name="tripId" value={tripId} />}
            <h2 id="report-title" className="t-h2">Report this {noun}</h2>
            <fieldset className="mt-4" aria-describedby={reasonError ? "reason-error" : undefined}>
              <legend className="mb-2 text-sm font-bold">What happened?</legend>
              <ul className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <li key={r}>
                    <label className={`card flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2 ${reason === r ? "!border-green !bg-mint" : ""}`}>
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--green)]" />
                      {r}
                    </label>
                  </li>
                ))}
              </ul>
              {reasonError && <p id="reason-error" role="alert" className="field-error">{reasonError}</p>}
            </fieldset>
            <div className="mt-4">
              <label htmlFor="report-details" className="mb-1 block text-sm font-bold">Details <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="report-details" name="details" rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className="field" />
              <p className="tabular mt-1 text-right text-sm text-muted">{details.length}/1000</p>
            </div>
            {report.status === "error" && !report.fields?.reason && <p role="alert" className="field-error" data-testid="report-error">{report.message}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="submit" className="btn-primary" disabled={reporting}>{reporting ? "Sending…" : "Submit"} <span aria-hidden="true">↗</span></button>
              <button type="button" className="btn-secondary" onClick={() => reportDialog.current?.close()}>Cancel</button>
            </div>
          </form>
        )}
      </dialog>

      <dialog ref={blockDialog} className="sheet" aria-labelledby="block-title" data-testid="block-dialog">
        <form action={sendBlock}>
          <input type="hidden" name="userId" value={person.id} />
          <h2 id="block-title" className="t-h2">Block {person.firstName}?</h2>
          <p className="mt-2 text-muted">You won&apos;t see each other&apos;s trips, requests, or chats. Anything they asked of you that is still waiting is cancelled.</p>
          {block.status === "error" && <p role="alert" className="field-error mt-3" data-testid="block-error">{block.message}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => blockDialog.current?.close()} autoFocus>Cancel</button>
            <button type="submit" className="btn-danger" disabled={blocking}>{blocking ? "Blocking…" : `Block ${person.firstName}`}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
