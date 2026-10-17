import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNext, signInUrl } from "./routes";

describe("isProtectedPath", () => {
  it.each(["/post", "/rides", "/inbox", "/me", "/chat/abc", "/trip/abc", "/request/abc", "/user/abc", "/admin", "/onboarding"])(
    "protects %s",
    (p) => expect(isProtectedPath(p)).toBe(true),
  );
  it.each(["/", "/sign-in", "/auth/callback", "/safety", "/terms", "/privacy", "/api/health"])(
    "leaves %s open",
    (p) => expect(isProtectedPath(p)).toBe(false),
  );
  it("does not treat a lookalike prefix as open", () => {
    expect(isProtectedPath("/safety-check")).toBe(true);
    expect(isProtectedPath("/authors")).toBe(true);
  });
});

describe("safeNext", () => {
  it("keeps a path on this site, query included", () => {
    expect(safeNext("/trip/123?x=1")).toBe("/trip/123?x=1");
  });
  it.each([null, undefined, "", "trip/1", "//evil.com", "https://evil.com", "/\\evil.com", "/ok\u0000", "javascript:alert(1)"])(
    "falls back to / for %j",
    (v) => expect(safeNext(v as string | null)).toBe("/"),
  );
});

describe("signInUrl", () => {
  it("encodes the way back", () => {
    expect(signInUrl("/trip/1", "?a=b")).toBe("/sign-in?next=%2Ftrip%2F1%3Fa%3Db");
  });
});
