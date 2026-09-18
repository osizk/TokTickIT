import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  completeFirstLogin,
  cleanupE2eData,
  loginAs,
  resetLab3Users,
  saveEvidenceScreenshot,
  signInWithInitialPassword,
} from "./lab3-fixtures.js";

const validPdf = Buffer.from("%PDF-1.7\nTokTickIT Lab 3 staff evidence\n", "utf8");

test.describe("Lab 3 IT Staff queue and Ticket detail", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
    await resetLab3Users();
  });

  test.afterEach(async () => {
    await cleanupE2eData();
  });

  test("shows the responsive staff queue and preserves searchable URL controls", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "staff");
    await completeFirstLogin(page, "staff");
    await expect(page).toHaveURL(/\/staff\/tickets$/);
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(page.getByLabel("Search Tickets")).toBeVisible();
    await page.getByLabel("Search Tickets").fill("Laptop");
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    await expect(page).toHaveURL(/search=Laptop/);
    await expect(
      page.locator("td strong:visible, .zen-ticket-card-item h2:visible", {
        hasText: "Laptop battery drains during meetings",
      }),
    ).toHaveCount(1);
    const matchingTicketLink = page.locator('a[href^="/staff/tickets/"]:visible').first();
    await expect(matchingTicketLink).toBeVisible();
    expect((await matchingTicketLink.textContent())?.trim()).toMatch(/^TKT-\d{4}-\d{6}$/);
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "staff-queue", "queue-search");
  });

  test("executes Staff Ticket Detail operations and reads an active Attachment", async ({ page, browser }, testInfo) => {
    const requesterContext = await browser.newContext();
    const requesterPage = await requesterContext.newPage();
    let ticketNumber = "";
    try {
      await loginAs(requesterPage, "requesterA");
      await requesterPage.getByRole("link", { name: "Create Ticket from My Tickets" }).click();
      await requesterPage.getByLabel("Category").selectOption({ label: "Hardware" });
      await requesterPage.getByLabel("Related System").selectOption({ label: "Laptop Fleet" });
      await requesterPage.getByLabel("Requested Priority").selectOption("MEDIUM");
      await requesterPage.getByLabel("Summary").fill(`E2E-39-Staff-${testInfo.project.name}-${Date.now()}`);
      await requesterPage.getByLabel("Description").fill("A staff workflow Ticket created for Lab 3 E2E evidence.");
      await requesterPage.locator("#attachments").setInputFiles({
        name: "staff-evidence.pdf",
        mimeType: "application/pdf",
        buffer: validPdf,
      });
      await requesterPage.getByRole("button", { name: "Submit Ticket", exact: true }).click();
      await expect(requesterPage.getByRole("heading", { name: "Ticket created successfully" })).toBeVisible();
      ticketNumber = (await requesterPage.locator(".zen-state-success strong").first().textContent())?.trim() ?? "";
      expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    } finally {
      await requesterContext.close();
    }

    await signInWithInitialPassword(page, "staff");
    await completeFirstLogin(page, "staff");
    await page.goto(`/staff/tickets/${ticketNumber}`);
    await expect(page).toHaveURL(new RegExp(`/staff/tickets/${ticketNumber}$`));
    await expect(page.getByRole("heading", { name: "Staff Ticket Detail" })).toBeVisible();
    await expect(page.getByLabel("Summary")).toHaveValue(new RegExp(`E2E-39-Staff-${testInfo.project.name}`));
    await expect(page.getByRole("heading", { name: "Public Comments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Internal Notes" })).toBeVisible();
    await expect(page.getByLabel("Assignee")).toBeVisible();
    await expect(page.getByLabel("IT Priority")).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();

    await page.getByRole("button", { name: "Claim", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ticket assignment updated." })).toBeVisible();
    await page.getByLabel("IT Priority").selectOption("HIGH");
    await page.getByRole("button", { name: "Save IT Priority", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "IT Priority updated." })).toBeVisible();
    await page.getByLabel("Status").selectOption("OPEN");
    await page.getByRole("button", { name: "Save Status", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ticket status updated." })).toBeVisible();

    await page.getByLabel("Add Public Comment").fill("Staff E2E public comment for the operations workflow.");
    await page.getByRole("button", { name: "Post Public Comment", exact: true }).click();
    await expect(page.getByText("Staff E2E public comment for the operations workflow.", { exact: true })).toBeVisible();
    await page.getByLabel("Add Internal Note").fill("Staff E2E internal note for the operations workflow.");
    await page.getByRole("button", { name: "Post Internal Note", exact: true }).click();
    await expect(page.getByText("Staff E2E internal note for the operations workflow.", { exact: true })).toBeVisible();
    await expect(page.getByText("staff-evidence.pdf", { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("staff-evidence.pdf");

    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "staff-ticket-detail", "detail-operations");
  });

  test("does not expose staff workspace controls to a Requester", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "requesterA");
    await completeFirstLogin(page, "requesterA");
    const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
    const queueResponse = await page.request.get(`${apiBaseUrl}/api/staff/tickets`);
    expect(queueResponse.status()).toBe(403);
    expect(await queueResponse.json()).toEqual({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
    await page.goto("/staff/tickets");
    await expect(page.getByRole("heading", { name: "Access not available" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "staff-queue", "requester-role-isolation");
  });
});
