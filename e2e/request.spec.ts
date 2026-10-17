import { expect, test, type Page } from "@playwright/test";

// Demo mode, clock pinned to Saturday, Oct 17 2026, 1:00 PM in Los Angeles. The rules (matching, the
// all-or-nothing accept, limits) are tested in the database (supabase/tests/step8_in_search_of.test.sql
// and supabase/tests/race/offers.mjs); these cover the screens and the checks that run before a send.

const SAMPLE = "This isn't available in sample mode.";
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const post = (page: Page) => page.getByRole("button", { name: /Post request/ });
const pickPlace = async (page: Page, name: string) => {
  await page.getByLabel("Search places").fill(name.slice(0, 6));
  await page.getByRole("button", { name }).click();
};

test.describe("asking for a ride", () => {
  test("starts with sensible defaults and says what is still needed", async ({ page }) => {
    await page.goto("/post/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask for a ride" })).toBeVisible();
    await expect(page.getByLabel("Date")).toHaveValue("2026-10-17");
    await expect(page.getByLabel("Around")).toHaveValue("13:30");
    await expect(page.getByLabel("Plus or minus 30 minutes")).toBeChecked();
    await expect(page.getByTestId("seats-value")).toHaveText("1");
    await expect(page.getByLabel(/I'll chip in/)).toBeChecked();
    await expect(post(page)).toBeDisabled();
    await expect(page.getByTestId("disabled-reason")).toHaveText("Pick where you're going.");
    await expect(page.getByText("You can have up to 2 open requests.")).toBeVisible();
  });

  test("offers the four flexibilities", async ({ page }) => {
    await page.goto("/post/ask");
    for (const label of ["Exactly then", "Plus or minus 30 minutes", "Plus or minus 1 hour", "Any time that day"]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await page.getByLabel("Any time that day").check();
    await expect(page.getByLabel("Any time that day")).toBeChecked();
  });

  test("seats go from 1 to 3 only", async ({ page }) => {
    await page.goto("/post/ask");
    const more = page.getByRole("button", { name: "More seats" });
    await more.click();
    await more.click();
    await expect(page.getByTestId("seats-value")).toHaveText("3");
    await expect(more).toBeDisabled();
    await expect(page.getByRole("button", { name: "Fewer seats" })).toBeEnabled();
  });

  test("there is no price field, only whether you will chip in", async ({ page }) => {
    await page.goto("/post/ask");
    await expect(page.getByRole("textbox", { name: /price|cost|pay|\$/i })).toHaveCount(0);
    await expect(page.locator('input[name="price"], input[name="amount"]')).toHaveCount(0);
    await page.getByLabel(/I'll chip in/).uncheck();
    await expect(page.getByLabel(/I'll chip in/)).not.toBeChecked();
  });

  test("a time more than 7 days out, or in the past, is refused inline", async ({ page }) => {
    await page.goto("/post/ask");
    await pickPlace(page, "Trader Joe's");
    await page.getByLabel("Date").fill("2026-10-30");
    await expect(page.locator("#time-error")).toHaveText("Pick a time within the next 7 days.");
    await expect(post(page)).toBeDisabled();
    await page.getByLabel("Date").fill("2020-01-01");
    await expect(page.locator("#time-error")).toHaveText("That time has already passed. Pick a later one.");
    await page.getByLabel("Date").fill("2026-10-20");
    await expect(page.locator("#time-error")).toHaveText("Up to 7 days ahead.");
    await expect(post(page)).toBeEnabled();
  });

  test("the date picker stops at 7 days ahead", async ({ page }) => {
    await page.goto("/post/ask");
    await expect(page.getByLabel("Date")).toHaveAttribute("max", "2026-10-24");
    await expect(page.getByLabel("Date")).toHaveAttribute("min", "2026-10-17");
  });

  test("meetup points are a pick-list: there is no address field", async ({ page }) => {
    await page.goto("/post/ask");
    await expect(page.getByRole("radio", { name: /Platt Campus Center/ })).toBeChecked();
    await expect(page.getByRole("textbox", { name: /meetup|address|pick ?up/i })).toHaveCount(0);
    await page.goto("/post/ask?points=none");
    await expect(page.getByTestId("no-meetup-points")).toBeVisible();
    await pickPlace(page, "Trader Joe's");
    await expect(post(page)).toBeDisabled();
    await expect(page.getByTestId("disabled-reason")).toHaveText("Pick a meetup point.");
  });

  test("contact details in the note are caught as you type", async ({ page }) => {
    await page.goto("/post/ask");
    await page.getByLabel(/Note/).fill("text me 909-555-0123");
    await expect(page.locator("#note-help")).toHaveText("Keep contact details in the app chat.");
    await page.getByLabel(/Note/).fill("Two grocery bags");
    await expect(page.locator("#note-help")).toContainText("No phone numbers, emails, handles, or links.");
  });

  test("a complete request reaches the server, which says plainly that sample mode can't post", async ({ page }) => {
    await page.goto("/post/ask");
    await pickPlace(page, "Trader Joe's");
    await post(page).click();
    await expect(page.getByText("Asking for a ride isn't available in sample mode.")).toBeVisible();
  });

  test("leaving a half-filled request asks before discarding it", async ({ page }) => {
    await page.goto("/post/ask");
    await page.getByLabel(/Note/).fill("hello");
    page.once("dialog", (d) => { expect(d.message()).toBe("Discard this request?"); void d.dismiss(); });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/post\/ask$/);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/post$/);
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const url of ["/post/ask", "/post/ask?points=none"]) {
      await page.goto(url);
      expect(await noSideScroll(page), url).toBeLessThanOrEqual(0);
    }
  });

  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/post/ask?fail=1");
    await expect(page.getByTestId("error-state")).toContainText("We couldn't load the form");
  });
});

