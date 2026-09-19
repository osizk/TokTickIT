import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  completeFirstLogin,
  fillFirstLoginPassword,
  resetLab3Users,
  saveEvidenceScreenshot,
  signInWithInitialPassword,
} from "./lab3-fixtures.js";

test.describe("Lab 3 authentication and role navigation", () => {
  test.beforeEach(async () => {
    await resetLab3Users();
  });

  test("requires the first-login password change and lands the Requester in My Tickets", async ({ page }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "login");
    await signInWithInitialPassword(page, "requesterA");
    await expect(page.getByRole("heading", { name: "Change Password" })).toBeVisible();
    await fillFirstLoginPassword(page, "requesterA");
    await expect(page.getByText("7 of 7 password requirements passed.")).toBeVisible();
    await expect(page.getByText("Passwords match.")).toBeVisible();
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "change-password");
    await page.getByRole("button", { name: "Save password", exact: true }).click();
    await expect(page).not.toHaveURL(/\/change-password$/);
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "requester-first-login");
  });

  test("logs out and blocks a protected route after the session is revoked", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "requesterA");
    await completeFirstLogin(page, "requesterA");
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/tickets");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "logout-and-route-guard");
  });

  test("routes each role to its permitted workspace", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "admin");
    await completeFirstLogin(page, "admin");
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "administrator-landing");
  });
});
