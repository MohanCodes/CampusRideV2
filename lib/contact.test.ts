import { describe, expect, it } from "vitest";
import { containsContactInfo } from "./contact";

// The same examples as supabase/tests/step1_schema.test.sql and step5_post_trip.test.sql.
describe("containsContactInfo", () => {
  it.each([
    "call me 909-555-0123",
    "text +1 (909) 555 0123",
    "maya@hmc.edu",
    "find me @maya_k",
    "see https://example.com/x",
    "www.example.org",
    "im at maya.me",
    "venmo @maya_k",
    "909-555 0123", // a number split across the cost note and notes, joined with a space
  ])("blocks %j", (t) => expect(containsContactInfo(t)).toBe(true));

  it.each([
    "Back by 5, no big bags",
    "Leave at 3:30, home by 5:00 PM",
    "Trader Joe's and Target, 3 seats open",
    "Split gas and parking",
    "Suggested: split gas and parking, no profit",
    "About $5 each",
    "",
    null,
    undefined,
  ])("allows %j", (t) => expect(containsContactInfo(t)).toBe(false));
});
