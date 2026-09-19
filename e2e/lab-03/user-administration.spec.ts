import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  completeFirstLogin,
  resetLab3Users,
  saveEvidenceScreenshot,
  signInWithInitialPassword,
} from "./lab3-fixtures.js";

test.describe("Lab 3 Administrator User Management", () => {
  test.beforeEach(async () => {
    await resetLab3Users();
  });

  test("lists users, opens an editor, and shows a safe no-results state", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "admin");
    await completeFirstLogin(page, "admin");
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await expect(page.getByRole("table", { name: "Users" })).toBeHidden();
      await expect(page.locator(".admin-users-cards")).toBeVisible();
    } else {
      await expect(page.getByRole("table", { name: "Users" })).toBeVisible();
    }
    await saveEvidenceScreenshot(page, testInfo.project.name, "user-management", "admin-users-list");
    await page.getByRole("button", { name: /Edit / }).first().click();
    await expect(page.getByRole("dialog", { name: "Edit User" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Edit User - / })).toBeFocused();
    await saveEvidenceScreenshot(page, testInfo.project.name, "user-management", "admin-user-editor");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByLabel("Search users").fill("no-such-lab3-user@example.test");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("No Users match the current search.", { exact: true })).toBeVisible();
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "user-management", "admin-no-results");
  });

  test("keeps Administrator actions isolated from Requester navigation", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "requesterA");
    await completeFirstLogin(page, "requesterA");
    const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
    const usersResponse = await page.request.get(`${apiBaseUrl}/api/admin/users`);
    expect(usersResponse.status()).toBe(403);
    expect(await usersResponse.json()).toEqual({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Access not available" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "User Management" })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "user-management", "requester-role-isolation");
  });
});
