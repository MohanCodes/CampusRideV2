import { expect, test } from "@playwright/test";

// Step 0 smoke test: the landing page renders at 360 px and desktop widths, in Light and Dark,
// with nothing spilling sideways. Projects in playwright.config.ts supply width and color scheme.
test("landing page renders without horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Same direction.");
  await expect(page.getByRole("link", { name: "CampusRide" }).first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("page background follows the color scheme", async ({ page }, info) => {
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dark = info.project.name.endsWith("dark");
  expect(bg).toBe(dark ? "rgb(15, 26, 21)" : "rgb(252, 253, 249)");
});

test("every interactive element shows a focus ring", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab"); // skip link
  const outline = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement as Element);
    return { width: s.outlineWidth, style: s.outlineStyle };
  });
  expect(outline).toEqual({ width: "3px", style: "solid" });
});

test("the landing page shows sample trips that are not links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A look at the board." })).toBeVisible();
  const cards = page.getByTestId("trip-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.first().getByRole("link")).toHaveCount(0);
  await expect(page.getByText("These are examples, not real trips.")).toBeVisible();
});
