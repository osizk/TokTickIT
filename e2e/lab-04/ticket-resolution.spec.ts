import { expect, test } from "@playwright/test";
import { createTicket, loginAs, resetLab3Users, cleanupE2eData, apiBaseUrl } from "./lab4-fixtures.js";

test.describe("Lab 4 Ticket workflow browser flow", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
    await resetLab3Users();
  });

  test.afterEach(async () => cleanupE2eData());

  test("E2E-02 exercises the resolution gate, advisory, persisted history, resolve and reopen", async ({ page, browser }, testInfo) => {
    const requesterContext = await browser.newContext();
    const requesterPage = await requesterContext.newPage();
    try {
      await loginAs(requesterPage, "requesterA");
      const ticketNumber = await createTicket(requesterPage, testInfo, "workflow");
      await requesterPage.goto(`/tickets/${ticketNumber}`);
      await requesterPage.getByRole("button", { name: "Problem appears resolved", exact: true }).click();
      await expect(requesterPage.getByRole("status").filter({ hasText: "Ticket status is unchanged." })).toBeVisible();
      await expect(requesterPage.getByText("Current Status")).toBeVisible();

      await loginAs(page, "staff");
      await page.goto(`/staff/tickets/${ticketNumber}`);
      await expect(page.getByRole("heading", { name: "Staff Ticket Detail" })).toBeVisible();
      await expect(page.getByText("Requester indicated the problem appears resolved.", { exact: false })).toBeVisible();

      let csrfToken = "";
      const captureCsrf = (request: import("@playwright/test").Request) => {
        if (request.method() === "PATCH" && request.url().includes(`/api/staff/tickets/${ticketNumber}/assignment`)) {
          const headers = request.headers();
          csrfToken = headers["x-csrf-token"] ?? "";
        }
      };
      page.on("request", captureCsrf);
      await page.getByRole("button", { name: "Claim", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Ticket assignment updated." })).toBeVisible();
      page.off("request", captureCsrf);
      expect(csrfToken).not.toBe("");

      await page.getByLabel("Status", { exact: true }).selectOption("OPEN");
      await page.getByRole("button", { name: "Save Status", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Ticket status updated." })).toBeVisible();

      const detailResponse = await page.request.get(`${apiBaseUrl}/api/staff/tickets/${ticketNumber}`);
      expect(detailResponse.status()).toBe(200);
      const initialDetail = await detailResponse.json() as { ticket: { workflowVersion: number } };
      const rejectedResolve = await page.request.patch(`${apiBaseUrl}/api/staff/tickets/${ticketNumber}/status`, {
        data: { status: "RESOLVED", expectedVersion: initialDetail.ticket.workflowVersion, confirm: true },
        headers: { origin: new URL(page.url()).origin, "x-csrf-token": csrfToken },
      });
      const rejectedBody = await rejectedResolve.json() as { error: { code: string; fieldErrors?: Record<string, string> } };
      expect(rejectedResolve.status(), JSON.stringify(rejectedBody)).toBe(409);
      expect(rejectedBody.error.code).toBe("RESOLUTION_GATE_NOT_MET");
      expect(rejectedBody.error.fieldErrors?.resolutionGate).toContain("COMPLETED_ACTION_REQUIRED");
      const unchanged = await page.request.get(`${apiBaseUrl}/api/staff/tickets/${ticketNumber}`);
      expect((await unchanged.json() as { ticket: { status: string } }).ticket.status).toBe("OPEN");

      await page.getByLabel("Status", { exact: true }).selectOption("IN_PROGRESS");
      await page.getByRole("button", { name: "Save Status", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Ticket status updated." })).toBeVisible();

      const actionDescription = `Complete qualifying work ${testInfo.project.name}`;
      await page.getByRole("button", { name: "Create Action", exact: true }).click();
      const actionForm = page.locator('form[aria-label="Create Action form"]');
      await actionForm.getByLabel("Description", { exact: true }).fill(actionDescription);
      await actionForm.getByLabel("Result (optional)", { exact: true }).fill("The resolution prerequisite was completed and checked.");
      await actionForm.getByRole("button", { name: "Save Action", exact: true }).click();
      const actionCard = page.locator(".action-taken-card").filter({ hasText: actionDescription });
      await expect(actionCard).toBeVisible();
      await actionCard.getByRole("button", { name: "Complete Action", exact: true }).click();
      await page.getByRole("dialog", { name: "Complete Action?" }).getByRole("button", { name: "Confirm completion", exact: true }).click();
      await expect(actionCard.getByText("COMPLETED", { exact: true })).toBeVisible();

      await page.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
      await page.getByRole("button", { name: "Save Status", exact: true }).click();
      await page.getByRole("dialog", { name: "Change status to RESOLVED?" }).getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Current Ticket status: RESOLVED", { exact: true })).toBeVisible();
      await page.getByLabel("Status", { exact: true }).selectOption("REOPENED");
      await page.getByRole("button", { name: "Save Status", exact: true }).click();
      await page.getByRole("dialog", { name: "Change status to REOPENED?" }).getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Current Ticket status: REOPENED", { exact: true })).toBeVisible();

      const eventsResponse = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/workflow-events`);
      expect(eventsResponse.status()).toBe(200);
      const events = await eventsResponse.json() as { events: Array<{ fromStatus: string; toStatus: string; workflowVersion: number }> };
      expect(events.events.map(({ toStatus }) => toStatus)).toEqual(["OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"]);
      expect(events.events.map(({ workflowVersion }) => workflowVersion)).toEqual([3, 4, 7, 8]);

      await requesterPage.goto(`/tickets/${ticketNumber}`);
      await expect(requesterPage.getByText("Requester indicated the problem appears resolved.", { exact: false })).toHaveCount(0);
      await expect(requesterPage.getByRole("heading", { name: actionDescription })).toBeVisible();
      const requesterDetail = await requesterPage.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}`);
      expect(requesterDetail.status()).toBe(200);
      expect((await requesterDetail.json() as { ticket: { resolutionIndication: unknown } }).ticket.resolutionIndication).toBeNull();
    } finally {
      await requesterContext.close();
    }
  });
});
