import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  cleanupE2eData,
  loginAs,
  resetLab3Users,
  saveEvidenceScreenshot,
} from "./lab3-fixtures.js";

const validPdf = Buffer.from("%PDF-1.7\nTokTickIT Lab 3 E2E evidence\n", "utf8");

test.describe("Lab 3 authenticated Requester regression", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
    await resetLab3Users();
  });

  test.afterEach(async () => {
    await cleanupE2eData();
  });

  test("creates an owned Ticket, preserves the attachment lifecycle, and keeps notes private", async ({ page, browser }, testInfo) => {
    await loginAs(page, "requesterA");
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Create Ticket from My Tickets" }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await page.getByLabel("Category").selectOption({ label: "Hardware" });
    await page.getByLabel("Related System").selectOption({ label: "Laptop Fleet" });
    await page.getByLabel("Requested Priority").selectOption("HIGH");
    const summary = `E2E-39-${testInfo.project.name}-${Date.now()}`;
    await page.getByLabel("Summary").fill(summary);
    await page.getByLabel("Description").fill("Lab 3 Playwright evidence for the authenticated Requester workflow.");
    await page.locator("#attachments").setInputFiles({ name: "lab3-evidence.pdf", mimeType: "application/pdf", buffer: validPdf });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ticket created successfully" })).toBeVisible();
    const ticketNumber = (await page.locator(".zen-state-success strong").first().textContent())?.trim() ?? "";
    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    await page.getByRole("button", { name: "View Ticket", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
    await expect(page.getByText("lab3-evidence.pdf", { exact: true })).toBeVisible();
    const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
    const attachmentList = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`);
    expect(attachmentList.status()).toBe(200);
    const attachmentRows = (await attachmentList.json()) as { attachments: Array<{ id: number; originalName: string }> };
    const attachmentId = attachmentRows.attachments.find((attachment) => attachment.originalName === "lab3-evidence.pdf")?.id;
    expect(attachmentId).toBeDefined();
    await page.getByLabel("Add Public Comment").fill("Requester E2E comment for the shared timeline.");
    await page.getByRole("button", { name: "Post Comment", exact: true }).click();
    await expect(page.getByText("Requester E2E comment for the shared timeline.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Problem appears resolved", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Problem marked as appearing resolved." })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("lab3-evidence.pdf");
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Remove Attachment?" })).toBeVisible();
    await page.getByLabel("Removal reason").fill("No longer needed for E2E evidence.");
    await page.getByRole("button", { name: "Confirm Removal", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/Removed .*Reason: No longer needed for E2E evidence/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveCount(0);
    const removedDownload = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${attachmentId}/download`);
    expect(removedDownload.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Internal Notes" })).toHaveCount(0);
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "authentication", "requester-ticket-detail");

    const requesterBContext = await browser.newContext();
    const requesterBPage = await requesterBContext.newPage();
    try {
      await loginAs(requesterBPage, "requesterB");
      const crossOwnerDetail = await requesterBPage.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}`);
      const crossOwnerAttachments = await requesterBPage.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`);
      expect(crossOwnerDetail.status()).toBe(404);
      expect(await crossOwnerDetail.json()).toEqual({ error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." } });
      expect(crossOwnerAttachments.status()).toBe(404);
      await requesterBPage.goto(`/tickets/${ticketNumber}`);
      await expect(requesterBPage.getByText("Unable to load Ticket.", { exact: true })).toBeVisible();
      await expect(requesterBPage.getByText("Unable to load Attachments.", { exact: true })).toBeVisible();
    } finally {
      await requesterBContext.close();
    }
  });

  test("does not expose the legacy selector route or sessionStorage context", async ({ page }) => {
    await page.goto("/select-requester");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Select Development Requester" })).toHaveCount(0);
    expect(await page.evaluate(() => window.sessionStorage.getItem("selectedRequesterId"))).toBeNull();

    await loginAs(page, "requesterA");
    await page.goto("/select-requester");
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole("heading", { name: "Select Development Requester" })).toHaveCount(0);
    expect(await page.evaluate(() => window.sessionStorage.getItem("selectedRequesterId"))).toBeNull();
  });
});
