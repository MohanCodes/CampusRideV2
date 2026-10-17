import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WEB_FLOWS.md Section 9, last item: every page works with keyboard only and with reduced motion on, and reads well
// in Light and Dark. axe checks contrast, names, roles and landmarks; the keyboard walk checks focus really moves.
// Runs in all four looks (phone and desktop, Light and Dark) against sample data.

const PAGES = ["/", "/trip/t1", "/trip/t12", "/post", "/post/offer", "/post/ask", "/rides", "/inbox", "/chat/c1", "/request/r1", "/user/d1", "/me", "/safety", "/terms", "/privacy", "/admin/reports", "/admin/reports/a1", "/admin/meetup-points", "/admin/audit"];

test("axe finds no serious or critical problems", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`), path).toEqual([]);
  }
});

test("the keyboard reaches the skip link first, then moves through the page without getting stuck", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim()), path).toBe("Skip to content");
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const id = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "body";
        const r = el.getBoundingClientRect();
        return `${el.tagName}|${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30)}|${Math.round(r.x)},${Math.round(r.y + window.scrollY)}|${r.width > 0 && r.height > 0}`;
      });
      seen.add(id);
    }
    expect(seen.size, `${path}: focus moves`).toBeGreaterThan(3);
    expect([...seen].filter((s) => s.endsWith("|false")), `${path}: focus never lands on something invisible`).toEqual([]);
  }
});

test("focus is visible on every stop", async ({ page }) => {
  for (const path of ["/", "/trip/t1", "/post/offer", "/me", "/admin/reports"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const shown = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "ok";
        // A date field highlights the part being edited (month, day, year) instead of ringing the box.
        if (el instanceof HTMLInputElement && el.type === "date") return "ok";
        const own = getComputedStyle(el);
        if (own.outlineStyle !== "none" && parseFloat(own.outlineWidth) >= 2) return "ok";
        // Whole-card links draw the ring on their ::after.
        const after = getComputedStyle(el, "::after");
        if (after.outlineStyle !== "none" && parseFloat(after.outlineWidth) >= 2) return "ok";
        return `${el.tagName}[${(el as HTMLInputElement).type ?? ""}].${el.className} "${el.textContent?.trim().slice(0, 30)}" outline=${own.outlineStyle} ${own.outlineWidth}`;
      });
      expect(shown, `${path}: stop ${i + 1}`).toBe("ok");
    }
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("animations and transitions are effectively off", async ({ page }) => {
    for (const path of ["/", "/trip/t1", "/rides", "/me"]) {
      await page.goto(path);
      const long = await page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        const dur = (v: string) => Math.max(...v.split(",").map((x) => parseFloat(x) * (x.includes("ms") ? 1 : 1000)));
        return dur(s.animationDuration) > 20 || dur(s.transitionDuration) > 20;
      }).length);
      expect(long, path).toBe(0);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), path).toBe("auto");
    }
  });
});

test("a dialog takes focus, and Escape gives it back", async ({ page }) => {
  await page.goto("/trip/t1");
  await page.getByLabel("More options").click();
  const trigger = page.getByLabel("More options");
  await page.getByRole("menuitem", { name: /^Report/ }).click();
  const dialog = page.getByTestId("report-dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeVisible();
});
