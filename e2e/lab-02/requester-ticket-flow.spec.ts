import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupE2eData } from "./e2e-data.js";

const repositoryDirectory = path.resolve(process.cwd(), "..");
const screenshotDirectory = path.join(repositoryDirectory, "artifacts/lab-02/screenshots");
const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
const requesterAEmail = "amina@example.test";
const requesterBEmail = "ben@example.test";
const ticketPrefix = process.env.PLAYWRIGHT_RUN_TAG ?? "E2E-18-local";

const initialPdf = Buffer.from("%PDF-1.7\nTokTickIT Issue 18 initial evidence\n", "utf8");
const addedPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xe5, 0x27, 0xd4, 0xa2, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

async function assertNoHorizontalScroll(page: import("@playwright/test").Page): Promise<void> {
  const fits = await page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth + 1 &&
    document.body.scrollWidth <= window.innerWidth + 1
  ));
  expect(fits, "the page must not introduce horizontal scrolling").toBe(true);
}

async function assertAccessible(page: import("@playwright/test").Page, screenName: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${screenName} accessibility violations`).toEqual([]);
}

async function chooseRequester(
  page: import("@playwright/test").Page,
  label: string,
): Promise<void> {
  const requesterSelect = page.getByRole("combobox", { name: /Development Requester/ });
  await expect(requesterSelect).toBeEnabled();
  await requesterSelect.selectOption({ label });
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
}

async function saveEvidenceScreenshot(
  page: import("@playwright/test").Page,
  projectName: string,
  screenName: "create-ticket" | "my-tickets" | "ticket-detail",
): Promise<void> {
  const directory = path.join(screenshotDirectory, screenName);
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${projectName}.png`),
    fullPage: true,
  });
}

