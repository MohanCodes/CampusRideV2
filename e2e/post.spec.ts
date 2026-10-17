import { expect, test, type Page } from "@playwright/test";

// Demo mode, clock pinned to Saturday, Oct 17 2026, 1:00 PM in Los Angeles. Posting itself needs a
// backend, so these cover everything up to the server: choosing, validating, and the screens around it.

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const submit = (page: Page) => page.getByRole("button", { name: /Post trip/ });
const pickPlace = async (page: Page, name: string) => {
  await page.getByLabel("Search places").fill(name.slice(0, 6));
  await page.getByRole("button", { name }).click();
};

test.describe("choosing what to post", () => {
  test("offers the two kinds, and says plainly that asking isn't open yet", async ({ page }) => {
    await page.goto("/post");
    await expect(page.getByRole("heading", { level: 1, name: "Post" })).toBeVisible();
    await expect(page.getByTestId("choose-offer")).toContainText("Offer a ride");
    await expect(page.getByTestId("choose-ask-disabled")).toContainText("Asking for a ride isn't open yet.");
    await page.getByTestId("choose-offer").click();
    await expect(page).toHaveURL(/\/post\/offer$/);
  });

  test("Post is in the navigation: a bottom bar on phones, header links on larger screens", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Post", exact: true }).and(page.locator(":visible"));
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole("link", { name: "Post", exact: true }).and(page.locator(":visible"))).toHaveAttribute("aria-current", "page");
  });

  test("the bottom bar steps aside on the trip page so the action bar is not covered", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones only");
    await page.goto("/trip/t1");
    await expect(page.getByRole("navigation", { name: "Bottom navigation" })).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Bottom navigation" })).toBeVisible();
  });
});

