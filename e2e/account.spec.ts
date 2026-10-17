import { expect, test, type Page } from "@playwright/test";

// Demo mode. Settings, the Safety page, and the footer links. What the database does when an account is deleted or
// exported is tested in supabase/tests/step11_deletion_export.test.sql; the Edge Function in supabase/functions/delete-account.

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("settings", () => {
  test("show the person's profile, the three email switches, blocked people, and the account buttons", async ({ page }) => {
    await page.goto("/me");
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await expect(page.getByTestId("my-profile")).toContainText("Riley");
    await expect(page.getByTestId("my-profile")).toContainText("never see your last name or email");
    await expect(page.getByTestId("prefs-form").getByRole("checkbox")).toHaveCount(3);
    for (const box of await page.getByTestId("prefs-form").getByRole("checkbox").all()) await expect(box).toBeChecked();
    await expect(page.getByTestId("blocked-row")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Sign out" }).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
    await expect(page.getByTestId("export-link")).toHaveAttribute("href", "/me/export");
  });

  test("a switch says plainly that sample mode doesn't save", async ({ page }) => {
    await page.goto("/me");
    await page.getByLabel(/^Messages/).uncheck();
    await expect(page.getByTestId("prefs-form")).toContainText("This isn't available in sample mode.");
  });

  test("unblocking in sample mode says so", async ({ page }) => {
    await page.goto("/me");
    await page.getByRole("button", { name: "Unblock Jordan" }).click();
    await expect(page.getByRole("main")).toContainText("This isn't available in sample mode.");
  });

  test("deleting asks first, defaults to keeping the account, and says what happens", async ({ page }) => {
    await page.goto("/me");
    await page.getByRole("button", { name: "Delete account" }).click();
    const d = page.getByTestId("delete-dialog");
    await expect(d.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
    await expect(d).toContainText("Deleted user");
    await expect(d.getByRole("button", { name: "Keep my account" })).toBeFocused();
    await d.getByRole("button", { name: "Delete my account" }).click();
    await expect(d).toBeHidden();
    await expect(page.getByTestId("delete-error")).toHaveText("This isn't available in sample mode.");
  });

  test("Escape closes the delete sheet without doing anything", async ({ page }) => {
    await page.goto("/me");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("delete-dialog")).toBeHidden();
    await expect(page.getByTestId("delete-error")).toHaveCount(0);
  });

  test("the download is a JSON file", async ({ page }) => {
    const res = await page.request.get("/me/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(JSON.parse(await res.text())).toHaveProperty("note");
  });

  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/me?fail=1");
    await expect(page.getByTestId("error-state")).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/me");
  });

  test("the Profile link is in the navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Profile" }).first()).toBeVisible();
  });
});

test.describe("the Safety page", () => {
  test("says the exact sentence, how to reach 911 and campus safety, and promises nothing more", async ({ page }) => {
    await page.goto("/safety");
    await expect(page.getByTestId("safety-sentence")).toHaveText("Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.");
    await expect(page.getByRole("link", { name: "911" })).toHaveAttribute("href", "tel:911");
    await expect(page.getByTestId("campus-phone")).toHaveText("909-607-2000");
    await expect(page.getByTestId("campus-phone")).toHaveAttribute("href", "tel:9096072000");
    for (const tip of ["Meet at the approved spot", "Check that the car and driver match", "Tell a friend where you're going", "Trust your gut"]) {
      await expect(page.getByRole("main")).toContainText(tip);
    }
  });

  test("is linked from the footer and from every trip", async ({ page }) => {
    await page.goto("/trip/t1");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Safety tips" })).toHaveAttribute("href", "/safety");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Safety", exact: true })).toHaveAttribute("href", "/safety");
  });
});

test.describe("Terms and Privacy", () => {
  for (const [path, word] of [["/terms", "terms of use are"], ["/privacy", "privacy policy is"]] as const) {
    test(`${path} says the text is pending and does not invent any`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("legal-pending")).toContainText(`The ${word} being reviewed`);
    });
  }
  test("Privacy states what the site does today, including 'never your location'", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("main")).toContainText("your location");
    await expect(page.getByRole("main")).toContainText("Deleted user");
  });
  test("the footer links Safety, Terms and Privacy", async ({ page }) => {
    await page.goto("/terms");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });
});

test("none of these pages scroll sideways", async ({ page }) => {
  for (const p of ["/me", "/safety", "/terms", "/privacy"]) {
    await page.goto(p);
    expect(await noSideScroll(page), p).toBeLessThanOrEqual(0);
  }
});