test.describe("Issue 18 requester Ticket and Attachment flow", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
  });

  test.afterEach(async () => {
    await cleanupE2eData();
  });

  test("completes the owned lifecycle and remains accessible at every responsive viewport", async ({ page, request }, testInfo) => {
    const ticketSummary = `${ticketPrefix} ${testInfo.project.name} lifecycle`;
    const ticketDescription = `${ticketPrefix} evidence for the complete requester-owned Ticket and Attachment lifecycle.`;

    await page.goto("/select-requester");
    await expect(page.getByRole("heading", { name: "Select Development Requester" })).toBeVisible();
    await assertAccessible(page, "requester selection");
    await chooseRequester(page, "Amina Rahman (amina@example.test)");
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Ticket", exact: true }).first()).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Create Ticket", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await page.getByLabel("Category").selectOption({ label: "Hardware" });
    await page.getByLabel("Related System").selectOption({ label: "Laptop Fleet" });
    await page.getByLabel("Requested Priority").selectOption("HIGH");
    await page.getByLabel("Summary").fill(ticketSummary);
    await page.getByLabel("Description").fill(ticketDescription);
    await page.locator("#attachments").setInputFiles({
      name: "e2e-initial.pdf",
      mimeType: "application/pdf",
      buffer: initialPdf,
    });
    await expect(page.getByText("e2e-initial.pdf", { exact: false })).toBeVisible();
    await assertAccessible(page, "Create Ticket");
    await assertNoHorizontalScroll(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "create-ticket");

    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ticket created successfully" })).toBeVisible();
    const ticketNumber = (await page.locator(".zen-state-success strong").first().textContent())?.trim() ?? "";
    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);

    await page.getByRole("link", { name: "My Tickets", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    const visibleTicketLink = page.locator("a:visible").filter({ hasText: ticketNumber }).first();
    await expect(visibleTicketLink).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await expect(page.locator(".zen-ticket-cards")).toBeVisible();
      await expect(page.locator(".zen-ticket-table")).toBeHidden();
    } else {
      await expect(page.locator(".zen-ticket-table")).toBeVisible();
      await expect(page.locator(".zen-ticket-cards")).toBeHidden();
    }
    await assertAccessible(page, "My Tickets owned list");
    await assertNoHorizontalScroll(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "my-tickets");
    await page.getByLabel("Search Tickets").fill(ticketSummary);
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets\?[^#]*search=/);
    expect(new URL(page.url()).searchParams.get("search")).toBe(ticketSummary);
    await expect(page.locator("a:visible").filter({ hasText: ticketNumber }).first()).toBeVisible();
    await page.locator("a:visible").filter({ hasText: ticketNumber }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketNumber}$`));
    await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
    await expect(page.getByText("e2e-initial.pdf", { exact: true })).toBeVisible();
    await assertAccessible(page, "Ticket Detail before attachment actions");
    await assertNoHorizontalScroll(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("e2e-initial.pdf");

    await page.locator("#ticket-detail-attachment").setInputFiles({
      name: "e2e-added.png",
      mimeType: "image/png",
      buffer: addedPng,
    });
    await expect(page.getByText("Ready to upload: e2e-added.png", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Upload Attachment", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Attachment uploaded successfully." })).toBeVisible();
    await expect(page.getByText("e2e-added.png", { exact: true })).toBeVisible();

    const initialRow = page.locator("li").filter({ hasText: "e2e-initial.pdf" }).first();
    await initialRow.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Remove Attachment?" })).toBeVisible();
    await page.getByLabel("Removal reason").fill("Evidence is no longer needed.");
    await page.getByRole("button", { name: "Confirm Removal", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(initialRow).toContainText("Removed");
    await expect(initialRow.getByRole("button", { name: "Download", exact: true })).toHaveCount(0);
    await assertAccessible(page, "Ticket Detail after soft removal");
    await assertNoHorizontalScroll(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "ticket-detail");

    const requestersResponse = await request.get(`${apiBaseUrl}/api/requesters`);
    expect(requestersResponse.ok()).toBe(true);
    const requesters = (await requestersResponse.json()) as Array<{ id: number; email: string }>;
    const requesterA = requesters.find((requester) => requester.email === requesterAEmail);
    const requesterB = requesters.find((requester) => requester.email === requesterBEmail);
    expect(requesterA).toBeDefined();
    expect(requesterB).toBeDefined();

    const attachmentResponse = await request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`, {
      headers: { "X-Requester-Id": String(requesterA?.id) },
    });
    expect(attachmentResponse.status()).toBe(200);
    const attachmentBody = (await attachmentResponse.json()) as { attachments: Array<{ id: number; originalName: string }> };
    const addedAttachment = attachmentBody.attachments.find((attachment) => attachment.originalName === "e2e-added.png");
    expect(addedAttachment).toBeDefined();

    const ownerHeader = { "X-Requester-Id": String(requesterB?.id) };
    const crossOwnerDetail = await request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}`, { headers: ownerHeader });
    const crossOwnerMetadata = await request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`, { headers: ownerHeader });
    const crossOwnerDownload = await request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${addedAttachment?.id}/download`, { headers: ownerHeader });
    const crossOwnerUpload = await request.post(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`, {
      headers: ownerHeader,
      multipart: { file: { name: "cross-owner.pdf", mimeType: "application/pdf", buffer: initialPdf } },
    });
    const crossOwnerRemove = await request.delete(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${addedAttachment?.id}`, {
      headers: { ...ownerHeader, "Content-Type": "application/json" },
      data: { removalReason: "Cross-owner attempt." },
    });
    for (const response of [crossOwnerDetail, crossOwnerMetadata, crossOwnerDownload, crossOwnerUpload, crossOwnerRemove]) {
      expect(response.status()).toBe(404);
    }
    expect(await crossOwnerDetail.json()).toEqual({
      error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." },
    });

    await page.getByRole("button", { name: "Change Requester", exact: true }).click();
    await expect(page).toHaveURL(/\/select-requester$/);
    await chooseRequester(page, "Ben Carter (ben@example.test)");
    await page.getByLabel("Search Tickets").fill(ticketSummary);
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    await expect(page.getByText("No Tickets match your filters.", { exact: true })).toBeVisible();
    await expect(page.getByText(ticketSummary, { exact: true })).toHaveCount(0);
    await assertAccessible(page, "My Tickets after requester switch");
    await assertNoHorizontalScroll(page);

    await page.goto(`/tickets/${ticketNumber}`);
    await expect(page.getByText("Unable to load Ticket.", { exact: true })).toBeVisible();
    await expect(page.getByText("Unable to load Attachments.", { exact: true })).toBeVisible();
  });
});
