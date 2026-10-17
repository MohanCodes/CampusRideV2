"use client";

import { useActionState } from "react";
import { unblock } from "@/app/(app)/me/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { campusShortName } from "@/lib/campuses";
import type { BlockedPerson } from "@/lib/data/types";

export function BlockedList({ people }: { people: BlockedPerson[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(unblock, { status: "idle" });
  if (people.length === 0) {
    return <p className="text-muted" data-testid="blocked-empty">You haven&apos;t blocked anyone.</p>;
  }
  return (
    <>
      <ul className="divide-y divide-line border-y border-line" aria-label="Blocked people">
        {people.map((p) => (
          <li key={p.id} data-testid="blocked-row" className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 py-2">
            <span className="min-w-0"><strong>{p.firstName}</strong> <span className="text-muted">· {campusShortName(p.campusId)}</span></span>
            <form action={action}>
              <input type="hidden" name="userId" value={p.id} />
              <button type="submit" className="btn-secondary" disabled={pending} aria-label={`Unblock ${p.firstName}`}>Unblock</button>
            </form>
          </li>
        ))}
      </ul>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </>
  );
}
