import { CAMPUS_TZ } from "@/lib/campuses";
import { dayKey, dayStart, formatTime } from "./time";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A date and a clock time typed in the campus time zone, as the moment they mean. Returns null for a
 * time that doesn't exist (clocks skipping forward) so the form can say so.
 */
export function localToUtc(date: string, time: string, tz = CAMPUS_TZ): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (h > 23 || mi > 59) return null;

  const start = dayStart(`${d[1]}-${d[2]}-${d[3]}`, tz);
  if (dayKey(start, tz) !== `${d[1]}-${d[2]}-${d[3]}`) return null; // e.g. February 30
  // Walk forward from midnight; the clock reading tells us when we've reached the requested time.
  const wanted = `${pad(h)}:${pad(mi)}`;
  for (let minutes = 0; minutes <= 25 * 60; minutes++) {
    const at = new Date(start.getTime() + minutes * 60_000);
    if (dayKey(at, tz) !== `${d[1]}-${d[2]}-${d[3]}`) break;
    if (hhmm(at, tz) === wanted) return at;
  }
  return null;
}

/** "15:30" in 24-hour form. */
export function hhmm(date: Date, tz = CAMPUS_TZ): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("hour")}:${get("minute")}`;
}

/** The next half hour after `now`, as the date and time fields the post form starts with. */
export function nextHalfHour(now: Date, tz = CAMPUS_TZ): { date: string; time: string } {
  const ms = Math.ceil((now.getTime() + 1) / (30 * 60_000)) * 30 * 60_000;
  const at = new Date(ms);
  return { date: dayKey(at, tz), time: hhmm(at, tz) };
}

/** Whether the back-by clock time lands on the next day (leaving 11:00 PM, back by 1:00 AM). */
export function backByDate(departDate: string, departTime: string, backTime: string): string {
  if (backTime > departTime) return departDate;
  const [y, m, d] = departDate.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
}

export const displayTime = formatTime;
