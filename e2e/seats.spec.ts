import { expect, test, type Page } from "@playwright/test";

// Demo mode, clock pinned to Saturday, Oct 17 2026, 1:00 PM in Los Angeles. Answering requests needs a
// backend, so these cover the screens, the checks that run before anything is sent, and the plain
// message sample mode gives. The rules themselves are tested in the database (supabase/tests).

const SAMPLE = "This isn't available in sample mode.";
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const dialog = (page: Page) => page.getByTestId("request-dialog");

test.describe("asking for a seat", () => {
  test("opens a request sheet with seats, a message, and a cost reminder", async ({ page }) => {
    await page.goto("/trip/t1");
    await page.getByRole("button", { name: /Request a seat/ }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole("heading", { name: "Request a seat" })).toBeVisible();
    await expect(page.getByTestId("request-seats")).toHaveText("1");
    await expect(dialog(page).getByLabel(/Message/)).toHaveAttribute("placeholder", "Hi, I just need Trader Joe's and back, no big bags");
    await expect(page.getByTestId("cost-reminder")).toHaveText("Split gas and parking. You settle up with Maya yourselves.");
    await expect(dialog(page).getByRole("button", { name: /Send request/ })).toBeEnabled();
  });

  test("seats stop at what is left on the trip, and at three", async ({ page }) => {
    await page.goto("/trip/t3?as=none"); // 1 seat left
    await page.getByRole("button", { name: /Request a seat/ }).click();
    await expect(dialog(page).getByRole("button", { name: "More seats" })).toBeDisabled();
    await expect(dialog(page)).toContainText("1 seat left on this trip.");
    await page.keyboard.press("Escape");
    await page.goto("/trip/t2?as=none"); // 4 seats left, but a rider can ask for at most 3
    await page.getByRole("button", { name: /Request a seat/ }).click();
    const more = dialog(page).getByRole("button", { name: "More seats" });
    await more.click();
    await more.click();
    await expect(page.getByTestId("request-seats")).toHaveText("3");
    await expect(more).toBeDisabled();
  });

  test("contact details in the message are caught as you type", async ({ page }) => {
    await page.goto("/trip/t1");
    await page.getByRole("button", { name: /Request a seat/ }).click();
    await dialog(page).getByLabel(/Message/).fill("text me 909-555-0123");
    await expect(dialog(page).locator("#request-message-note")).toHaveText("Keep contact details in the app chat.");
    await expect(dialog(page).getByRole("button", { name: /Send request/ })).toBeDisabled();
    await dialog(page).getByLabel(/Message/).fill("Just a few bags");
    await expect(dialog(page).getByRole("button", { name: /Send request/ })).toBeEnabled();
  });

  test("Cancel and Escape close it without sending", async ({ page }) => {
    await page.goto("/trip/t1");
    const open = page.getByRole("button", { name: /Request a seat/ });
    await open.click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toBeHidden();
    await open.click();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
  });

  test("sending in sample mode says so plainly", async ({ page }) => {
    await page.goto("/trip/t1");
    await page.getByRole("button", { name: /Request a seat/ }).click();
    await dialog(page).getByRole("button", { name: /Send request/ }).click();
    await expect(page.getByTestId("request-error")).toHaveText(SAMPLE);
  });

  test("the sheet sits at the bottom on phones and in the middle on larger screens", async ({ page, isMobile }) => {
    await page.goto("/trip/t1");
    await page.getByRole("button", { name: /Request a seat/ }).click();
    const box = (await dialog(page).boundingBox())!;
    const vp = page.viewportSize()!;
    if (isMobile) {
      expect(box.width).toBeGreaterThanOrEqual(vp.width - 2);
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(vp.height - 2);
    } else {
      expect(box.width).toBeLessThanOrEqual(500);
      expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(4);
    }
  });

  test("shows the toast after a request is sent", async ({ page }) => {
    await page.goto("/trip/t1?as=pending&sent=1");
    await expect(page.getByTestId("toast")).toHaveText("Request sent. We'll let you know when Maya replies.");
  });

  test("a pending request can be cancelled, and an accepted seat too", async ({ page }) => {
    await page.goto("/trip/t1?as=pending");
    await page.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByTestId("action-area").getByRole("alert")).toHaveText(SAMPLE);
    await page.goto("/trip/t3?as=accepted");
    await expect(page.getByRole("button", { name: "Cancel my seat" })).toBeVisible();
  });
});

