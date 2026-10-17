import { z } from "zod";

// The three email switches in Settings. The names match profiles.notification_prefs and email_allowed() in the database.
// Sign-in codes, account notices, and the report receipt always send, so they are not here.
export const NOTIFICATION_KEYS = ["requests", "messages", "reminders"] as const;
export type NotificationPrefs = Record<(typeof NOTIFICATION_KEYS)[number], boolean>;

export const notificationPrefsSchema = z.object({
  requests: z.boolean(),
  messages: z.boolean(),
  reminders: z.boolean(),
});

export const DEFAULT_PREFS: NotificationPrefs = { requests: true, messages: true, reminders: true };

/** Reads the stored jsonb, tolerating missing or odd keys by falling back to "on". */
export function readPrefs(raw: unknown): NotificationPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    requests: o.requests !== false,
    messages: o.messages !== false,
    reminders: o.reminders !== false,
  };
}
