"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RESEND_AFTER_SECONDS } from "@/lib/format/code";
import { requestCode, verifyCode, type RequestCodeState, type VerifyCodeState } from "@/app/(public)/sign-in/actions";
import { CodeInput } from "./CodeInput";

export function SignInForm({ next }: { next: string }) {
  const [req, sendCode, sending] = useActionState<RequestCodeState, FormData>(requestCode, { status: "idle" });
  const [ver, submitCode, verifying] = useActionState<VerifyCodeState, FormData>(verifyCode, { status: "idle" });
  const [code, setCode] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [seenSentAt, setSeenSentAt] = useState(0);
  const codeForm = useRef<HTMLFormElement>(null);

  const sent = req.status === "sent" && !changingEmail;
  const sentAt = req.status === "sent" ? req.sentAt : 0;

  // A fresh code was sent: clear the boxes and go back to the code step.
  if (sentAt !== seenSentAt) {
    setSeenSentAt(sentAt);
    setCode("");
    setChangingEmail(false);
  }

  // Resend unlocks 30 seconds after the last send. The countdown comes from timestamps, so it
  // stays right even if the tab sleeps.
  useEffect(() => {
    if (!sentAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAt]);
  const secondsLeft = sentAt
    ? Math.min(RESEND_AFTER_SECONDS, Math.max(0, Math.ceil((sentAt + RESEND_AFTER_SECONDS * 1000 - now) / 1000)))
    : 0;

  // A wrong code empties the boxes so the next try starts clean.
  const [lastVer, setLastVer] = useState(ver);
  if (ver !== lastVer) {
    setLastVer(ver);
    if (ver.status === "error") setCode("");
  }

  useEffect(() => {
    if (code.length === 6 && !verifying) codeForm.current?.requestSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (sent) {
    const email = req.status === "sent" ? req.email : "";
    const wrong = ver.status === "error";
    return (
      <div>
        <h1 className="t-h1 text-[2.4rem]">Check your email</h1>
        <p className="mt-3 text-muted">
          We sent a 6-digit code to <strong className="text-ink">{email}</strong>. It works for 10 minutes.
        </p>

        <form ref={codeForm} action={submitCode} className="mt-6">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="code" value={code} />
          <div className={wrong ? "shake" : undefined} key={wrong ? ver.message + sentAt : "ok"}>
            <CodeInput value={code} onChange={setCode} invalid={wrong} describedBy={wrong ? "code-error" : undefined} />
          </div>
          {wrong && (
            <p id="code-error" role="alert" className="field-error">
              {ver.message}
            </p>
          )}
          <button type="submit" className="btn-primary mt-6" disabled={verifying || code.length !== 6}>
            {verifying ? "Checking…" : "Continue"} <span aria-hidden="true">↗</span>
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <form action={sendCode}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" className="link min-h-[44px]" disabled={secondsLeft > 0 || sending}>
              {sending ? "Sending…" : secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
            </button>
          </form>
          <button type="button" className="link min-h-[44px]" onClick={() => setChangingEmail(true)}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  const error = req.status === "error" ? req.message : null;
  return (
    <div>
      <h1 className="t-h1 text-[2.4rem]">Sign in</h1>
      <p className="mt-3 text-muted">Use your school email. We&apos;ll send you a 6-digit code. No password.</p>
      <form action={sendCode} className="mt-6" noValidate>
        <label htmlFor="email" className="mb-2 block text-sm font-bold">
          School email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={req.status === "error" ? req.email : undefined}
          placeholder="you@hmc.edu"
          className="field"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error && (
          <p id="email-error" role="alert" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary mt-6" disabled={sending}>
          {sending ? "Sending…" : "Send code"} <span aria-hidden="true">↗</span>
        </button>
      </form>
    </div>
  );
}
