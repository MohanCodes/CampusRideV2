"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function CopyLink({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
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
        Copy link
      </button>
      <span role="status" className="text-sm text-muted">
        {state === "copied" && "Link copied."}
        {state === "failed" && "Couldn't copy the link."}
      </span>
    </>
  );
}
