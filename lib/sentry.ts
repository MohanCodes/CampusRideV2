// Sentry settings shared by the server and the browser (BUILD.md Section 13). Errors only: no tracing, no replay, no
// personal data. scrubEvent removes anything that could identify a student before an event leaves the app.
import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const redact = (s: string) => s.replace(EMAIL, "[email]");

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.message) event.message = redact(event.message);
  for (const v of event.exception?.values ?? []) if (v.value) v.value = redact(v.value);
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = redact(b.message);
    delete b.data;
  }
  return event;
}

export function sentryOptions(dsn: string | undefined) {
  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}
