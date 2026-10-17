import { CAMPUS_TZ } from "@/lib/campuses";

// Every time in the app shows in the campus time zone, in relative form where possible
// ("Today, 3:30 PM"). Built on Intl so daylight saving is handled by the platform.

type Parts = { y: number; m: number; d: number; h: number; min: number };

function partsIn(ms: number, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", hourCycle: "h23",
  });
  const get = (t: string) => Number(f.formatToParts(ms).find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-17" for the calendar day a moment falls on in the campus time zone. */
export function dayKey(date: Date | string, tz = CAMPUS_TZ): string {
  const p = partsIn(new Date(date).getTime(), tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function tzOffsetMs(ms: number, tz: string): number {
  const p = partsIn(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(ms / 60000) * 60000;
}

/** The instant a calendar day starts in the campus time zone. Handles 23- and 25-hour days. */
export function dayStart(key: string, tz = CAMPUS_TZ): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let start = guess - tzOffsetMs(guess, tz);
  start = guess - tzOffsetMs(start, tz); // settle across a clock change
  return new Date(start);
}

export function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
}

/** Whole calendar days from `now` to `date` in the campus time zone (0 = today, 1 = tomorrow). */
export function dayDiff(date: Date | string, now: Date, tz = CAMPUS_TZ): number {
  const a = dayKey(date, tz).split("-").map(Number);
  const b = dayKey(now, tz).split("-").map(Number);
  return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000);
}

export function formatTime(date: Date | string, tz = CAMPUS_TZ): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(date))
    .replace(/[  ]/g, " ");
}

function weekdayDate(date: Date | string, tz: string, long = false): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: long ? "long" : "short", month: "short", day: "numeric" })
    .format(new Date(date));
}

/** "Today", "Tomorrow", "Yesterday", or "Sat, Oct 24". */
export function formatDay(date: Date | string, now: Date, tz = CAMPUS_TZ): string {
  const diff = dayDiff(date, now, tz);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return weekdayDate(date, tz);
}

/** "Today, 3:30 PM". */
export function formatDeparture(date: Date | string, now: Date, tz = CAMPUS_TZ): string {
  return `${formatDay(date, now, tz)}, ${formatTime(date, tz)}`;
}

/** "Back by 5:00 PM", with the day only when it isn't the departure day. */
export function formatBackBy(backBy: Date | string, departs: Date | string, now: Date, tz = CAMPUS_TZ): string {
  const sameDay = dayKey(backBy, tz) === dayKey(departs, tz);
  return `Back by ${sameDay ? "" : formatDay(backBy, now, tz) + ", "}${formatTime(backBy, tz)}`;
}

/** Section heading for a day on the board: "Today", "Tomorrow", "Saturday, Oct 24". */
export function formatDayHeader(key: string, now: Date, tz = CAMPUS_TZ): string {
  const start = dayStart(key, tz);
  const diff = dayDiff(start, now, tz);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return weekdayDate(start, tz, true);
}

/** When a rider is free: "Tomorrow, 3:00 PM to 4:00 PM", or "Tomorrow, any time". */
export function formatWindow(
  start: Date | string, end: Date | string, flexibility: "exact" | "pm30" | "pm60" | "anytime",
  now: Date, tz = CAMPUS_TZ,
): string {
  const day = formatDay(start, now, tz);
  if (flexibility === "anytime") return `${day}, any time`;
  if (flexibility === "exact") return `${day}, ${formatTime(start, tz)}`;
  return `${day}, ${formatTime(start, tz)} to ${formatTime(end, tz)}`;
}

/** The middle of a request's window: the time it is centered on, for pre-filling edit forms and offers. */
export function requestCenter(
  windowStart: Date | string, windowEnd: Date | string, flexibility: "exact" | "pm30" | "pm60" | "anytime",
): Date {
  const a = new Date(windowStart).getTime();
  const b = new Date(windowEnd).getTime();
  if (flexibility === "exact") return new Date(a);
  if (flexibility === "anytime") return new Date(a + 12 * 3600_000);
  return new Date((a + b) / 2);
}