test.describe("the rider's request page", () => {
  test("shows the request and the offers waiting", async ({ page }) => {
    await page.goto("/request/r4");
    await expect(page.getByRole("heading", { level: 1, name: "Trader Joe's" })).toBeVisible();
    await expect(page.getByText("Tomorrow, 7:00 PM to 9:00 PM")).toBeVisible();
    await expect(page.getByText("Will chip in")).toBeVisible();
    const offers = page.getByTestId("offer");
    await expect(offers.filter({ has: page.locator("xpath=.") })).toHaveCount(3);
    await expect(page.locator('[data-testid=offer][data-status=pending]')).toHaveCount(2);
    const first = page.locator('[data-testid=offer][data-status=pending]').first();
    await expect(first).toContainText("Maya");
    await expect(first).toContainText("Blue Honda Civic");
    await expect(first).toContainText("Platt Campus Center");
    await expect(first).toContainText("Happy to take you, I have room for bags.");
    await expect(first.getByRole("button", { name: "Accept Maya's offer" })).toBeVisible();
    await expect(first.getByRole("button", { name: "Decline Maya's offer" })).toBeVisible();
  });

  test("keeps answered offers apart, with no buttons", async ({ page }) => {
    await page.goto("/request/r4");
    await expect(page.getByRole("heading", { level: 3, name: "Answered" })).toBeVisible();
    const declined = page.locator("[data-testid=offer][data-status=declined]");
    await expect(declined).toHaveCount(1);
    await expect(declined).toContainText("Declined");
    await expect(declined.getByRole("button")).toHaveCount(0);
  });

  test("never shows a plate or an exact spot on an offer", async ({ page }) => {
    await page.goto("/request/r4");
    await expect(page.locator("main")).toHaveCount(1); // wait for the page to replace its loading screen
    await expect(page.getByTestId("offer").first()).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/DEV\d{4}/);
    expect(text).not.toMatch(/Stand (at|by)/);
  });

  test("answering in sample mode says so, next to that offer", async ({ page }) => {
    await page.goto("/request/r4");
    const first = page.locator("[data-testid=offer][data-status=pending]").first();
    await first.getByRole("button", { name: "Accept Maya's offer" }).click();
    await expect(first.getByRole("alert")).toHaveText(SAMPLE);
  });

  test("offers Edit, Keep open, and a confirmed Cancel", async ({ page }) => {
    await page.goto("/request/r4");
    const actions = page.getByTestId("request-actions");
    await expect(actions.getByRole("link", { name: "Edit request" })).toHaveAttribute("href", "/request/r4/edit");
    await actions.getByRole("button", { name: "Keep open 2 more hours" }).click();
    await expect(actions.getByRole("alert")).toHaveText(SAMPLE);
    await actions.getByRole("button", { name: "Cancel request" }).click();
    const d = page.getByTestId("cancel-request-dialog");
    await expect(d.getByRole("heading", { name: "Cancel this request?" })).toBeVisible();
    await expect(d).toContainText("Drivers who offered will be told.");
    await d.getByRole("button", { name: "Keep request" }).click();
    await expect(d).toBeHidden();
  });

  test("a matched request points to the trip", async ({ page }) => {
    await page.goto("/request/r4?as=matched");
    await expect(page.getByTestId("matched")).toContainText("You have a ride.");
    await expect(page.getByRole("link", { name: /View trip/ })).toHaveAttribute("href", "/trip/t1");
    await expect(page.locator("[data-testid=offer][data-status=pending]")).toHaveCount(0);
  });

  test("a cancelled request says it is closed", async ({ page }) => {
    await page.goto("/request/r4?as=cancelled");
    await expect(page.getByTestId("request-actions")).toContainText("This request is closed.");
    await expect(page.getByRole("link", { name: "Ask for another ride" })).toHaveAttribute("href", "/post/ask");
  });

  test("shows the toasts after posting and after offering", async ({ page }) => {
    await page.goto("/request/r4?posted=1");
    await expect(page.getByTestId("toast")).toHaveText("Request posted. Drivers going your way will see it.");
    await page.goto("/request/r1?offered=1");
    await expect(page.getByTestId("toast")).toHaveText("Offer sent. We'll let Jordan know.");
  });

  test("an unknown request is the plain not-found page", async ({ page }) => {
    await page.goto("/request/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
  });
});

