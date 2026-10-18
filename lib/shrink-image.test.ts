import { describe, expect, it } from "vitest";
import { fitWithin } from "./shrink-image";

describe("fitWithin", () => {
  it("shrinks a landscape photo so its long edge is 1024", () => expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 }));
  it("shrinks a portrait photo the same way", () => expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 }));
  it("never enlarges a small photo", () => expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 }));
  it("leaves one that is exactly the limit", () => expect(fitWithin(1024, 600)).toEqual({ width: 1024, height: 600 }));
  it("keeps a very thin photo at least 1 px", () => expect(fitWithin(20000, 5)).toEqual({ width: 1024, height: 1 }));
  it("copes with zero", () => expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 }));
});
