import { expect, test } from "@playwright/test";

test.describe("Issue 35 authenticated Requester regression", () => {
  test("guards Ticket routes with Login and removes the Lab 2 selector context", async ({ page }) => {
    await page.goto("/tickets");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select Development Requester" })).toHaveCount(0);
  });
});
