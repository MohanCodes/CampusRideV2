import { expect, test, type Page } from "@playwright/test";

// Demo mode, with the clock pinned to Saturday, Oct 17 2026, 1:00 PM in Los Angeles.
// Open trips with seats: t1 today 4:00 PM, t10 (own) today 7:00 PM, t2 tomorrow, t3 Monday, t7, t4, t5.

const cards = (page: Page) => page.getByTestId("trip-card");
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("board", () => {
  test("shows upcoming trips grouped under day headers, soonest first", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Claremont Colleges" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveText("Sample data. Nothing here is real.");
    await expect(cards(page)).toHaveCount(7); // full, cancelled and past trips are left out
    await expect(page.getByRole("heading", { level: 2, name: "Today" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Tomorrow" })).toBeVisible();
    await expect(cards(page).first()).toContainText("Trader Joe's");
    await expect(cards(page).first()).toContainText("Today, 4:00 PM");
    await expect(cards(page).first()).toContainText("2 seats left");
    await expect(cards(page).first()).toContainText("Platt Campus Center");
    await expect(cards(page).first()).toContainText("Maya");
    await expect(cards(page).first()).toContainText("Harvey Mudd");
    await expect(cards(page).first()).toContainText("Verified");
  });

  test("cards show the person's status on that trip", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("trip-card").filter({ hasText: "Target (Montclair)" }).filter({ hasText: "Pending" })).toHaveCount(1);
    await expect(page.getByTestId("trip-card").filter({ hasText: "Ontario International" }).filter({ hasText: "Accepted" })).toHaveCount(1);
  });

  test("no last names or emails appear anywhere on the board", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bDev\b/); // the sample people's last name
    expect(text).not.toMatch(/@/);
  });

  test("destination chips filter the board and are shareable links", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Target", exact: true }).click();
    await expect(page).toHaveURL(/\?chip=Target$/);
    await expect(cards(page)).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Target", exact: true })).toHaveAttribute("aria-current", "true");
    await page.getByRole("link", { name: "Other", exact: true }).click();
    await expect(cards(page).first()).toContainText("Ontario Mills");
    await page.getByRole("link", { name: "All", exact: true }).click();
    await expect(cards(page)).toHaveCount(7);
  });

  test("the filter form narrows by date, college, seats and search", async ({ page }) => {
    await page.goto("/?date=tomorrow");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Target (Montclair)");

    await page.goto("/?college=hmc");
    await expect(cards(page)).toHaveCount(2); // Maya's trip and the demo viewer's own

    await page.goto("/?seats=3");
    for (const c of await cards(page).all()) await expect(c).toContainText(/[3-9] seats left/);

    await page.goto("/?q=airport");
    await expect(cards(page)).toHaveCount(2);
  });

  test("filters work by using the form", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByText("Filters", { exact: true }).click();
    const form = page.getByRole("search", { name: "Filter the board" }).and(page.locator(":visible"));
    await form.getByLabel("Search").fill("market");
    await form.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=market/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Farmers Market");
  });

  test("an empty result says so plainly and offers to clear the filters", async ({ page }) => {
    await page.goto("/?chip=LA%20%2F%20LAX&college=hmc");
    const empty = page.getByTestId("empty-state");
    await expect(empty).toContainText("No rides to LA / LAX yet");
    await empty.getByRole("link", { name: "Clear filters" }).click();
    await expect(cards(page)).toHaveCount(7);
  });

  test("'In search of' lists riders looking for a trip", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "In search of", exact: true }).click();
    await expect(page).toHaveURL(/tab=requests/);
    await expect(page.getByTestId("request-card")).toHaveCount(3);
    await expect(page.getByTestId("request-card").first()).toContainText("Will chip in");
    await expect(page.getByTestId("request-card").first()).toContainText("Needs 1 seat");
    await expect(page.getByTestId("request-card").first()).toContainText("Tomorrow, 1:00 PM to 2:00 PM");
    await expect(page.getByRole("link", { name: "In search of", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("the error state offers Try again, which recovers", async ({ page }) => {
    await page.goto("/?fail=1");
    const err = page.getByTestId("error-state");
    await expect(err).toContainText("We couldn't load the board");
    await err.getByRole("link", { name: "Try again" }).click();
    await expect(cards(page)).toHaveCount(7);
  });

  test("a card is reachable by keyboard and opens the trip", async ({ page }) => {
    await page.goto("/");
    const link = cards(page).first().getByRole("link");
    await link.focus();
    const ring = await link.evaluate((el) => {
      const s = getComputedStyle(el, "::after");
      return [s.outlineStyle, s.outlineWidth];
    });
    expect(ring).toEqual(["solid", "3px"]);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/trip\/t1$/);
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const url of ["/", "/?tab=requests", "/?chip=Target", "/?chip=LA%20%2F%20LAX&college=hmc"]) {
      await page.goto(url);
      expect(await noSideScroll(page), url).toBeLessThanOrEqual(0);
    }
  });

  test("the safety notice is in the footer, word for word", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toContainText(
      "Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.",
    );
  });

  test("does not link to parts of the app that are not built yet", async ({ page }) => {
    await page.goto("/");
    for (const href of ["/rides", "/inbox", "/me", "/safety"]) {
      await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
  });
});

