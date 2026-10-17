import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, errorCode, errorMessage } from "./errors";

describe("errorMessage", () => {
  it("maps a database error code to a plain sentence", () => {
    expect(errorMessage({ message: "trip_full" })).toBe("This trip just filled up.");
  });
  it("finds the code inside a longer message", () => {
    expect(errorMessage({ message: "P0001: account_suspended" })).toBe("Your account is paused, so you can't do this right now.");
  });
  it("accepts an Error or a string", () => {
    expect(errorMessage(new Error("time_in_past"))).toContain("already passed");
    expect(errorMessage("rate_limited")).toContain("Too many tries");
  });
  it("does not match a code inside a longer word", () => {
    expect(errorMessage({ message: "not_found_anywhere_else" })).toBe(GENERIC_ERROR);
  });
  it("falls back for anything unknown", () => {
    expect(errorMessage({ message: "something odd" })).toBe(GENERIC_ERROR);
    expect(errorMessage(null)).toBe(GENERIC_ERROR);
  });
  it("hides blocks behind an ordinary unavailable message", () => {
    expect(errorMessage("blocked")).toBe("This isn't available.");
    expect(errorMessage("blocked").toLowerCase()).not.toContain("block");
  });
  it("never uses an exclamation mark", () => {
    for (const code of ["not_signed_in", "trip_full", "rate_limited", "invalid_profile"]) {
      expect(errorMessage(code)).not.toContain("!");
    }
  });
  it("covers the trip-posting codes", () => {
    expect(errorMessage("trip_too_far")).toBe("Pick a time within the next 60 days.");
    expect(errorMessage("contact_info")).toBe("Keep contact details in the app chat.");
    expect(errorMessage("invalid_trip")).toContain("Check the trip details");
  });
  it("exposes the code", () => {
    expect(errorCode({ message: "overlap" })).toBe("overlap");
    expect(errorCode({ message: "nope" })).toBeNull();
  });
});
