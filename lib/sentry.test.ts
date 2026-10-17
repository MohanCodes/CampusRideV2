import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent, sentryOptions } from "./sentry";

const event = (over: Partial<ErrorEvent> = {}): ErrorEvent => ({ type: undefined, ...over }) as ErrorEvent;

describe("scrubEvent", () => {
  it("drops the user, cookies, headers, body and query string", () => {
    const e = scrubEvent(event({
      user: { id: "u1", email: "a@pomona.edu" },
      request: { url: "https://x.example/trip/1?token=secret", cookies: { sb: "x" }, headers: { cookie: "y" }, data: "body", query_string: "token=secret" },
    }));
    expect(e.user).toBeUndefined();
    expect(e.request).toEqual({ url: "https://x.example/trip/1" });
  });
  it("redacts email addresses in messages, errors and breadcrumbs", () => {
    const e = scrubEvent(event({
      message: "failed for rae@pomona.edu",
      exception: { values: [{ value: "no profile for dee@hmc.edu" }] },
      breadcrumbs: [{ message: "sent to ron@cmc.edu", data: { to: "ron@cmc.edu" } }],
    }));
    expect(JSON.stringify(e)).not.toMatch(/@(pomona|hmc|cmc)\.edu/);
    expect(e.message).toBe("failed for [email]");
    expect(e.breadcrumbs?.[0].data).toBeUndefined();
  });
  it("copes with an event that has none of those fields", () => {
    expect(() => scrubEvent(event())).not.toThrow();
  });
});

describe("sentryOptions", () => {
  it("is off without a DSN", () => expect(sentryOptions("").enabled).toBe(false));
  it("is on with one, and never sends default personal data or traces", () => {
    const o = sentryOptions("https://k@o1.ingest.sentry.io/1");
    expect(o).toMatchObject({ enabled: true, sendDefaultPii: false, tracesSampleRate: 0 });
  });
});