test.describe("editing a request", () => {
  test("starts with the request's current details", async ({ page }) => {
    await page.goto("/request/r4/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Edit request" })).toBeVisible();
    await expect(page.getByLabel("Date")).toHaveValue("2026-10-18");
    await expect(page.getByLabel("Around")).toHaveValue("20:00");
    await expect(page.getByLabel("Plus or minus 1 hour")).toBeChecked();
    await expect(page.getByLabel(/Note/)).toHaveValue("Two grocery bags.");
    await expect(page.getByText("Going to")).toBeVisible();
  });

  test("checks the time and the note, then says sample mode can't save", async ({ page }) => {
    await page.goto("/request/r4/edit");
    await page.getByLabel("Date").fill("2020-01-01");
    await expect(page.locator("#time-error")).toHaveText("That time has already passed. Pick a later one.");
    await expect(page.getByRole("button", { name: /Save changes/ })).toBeDisabled();
    await page.getByLabel("Date").fill("2026-10-19");
    await page.getByLabel(/Note/).fill("see me@hmc.edu");
    await expect(page.locator("#note-help")).toHaveText("Keep contact details in the app chat.");
    await page.getByLabel(/Note/).fill("Updated note");
    await page.getByRole("button", { name: /Save changes/ }).click();
    await expect(page.getByText(SAMPLE)).toBeVisible();
  });
});

