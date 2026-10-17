import { describe, expect, it } from "vitest";
import { backByDate, hhmm, localToUtc, nextHalfHour } from "./tz";

describe("localToUtc", () => {
  it("reads a typed time as Los Angeles time", () => {
    expect(localToUtc("2026-10-17", "15:30")?.toISOString()).toBe("2026-10-17T22:30:00.000Z"); // PDT, UTC-7
    expect(localToUtc("2026-12-17", "15:30")?.toISOString()).toBe("2026-12-17T23:30:00.000Z"); // PST, UTC-8
  });
  it("handles midnight and the last minute of the day", () => {
    expect(localToUtc("2026-10-17", "00:00")?.toISOString()).toBe("2026-10-17T07:00:00.000Z");
    expect(localToUtc("2026-10-17", "23:59")?.toISOString()).toBe("2026-10-18T06:59:00.000Z");
  });
  it("refuses a time that doesn't exist when clocks skip forward", () => {
    expect(localToUtc("2027-03-14", "02:30")).toBeNull(); // 2:00 jumps to 3:00
    expect(localToUtc("2027-03-14", "03:30")).not.toBeNull();
  });
  it("picks the first of a repeated hour when clocks go back", () => {
    // Nov 1, 2026: 1:30 AM happens twice. The first one is still PDT.
    expect(localToUtc("2026-11-01", "01:30")?.toISOString()).toBe("2026-11-01T08:30:00.000Z");
  });
  it.each([["2026-02-30", "10:00"], ["2026-13-01", "10:00"], ["abc", "10:00"], ["2026-10-17", "25:00"], ["2026-10-17", "10:60"], ["2026-10-17", "9:00"]])(
    "rejects %s %s", (d, t) => expect(localToUtc(d, t)).toBeNull(),
  );
});

describe("nextHalfHour", () => {
  it("rounds up to the next :00 or :30 in campus time", () => {
    expect(nextHalfHour(new Date("2026-10-17T20:10:00Z"))).toEqual({ date: "2026-10-17", time: "13:30" }); // 1:10 PM
    expect(nextHalfHour(new Date("2026-10-17T20:40:00Z"))).toEqual({ date: "2026-10-17", time: "14:00" });
  });
  it("moves on from exactly on the half hour", () => {
    expect(nextHalfHour(new Date("2026-10-17T20:30:00Z"))).toEqual({ date: "2026-10-17", time: "14:00" });
  });
  it("rolls into the next day late at night", () => {
    expect(nextHalfHour(new Date("2026-10-18T06:50:00Z"))).toEqual({ date: "2026-10-18", time: "00:00" }); // 11:50 PM PDT
  });
});

describe("backByDate", () => {
  it("stays on the same day when it is later", () => expect(backByDate("2026-10-17", "15:00", "17:00")).toBe("2026-10-17"));
  it("moves to the next day when the clock time is earlier or equal", () => {
    expect(backByDate("2026-10-17", "23:00", "01:00")).toBe("2026-10-18");
    expect(backByDate("2026-12-31", "23:00", "01:00")).toBe("2027-01-01");
    expect(backByDate("2026-10-17", "15:00", "15:00")).toBe("2026-10-18");
  });
});

describe("hhmm", () => {
  it("is 24-hour, in campus time", () => expect(hhmm(new Date("2026-10-17T22:30:00Z"))).toBe("15:30"));
});
