import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/data/types";
import { QUICK_REPLIES, lastId, mergeMessages } from "./merge";

const m = (id: number, body = `m${id}`): ChatMessage => ({ id, senderId: "a", body, kind: "user", createdAt: "2026-10-17T20:00:00Z" });

describe("mergeMessages", () => {
  it("keeps one copy of a message that arrives twice", () => {
    expect(mergeMessages([m(1), m(2)], [m(2), m(3)]).map((x) => x.id)).toEqual([1, 2, 3]);
  });
  it("puts late arrivals in order", () => {
    expect(mergeMessages([m(1), m(4)], [m(3), m(2)]).map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });
  it("takes the newer copy of the same id", () => {
    expect(mergeMessages([m(1, "old")], [m(1, "new")])[0].body).toBe("new");
  });
  it("does not change its inputs", () => {
    const a = [m(2)];
    mergeMessages(a, [m(1)]);
    expect(a.map((x) => x.id)).toEqual([2]);
  });
  it("copes with nothing", () => {
    expect(mergeMessages([], [])).toEqual([]);
    expect(lastId([])).toBe(0);
    expect(lastId([m(5), m(2)])).toBe(5);
  });
});

describe("quick replies", () => {
  it("are the three from the spec", () => expect([...QUICK_REPLIES]).toEqual(["On my way", "Running 5 min late", "I'm here"]));
});
