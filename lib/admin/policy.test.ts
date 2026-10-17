import { describe, expect, it } from "vitest";
import { noShowSuggestion } from "./policy";

describe("noShowSuggestion", () => {
  it("says nothing for the first no-show", () => {
    expect(noShowSuggestion(0)).toBeNull();
    expect(noShowSuggestion(1)).toBeNull();
  });
  it("suggests a warning for the second", () => expect(noShowSuggestion(2)).toBe("Second no-show: send a warning."));
  it("suggests a 7-day suspension for the third and beyond", () => {
    expect(noShowSuggestion(3)).toBe("Third no-show or more: suspend for 7 days.");
    expect(noShowSuggestion(9)).toBe("Third no-show or more: suspend for 7 days.");
  });
});
