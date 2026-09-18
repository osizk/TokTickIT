import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  completeFirstLogin,
  resetLab3Users,
  saveEvidenceScreenshot,
  signInWithInitialPassword,
} from "./lab3-fixtures.js";

test.describe("Lab 3 release evidence states", () => {
  test.beforeEach(async () => {
    await resetLab3Users();
  });

  test("captures a readable authenticated workspace at each responsive breakpoint", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "requesterA");
    await completeFirstLogin(page, "requesterA");
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "authenticated-workspace");
  });
});
