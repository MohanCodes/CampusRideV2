"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

// Copies the short summary a rider can send to a friend (WEB_FLOWS.md Section 6.2).
export function CopyTripDetails({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={copy}>
        <Icon name="copy" size={16} />
        Copy trip details
      </button>
      <span role="status" className="text-sm text-muted">
        {state === "copied" && "Copied."}
        {state === "failed" && "Couldn't copy. Select the details and copy them."}
      </span>
    </>
  );
}
