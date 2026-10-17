import { describe, expect, it } from "vitest";
import { digitsOnly } from "@/lib/format/code";
import { NOT_SCHOOL_EMAIL, emailSchema, verifyCodeSchema } from "./auth";
import { onboardingSchema } from "./onboarding";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Maya@HMC.edu ")).toBe("maya@hmc.edu");
  });
  it.each(["", "maya", "maya@", "@hmc.edu", "maya @hmc.edu", "a".repeat(250) + "@hmc.edu"])("rejects %j", (v) => {
    const r = emailSchema.safeParse(v);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe(NOT_SCHOOL_EMAIL);
  });
});

describe("verifyCodeSchema", () => {
  it("accepts six digits", () => expect(verifyCodeSchema.safeParse({ email: "a@hmc.edu", code: "123456" }).success).toBe(true));
  it.each(["12345", "1234567", "12345a", "", "12 456"])("rejects %j", (code) =>
    expect(verifyCodeSchema.safeParse({ email: "a@hmc.edu", code }).success).toBe(false),
  );
});

describe("digitsOnly", () => {
  it("keeps up to six digits from pasted text", () => {
    expect(digitsOnly("Your code: 123 456!")).toBe("123456");
    expect(digitsOnly("1234567890")).toBe("123456");
    expect(digitsOnly("abc")).toBe("");
  });
});

describe("onboardingSchema", () => {
  const ok = { firstName: "Uma", lastName: "Patel", classYear: "2028", bio: "", avatarPath: "u/profile.webp" };
  it("accepts a complete profile and turns the year into a number", () => {
    const r = onboardingSchema.parse(ok);
    expect(r.classYear).toBe(2028);
  });
  it("trims names", () => expect(onboardingSchema.parse({ ...ok, firstName: "  Uma  " }).firstName).toBe("Uma"));
  it("requires the photo with a plain message", () => {
    const r = onboardingSchema.safeParse({ ...ok, avatarPath: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Add a photo of your face to continue.");
  });
  it.each([{ firstName: "" }, { lastName: "   " }, { classYear: "1999" }, { classYear: "abc" }, { bio: "x".repeat(281) }])(
    "rejects %j",
    (bad) => expect(onboardingSchema.safeParse({ ...ok, ...bad }).success).toBe(false),
  );
});
