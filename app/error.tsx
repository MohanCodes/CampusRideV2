"use client";

import { ErrorState } from "@/components/states";

// Anything that throws while rendering lands here: a plain message and a way to try again.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-[560px] px-4 py-16 sm:px-[25px]">
      <ErrorState onRetry={reset} />
    </main>
  );
}
