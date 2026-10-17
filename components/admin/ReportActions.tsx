"use client";

import { useActionState, useEffect, useRef } from "react";
import { removeAccount, setReportStatus, suspendUser, unsuspendUser, warnUser } from "@/app/admin/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";

// One click each, from the queue's detail page (BUILD.md Section 10). Nothing here is automatic: the
// second no-show earns a warning and the third a short suspension, but an admin presses the button.
export function ReportActions({ reportId, userId, targetName, status, suspended }: {
  reportId: string; userId: string; targetName: string; status: string; suspended: boolean;
}) {
  const [statusState, setStatus, settingStatus] = useActionState<FormState, FormData>(setReportStatus, { status: "idle" });
  const [warnState, warn, warning] = useActionState<FormState, FormData>(warnUser, { status: "idle" });
  const [s7State, suspend7, suspending7] = useActionState<FormState, FormData>(suspendUser, { status: "idle" });
  const [s30State, suspend30, suspending30] = useActionState<FormState, FormData>(suspendUser, { status: "idle" });
  const [liftState, lift, lifting] = useActionState<FormState, FormData>(unsuspendUser, { status: "idle" });
  const [removeState, remove, removing] = useActionState<FormState, FormData>(removeAccount, { status: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  // Whatever the answer, the confirm sheet has done its job: close it so the result is visible on the page.
  useEffect(() => {
    if (removeState.status !== "idle") dialog.current?.close();
  }, [removeState]);
  const errors = [statusState, warnState, s7State, s30State, liftState, removeState].flatMap((s) => (s.status === "error" ? [s.message] : []));
  const ids = (
    <>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="userId" value={userId} />
    </>
  );

  return (
    <div data-testid="report-actions">
      <div className="flex flex-wrap gap-3">
        {status === "new" && (
          <form action={setStatus}>
            <input type="hidden" name="reportId" value={reportId} />
            <input type="hidden" name="status" value="reviewing" />
            <button className="btn-secondary" disabled={settingStatus}>Mark as reviewing</button>
          </form>
        )}
        {status !== "dismissed" && (
          <form action={setStatus}>
            <input type="hidden" name="reportId" value={reportId} />
            <input type="hidden" name="status" value="dismissed" />
            <button className="btn-secondary" disabled={settingStatus}>Dismiss</button>
          </form>
        )}
        <form action={warn}>{ids}<button className="btn-secondary" disabled={warning}>Warn {targetName}</button></form>
        <form action={suspend7}>{ids}<input type="hidden" name="days" value="7" /><button className="btn-secondary" disabled={suspending7}>Suspend 7 days</button></form>
        <form action={suspend30}>{ids}<input type="hidden" name="days" value="30" /><button className="btn-secondary" disabled={suspending30}>Suspend 30 days</button></form>
        {suspended && <form action={lift}>{ids}<button className="btn-secondary" disabled={lifting}>Lift suspension</button></form>}
        <button type="button" className="btn-danger" onClick={() => dialog.current?.showModal()}>Remove account</button>
      </div>
      {errors.map((m, i) => <p key={i} role="alert" className="field-error">{m}</p>)}

      <dialog ref={dialog} className="sheet" aria-labelledby="remove-title" data-testid="remove-dialog">
        <form action={remove}>
          {ids}
          <h2 id="remove-title" className="t-h2">Remove {targetName}&apos;s account?</h2>
          <p className="mt-2 text-muted">Their name, bio, and photo are cleared, and everything still ahead of them is cancelled. Riders are told. This can&apos;t be undone.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => dialog.current?.close()} autoFocus>Keep account</button>
            <button type="submit" className="btn-danger" disabled={removing}>{removing ? "Removing…" : "Remove account"}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
