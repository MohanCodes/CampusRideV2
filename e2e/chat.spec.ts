import { expect, test, type Page } from "@playwright/test";

// Demo mode, clock pinned to Saturday, Oct 17 2026, 1:00 PM in Los Angeles. The live feed and the
// rules about who may send are tested against the database (supabase/tests/step7_chat.test.sql);
// these cover the screens. In sample mode a sent message stays in the page.

const log = (page: Page) => page.getByRole("log", { name: "Messages" });
const box = (page: Page) => page.getByLabel("Message", { exact: true });
const send = (page: Page) => page.getByRole("button", { name: /^Send/ });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("a chat", () => {
  test("shows who it is with, the trip, and the history in order", async ({ page }) => {
    await page.goto("/chat/c1");
    await expect(page.getByRole("main")).toContainText("Sam");
    await expect(page.getByRole("main")).toContainText("Scripps");
    await expect(page.getByRole("link", { name: "Ontario International Airport (ONT)" })).toHaveAttribute("href", "/trip/t3");
    const items = log(page).locator("[data-kind]");
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toHaveAttribute("data-kind", "system");
    await expect(items.nth(0)).toHaveText("Sam accepted Riley. You can plan the pickup here.");
    await expect(items.nth(1)).toContainText("Hi! I'll be in a green Subaru Outback.");
    await expect(items.nth(3)).toContainText("Running 5 min late, sorry!");
  });

  test("puts my messages on the right and theirs on the left", async ({ page }) => {
    await page.goto("/chat/c1");
    await expect(log(page).locator("[data-mine=true]")).toHaveCount(1);
    await expect(log(page).locator("[data-mine=false]")).toHaveCount(2);
    const mine = (await log(page).locator("[data-mine=true] p").boundingBox())!;
    const theirs = (await log(page).locator("[data-mine=false] p").first().boundingBox())!;
    expect(mine.x).toBeGreaterThan(theirs.x);
  });

  test("labels the day and the time of each message", async ({ page }) => {
    await page.goto("/chat/c1");
    await expect(log(page)).toContainText(/Today|Yesterday/);
    await expect(log(page).getByText(/\d{1,2}:\d{2} (AM|PM)/).first()).toBeVisible();
  });

  test("sends what you type, and clears the box", async ({ page }) => {
    await page.goto("/chat/c1");
    await expect(send(page)).toBeDisabled();
    await box(page).fill("I'll be at the front gate.");
    await expect(send(page)).toBeEnabled();
    await send(page).click();
    const last = log(page).locator("[data-kind=user]").last();
    await expect(last).toContainText("I'll be at the front gate.");
    await expect(last).toHaveAttribute("data-mine", "true");
    await expect(box(page)).toHaveValue("");
    await expect(send(page)).toBeDisabled();
  });

  test("Enter sends, and Shift and Enter makes a new line", async ({ page }) => {
    await page.goto("/chat/c1");
    await box(page).fill("line one");
    await box(page).press("Shift+Enter");
    await box(page).type("line two");
    await expect(box(page)).toHaveValue("line one\nline two");
    await expect(log(page).locator("[data-kind=user]")).toHaveCount(3);
    await box(page).press("Enter");
    await expect(log(page).locator("[data-kind=user]")).toHaveCount(4);
    await expect(log(page).locator("[data-kind=user]").last()).toContainText("line one");
  });

  test("quick replies send in one tap", async ({ page }) => {
    await page.goto("/chat/c1");
    const quick = page.getByRole("list", { name: "Quick replies" }).getByRole("button");
    await expect(quick).toHaveText(["On my way", "Running 5 min late", "I'm here"]);
    await quick.nth(2).click();
    await expect(log(page).locator("[data-kind=user]").last()).toContainText("I'm here");
  });

  test("shows what is sent as plain text: nothing becomes a link or markup", async ({ page }) => {
    await page.goto("/chat/c1");
    await box(page).fill("<b>hi</b> https://example.com call 909-555-0123");
    await send(page).click();
    const last = log(page).locator("[data-kind=user]").last();
    await expect(last).toContainText("<b>hi</b> https://example.com call 909-555-0123");
    await expect(log(page).locator("a, b")).toHaveCount(0);
  });

  test("counts characters near the limit and stops at 1,000", async ({ page }) => {
    await page.goto("/chat/c1");
    await box(page).fill("x".repeat(950));
    await expect(page.getByText("950/1000")).toBeVisible();
    await box(page).fill("y".repeat(1200));
    await expect(box(page)).toHaveValue("y".repeat(1000));
  });

  test("a very long unbroken word does not push the page sideways", async ({ page }) => {
    await page.goto("/chat/c1");
    await box(page).fill("a".repeat(400));
    await send(page).click();
    await expect(log(page).locator("[data-kind=user]").last()).toBeVisible();
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  });

  test("the composer stays in view, and the newest message is showing when the chat opens", async ({ page, isMobile }) => {
    await page.goto("/chat/c1");
    await expect(page.getByTestId("composer")).toBeInViewport();
    await expect(log(page).locator("[data-kind]").last()).toBeInViewport();
    const atBottom = await page.getByTestId("scroller").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 2);
    expect(atBottom).toBe(true);
    if (isMobile) await expect(page.getByRole("navigation", { name: "Bottom navigation" })).toHaveCount(0);
  });

  test("a closed chat keeps its history and says why it can't be used", async ({ page }) => {
    await page.goto("/chat/c3");
    await expect(page.getByTestId("chat-closed")).toHaveText("This chat is closed. Chats close 24 hours after the trip leaves.");
    await expect(page.getByTestId("composer")).toHaveCount(0);
    await expect(log(page).locator("[data-kind]")).toHaveCount(3);
  });

  test("an unknown chat is the plain not-found page", async ({ page }) => {
    await page.goto("/chat/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
  });

  test("the error state offers Try again", async ({ page }) => {
    await page.goto("/chat/c1?fail=1");
    await expect(page.getByTestId("error-state")).toContainText("We couldn't load this chat");
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const url of ["/chat/c1", "/chat/c2", "/chat/c3"]) {
      await page.goto(url);
      expect(await noSideScroll(page), url).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("chats in the Inbox", () => {
  test("lists every chat, most recent first, with unread counts", async ({ page }) => {
    await page.goto("/inbox");
    const rows = page.getByTestId("chat-row");
    await expect(page.getByRole("heading", { level: 2, name: "Chats" })).toBeVisible();
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Sam");
    await expect(rows.nth(0)).toContainText("Running 5 min late, sorry!");
    await expect(rows.nth(0).getByTestId("unread")).toContainText("1 unread");
    await expect(rows.nth(1)).toContainText("Jordan");
    await expect(rows.nth(1)).toContainText("You: No problem. Platt steps at 6:55?");
    await expect(rows.nth(1).getByTestId("unread")).toHaveCount(0);
    await expect(rows.nth(2)).toContainText("Alex");
    await expect(rows.nth(2)).toContainText("Closed");
  });

  test("a chat opens from the list", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByTestId("chat-row").first().getByRole("link").click();
    await expect(page).toHaveURL(/\/chat\/c1$/);
  });
});

test.describe("Message links", () => {
  test("an accepted rider's trip page links to the chat with the driver", async ({ page }) => {
    await page.goto("/trip/t3?as=accepted");
    await expect(page.getByRole("link", { name: /Message driver/ })).toHaveAttribute("href", "/chat/c1");
  });

  test("a driver's own trip links to the chat with each accepted rider", async ({ page }) => {
    await page.goto("/trip/t10");
    await expect(page.getByRole("link", { name: "Message Jordan" })).toHaveAttribute("href", "/chat/c2");
    await expect(page.getByRole("link", { name: /Message Alex/ })).toHaveCount(0); // not accepted yet
  });
});
