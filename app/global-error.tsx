"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorState } from "@/components/states";
import "./globals.css";

// Used only when the root layout itself fails. It has to bring its own <html> and <body>.
export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body className="min-h-screen">
        <main id="main" className="mx-auto max-w-[560px] px-4 py-16 sm:px-[25px]">
          <ErrorState onRetry={reset} />
        </main>
      </body>
    </html>
  );
}
