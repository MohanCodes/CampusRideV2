import { expect, test, type Page } from "@playwright/test";

// Demo mode. Report, block, no-show, the profile page, and the admin pages. The rules behind them
// (who may report, what an admin may do, suspension) are tested in supabase/tests/step10_moderation.test.sql.

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const openMenu = async (page: Page) => {
  await page.getByLabel("More options").click();
};

test.describe("report and block", () => {
  test("a trip can be reported: five reasons, a details counter, and a plain sample-mode answer", async ({ page }) => {
    await page.goto("/trip/t1");
    await openMenu(page);
    await page.getByRole("menuitem", { name: /^Report/ }).click();
    const d = page.getByTestId("report-dialog");
    await expect(d.getByRole("radio")).toHaveCount(5);
    await d.getByLabel("Details").fill("hello");
    await expect(d).toContainText("5");
    await d.getByRole("radio").first().check();
    await d.getByRole("button", { name: /^Submit/ }).click();
    await expect(d).toContainText(/sample mode/i);
  });

  test("blocking asks first, and Cancel is the safe default", async ({ page }) => {
    await page.goto("/trip/t1");
    await openMenu(page);
    await page.getByRole("menuitem", { name: /^Block/ }).click();
    const d = page.getByTestId("block-dialog");
    await expect(d.getByRole("heading", { name: /^Block .+\?$/ })).toBeVisible();
    await expect(d.getByRole("button", { name: "Cancel" })).toBeFocused();
    await d.getByRole("button", { name: /^Block \w+$/ }).click();
    await expect(d).toContainText(/sample mode/i);
  });

  test("your own trip has no report menu", async ({ page }) => {
    await page.goto("/trip/t12");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("More options")).toHaveCount(0);
  });

  test("a request and a chat have the menu too", async ({ page }) => {
    await page.goto("/request/r1");
    await expect(page.getByLabel("More options")).toBeVisible();
    await page.goto("/chat/c1");
    await expect(page.getByLabel("More options")).toBeVisible();
  });
});

test.describe("a profile", () => {
  test("shows a first name, college, class year and bio, never a last name or email", async ({ page }) => {
    await page.goto("/user/d1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maya");
    await expect(page.getByTestId("bio")).toContainText("Trader Joe's");
    await expect(page.getByRole("main")).toContainText("Verified");
    await expect(page.getByRole("main")).not.toContainText("@");
    await expect(page.getByLabel("More options")).toBeVisible();
  });
  test("an unknown profile is not found", async ({ page }) => {
    const res = await page.goto("/user/nobody");
    expect(res?.status()).toBe(404);
  });
  test("the driver's name on a trip links to the profile", async ({ page }) => {
    await page.goto("/trip/t1");
    await page.getByRole("main").getByRole("link", { name: /Maya/ }).first().click();
    await expect(page).toHaveURL(/\/user\//);
  });
});

test.describe("no-show", () => {
  test("a driver can report a rider who didn't show, after the trip left", async ({ page }) => {
    await page.goto("/trip/t12");
    await page.getByRole("button", { name: /didn.t show|No-show|Report a no-show/i }).first().click();
    const d = page.getByTestId("no-show-dialog").first();
    await expect(d).toContainText("didn't show?");
    await d.getByRole("button", { name: "Send to the team" }).click();
    await expect(d).toContainText(/sample mode/i);
  });
});

test.describe("admin", () => {
  test("the queue lists reports newest first with counts and the policy hint", async ({ page }) => {
    await page.goto("/admin/reports");
    const rows = page.getByTestId("report-row");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText("No-show: Alex");
    await expect(rows.first()).toContainText("3 no-shows");
    await expect(rows.first().getByTestId("policy-hint")).toContainText("Third no-show");
  });
  test("filters narrow the queue and can be cleared", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.getByLabel("Status").selectOption("new");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByTestId("report-row")).toHaveCount(2);
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByTestId("report-row")).toHaveCount(5);
  });
  test("a filter with no matches says so", async ({ page }) => {
    await page.goto("/admin/reports?status=dismissed&reason=No-show");
    await expect(page.getByRole("main")).toContainText("Nothing matches these filters.");
  });
  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/admin/reports?fail=1");
    await expect(page.getByTestId("error-state")).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" }).or(page.getByRole("button", { name: "Try again" }))).toBeVisible();
  });
  test("a report opens with the full profile, an audit note, and the actions", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.getByTestId("report-row").first().getByRole("link").click();
    await expect(page.getByTestId("audit-note")).toContainText("audit log");
    await expect(page.getByTestId("target-profile")).toContainText("@example.edu");
    await expect(page.getByTestId("no-show-count")).toContainText("3 no-shows");
    await expect(page.getByRole("button", { name: "Suspend 7 days" })).toBeVisible();
    await page.getByRole("button", { name: "Warn Alex" }).click();
    await expect(page.getByRole("main")).toContainText(/sample mode/i);
  });
  test("removing an account asks first", async ({ page }) => {
    await page.goto("/admin/reports/a1");
    await page.getByRole("button", { name: "Remove account" }).first().click();
    const d = page.getByTestId("remove-dialog");
    await expect(d.getByRole("button", { name: "Keep account" })).toBeFocused();
    await d.getByRole("button", { name: "Remove account" }).click();
    await expect(d).toBeHidden();
    await expect(page.getByTestId("report-actions")).toContainText(/sample mode/i);
  });
  test("meetup points are grouped by college, and the form checks its input", async ({ page }) => {
    await page.goto("/admin/meetup-points");
    await expect(page.getByTestId("point-row").first()).toBeVisible();
    await page.getByText("Add a meetup point").click();
    const form = page.getByTestId("add-point").locator("form");
    await form.locator("input[name=name]").fill("Test Plaza");
    await form.locator("input[name=lat]").fill("34.1");
    await form.locator("input[name=lng]").fill("117.7"); // positive: should be refused (the 5Cs are west)
    await form.getByRole("button", { name: "Add meetup point" }).click();
    await expect(form.getByRole("alert").first()).toBeVisible();
  });
  test("the audit log lists actions newest first", async ({ page }) => {
    await page.goto("/admin/audit");
    const rows = page.getByTestId("audit-row");
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText("view report");
  });
  test("a student gets a not-found page, not a hint that admin exists", async ({ page }) => {
    const res = await page.goto("/admin/reports?as=student");
    expect(res?.status()).toBe(404);
  });
  test("no sideways scroll", async ({ page }) => {
    for (const p of ["/admin/reports", "/admin/reports/a1", "/admin/meetup-points", "/admin/audit", "/user/d1"]) {
      await page.goto(p);
      expect(await noSideScroll(page), p).toBeLessThanOrEqual(0);
    }
  });
});
