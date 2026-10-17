import { describe, expect, it } from "vitest";
import { notificationPrefsSchema, readPrefs } from "./account";

describe("notificationPrefsSchema", () => {
  it("takes three booleans", () => expect(notificationPrefsSchema.safeParse({ requests: true, messages: false, reminders: true }).success).toBe(true));
  it("refuses a missing key or a non-boolean", () => {
    expect(notificationPrefsSchema.safeParse({ requests: true, messages: false }).success).toBe(false);
    expect(notificationPrefsSchema.safeParse({ requests: "yes", messages: false, reminders: true }).success).toBe(false);
  });
});

describe("readPrefs", () => {
  it("defaults everything to on", () => expect(readPrefs(null)).toEqual({ requests: true, messages: true, reminders: true }));
  it("keeps what was switched off", () => expect(readPrefs({ messages: false })).toEqual({ requests: true, messages: false, reminders: true }));
  it("ignores junk", () => expect(readPrefs("x")).toEqual({ requests: true, messages: true, reminders: true }));
});
