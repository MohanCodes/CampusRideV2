import { describe, expect, it } from "vitest";
import {
  requestCenter, dayDiff, dayKey, dayStart, formatBackBy, formatDay, formatDayHeader, formatDeparture, formatTime, formatWindow, nextDayKey,
} from "./time";

// Saturday, Oct 17, 2026, 1:00 PM in Los Angeles (PDT, UTC-7).
const NOW = new Date("2026-10-17T20:00:00Z");

describe("campus time zone", () => {
  it("reads the calendar day in Los Angeles, not UTC", () => {
    // 2:00 AM UTC on Oct 18 is still the evening of Oct 17 in LA.
    expect(dayKey("2026-10-18T02:00:00Z")).toBe("2026-10-17");
    expect(dayKey("2026-10-18T08:00:00Z")).toBe("2026-10-18");
  });
  it("formats times without non-breaking spaces", () => {
    expect(formatTime("2026-10-17T22:30:00Z")).toBe("3:30 PM");
    expect(formatTime("2026-10-17T07:00:00Z")).toBe("12:00 AM");
    expect(formatTime("2026-10-17T19:05:00Z")).toBe("12:05 PM");
  });
});

describe("relative days", () => {
  it("says Today, Tomorrow, Yesterday", () => {
    expect(formatDay("2026-10-17T22:30:00Z", NOW)).toBe("Today");
    expect(formatDay("2026-10-18T22:30:00Z", NOW)).toBe("Tomorrow");
    expect(formatDay("2026-10-16T22:30:00Z", NOW)).toBe("Yesterday");
  });
  it("uses the weekday and date after that", () => {
    expect(formatDay("2026-10-24T22:30:00Z", NOW)).toBe("Sat, Oct 24");
  });
  it("counts days by the LA calendar, so late evening trips are still 'Today'", () => {
    expect(dayDiff("2026-10-18T05:00:00Z", NOW)).toBe(0); // 10 PM Oct 17 in LA
    expect(dayDiff("2026-10-18T08:00:00Z", NOW)).toBe(1);
  });
  it("formats a departure", () => {
    expect(formatDeparture("2026-10-17T22:30:00Z", NOW)).toBe("Today, 3:30 PM");
  });
});

describe("back by", () => {
  it("omits the day when it is the same day", () => {
    expect(formatBackBy("2026-10-18T00:00:00Z", "2026-10-17T22:30:00Z", NOW)).toBe("Back by 5:00 PM");
  });
  it("adds the day when it is not", () => {
    expect(formatBackBy("2026-10-19T00:00:00Z", "2026-10-17T22:30:00Z", NOW)).toBe("Back by Tomorrow, 5:00 PM");
  });
});

describe("day headers", () => {
  it("names the day", () => {
    expect(formatDayHeader("2026-10-17", NOW)).toBe("Today");
    expect(formatDayHeader("2026-10-18", NOW)).toBe("Tomorrow");
    expect(formatDayHeader("2026-10-24", NOW)).toBe("Saturday, Oct 24");
  });
});

describe("day boundaries across daylight saving", () => {
  it("starts a normal PDT day at 07:00 UTC", () => {
    expect(dayStart("2026-10-17").toISOString()).toBe("2026-10-17T07:00:00.000Z");
  });
  it("makes the day clocks go back a 25-hour day", () => {
    // Nov 1, 2026: PDT ends at 2 AM. The day runs 07:00Z to 08:00Z the next day.
    const len = dayStart(nextDayKey("2026-11-01")).getTime() - dayStart("2026-11-01").getTime();
    expect(len / 3600000).toBe(25);
  });
  it("makes the day clocks go forward a 23-hour day", () => {
    const len = dayStart(nextDayKey("2027-03-14")).getTime() - dayStart("2027-03-14").getTime();
    expect(len / 3600000).toBe(23);
  });
  it("rolls over month and year ends", () => {
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
    expect(nextDayKey("2026-02-28")).toBe("2026-03-01");
  });
});

describe("rider windows", () => {
  const s = "2026-10-18T22:00:00Z";
  const e = "2026-10-18T23:00:00Z";
  it("shows an exact time", () => expect(formatWindow(s, e, "exact", NOW)).toBe("Tomorrow, 3:00 PM"));
  it("shows a range for plus or minus", () => expect(formatWindow(s, e, "pm30", NOW)).toBe("Tomorrow, 3:00 PM to 4:00 PM"));
  it("says any time", () => expect(formatWindow(s, e, "anytime", NOW)).toBe("Tomorrow, any time"));
});

describe("requestCenter", () => {
  const a = "2026-10-18T22:00:00Z";
  const b = "2026-10-19T00:00:00Z";
  it("is the start for an exact request", () => expect(requestCenter(a, b, "exact").toISOString()).toBe("2026-10-18T22:00:00.000Z"));
  it("is the middle for a plus or minus window", () => expect(requestCenter(a, b, "pm60").toISOString()).toBe("2026-10-18T23:00:00.000Z"));
  it("is midday for an any-time request", () => expect(requestCenter("2026-10-18T07:00:00Z", "2026-10-19T07:00:00Z", "anytime").toISOString()).toBe("2026-10-18T19:00:00.000Z"));
});
