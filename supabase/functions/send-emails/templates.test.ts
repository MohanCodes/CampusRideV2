import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMAIL_COLORS, TEMPLATE_NAMES, escapeHtml, formatWhen, renderEmail, tripLine, type ClaimedEmail, type EmailContext } from "./templates.ts";

// Saturday, Oct 17 2026, 1:00 PM in Los Angeles.
const NOW = new Date("2026-10-17T20:00:00Z");
const OPTS = { siteUrl: "https://campusride.example", now: NOW };
const TODAY_330 = "2026-10-17T22:30:00Z"; // 3:30 PM LA

const ctx = (over: Partial<EmailContext> = {}): EmailContext => ({
  link_path: "/trip/abc", other_first_name: "Maya", destination: "Trader Joe's", departs_at: TODAY_330, meetup_point: "Platt Campus Center", ...over,
});
const email = (template: string, over: Partial<EmailContext> = {}, to_first_name: string | null = "Alex"): ClaimedEmail =>
  ({ id: 1, to_email: "alex@pomona.edu", to_first_name, template, context: ctx(over) });

describe("every template in BUILD.md Section 8.2", () => {
  it("is covered: 21 templates, including rider_cancelled", () => {
    expect(TEMPLATE_NAMES).toHaveLength(21);
    expect(new Set(TEMPLATE_NAMES).size).toBe(21);
  });

  for (const template of TEMPLATE_NAMES) {
    describe(template, () => {
      const extra: Partial<EmailContext> =
        template === "meetup_reminder" ? { link_path: "/chat/c1" } :
        template === "account_suspended" ? { until: "2026-11-01" } :
        template === "admin_digest" ? { link_path: "/admin/reports", count: 3 } :
        template === "request_ending_soon" ? { window_end: "2026-10-17T21:00:00Z" } : {};
      const r = renderEmail(email(template, extra), OPTS);

      it("has a subject, an HTML body, and a text body", () => {
        expect(r.subject.length).toBeGreaterThan(3);
        expect(r.html).toContain("<html");
        expect(r.text.length).toBeGreaterThan(40);
      });
      it("greets the person by first name", () => {
        expect(r.text.startsWith("Hi Alex,")).toBe(true);
        expect(r.html).toContain("Hi Alex,");
      });
      it("has one button, to the right page on this site", () => {
        expect(r.html.match(/<a href="https:\/\/campusride\.example\/(?!me"|safety")[^"]*"[^>]*display:inline-block/g)).toHaveLength(1);
        expect(r.html).toContain(`href="https://campusride.example${extra.link_path ?? "/trip/abc"}"`);
      });
      it("ends with notification settings and Safety links, and the plain safety sentence", () => {
        const sentence = "Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.";
        for (const body of [r.html, r.text]) {
          expect(body).toContain("https://campusride.example/me");
          expect(body).toContain("https://campusride.example/safety");
        }
        expect(r.text).toContain(sentence);
        expect(r.html).toContain(escapeHtml(sentence)); // HTML escapes the apostrophe
      });
      it("uses plain words: no exclamation marks, no emoji", () => {
        expect(r.subject + r.text).not.toContain("!");
        expect(r.subject + r.text).not.toMatch(/\p{Extended_Pictographic}/u);
      });
      it("never carries a plate, an exact spot, a last name, a phone number, or message text, even if handed one", () => {
        const leaky = { ...ctx(extra), car_plate: "ABC1234", stand_at: "Stand by the secret door", last_name: "Lopez", phone: "909-555-0123", message: "my secret note" } as EmailContext;
        const out = renderEmail({ ...email(template, extra), context: leaky }, OPTS);
        for (const value of ["ABC1234", "secret door", "Lopez", "909-555-0123", "secret note"]) {
          expect(out.text + out.html + out.subject).not.toContain(value);
        }
      });
    });
  }

  it("refuses an unknown template instead of sending something wrong", () => {
    expect(() => renderEmail(email("nonsense"), OPTS)).toThrow(/unknown email template/);
  });
});

describe("wording", () => {
  const text = (t: string, over: Partial<EmailContext> = {}) => renderEmail(email(t, over), OPTS).text;
  it("gives the trip line the way the spec shows it", () => {
    expect(tripLine(ctx(), OPTS)).toBe("Trader Joe's, Today 3:30 PM");
    expect(text("seat_requested")).toContain("Trader Joe's, Today 3:30 PM");
  });
  it("names the other person", () => {
    expect(renderEmail(email("seat_requested"), OPTS).subject).toBe("Maya wants a seat");
    expect(renderEmail(email("seat_declined"), OPTS).subject).toBe("Maya can't take you this time");
  });
  it("says the accepted details live on the trip page, without giving them", () => {
    const t = text("seat_accepted");
    expect(t).toContain("on the trip page");
    expect(t).not.toContain("DEV");
  });
  it("tells a seat-request expiry from a ride-request expiry", () => {
    expect(renderEmail(email("request_expired"), OPTS).subject).toBe("Your request to Maya expired");
    const ride = renderEmail(email("request_expired", { other_first_name: undefined, link_path: "/post/ask" }), OPTS);
    expect(ride.subject).toBe("Your request for a ride to Trader Joe's expired");
  });
  it("explains why an offer closed", () => {
    expect(renderEmail(email("offer_closed", { reason: "chose_another" }), OPTS).subject).toBe("Maya chose another ride");
    expect(renderEmail(email("offer_closed", { reason: "request_cancelled" }), OPTS).subject).toBe("Maya cancelled their request");
    expect(renderEmail(email("offer_closed", { reason: "request_expired" }), OPTS).subject).toBe("The request to Trader Joe's expired");
  });
  it("sends a rider to the chat and a driver to the trip for a reminder", () => {
    expect(renderEmail(email("meetup_reminder", { link_path: "/chat/c1" }), OPTS).html).toContain("Open the chat");
    const driver = renderEmail(email("meetup_reminder", { link_path: "/trip/t1", other_first_name: undefined, other_first_names: ["Rae", "Rob"] }), OPTS);
    expect(driver.text).toContain("with Rae, Rob");
    expect(driver.html).toContain("Open the trip");
  });
  it("names the meetup point but never says where exactly to stand", () => {
    expect(text("meetup_reminder", { link_path: "/chat/c1" })).toContain("Meet at Platt Campus Center.");
  });
  it("does not include any message text in a new-message email", () => {
    const r = renderEmail(email("new_message", { link_path: "/chat/c1" }), OPTS);
    expect(r.text).toContain("Open the chat to read it.");
  });
  it("copes with missing details", () => {
    const r = renderEmail({ id: 1, to_email: "a@b.edu", to_first_name: null, template: "seat_requested", context: { link_path: "/inbox" } }, OPTS);
    expect(r.text.startsWith("Hi,")).toBe(true);
    expect(r.subject).toBe("Someone wants a seat");
  });
});

describe("safety of dynamic values", () => {
  it("escapes everything that goes into HTML", () => {
    const r = renderEmail(email("seat_requested", { other_first_name: "<script>alert(1)</script>", destination: "A & B \"Mall\"" }, "<b>Alex</b>"), OPTS);
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<b>Alex</b>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("A &amp; B &quot;Mall&quot;");
  });
  it("escapes a hostile link and keeps it on this site", () => {
    const r = renderEmail(email("seat_requested", { link_path: '/x"><img src=x onerror=alert(1)>' }), OPTS);
    expect(r.html).not.toContain('"><img');
    expect(r.html.startsWith("<!doctype html>")).toBe(true);
  });
  it("escapeHtml handles the five characters", () => expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;"));
  it("tolerates a trailing slash on the site address", () => {
    expect(renderEmail(email("seat_requested"), { ...OPTS, siteUrl: "https://campusride.example/" }).text).toContain("https://campusride.example/trip/abc");
  });
});

describe("times, in Los Angeles", () => {
  it("says Today, Tomorrow, Yesterday, or the date", () => {
    expect(formatWhen(new Date("2026-10-17T22:30:00Z"), NOW)).toBe("Today 3:30 PM");
    expect(formatWhen(new Date("2026-10-18T16:00:00Z"), NOW)).toBe("Tomorrow 9:00 AM");
    expect(formatWhen(new Date("2026-10-16T22:30:00Z"), NOW)).toBe("Yesterday 3:30 PM");
    expect(formatWhen(new Date("2026-10-24T22:30:00Z"), NOW)).toBe("Sat, Oct 24 3:30 PM");
  });
  it("counts days by the Los Angeles calendar", () => {
    expect(formatWhen(new Date("2026-10-18T05:00:00Z"), NOW)).toBe("Today 10:00 PM");
  });
});

describe("design tokens", () => {
  it("email colors are the same values as the Light design tokens", () => {
    const css = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
    const light = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    const token = (n: string) => new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, "i").exec(light)![1].toLowerCase();
    expect(EMAIL_COLORS.ink).toBe(token("ink"));
    expect(EMAIL_COLORS.onInk).toBe(token("on-ink"));
    expect(EMAIL_COLORS.muted).toBe(token("muted"));
    expect(EMAIL_COLORS.line).toBe(token("line"));
    expect(EMAIL_COLORS.mint).toBe(token("mint"));
    expect(EMAIL_COLORS.page).toBe(token("bg"));
  });
});