test.describe("the offer form", () => {
  test("starts with smart defaults and says what is still needed", async ({ page }) => {
    await page.goto("/post/offer");
    await expect(page.getByLabel("Date")).toHaveValue("2026-10-17");
    await expect(page.getByLabel("Leave at")).toHaveValue("13:30"); // the next half hour
    await expect(page.getByTestId("seats-value")).toHaveText("3");
    await expect(page.getByRole("radio", { name: "Platt Campus Center" })).toBeChecked(); // last used
    await expect(submit(page)).toBeDisabled();
    await expect(page.getByTestId("disabled-reason")).toHaveText("Pick where you're going.");
  });

  test("a place from the list can be picked and changed", async ({ page }) => {
    await page.goto("/post/offer");
    await expect(page.getByRole("list", { name: "Popular places" }).getByRole("button")).toHaveCount(6);
    await page.getByRole("button", { name: "Show all places" }).click();
    await expect(page.getByRole("list", { name: "Popular places" }).getByRole("button")).toHaveCount(7);
    await pickPlace(page, "Trader Joe's");
    await expect(page.getByTestId("destination-selected")).toContainText("Trader Joe's");
    await expect(submit(page)).toBeEnabled();
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.getByLabel("Search places")).toBeVisible();
    await expect(submit(page)).toBeDisabled();
  });

  test("somewhere else comes from a search, and addresses can't be chosen", async ({ page }) => {
    await page.goto("/post/offer");
    await page.getByLabel("Search places").fill("botanic");
    await expect(page.getByText("Somewhere else")).toBeVisible();
    await page.getByRole("button", { name: /Rancho Santa Ana Botanic Garden/ }).click();
    await expect(page.getByTestId("destination-selected")).toContainText("Rancho Santa Ana Botanic Garden");
    await page.getByRole("button", { name: "Change" }).click();
    await page.getByLabel("Search places").fill("123 Oak Street");
    await expect(page.getByText("No matches. Try another name.")).toBeVisible();
    await expect(page.getByText("Home addresses can't be chosen.")).toBeVisible();
  });

  test("a time in the past is refused inline, with the button off and the reason shown", async ({ page }) => {
    await page.goto("/post/offer");
    await pickPlace(page, "Trader Joe's");
    await page.getByLabel("Date").fill("2020-01-01");
    await expect(page.locator("#time-error")).toHaveText("That time has already passed. Pick a later one.");
    await expect(submit(page)).toBeDisabled();
    await expect(page.getByTestId("disabled-reason")).toHaveText("That time has already passed. Pick a later one.");
    await page.getByLabel("Date").fill("2026-10-18");
    await expect(page.locator("#time-error")).not.toHaveAttribute("role", "alert");
    await expect(submit(page)).toBeEnabled();
  });

  test("seats go from 1 to 6", async ({ page }) => {
    await page.goto("/post/offer");
    const more = page.getByRole("button", { name: "More seats" });
    const fewer = page.getByRole("button", { name: "Fewer seats" });
    for (let i = 0; i < 3; i++) await more.click(); // 3 is the default
    await expect(page.getByTestId("seats-value")).toHaveText("6");
    await expect(more).toBeDisabled();
    for (let i = 0; i < 5; i++) await fewer.click();
    await expect(page.getByTestId("seats-value")).toHaveText("1");
    await expect(fewer).toBeDisabled();
  });

  test("meetup points are a pick-list of approved points: there is no address field", async ({ page }) => {
    await page.goto("/post/offer");
    await expect(page.getByRole("radio")).toHaveCount(4);
    await expect(page.getByText("Harvey Mudd points")).toBeVisible();
    await expect(page.getByText("Shared points")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /meetup|address|pick ?up/i })).toHaveCount(0);
    await page.getByRole("radio", { name: "Smith Campus Center" }).check();
    await expect(page.getByRole("radio", { name: "Smith Campus Center" })).toBeChecked();
    await expect(page.getByText("The exact place to stand is shared with riders after you accept them.")).toBeVisible();
  });

  test("with no approved points the form says so rather than offering a way to type one", async ({ page }) => {
    await page.goto("/post/offer?points=none");
    await expect(page.getByTestId("no-meetup-points")).toContainText("No meetup points are available for Harvey Mudd yet");
    await pickPlace(page, "Trader Joe's");
    await expect(submit(page)).toBeDisabled();
    await expect(page.getByTestId("disabled-reason")).toHaveText("Pick a meetup point.");
  });

  test("notes with contact details are flagged as you type", async ({ page }) => {
    await page.goto("/post/offer");
    await page.getByLabel("Notes").fill("text me at 909-555-0123");
    await expect(page.locator("#notes-help")).toHaveText("Keep contact details in the app chat.");
    await page.getByLabel("Notes").fill("Back by 5, no big bags");
    await expect(page.locator("#notes-help")).toContainText("No phone numbers, emails, handles, or links.");
    await page.getByLabel("Cost note").fill("venmo @maya");
    await expect(page.locator("#cost-note")).toHaveText("Keep contact details in the app chat.");
    await page.getByLabel("Cost note").fill("909-555");
    await page.getByLabel("Notes").fill("0123");
    await expect(page.locator("#notes-help")).toHaveText("Keep contact details in the app chat.");
  });

  test("the server's checks come back next to the right fields", async ({ page }) => {
    await page.goto("/post/offer");
    await pickPlace(page, "Trader Joe's");
    await submit(page).click(); // the car is still blank
    await expect(page.locator("#carMake-error")).toHaveText("Add the car's make.");
    await expect(page.locator("#carColor-error")).toHaveText("Add the car's color.");
    await expect(page.locator("#carPlate-error")).toContainText("Enter the plate");
    await expect(page.getByLabel("Make")).toHaveAttribute("aria-invalid", "true");
  });

  test("a complete form reaches the server, which says plainly that sample mode can't post", async ({ page }) => {
    await page.goto("/post/offer");
    await pickPlace(page, "Trader Joe's");
    await page.getByLabel("Make").fill("Honda");
    await page.getByLabel("Color").fill("Blue");
    await page.getByLabel("Plate").fill("abc 123");
    await submit(page).click();
    await expect(page.getByText("Posting isn't available in sample mode.")).toBeVisible();
  });

  test("leaving a half-filled form asks 'Discard this trip?'", async ({ page }) => {
    await page.goto("/post/offer");
    await page.getByLabel("Make").fill("Honda");
    await page.getByRole("button", { name: "Cancel" }).click();
    const dialog = page.getByRole("dialog", { name: "Discard this trip?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Make")).toHaveValue("Honda");
    await page.getByRole("button", { name: "Cancel" }).click();
    await dialog.getByRole("link", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/post$/);
  });

  test("leaving an untouched form needs no question", async ({ page }) => {
    await page.goto("/post/offer");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/post$/);
  });

  test("every field has a visible label, and the plate says who can see it", async ({ page }) => {
    await page.goto("/post/offer");
    for (const label of ["Date", "Leave at", "Back by", "Make", "Color", "Plate", "Cost note", "Notes", "Search places"]) {
      await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByText("The plate is only shown to riders you accept.")).toBeVisible();
  });

  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/post/offer?fail=1");
    await expect(page.getByTestId("error-state")).toContainText("We couldn't load the form");
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/post/offer");
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const url of ["/post", "/post/offer", "/post/offer?points=none", "/post/confirmed/t1"]) {
      await page.goto(url);
      expect(await noSideScroll(page), url).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("after posting", () => {
  test("shows the trip card, a Done button, and Copy link", async ({ page, context, browserName }) => {
    await page.goto("/post/confirmed/t1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your trip is posted");
    await expect(page.getByTestId("trip-card")).toContainText("Trader Joe's");
    await expect(page.getByRole("link", { name: /Done/ })).toHaveAttribute("href", "/");
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy link" }).click();
      await expect(page.getByText("Link copied.")).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/trip\/t1$/);
    }
  });

  test("an unknown trip is the plain not-found page", async ({ page }) => {
    await page.goto("/post/confirmed/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
  });
});
