import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Starts error reporting on the server. Nothing is sent unless SENTRY_DSN is set.
export function register() {
  Sentry.init(sentryOptions(process.env.SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
