import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow } from "../lab-03/lab3-fixtures.js";
import { apiBaseUrl, captureLab4Screenshot, cleanupE2eData, createTicket, loginAs, resetLab3Users, validPdf } from "./lab4-fixtures.js";

test.describe("Lab 4 Actions Taken browser flow", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
    await resetLab3Users();
  });

  test.afterEach(async () => cleanupE2eData());

  test("E2E-01 persists Action create, edit, completion, cancellation, ownership and read-only Requester behavior", async ({ page, browser }, testInfo) => {
    const requesterContext = await browser.newContext();
    const requesterPage = await requesterContext.newPage();
    let ticketNumber = "";
    try {
      await loginAs(requesterPage, "requesterA");
      ticketNumber = await createTicket(requesterPage, testInfo, "actions", true);
      await requesterPage.goto(`/tickets/${ticketNumber}`);
      await expect(requesterPage.getByText("lab4-evidence.pdf", { exact: true })).toBeVisible();

      await loginAs(page, "staff");
      await page.goto(`/staff/tickets/${ticketNumber}`);
      await expect(page.getByRole("heading", { name: "Staff Ticket Detail" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "No Actions Taken have been recorded for this Ticket." })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();

      const firstDescription = `Inspect submitted evidence ${testInfo.project.name}`;
      const editedDescription = `Verify submitted evidence ${testInfo.project.name}`;
      await page.getByRole("button", { name: "Create Action", exact: true }).click();
      const createForm = page.locator('form[aria-label="Create Action form"]');
      await createForm.getByLabel("Description", { exact: true }).fill(firstDescription);
      await createForm.getByRole("button", { name: "Save Action", exact: true }).click();
      let firstAction = page.locator(".action-taken-card").filter({ hasText: firstDescription });
      await expect(firstAction).toBeVisible();
      await expect(firstAction.locator(".action-taken-meta div").filter({ hasText: /^Result/ })).toContainText("Not recorded");

      await firstAction.getByRole("button", { name: "Edit Action", exact: true }).click();
      const editForm = page.locator("form.action-taken-editor").filter({ has: page.getByRole("heading", { name: "Edit Action" }) });
      await editForm.getByLabel("Description", { exact: true }).fill(editedDescription);
      await editForm.getByLabel("Result (optional)", { exact: true }).fill("The supplied evidence was checked and matches this request.");
      await editForm.getByRole("button", { name: "Save Action", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Action updated." })).toBeVisible();
      firstAction = page.locator(".action-taken-card").filter({ hasText: editedDescription });
      await expect(firstAction).toBeVisible();
      await firstAction.getByRole("button", { name: "Show revision history", exact: true }).click();
      await expect(firstAction.getByText(firstDescription, { exact: true })).toBeVisible();
      await expect(firstAction.getByLabel(/Revision history for Action/).getByText(editedDescription, { exact: true })).toBeVisible();

      await firstAction.getByRole("button", { name: "Start Work", exact: true }).click();
      await expect(firstAction.getByText("IN_PROGRESS", { exact: true })).toBeVisible();
      await firstAction.getByRole("button", { name: "Complete Action", exact: true }).click();
      await page.getByRole("dialog", { name: "Complete Action?" }).getByRole("button", { name: "Confirm completion", exact: true }).click();
      await expect(firstAction.getByText("COMPLETED", { exact: true })).toBeVisible();
      await expect(firstAction.locator(".action-taken-meta div").filter({ hasText: /^Performed by/ })).toContainText("Michael Brown (michael.staff@example.test)");

      const secondDescription = `Confirm requester follow-up ${testInfo.project.name}`;
      await page.getByRole("button", { name: "Create Action", exact: true }).click();
      const secondForm = page.locator('form[aria-label="Create Action form"]');
      await secondForm.getByLabel("Description", { exact: true }).fill(secondDescription);
      await secondForm.getByRole("button", { name: "Save Action", exact: true }).click();
      const secondAction = page.locator(".action-taken-card").filter({ hasText: secondDescription });
      await expect(secondAction).toBeVisible();
      await secondAction.getByRole("button", { name: "Cancel Action", exact: true }).click();
      const cancellationDialog = page.getByRole("dialog", { name: "Cancel Action?" });
      await cancellationDialog.getByLabel("Cancellation reason").fill("The requester confirmed this step is no longer needed.");
      await cancellationDialog.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
      await expect(secondAction.getByText("CANCELLED", { exact: true })).toBeVisible();
      await expect(secondAction.getByText(/The requester confirmed this step is no longer needed/)).toBeVisible();

      const persisted = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/actions-taken`);
      expect(persisted.status()).toBe(200);
      const persistedBody = await persisted.json() as { actions: Array<{ description: string; status: string; result: string | null; cancellationReason: string | null }> };
      expect(persistedBody.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ description: editedDescription, status: "COMPLETED", result: "The supplied evidence was checked and matches this request." }),
        expect.objectContaining({ description: secondDescription, status: "CANCELLED", cancellationReason: "The requester confirmed this step is no longer needed." }),
      ]));
      await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
      await assertNoHorizontalOverflow(page);
      await captureLab4Screenshot(page, testInfo, "actions-taken", "multi-action-workflow");

      await requesterPage.goto(`/tickets/${ticketNumber}`);
      await expect(requesterPage.getByRole("heading", { name: editedDescription })).toBeVisible();
      await expect(requesterPage.getByRole("heading", { name: secondDescription })).toBeVisible();
      await expect(requesterPage.getByRole("button", { name: "Create Action", exact: true })).toHaveCount(0);
      await expect(requesterPage.getByRole("button", { name: "Edit Action", exact: true })).toHaveCount(0);
      await expect(requesterPage.getByRole("button", { name: "Complete Action", exact: true })).toHaveCount(0);
      await expect(requesterPage.getByRole("heading", { name: "Internal Notes" })).toHaveCount(0);
      const otherContext = await browser.newContext();
      try {
        const otherPage = await otherContext.newPage();
        await loginAs(otherPage, "requesterB");
        const otherActions = await otherPage.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/actions-taken`);
        expect(otherActions.status()).toBe(404);
        expect(await otherActions.json()).toEqual({ error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." } });
      } finally {
        await otherContext.close();
      }
    } finally {
      await requesterContext.close();
    }
  });
});
