"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// A half-filled form is kept in this browser (localStorage) so closing the tab does not lose it. It is offered back
// as "Continue" or "Start over", never restored silently. The plate is never stored. Drafts expire after 3 days.
const MAX_AGE_MS = 3 * 24 * 3600_000;
const loaded = new Map<string, unknown>();
const noopSubscribe = () => () => {};

// Read once per page visit and kept, so what the form offers does not shift while the person types.
function read<T>(key: string): T | null {
  if (!loaded.has(key)) {
    let value: unknown = null;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as { at: number; v: unknown }) : null;
      if (parsed && Date.now() - parsed.at < MAX_AGE_MS) value = parsed.v;
    } catch { /* blocked storage or an unreadable draft is the same as none */ }
    loaded.set(key, value);
  }
  return (loaded.get(key) as T | null) ?? null;
}

export function useDraft<T>(key: string, enabled: boolean) {
  // Nothing is read on the server, so there is no hydration mismatch.
  const found = useSyncExternalStore(noopSubscribe, () => (enabled ? read<T>(key) : null), () => null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => () => { loaded.delete(key); }, [key]);

  const write = (value: T | null) => {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), v: value }));
    } catch { /* storage can be blocked; the form still works */ }
  };
  return {
    // Shown until the person picks Continue or Start over.
    offered: dismissed ? null : found,
    dismiss: () => setDismissed(true),
    save: write,
    clear: () => write(null),
  };
}

export function DraftBanner({ noun, onContinue, onStartOver }: { noun: string; onContinue: () => void; onStartOver: () => void }) {
  return (
    <div role="region" aria-label="Saved draft" data-testid="draft-banner" className="card flex flex-wrap items-center justify-between gap-3 p-4 lg:col-span-2">
      <p>You have an unfinished {noun}. Pick up where you left off?</p>
      <div className="flex gap-3">
        <button type="button" className="btn-secondary" onClick={onContinue}>Continue</button>
        <button type="button" className="btn-secondary" onClick={onStartOver}>Start over</button>
      </div>
    </div>
  );
}
