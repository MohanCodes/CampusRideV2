// Email templates (BUILD.md Section 8.2): plain and short, in the voice of WEB_FLOWS.md Section 7.
// Pure functions with no Deno or network use, so they run in Node tests too.
//
// Rules this file keeps:
//  - Every email names the other person by first name only, gives the trip line ("Trader Joe's, Today 3:30 PM"),
//    has one button to the right page, and a footer linking to notification settings and the Safety page.
//  - Emails never carry a last name, a phone number, the plate, the exact spot to stand, or message text.
//    The database only hands over what is allowed (email_context in migration 21); nothing here adds to it.
//  - Every dynamic value is escaped before it goes into HTML.

export type EmailContext = {
  link_path: string;
  other_first_name?: string;
  other_first_names?: string[];
  destination?: string;
  departs_at?: string;
  window_end?: string;
  meetup_point?: string;
  reason?: string;
  until?: string;
  count?: number;
};

export type ClaimedEmail = {
  id: number;
  to_email: string;
  to_first_name: string | null;
  template: string;
  context: EmailContext;
};

export type RenderOptions = { siteUrl: string; now: Date; tz?: string };
export type Rendered = { subject: string; html: string; text: string };

export const TEMPLATE_NAMES = [
  "seat_requested", "seat_accepted", "seat_declined", "request_expired", "trip_cancelled", "trip_time_changed",
  "rider_cancelled", "offer_received", "offer_accepted", "offer_declined", "offer_closed", "offer_withdrawn",
  "match_for_rider", "match_for_driver", "request_ending_soon", "meetup_reminder", "new_message",
  "report_received", "account_warning", "account_suspended",
  "admin_digest",
] as const;

// The campus colors from WEB_FLOWS.md Section 7 (Light). Email can't use CSS variables, so these are the
// same values written out; a test checks they still match the design tokens.
export const EMAIL_COLORS = { ink: "#17392e", onInk: "#ffffff", muted: "#5d7168", line: "#cedcd3", mint: "#ddf9ea", page: "#fcfdf9" } as const;

const DEFAULT_TZ = "America/Los_Angeles";
const SAFETY_SENTENCE = "Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.";

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const parts = (d: Date, tz: string) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const get = (t: string) => Number(f.find((p) => p.type === t)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
};

export function formatTime(date: Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(/[  ]/g, " ");
}

/** "Today 3:30 PM", "Tomorrow 9:00 AM", or "Sat, Oct 24 3:30 PM". */
export function formatWhen(date: Date, now: Date, tz = DEFAULT_TZ): string {
  const diff = Math.round((parts(date, tz) - parts(now, tz)) / 86_400_000);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday"
    : new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(date);
  return `${day} ${formatTime(date, tz)}`;
}

/** "Trader Joe's, Today 3:30 PM". */
export function tripLine(c: EmailContext, o: RenderOptions): string {
  const where = c.destination ?? "your trip";
  return c.departs_at ? `${where}, ${formatWhen(new Date(c.departs_at), o.now, o.tz)}` : where;
}

type Body = { subject: string; lines: string[]; button: string };

