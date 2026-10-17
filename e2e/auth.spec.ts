import { expect, test } from "@playwright/test";

const backendConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test.describe("signed-out visitors", () => {
  test("a protected page sends them to sign in, then remembers the way back", async ({ page }) => {
    await page.goto("/post");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fpost$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("the landing page and sign-in page stay open", async ({ page }) => {
    expect((await page.goto("/"))?.status()).toBe(200);
    expect((await page.goto("/sign-in"))?.status()).toBe(200);
  });

  test("an off-site 'next' address is ignored", async ({ page }) => {
    await page.goto("/sign-in?next=//evil.example");
    await expect(page.getByLabel("School email")).toBeVisible();
    // Still on this site, and nothing in the page links or posts to the off-site address.
    expect(new URL(page.url()).origin).toBe(new URL(test.info().project.use.baseURL ?? page.url()).origin);
    await expect(page.locator('a[href*="evil.example"], input[value*="evil.example"], form[action*="evil.example"]')).toHaveCount(0);
  });
});

test.describe("sign-in form", () => {
  test("a malformed email says to use a school email, and keeps the field", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("School email").fill("maya");
    await page.getByRole("button", { name: /Send code/ }).click();
    await expect(page.locator("#email-error")).toHaveText("Use your school email.");
    await expect(page.getByLabel("School email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("School email")).toHaveAccessibleDescription("Use your school email.");
  });

  test("a well-formed email reaches the server and fails plainly when no backend is set up", async ({ page }) => {
    test.skip(backendConfigured, "needs the environment to be unconfigured");
    await page.goto("/sign-in");
    await page.getByLabel("School email").fill("maya@hmc.edu");
    await page.getByRole("button", { name: /Send code/ }).click();
    await expect(page.locator("#email-error")).toContainText("isn't set up");
  });

  test("works with the keyboard alone and shows the focus ring", async ({ page }) => {
    await page.goto("/sign-in");
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // logo
    await page.keyboard.press("Tab"); // email
    await expect(page.getByLabel("School email")).toBeFocused();
    const ring = await page.getByLabel("School email").evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.outlineStyle, s.outlineWidth];
    });
    expect(ring).toEqual(["solid", "3px"]);
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/sign-in");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("every page shows the offline banner when the connection drops", async ({ page, context }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("You're offline.")).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByRole("status")).toHaveText("You're offline. Trips may be out of date.");
  await context.setOffline(false);
  await expect(page.getByText("You're offline.")).toHaveCount(0);
});
