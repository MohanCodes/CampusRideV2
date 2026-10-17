"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// WEB_FLOWS.md Section 7: every screen shows this when the connection drops.
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="border-b border-line bg-pale px-4 py-2 text-center text-sm">
      You&apos;re offline. Trips may be out of date.
    </div>
  );
}