function body(c: ClaimedEmail["context"], template: string, o: RenderOptions): Body {
  const name = c.other_first_name ?? "Someone";
  const line = tripLine(c, o);
  const where = c.destination ?? "your trip";
  const closes = c.window_end ? formatWhen(new Date(c.window_end), o.now, o.tz) : "soon";
  const names = c.other_first_names?.length ? c.other_first_names.join(", ") : "your riders";
  const meet = c.meetup_point ?? "the meetup point";

  switch (template) {
    case "seat_requested":
      return { subject: `${name} wants a seat`, lines: [`${name} asked for a seat on your trip: ${line}.`, "You can accept or decline in the app."], button: "Review the request" };
    case "seat_accepted":
      return { subject: `${name} accepted your request`, lines: [`${name} accepted your request for ${line}.`, "The exact meeting spot and the car's plate are on the trip page, and you can chat there."], button: "Open the trip" };
    case "seat_declined":
      return { subject: `${name} can't take you this time`, lines: [`${name} can't take you on ${line}.`, `There may be other rides to ${where}.`], button: "Find another ride" };
    case "request_expired":
      return c.other_first_name
        ? { subject: `Your request to ${name} expired`, lines: [`${name} didn't answer your request for ${line} before the trip left.`, `There may be other rides to ${where}.`], button: "Find another ride" }
        : { subject: `Your request for a ride to ${where} expired`, lines: [`No one offered a ride to ${where} before your time passed.`, "You can post a new request."], button: "Ask for a ride" };
    case "trip_cancelled":
      return { subject: `${name} cancelled the trip to ${where}`, lines: [`${name} cancelled the trip: ${line}.`, "Your seat is cancelled too."], button: "Open the trip" };
    case "trip_time_changed":
      return { subject: `${name} changed the time`, lines: [`${name} moved the trip to ${line}.`, "Check that the new time still works for you."], button: "Open the trip" };
    case "rider_cancelled":
      return { subject: `${name} cancelled their seat`, lines: [`${name} won't be on your trip: ${line}.`, "That seat is open again."], button: "Open the trip" };
    case "offer_received":
      return { subject: `${name} offered you a ride`, lines: [`${name} can take you to ${where}: ${line}.`, "You can accept or decline in the app."], button: "See the offer" };
    case "offer_accepted":
      return { subject: `${name} accepted your offer`, lines: [`${name} will ride with you: ${line}.`, "You can plan the pickup in the chat."], button: "Open the trip" };
    case "offer_declined":
      return { subject: `${name} declined your offer`, lines: [`${name} didn't take your offer to ${where}.`], button: "See your rides" };
    case "offer_closed":
      return c.reason === "request_cancelled"
        ? { subject: `${name} cancelled their request`, lines: [`${name} cancelled their request for a ride to ${where}, so your offer is closed.`], button: "Open the board" }
        : c.reason === "request_expired"
          ? { subject: `The request to ${where} expired`, lines: [`The request for a ride to ${where} ended before it was answered, so your offer is closed.`], button: "Open the board" }
          : { subject: `${name} chose another ride`, lines: [`${name} chose another ride to ${where}, so your offer is closed.`], button: "Open the board" };
    case "offer_withdrawn":
      return { subject: `${name} withdrew their offer`, lines: [`${name} can't take you to ${where} after all.`, "Other offers may still come."], button: "Open the request" };
    case "match_for_rider":
      return { subject: `A ride to ${where} is posted`, lines: [`${name} is driving: ${line}. It fits your request.`], button: "See the trip" };
    case "match_for_driver":
      return { subject: `${name} needs a ride to ${where}`, lines: [`${name} asked for a ride to ${where}, and one of your trips fits.`], button: "See the request" };
    case "request_ending_soon":
      return { subject: "Your request ends soon", lines: [`Your request for a ride to ${where} closes at ${closes}, and no one has offered yet.`, "You can keep it open for 2 more hours, or cancel it."], button: "Open the request" };
    case "meetup_reminder":
      return c.link_path.startsWith("/chat/")
        ? { subject: "Your trip leaves soon", lines: [`${name} is driving: ${line}.`, `Meet at ${meet}.`], button: "Open the chat" }
        : { subject: "Your trip leaves soon", lines: [`You're driving: ${line}, with ${names}.`, `Riders will meet you at ${meet}.`], button: "Open the trip" };
    case "new_message":
      return { subject: `${name} sent you a message`, lines: [`${name} wrote to you about ${line}.`, "Open the chat to read it."], button: "Open the chat" };
    case "report_received":
      return { subject: "We got your report", lines: ["Thanks. Our team will review it within 24 hours."], button: "Open CampusRide" };
    case "account_warning":
      return { subject: "A note about your account", lines: ["We received a report about your recent activity.", "Please meet at approved spots, be on time, and report anything off. More reports may pause your account."], button: "Open CampusRide" };
    case "account_suspended":
      return { subject: "Your account is paused", lines: [c.until ? `Your account is paused until ${c.until}.` : "Your account is paused.", "You can still sign in and read, but you can't post, ask for a seat, or send messages."], button: "Open CampusRide" };
    case "admin_digest": {
      const n = c.count ?? 0;
      return { subject: `${n} ${n === 1 ? "report is" : "reports are"} waiting`, lines: [`${n} ${n === 1 ? "report is" : "reports are"} waiting for review.`], button: "Open the queue" };
    }
    default:
      throw new Error(`unknown email template: ${template}`);
  }
}

export function renderEmail(email: ClaimedEmail, o: RenderOptions): Rendered {
  const b = body(email.context, email.template, o);
  const base = o.siteUrl.replace(/\/+$/, "");
  const link = base + email.context.link_path;
  const settings = `${base}/me`;
  const safety = `${base}/safety`;
  const hello = email.to_first_name ? `Hi ${email.to_first_name},` : "Hi,";
  const c = EMAIL_COLORS;

  const text = [hello, "", ...b.lines, "", `${b.button}: ${link}`, "", "--",
    `Notification settings: ${settings}`, `Safety tips: ${safety}`, SAFETY_SENTENCE].join("\n");

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:${c.page};font-family:Arial,Helvetica,sans-serif;color:${c.ink};">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
<p style="font-size:20px;font-weight:700;letter-spacing:-0.04em;margin:0 0 24px;">CampusRide</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">${escapeHtml(hello)}</p>
${b.lines.map((l) => `<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">${escapeHtml(l)}</p>`).join("\n")}
<p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:${c.ink};color:${c.onInk};text-decoration:none;font-size:14px;padding:14px 22px;border-radius:7px;">${escapeHtml(b.button)}</a></p>
<hr style="border:0;border-top:1px solid ${c.line};margin:32px 0 16px;">
<p style="font-size:12px;line-height:1.6;color:${c.muted};margin:0 0 8px;"><a href="${escapeHtml(settings)}" style="color:${c.muted};">Notification settings</a> · <a href="${escapeHtml(safety)}" style="color:${c.muted};">Safety tips</a></p>
<p style="font-size:12px;line-height:1.6;color:${c.muted};margin:0;">${escapeHtml(SAFETY_SENTENCE)}</p>
</div></body></html>`;

  return { subject: b.subject, html, text };
}
