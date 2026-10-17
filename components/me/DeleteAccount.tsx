"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAccount } from "@/app/(app)/me/actions";

// Delete account asks first, says what it does, and defaults to the safe choice.
export function DeleteAccount() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const r = await deleteAccount();
      if (r?.status === "error") {
        setMessage(r.message);
        dialog.current?.close();
      }
    });

  return (
    <>
      <button type="button" className="btn-danger" onClick={() => { setMessage(null); dialog.current?.showModal(); }}>Delete account</button>
      {message && <p role="alert" className="field-error" data-testid="delete-error">{message}</p>}
      <dialog ref={dialog} className="sheet" aria-labelledby="delete-title" data-testid="delete-dialog">
        <h2 id="delete-title" className="t-h2">Delete your account?</h2>
        <p className="mt-2 text-muted">
          Your name, bio, and photo are removed, and your sign-in is deleted. Trips, seats, and requests that are still ahead are cancelled,
          and the people on them are told. Trips you already took stay in other people&apos;s history, with your name shown as &ldquo;Deleted user&rdquo;.
          This can&apos;t be undone.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => dialog.current?.close()} autoFocus disabled={pending}>Keep my account</button>
          <button type="button" className="btn-danger" onClick={confirm} disabled={pending}>{pending ? "Deleting…" : "Delete my account"}</button>
        </div>
      </dialog>
    </>
  );
}
