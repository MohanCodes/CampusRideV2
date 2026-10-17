"use client";

import { useActionState } from "react";
import { setMeetupStatus } from "@/app/admin/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";

const NEXT: Record<string, { status: string; label: string }[]> = {
  approved: [{ status: "suspended", label: "Suspend" }, { status: "retired", label: "Retire" }],
  suspended: [{ status: "approved", label: "Approve again" }, { status: "retired", label: "Retire" }],
  retired: [{ status: "approved", label: "Approve again" }],
};

// Suspending takes a point off new trips; trips that already use it keep it.
export function PointStatusButtons({ pointId, status }: { pointId: string; status: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setMeetupStatus, { status: "idle" });
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {NEXT[status]?.map((n) => (
          <form key={n.status} action={action}>
            <input type="hidden" name="pointId" value={pointId} />
            <input type="hidden" name="status" value={n.status} />
            <button className="btn-secondary" disabled={pending}>{n.label}</button>
          </form>
        ))}
      </div>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </div>
  );
}