test.describe("a driver answering a request", () => {
  test("opens an Offer a ride dialog with the trips that fit", async ({ page }) => {
    await page.goto("/request/r1");
    await expect(page.getByTestId("request-actions").getByRole("heading")).toHaveCount(0);
    await page.getByRole("button", { name: /Offer a ride/ }).click();
    const d = page.getByTestId("offer-dialog");
    await expect(d.getByRole("heading", { name: "Offer a ride to Jordan" })).toBeVisible();
    await expect(d.getByRole("radio")).toHaveCount(2);
    await expect(d.getByRole("radio").first()).toBeChecked();
    await expect(d.getByRole("link", { name: "Post a new trip for this" })).toHaveAttribute("href", "/post/offer?for=r1");
  });

  test("keeps contact details out of the offer message", async ({ page }) => {
    await page.goto("/request/r1");
    await page.getByRole("button", { name: /Offer a ride/ }).click();
    const d = page.getByTestId("offer-dialog");
    await d.getByLabel(/Message/).fill("call 909-555-0123");
    await expect(d.locator("#offer-note")).toHaveText("Keep contact details in the app chat.");
    await expect(d.getByRole("button", { name: /Send offer/ })).toBeDisabled();
  });

  test("sending in sample mode says so", async ({ page }) => {
    await page.goto("/request/r1");
    await page.getByRole("button", { name: /Offer a ride/ }).click();
    await page.getByTestId("offer-dialog").getByRole("button", { name: /Send offer/ }).click();
    await expect(page.getByTestId("offer-error")).toHaveText(SAMPLE);
  });

  test("a driver who already offered sees their offer and can withdraw it", async ({ page }) => {
    await page.goto("/request/r1?as=offered");
    await expect(page.getByTestId("request-actions")).toContainText("You offered a ride.");
    await expect(page.getByRole("button", { name: "Offer a ride" })).toHaveCount(0);
    await page.getByRole("button", { name: "Withdraw offer" }).click();
    await expect(page.getByTestId("request-actions").getByRole("alert")).toHaveText(SAMPLE);
  });

  test("posting a new trip for a request starts from its destination and says what happens", async ({ page }) => {
    await page.goto("/post/offer?for=r1");
    await expect(page.getByTestId("answering")).toContainText("You're answering Jordan's request to Trader Joe's.");
    await expect(page.getByTestId("answering")).toContainText("we'll send your offer");
    await expect(page.getByTestId("destination-selected")).toContainText("Trader Joe's");
    await expect(page.getByLabel("Date")).toHaveValue("2026-10-18");
  });

  test("the confirmation page says whether the offer went out", async ({ page }) => {
    await page.goto("/post/confirmed/t1?offered=1&for=r1");
    await expect(page.getByTestId("offer-sent")).toContainText("Your offer was sent.");
    await page.goto("/post/confirmed/t1?offered=0&for=r1");
    await expect(page.getByTestId("offer-failed")).toContainText("we couldn't send the offer");
    await expect(page.getByRole("link", { name: "Open the request to try again" })).toHaveAttribute("href", "/request/r1");
  });
});

test.describe("offers in the Inbox", () => {
  test("lists the offers waiting, above everything else, with the request each is for", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Offers");
    const offers = page.getByTestId("offer");
    await expect(offers).toHaveCount(2);
    await expect(offers.first()).toContainText("For your request to Trader Joe's");
    await expect(offers.first().getByRole("link", { name: "Trader Joe's" })).toHaveAttribute("href", "/request/r4");
    await expect(offers.first().getByRole("button", { name: "Accept Maya's offer" })).toBeVisible();
    await expect(offers.nth(1)).toContainText("Jordan");
  });
});

test.describe("In search of in My Rides", () => {
  test("Requests lists the person's own request, with its offers", async ({ page }) => {
    await page.goto("/rides?tab=requests");
    const mine = page.getByTestId("my-request-row");
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText("Trader Joe's");
    await expect(mine).toContainText("2 offers waiting");
    await expect(mine.getByRole("link", { name: "Trader Joe's" })).toHaveAttribute("href", "/request/r4");
  });

  test("Past lists cancelled and expired requests", async ({ page }) => {
    await page.goto("/rides?tab=past");
    const mine = page.getByTestId("my-request-row");
    await expect(mine).toHaveCount(2);
    await expect(mine.filter({ hasText: "Ontario Mills" })).toContainText("Cancelled");
    await expect(mine.filter({ hasText: "Claremont Village" })).toContainText("Expired");
  });
});

test("none of these pages scroll sideways", async ({ page }) => {
  for (const url of ["/request/r4", "/request/r4/edit", "/request/r1", "/request/r4?as=matched", "/inbox", "/post/offer?for=r1"]) {
    await page.goto(url);
    expect(await noSideScroll(page), url).toBeLessThanOrEqual(0);
  }
});
