import { expect, test } from "@playwright/test";

// The real app (no sample data), signed out: the open pages are open, and Settings sends people to sign in.

test("the Safety page opens for a visitor, with the exact sentence and a nudge to sign in for the campus number", async ({ page }) => {
  await page.goto("/safety");
  await expect(page.getByTestId("safety-sentence")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("sign in to see your college's campus safety number");
  await expect(page.getByRole("link", { name: "911" })).toBeVisible();
});

test("Terms and Privacy open for a visitor", async ({ page }) => {
  for (const p of ["/terms", "/privacy"]) {
    await page.goto(p);
    await expect(page.getByTestId("legal-pending")).toBeVisible();
  }
});

test("the landing page and sign-in link to Safety, Terms and Privacy", async ({ page }) => {
  for (const p of ["/", "/sign-in"]) {
    await page.goto(p);
    await expect(page.getByRole("link", { name: "Safety", exact: true }).first()).toHaveAttribute("href", "/safety");
    await expect(page.getByRole("link", { name: "Terms" }).first()).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy" }).first()).toHaveAttribute("href", "/privacy");
  }
});

test("Settings and the data download need a sign-in", async ({ page, request }) => {
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fme/);
  const res = await request.get("/me/export", { maxRedirects: 0 });
  expect([307, 308, 401, 302]).toContain(res.status());
});
