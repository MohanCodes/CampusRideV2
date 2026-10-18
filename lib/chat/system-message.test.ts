import { describe, expect, it } from "vitest";
import { personalizeSystemMessage as p } from "./system-message";

describe("personalizeSystemMessage", () => {
  it("tells the driver they accepted the rider, and the rider who accepted them", () => {
    expect(p("Sam accepted Riley. You can plan the pickup here.", true)).toBe("You accepted Riley. You can plan the pickup here.");
    expect(p("Sam accepted Riley. You can plan the pickup here.", false)).toBe("Sam accepted you. You can plan the pickup here.");
  });
  it("words an accepted offer for each side", () => {
    const body = "Riley accepted Sam's offer. You can plan the pickup here.";
    expect(p(body, true)).toBe("Riley accepted your offer. You can plan the pickup here.");
    expect(p(body, false)).toBe("You accepted Sam's offer. You can plan the pickup here.");
  });
  it("tells the sender, not the other person, in their own voice", () => {
    expect(p("Riley cancelled their seat.", true)).toBe("You cancelled your seat.");
    expect(p("Riley cancelled their seat.", false)).toBe("Riley cancelled their seat.");
    expect(p("Sam cancelled this trip.", true)).toBe("You cancelled this trip.");
    expect(p("Sam cancelled this trip.", false)).toBe("Sam cancelled this trip.");
    expect(p("Sam changed the departure time. Check the trip for the new time.", true)).toBe("You changed the departure time. Check the trip for the new time.");
    expect(p("Sam changed the departure time. Check the trip for the new time.", false)).toBe("Sam changed the departure time. Check the trip for the new time.");
  });
  it("leaves anything it does not recognize alone", () => {
    expect(p("Something else happened.", true)).toBe("Something else happened.");
    expect(p("Sam accepted Riley. Bring snacks.", false)).toBe("Sam accepted Riley. Bring snacks.");
  });
});
