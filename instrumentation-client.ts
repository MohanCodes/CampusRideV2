import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Starts error reporting in the browser. Nothing is sent unless a DSN was set at build time.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
