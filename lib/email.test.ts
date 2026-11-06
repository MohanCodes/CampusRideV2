import { describe, expect, it } from "vitest";
import { canonicalEmail } from "./email";
import { emailSchema } from "./schemas/auth";

describe("canonicalEmail", () => {
  it("folds the longer domains into the shorter ones", () => {
    expect(canonicalEmail("ada@g.hmc.edu")).toBe("ada@hmc.edu");
    expect(canonicalEmail("ada@claremontmckenna.edu")).toBe("ada@cmc.edu");
  });
  it("leaves every other address alone", () => {
    for (const e of ["ada@hmc.edu", "ada@cmc.edu", "ada@pomona.edu", "ada@scrippscollege.edu", "ada@pitzer.edu", "ada@gmail.com", "nope"]) {
      expect(canonicalEmail(e)).toBe(e);
    }
  });
  it("does not touch lookalike domains", () => {
    expect(canonicalEmail("ada@evil-g.hmc.edu")).toBe("ada@evil-g.hmc.edu");
    expect(canonicalEmail("ada@g.hmc.edu.evil.com")).toBe("ada@g.hmc.edu.evil.com");
  });
  it("is applied by the sign-in schema, after trimming and lowercasing", () => {
    expect(emailSchema.parse("  Ada@G.HMC.edu ")).toBe("ada@hmc.edu");
  });
});