test.describe("the driver's side of a trip", () => {
  test("lists who asked, with Accept and Decline on the ones waiting", async ({ page }) => {
    await page.goto("/trip/t10");
    await expect(page.getByRole("heading", { level: 2, name: "Requests" })).toBeVisible();
    const rows = page.getByTestId("seat-request");
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: "Alex wants 1 seat." })).toContainText("Hi, I just need Target and back, no big bags.");
    await expect(rows.filter({ hasText: "Sam wants 2 seats." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept Alex" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decline Sam" })).toBeVisible();
    await expect(rows.filter({ hasText: "Jordan" })).toContainText("Accepted");
    await expect(rows.filter({ hasText: "Jordan" }).getByRole("button")).toHaveCount(0);
  });

  test("answering in sample mode says so, next to that request", async ({ page }) => {
    await page.goto("/trip/t10");
    const row = page.getByTestId("seat-request").filter({ hasText: "Alex wants" });
    await row.getByRole("button", { name: "Accept Alex" }).click();
    await expect(row.getByRole("alert")).toHaveText(SAMPLE);
  });

  test("offers Edit trip and a confirmed Cancel trip", async ({ page }) => {
    await page.goto("/trip/t10");
    await expect(page.getByRole("link", { name: "Edit trip" })).toHaveAttribute("href", "/trip/t10/edit");
    await page.getByRole("button", { name: "Cancel trip" }).click();
    const d = page.getByTestId("cancel-trip-dialog");
    await expect(d.getByRole("heading", { name: "Cancel this trip?" })).toBeVisible();
    await expect(d).toContainText("Everyone who asked for a seat will be told.");
    await d.getByRole("button", { name: "Keep trip" }).click();
    await expect(d).toBeHidden();
  });

  test("a trip the rider is not driving shows no driver controls", async ({ page }) => {
    await page.goto("/trip/t1");
    await expect(page.getByRole("heading", { name: "Requests" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit trip" })).toHaveCount(0);
  });
});

test.describe("editing a trip", () => {
  test("starts with the trip's current details", async ({ page }) => {
    await page.goto("/trip/t10/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Edit trip" })).toBeVisible();
    await expect(page.getByLabel("Date")).toHaveValue("2026-10-17");
    await expect(page.getByLabel("Leave at")).toHaveValue("19:00");
    await expect(page.getByTestId("seats-value")).toHaveText("3");
    await expect(page.getByLabel(/Cost note/)).toHaveValue("Split gas and parking");
    await expect(page.getByText("1 already taken, so you can't go below that.")).toBeVisible();
  });

  test("seats cannot go below the riders already accepted", async ({ page }) => {
    await page.goto("/trip/t10/edit");
    const fewer = page.getByRole("button", { name: "Fewer seats" });
    await fewer.click();
    await fewer.click();
    await expect(page.getByTestId("seats-value")).toHaveText("1");
    await expect(fewer).toBeDisabled();
  });

  test("a past time and contact details are refused inline", async ({ page }) => {
    await page.goto("/trip/t10/edit");
    await page.getByLabel("Date").fill("2020-01-01");
    await expect(page.locator("#time-error")).toHaveText("That time has already passed. Pick a later one.");
    await expect(page.getByRole("button", { name: /Save changes/ })).toBeDisabled();
    await page.getByLabel("Date").fill("2026-10-18");
    await page.getByLabel("Notes").fill("call 909-555-0123");
    await expect(page.locator("#notes-help")).toHaveText("Keep contact details in the app chat.");
    await expect(page.getByRole("button", { name: /Save changes/ })).toBeDisabled();
  });

  test("saving in sample mode says so", async ({ page }) => {
    await page.goto("/trip/t10/edit");
    await page.getByLabel("Notes").fill("Back by 8");
    await page.getByRole("button", { name: /Save changes/ }).click();
    await expect(page.getByText(SAMPLE)).toBeVisible();
  });
});

