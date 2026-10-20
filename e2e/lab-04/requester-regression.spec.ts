import { expect, test } from "@playwright/test";
import { apiBaseUrl, cleanupE2eData, createEmptyRequester, createTicket, deleteEmptyRequester, loginAs, loginTemporaryRequester, resetLab3Users, validPdf } from "./lab4-fixtures.js";

const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/k3sAAAAASUVORK5CYII=", "base64");

test.describe("Authenticated Lab 2 Requester continuity (REG-01)", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
    await resetLab3Users();
  });

  test.afterEach(async () => cleanupE2eData());

  test("R02-11 distinguishes a genuinely empty My Tickets list from filtered no-results", async ({ page }) => {
    let identity: { email: string; password: string } | undefined;
    try {
      identity = await createEmptyRequester();
      await loginTemporaryRequester(page, identity);
      await page.goto("/tickets");
      await expect(page.getByText("You have no Tickets yet.", { exact: true })).toBeVisible();
      await expect(page.getByText("No Tickets match your filters.", { exact: true })).toHaveCount(0);
    } finally {
      if (identity) await deleteEmptyRequester(identity.email);
    }
  });

  test("R02-02/05/06/11/12 keeps ownership, URL filters, pagination, keyboard navigation and responsive list behavior", async ({ page }, testInfo) => {
    await loginAs(page, "requesterA");
    const summaries: string[] = [];
    const numbers: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const number = await createTicket(page, testInfo, `controls-${index}`);
      numbers.push(number);
      summaries.push((await page.locator("#summary").inputValue()).trim());
    }

    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("link", { name: numbers[0], exact: true })).toBeVisible();
    await page.getByLabel("Page size", { exact: true }).selectOption("10");
    await expect(page.getByRole("navigation", { name: "Ticket list pagination" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("navigation", { name: "Ticket list pagination" }).getByText("Page 2 of 2", { exact: true })).toBeVisible();

    await page.getByLabel("Search Tickets", { exact: true }).fill("E2E-61-controls-");
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    await expect(page).toHaveURL(/search=E2E-61-controls-/);
    await expect(page.getByRole("link", { name: numbers[0], exact: true })).toBeVisible();
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Hardware" });
    await expect(page).toHaveURL(/categoryId=\d+/);
    await page.getByLabel("Related System", { exact: true }).selectOption({ label: "Laptop Fleet" });
    await expect(page).toHaveURL(/relatedSystemId=\d+/);
    await page.getByLabel("Requested Priority", { exact: true }).selectOption("HIGH");
    await expect(page).toHaveURL(/priority=HIGH/);
    await page.getByLabel("Status", { exact: true }).selectOption("NEW");
    await expect(page).toHaveURL(/status=NEW/);
    await page.getByLabel("Sort by", { exact: true }).selectOption("summary");
    await expect(page).toHaveURL(/sort=summary/);
    await page.getByLabel("Order", { exact: true }).selectOption("asc");
    await expect(page).toHaveURL(/order=asc/);
    await page.getByLabel("Page size", { exact: true }).selectOption("25");
    await expect(page).toHaveURL(/pageSize=25/);

    await page.getByLabel("Search Tickets", { exact: true }).fill("no-such-issue61-ticket");
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    await expect(page.getByText("No Tickets match your filters.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters from no-results state", exact: true }).click();
    await expect(page.getByText("No Tickets match your filters.", { exact: true })).toHaveCount(0);

    await page.getByLabel("Search Tickets", { exact: true }).fill("E2E-61-controls-");
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    const targetLink = page.getByRole("link", { name: numbers[0], exact: true });
    await expect(targetLink).toBeVisible();
    await targetLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
    await expect(page.getByLabel("Ticket Number", { exact: true })).toHaveValue(numbers[0]);

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await loginAs(page, "requesterB");
    await page.goto("/tickets");
    await page.getByLabel("Search Tickets", { exact: true }).fill("E2E-61-controls-");
    await page.getByRole("button", { name: "Apply Filters", exact: true }).click();
    await expect(page.getByText("No Tickets match your filters.", { exact: true })).toBeVisible();
    await expect(page.getByText(summaries[0], { exact: true })).toHaveCount(0);
    const crossOwner = await page.request.get(`${apiBaseUrl}/api/tickets/${numbers[0]}`);
    expect(crossOwner.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Select Development Requester" })).toHaveCount(0);
  });

  test("R02-03/04/07/08/09/10 preserves initial and added Attachments with safe cross-owner denial", async ({ page, browser }, testInfo) => {
    await loginAs(page, "requesterA");
    const ticketNumber = await createTicket(page, testInfo, "attachment-life", true);
    await page.goto(`/tickets/${ticketNumber}`);
    await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
    await expect(page.getByLabel("Summary", { exact: true })).toHaveValue(new RegExp(`E2E-61-attachment-life-${testInfo.project.name}`));
    const initialDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).first().click();
    expect((await initialDownload).suggestedFilename()).toBe("lab4-evidence.pdf");

    await page.locator("#ticket-detail-attachment").setInputFiles({ name: "follow-up.png", mimeType: "image/png", buffer: validPng });
    await expect(page.getByText("Ready to upload: follow-up.png", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Upload Attachment", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Attachment uploaded successfully." })).toBeVisible();
    await expect(page.getByText("follow-up.png", { exact: true })).toBeVisible();

    const listResponse = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`);
    expect(listResponse.status()).toBe(200);
    const listed = await listResponse.json() as { attachments: Array<{ id: number; originalName: string; removedAt: string | null }> };
    expect(listed.attachments.map(({ originalName }) => originalName)).toEqual(expect.arrayContaining(["lab4-evidence.pdf", "follow-up.png"]));
    const initialAttachment = listed.attachments.find(({ originalName }) => originalName === "lab4-evidence.pdf");
    expect(initialAttachment).toBeDefined();

    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
    const removeDialog = page.getByRole("dialog", { name: "Remove Attachment?" });
    await removeDialog.getByLabel("Removal reason").fill("Evidence is duplicated by the newer image.");
    await removeDialog.getByRole("button", { name: "Confirm Removal", exact: true }).click();
    await expect(page.getByText(/Removed .*Reason: Evidence is duplicated by the newer image/)).toBeVisible();
    const removedDownload = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${initialAttachment?.id}/download`);
    expect(removedDownload.status()).toBe(404);

    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, "requesterB");
      const listDenied = await otherPage.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`);
      const downloadDenied = await otherPage.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${initialAttachment?.id}/download`);
      expect(listDenied.status()).toBe(404);
      expect(downloadDenied.status()).toBe(404);
      expect(await listDenied.json()).toEqual({ error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." } });
      expect(await downloadDenied.json()).toEqual({ error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." } });

      let csrfToken = "";
      const captureUploadToken = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST" && request.url().endsWith(`/api/tickets/${ticketNumber}/attachments`)) {
          csrfToken = request.headers()["x-csrf-token"] ?? "";
        }
      };
      otherPage.on("request", captureUploadToken);
      await otherPage.goto(`/tickets/${ticketNumber}`);
      await otherPage.locator("#ticket-detail-attachment").setInputFiles({ name: "unauthorized.png", mimeType: "image/png", buffer: validPng });
      const uploadResponse = otherPage.waitForResponse((response) => response.url().endsWith(`/api/tickets/${ticketNumber}/attachments`) && response.request().method() === "POST");
      await otherPage.getByRole("button", { name: "Upload Attachment", exact: true }).click();
      expect((await uploadResponse).status()).toBe(404);
      otherPage.off("request", captureUploadToken);
      expect(csrfToken).not.toBe("");
      const removalDenied = await otherPage.request.delete(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${initialAttachment?.id}`, {
        data: { removalReason: "Unauthorized requester attempt." },
        headers: { origin: new URL(otherPage.url()).origin, "x-csrf-token": csrfToken },
      });
      expect(removalDenied.status()).toBe(404);
      expect(await removalDenied.json()).toEqual({ error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." } });
    } finally {
      await otherContext.close();
    }

    const unchanged = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`);
    expect((await unchanged.json() as { attachments: unknown[] }).attachments).toHaveLength(2);
  });

  test("R02-13/14/15/16 validates locally, retains drafts on safe failure and blocks duplicate submit", async ({ page }, testInfo) => {
    await loginAs(page, "requesterA");
    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await page.getByLabel("Category").selectOption({ label: "Hardware" });
    await page.getByLabel("Related System").selectOption({ label: "Laptop Fleet" });
    await page.getByLabel("Requested Priority").selectOption("HIGH");
    await page.getByLabel("Summary").fill("bad");
    await page.getByLabel("Description").fill("This request contains a sufficiently long description.");
    let createRequests = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/tickets")) createRequests += 1; });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByText("Summary must be 5–120 characters after trimming.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Summary")).toBeFocused();
    expect(createRequests).toBe(0);

    await page.getByLabel("Summary").fill(`E2E-61-validation-${testInfo.project.name}`);
    await page.locator("#attachments").setInputFiles({ name: "bad-signature.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByText("Attachment content does not match its declared file signature.", { exact: true })).toBeVisible();
    expect(createRequests).toBe(0);

    await page.getByRole("list", { name: "Selected attachments" }).getByRole("button", { name: "Remove", exact: true }).click();
    const summary = `E2E-61-preserved-draft-${testInfo.project.name}`;
    await page.getByLabel("Summary").fill(summary);
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unable to create Ticket." } }) });
      } else {
        await route.continue();
      }
    }, { times: 1 });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Unable to create Ticket.");
    await expect(page.getByLabel("Summary")).toHaveValue(summary);
    await expect(page.getByLabel("Description")).toHaveValue("This request contains a sufficiently long description.");
    await page.unrouteAll({ behavior: "wait" });

    let delayedPosts = 0;
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        delayedPosts += 1;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    const busyButton = page.getByRole("button", { name: "Submitting Ticket...", exact: true });
    await expect(busyButton).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Ticket created successfully" })).toBeVisible();
    expect(delayedPosts).toBe(1);
  });
});
