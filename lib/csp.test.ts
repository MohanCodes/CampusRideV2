import { describe, expect, it } from "vitest";
import { buildCsp, makeNonce } from "./csp";

const base = { nonce: "abc123", supabaseUrl: "https://proj.supabase.co", sentryDsn: "https://key@o1.ingest.us.sentry.io/42" };
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " "))?.slice(name.length + 1) ?? "";

describe("buildCsp", () => {
  const csp = buildCsp(base);

  it("forbids framing and plugins, and pins base and form targets", () => {
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "form-action")).toBe("'self'");
    expect(directive(csp, "default-src")).toBe("'self'");
  });
  it("lets scripts run only with this response's nonce, and never eval in production", () => {
    const s = directive(csp, "script-src");
    expect(s).toContain("'nonce-abc123'");
    expect(s).not.toContain("'unsafe-inline'");
    expect(s).not.toContain("'unsafe-eval'");
  });
  it("allows the app, Supabase (including wss), Mapbox and Sentry to connect", () => {
    const c = directive(csp, "connect-src");
    for (const want of ["'self'", "https://proj.supabase.co", "wss://proj.supabase.co", "https://api.mapbox.com", "https://events.mapbox.com", "https://*.tiles.mapbox.com", "https://o1.ingest.us.sentry.io"]) {
      expect(c).toContain(want);
    }
  });
  it("allows nothing else to connect", () => {
    const hosts = directive(csp, "connect-src").split(" ").filter((h) => h.includes("://"));
    expect(hosts.every((h) => /supabase\.co|mapbox\.com|sentry\.io/.test(h))).toBe(true);
  });
  it("lets the map run its worker and show tiles and signed photos", () => {
    expect(directive(csp, "worker-src")).toContain("blob:");
    expect(directive(csp, "img-src")).toContain("https://proj.supabase.co");
    expect(directive(csp, "img-src")).toContain("blob:");
    expect(directive(csp, "img-src")).toContain("https://tile.openstreetmap.org");
  });
  it("upgrades insecure requests in production only", () => {
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildCsp({ ...base, dev: true })).not.toContain("upgrade-insecure-requests");
  });
  it("allows eval and local sockets only in development", () => {
    const dev = buildCsp({ ...base, dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws://localhost:*");
    expect(directive(csp, "connect-src")).not.toContain("localhost");
  });
  it("copes with no Supabase or Sentry settings", () => {
    const bare = buildCsp({ nonce: "n" });
    expect(directive(bare, "connect-src")).not.toContain("undefined");
    expect(bare).not.toContain("null");
  });
  it("ignores a malformed DSN instead of throwing", () => {
    expect(() => buildCsp({ nonce: "n", sentryDsn: "not a url" })).not.toThrow();
  });
  it("makes a different nonce each time", () => {
    expect(makeNonce()).not.toBe(makeNonce());
    expect(makeNonce().length).toBeGreaterThan(16);
  });
});
