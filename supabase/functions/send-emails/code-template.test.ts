import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMAIL_COLORS } from "./templates.ts";

// The sign-in code email lives in Supabase Auth (pasted into the dashboard), not in the Edge Function, so it gets its own check.
const html = readFileSync("supabase/templates/code.html", "utf8");

describe("supabase/templates/code.html", () => {
  it("shows the six-digit code and nothing that signs in by link", () => {
    expect(html).toContain("{{ .Token }}");
    expect(html).not.toContain("ConfirmationURL");
    expect(html).not.toMatch(/<a\s/i);
  });
  it("says how long the code lasts and what to do if you didn't ask", () => {
    expect(html).toContain("10 minutes");
    expect(html).toContain("you can ignore this email");
  });
  it("uses the app's email colors only", () => {
    const used = [...html.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase());
    const allowed: string[] = Object.values(EMAIL_COLORS);
    expect(used.filter((c) => !allowed.includes(c))).toEqual([]);
  });
  it("carries the plain safety sentence", () => {
    expect(html).toContain("Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.");
  });
});