test.describe("trip detail", () => {
  test("two clicks from the board reach the request button", async ({ page }) => {
    await page.goto("/");
    await cards(page).first().getByRole("link").click(); // click one
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trader Joe's");
    await expect(page.getByRole("button", { name: /Request a seat/ })).toBeVisible(); // there it is
  });

  test("shows the time, seats, meetup point, car, driver and cost note", async ({ page }) => {
    await page.goto("/trip/t1");
    await expect(page.getByText("Today, 4:00 PM")).toBeVisible();
    await expect(page.getByText("Back by 6:00 PM")).toBeVisible();
    await expect(page.getByText("2 seats left")).toBeVisible();
    await expect(page.getByText("Platt Campus Center")).toBeVisible();
    await expect(page.getByText("Blue Honda Civic")).toBeVisible();
    await expect(page.getByText("Split gas and parking")).toBeVisible();
    // The driver shows inline on phones and in the sidebar on desktop; either way one copy is visible.
    await expect(page.getByText("Maya", { exact: true }).and(page.locator(":visible"))).toHaveCount(1);
    await expect(page.getByText("Verified").and(page.locator(":visible"))).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("link", { name: "Board" })).toBeVisible();
  });

  for (const view of ["none", "pending", "declined", "unavailable"] as const) {
    test(`hides the plate and exact spot when the view is "${view}"`, async ({ page }) => {
      await page.goto(`/trip/t3?as=${view}`);
      await expect(page.getByTestId("plate")).toHaveCount(0);
      await expect(page.getByTestId("stand-at")).toHaveCount(0);
      await expect(page.getByTestId("plate-hidden")).toBeVisible();
      await expect(page.getByTestId("stand-at-hidden")).toHaveText("Exact meeting spot is shared after the driver accepts.");
      const html = await page.content();
      expect(html.includes("DEV1003")).toBe(false); // not even in the page source
      expect(html.includes("entrance gate")).toBe(false);
    });
  }

  for (const view of ["accepted", "own"] as const) {
    test(`shows the plate and exact spot when the view is "${view}"`, async ({ page }) => {
      await page.goto(`/trip/t3?as=${view}`);
      await expect(page.getByTestId("plate")).toContainText("DEV1003");
      await expect(page.getByTestId("stand-at")).toContainText("Stand at the entrance gate");
    });
  }

  test("each state says what happened and offers one next step", async ({ page }) => {
    const action = page.getByTestId("action-area");
    await page.goto("/trip/t1?as=none");
    await expect(action.getByRole("button", { name: /Request a seat/ })).toBeDisabled();
    await expect(action).toContainText("Seat requests aren't open yet.");

    await page.goto("/trip/t1?as=pending");
    await expect(action).toContainText("Request sent. We'll let you know when Maya replies.");
    await expect(action.getByRole("button", { name: "Cancel request" })).toBeVisible();

    await page.goto("/trip/t1?as=accepted");
    await expect(action).toContainText("Maya accepted your request.");
    await expect(action.getByRole("button", { name: "Copy trip details" })).toBeVisible();

    await page.goto("/trip/t1?as=declined");
    await expect(action).toContainText("Maya can't take you this time.");
    await expect(action.getByRole("link", { name: "Find another trip" })).toHaveAttribute("href", "/?chip=Trader%20Joe's");

    await page.goto("/trip/t1?as=unavailable");
    await expect(action).toContainText("This trip isn't available.");

    await page.goto("/trip/t1?as=own");
    await expect(action).toContainText("This is your trip.");
  });

  test("a full, cancelled or past trip reads as unavailable", async ({ page }) => {
    for (const id of ["t6", "t8", "t9"]) {
      await page.goto(`/trip/${id}`);
      await expect(page.getByTestId("action-area")).toContainText("This trip isn't available.");
    }
  });

  test("Copy trip details copies the summary", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/trip/t3?as=accepted");
    await page.getByRole("button", { name: "Copy trip details" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Copied." })).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("Sam is driving to Ontario International Airport (ONT)");
    expect(clip).toContain("plate DEV1003");
    expect(clip).toContain("Balch Hall");
  });

  test("the safety notice is on the trip, word for word", async ({ page }) => {
    await page.goto("/trip/t1");
    await expect(page.getByRole("main")).toContainText(
      "Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.",
    );
  });

  test("an unknown trip is a plain not-found page", async ({ page }) => {
    // (The status is 200 because the loading shell streams first; what people see is the not-found page.)
    await page.goto("/trip/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
    await page.getByRole("link", { name: "Back to the board" }).click();
    await expect(cards(page).first()).toBeVisible();
  });

  test("has no horizontal scroll, and the action bar does not hide the content on phones", async ({ page }) => {
    for (const view of ["none", "accepted", "own", "unavailable"]) {
      await page.goto(`/trip/t1?as=${view}`);
      expect(await noSideScroll(page), view).toBeLessThanOrEqual(0);
    }
    await page.goto("/trip/t1");
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(page.getByRole("contentinfo")).toBeInViewport();
  });
});
