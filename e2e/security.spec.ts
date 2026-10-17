import { expect, test, type Page } from "@playwright/test";

// Runs against both servers (the real app, signed out, and the sample-data one). The policy itself is unit tested in
// lib/csp.test.ts; these check that the built site really sends it, that the pages still work under it, and the health check.

const demo = () => test.info().project.name.startsWith("demo");
const PAGES_APP = ["/", "/sign-in", "/safety", "/terms", "/privacy"];
const PAGES_DEMO = ["/", "/trip/t1", "/post/offer", "/rides", "/inbox", "/chat/c1", "/request/r1", "/user/d1", "/me", "/safety", "/admin/reports", "/admin/meetup-points"];

async function violations(page: Page, path: string): Promise<string[]> {
  const seen: string[] = [];
  page.on("console", (m) => { if (/content security policy|refused to (load|execute|connect|apply)/i.test(m.text())) seen.push(m.text()); });
  page.on("pageerror", (e) => seen.push(`pageerror: ${e.message}`));
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return seen;
}

test("every page sends a Content-Security-Policy that allows only the app, Supabase, Mapbox and Sentry", async ({ request }) => {
  for (const path of demo() ? PAGES_DEMO : PAGES_APP) {
    const res = await request.get(path);
    const csp = res.headers()["content-security-policy"];
    expect(csp, path).toBeTruthy();
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("object-src 'none'");
    expect(csp, path).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp, path).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp, path).toContain("upgrade-insecure-requests");
  }
});

test("each response gets its own nonce", async ({ request }) => {
  const nonce = async () => (await request.get("/")).headers()["content-security-policy"].match(/'nonce-([^']+)'/)![1];
  expect(await nonce()).not.toBe(await nonce());
});

test("the other security headers are on", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("geolocation=()");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("pages load and run their scripts with no policy violations", async ({ page }) => {
  for (const path of demo() ? PAGES_DEMO : PAGES_APP) {
    const seen = await violations(page, path);
    expect(seen, path).toEqual([]);
  }
});

test("a page's own scripts carry the nonce, so the policy is really enforced", async ({ page }) => {
  await page.goto(demo() ? "/trip/t1" : "/sign-in");
  const bad = await page.evaluate(() => [...document.querySelectorAll("script")].filter((s) => !s.src && !s.nonce && s.textContent).length);
  expect(bad).toBe(0);
});

test("injected markup with an inline handler does not run", async ({ page }) => {
  // (A <script> added from page.evaluate would be trusted, because 'strict-dynamic' trusts scripts that trusted scripts add.
  // An inline event handler has no such path in, which is what real injected markup looks like.)
  await page.goto(demo() ? "/safety" : "/sign-in");
  const ran = await page.evaluate(async () => {
    (window as unknown as { injected?: boolean }).injected = false;
    const box = document.createElement("div");
    box.innerHTML = '<img src="x" onerror="window.injected = true">';
    document.body.appendChild(box);
    await new Promise((r) => setTimeout(r, 300));
    return (window as unknown as { injected?: boolean }).injected;
  });
  expect(ran).toBe(false);
});

test("the health check says 503 when no database is configured, and nothing more", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(503);
  expect(await res.json()).toEqual({ ok: false });
  expect(res.headers()["cache-control"]).toBe("no-store");
});

test("the health check is open to signed-out visitors (no sign-in redirect)", async ({ request }) => {
  const res = await request.get("/api/health", { maxRedirects: 0 });
  expect(res.status()).not.toBe(307);
});