test.describe("My Rides", () => {
  const rows = (page: Page) => page.getByTestId("ride-row");

  test("Upcoming lists trips the person drives and rides they were accepted for", async ({ page }) => {
    await page.goto("/rides");
    await expect(page.getByRole("heading", { level: 1, name: "My Rides" })).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator("[data-role=driver]")).toContainText("2 requests waiting");
    await expect(page.locator("[data-role=driver]")).toContainText("Open");
    await expect(page.locator("[data-role=rider]")).toContainText("Accepted");
    await expect(page.locator("[data-role=rider]")).toContainText("Ontario International");
  });

  test("Requests lists pending and declined asks", async ({ page }) => {
    await page.goto("/rides?tab=requests");
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).filter({ hasText: "Target (Montclair)" })).toContainText("Pending");
    await expect(rows(page).filter({ hasText: "Trader Joe's" })).toContainText("Declined");
    await expect(page.getByRole("link", { name: /Requests/ })).toHaveAttribute("aria-current", "page");
  });

  test("Past lists cancelled and finished trips, most recent first", async ({ page }) => {
    await page.goto("/rides?tab=past");
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).nth(0)).toContainText("Cancelled");
    await expect(rows(page).nth(1)).toContainText("Past");
    await expect(rows(page).nth(2)).toContainText("Past");
    await expect(rows(page).nth(0)).toContainText("Claremont Village");
  });

  test("shows a count on each tab", async ({ page }) => {
    await page.goto("/rides");
    await expect(page.getByRole("link", { name: /Upcoming/ })).toContainText("2");
    await expect(page.getByRole("link", { name: /Past/ })).toContainText("3");
  });

  test("a row opens its trip", async ({ page }) => {
    await page.goto("/rides");
    await page.locator("[data-role=rider]").getByRole("link").click();
    await expect(page).toHaveURL(/\/trip\/t3$/);
  });

  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/rides?fail=1");
    await expect(page.getByTestId("error-state")).toContainText("We couldn't load your rides");
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/rides");
  });
});

test.describe("Inbox", () => {
  test("lists the seat requests waiting, with the trip each is for", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
    const rows = page.getByTestId("seat-request");
    await expect(rows).toHaveCount(2); // the accepted one is not "waiting"
    await expect(rows.first()).toContainText("Target (Montclair)");
    await expect(rows.first()).toContainText("Today, 7:00 PM");
    await expect(rows.first().getByRole("link", { name: "Target (Montclair)" })).toHaveAttribute("href", "/trip/t10");
    await expect(page.getByRole("button", { name: "Accept Alex" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decline Sam" })).toBeVisible();
  });

  test("the Inbox link carries a badge with how many are waiting", async ({ page }) => {
    await page.goto("/");
    const badge = page.getByTestId("nav-badge").and(page.locator(":visible"));
    await expect(badge).toHaveText(/2/);
    await expect(page.getByRole("link", { name: /Inbox/ }).and(page.locator(":visible"))).toContainText("2 waiting");
  });

  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/inbox?fail=1");
    await expect(page.getByTestId("error-state")).toContainText("We couldn't load your inbox");
  });
});

test("none of these pages scroll sideways", async ({ page }) => {
  for (const url of ["/trip/t1", "/trip/t10", "/trip/t10/edit", "/rides", "/rides?tab=past", "/inbox"]) {
    await page.goto(url);
    expect(await noSideScroll(page), url).toBeLessThanOrEqual(0);
  }
});

test("the request sheet has no sideways scroll either", async ({ page }) => {
  await page.goto("/trip/t1");
  await page.getByRole("button", { name: /Request a seat/ }).click();
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});
