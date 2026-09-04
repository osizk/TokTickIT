import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupE2eData } from "./e2e-data.js";

const repositoryDirectory = path.resolve(process.cwd(), "..");
const screenshotRoot = path.join(repositoryDirectory, "artifacts/lab-02/screenshots/release-states");
const validPdf = Buffer.from("%PDF-1.7\nTokTickIT Issue 19 release evidence\n", "utf8");
const invalidPdf = Buffer.from("not a PDF signature", "utf8");
const ticketSummary = "E2E-18-issue19-release-state evidence";
const ticketDescription = "E2E-18-issue19-release-state evidence for the submission audit.";

async function saveScreenshot(page: import("@playwright/test").Page, projectName: string, name: string): Promise<void> {
  const screenshotDirectory = path.join(screenshotRoot, projectName);
  await fs.mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDirectory, `${name}.png`), fullPage: true });
}

test.describe("Issue 19 release evidence states", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
  });

  test.afterEach(async () => {
    await cleanupE2eData();
  });

  test("captures requester selection states", async ({ page }, testInfo) => {
    await page.route("**/api/requesters", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.goto("/select-requester");
    await expect(page.getByRole("status")).toHaveText("Loading Development Requesters...");
    await saveScreenshot(page, testInfo.project.name, "requester-loading");
    await expect(page.getByRole("option", { name: "Amina Rahman (amina@example.test)" })).toHaveCount(1);
    await page.unroute("**/api/requesters");

    await page.route("**/api/requesters", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }));
    await page.reload();
    await expect(page.getByText("No active Development Requesters are available.", { exact: true })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "requester-empty");
    await page.unroute("**/api/requesters");

    await page.route("**/api/requesters", (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "REFERENCE_DATA_UNAVAILABLE", message: "Unable to load Development Requesters." } }),
    }));
    await page.reload();
    await expect(page.getByRole("alert", { name: "Requester loading error" })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "requester-failure");
    await page.unroute("**/api/requesters");
  });

  test("captures Create Ticket validation, failure, submitting, and success states", async ({ page }, testInfo) => {
    await page.goto("/select-requester");
    const requesterSelect = page.getByRole("combobox", { name: "Development Requester" });
    await expect(requesterSelect).toBeEnabled();
    await requesterSelect.selectOption({ label: "Amina Rahman (amina@example.test)" });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("link", { name: "Create Ticket", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await expect(page.getByLabel("Category")).toBeEnabled();
    await saveScreenshot(page, testInfo.project.name, "create-initial");

    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByText(/Summary must be 5.*120 characters/)).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "create-validation");

    await page.getByLabel("Category").selectOption({ label: "Hardware" });
    await page.getByLabel("Related System").selectOption({ label: "Laptop Fleet" });
    await page.getByLabel("Requested Priority").selectOption("HIGH");
    await page.getByLabel("Summary").fill(ticketSummary);
    await page.getByLabel("Description").fill(ticketDescription);
    await page.locator("#attachments").setInputFiles({
      name: "invalid.pdf",
      mimeType: "application/pdf",
      buffer: invalidPdf,
    });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByText("Attachment content does not match its declared file signature.", { exact: true })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "create-invalid-attachment");
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    await page.locator("#attachments").setInputFiles({
      name: "release-evidence.pdf",
      mimeType: "application/pdf",
      buffer: validPdf,
    });
    await expect(page.getByText("release-evidence.pdf", { exact: false })).toBeVisible();

    await page.route("**/api/tickets", (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unable to create Ticket." } }),
    }));
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByText("Unable to create Ticket.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Summary")).toHaveValue(ticketSummary);
    await saveScreenshot(page, testInfo.project.name, "create-api-failure");
    await page.unroute("**/api/tickets");

    await page.route("**/api/tickets", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("button", { name: "Submitting Ticket...", exact: true })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "create-submitting");
    await expect(page.getByRole("heading", { name: "Ticket created successfully" })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "create-success");
    await page.unroute("**/api/tickets");
  });
});
