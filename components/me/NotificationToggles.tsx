"use client";

import { useActionState, useRef } from "react";
import { savePrefs } from "@/app/(app)/me/actions";
import type { FormState } from "@/app/(app)/trip/[id]/actions";

const ROWS = [
  { name: "requests", label: "Requests and offers", help: "Someone asks for a seat, offers you a ride, or a match turns up." },
  { name: "messages", label: "Messages", help: "Someone writes to you in a trip chat." },
  { name: "reminders", label: "Reminders and trip changes", help: "Your trip is about to leave, or a trip or request changed." },
] as const;

// Three switches. Each one saves when it changes, so there is no Save button to forget.
// Sign-in codes and notices about your account always send.
export function NotificationToggles({ prefs }: { prefs: Record<(typeof ROWS)[number]["name"], boolean> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePrefs, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} data-testid="prefs-form">
      <ul className="divide-y divide-line border-y border-line">
        {ROWS.map((r) => (
          <li key={r.name}>
            <label className="flex min-h-[56px] cursor-pointer items-start gap-3 py-3">
              <input
                type="checkbox" name={r.name} defaultChecked={prefs[r.name]} disabled={pending}
                onChange={() => form.current?.requestSubmit()} className="mt-1 size-5 shrink-0 accent-[var(--green)]"
              />
              <span className="min-w-0">
                <span className="block font-bold">{r.label}</span>
                <span className="block text-sm text-muted">{r.help}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">Sign-in codes and notices about your account always send.</p>
      {state.status === "error" && <p role="alert" className="field-error">{state.message}</p>}
    </form>
  );
}
