// Database functions raise short codes (BUILD.md Section 6.1). These are the plain sentences
// people see, in the voice from WEB_FLOWS.md Section 7: short, no blame, no exclamation marks.
// "blocked" deliberately reads like any other unavailable result, so nobody learns they were blocked.
const MESSAGES: Record<string, string> = {
  not_signed_in: "Sign in to continue.",
  not_onboarded: "Finish your profile to continue.",
  account_suspended: "Your account is paused, so you can't do this right now.",
  invalid_profile: "Check your name, class year, and photo, then try again.",
  meetup_not_allowed: "Pick an approved meetup point.",
  invalid_trip: "Check the trip details and try again.",
  contact_info: "Keep contact details in the app chat.",
  trip_too_far: "Pick a time within the next 60 days.",
  time_in_past: "That time has already passed. Pick a later one.",
  overlap: "You already have a trip at this time.",
  forbidden: "You can't do that.",
  seats_below_taken: "You already have more riders than that.",
  own_trip: "This is your own trip.",
  trip_unavailable: "This trip isn't available.",
  trip_full: "This trip just filled up.",
  already_requested: "You already asked for a seat on this trip.",
  blocked: "This isn't available.",
  not_pending: "That request was already answered.",
  too_many_requests: "You can have 2 open requests. Cancel one to add another.",
  too_far_ahead: "Pick a time within the next 7 days.",
  not_open: "This request isn't open anymore.",
  trip_mismatch: "This trip doesn't match that request.",
  too_many_offers: "You have 10 offers waiting. Wait for replies or withdraw one.",
  no_longer_available: "This ride isn't available anymore.",
  too_early: "You can report a no-show after the departure time.",
  invalid_target: "We couldn't find that to report.",
  not_found: "We couldn't find that.",
  rate_limited: "Too many tries. Wait a bit, then try again.",
};

export const GENERIC_ERROR = "Something went wrong. Try again.";

// Accepts a Postgrest error, an Error, or a plain string. Matches the code as a whole word so
// "trip_full" is never confused with a longer message that merely contains it.
export function errorMessage(error: unknown): string {
  const text =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  for (const code of Object.keys(MESSAGES)) {
    if (new RegExp(`(^|[^a-z_])${code}($|[^a-z_])`).test(text)) return MESSAGES[code];
  }
  return GENERIC_ERROR;
}

export function errorCode(error: unknown): string | null {
  const text = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  return Object.keys(MESSAGES).find((c) => new RegExp(`(^|[^a-z_])${c}($|[^a-z_])`).test(text)) ?? null;
}
