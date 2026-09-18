import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  completeFirstLogin,
  resetLab3Users,
  saveEvidenceScreenshot,
  signInWithInitialPassword,
} from "./lab3-fixtures.js";

test.describe("Lab 3 IT Staff queue and Ticket detail", () => {
  test.beforeEach(async () => {
    await resetLab3Users();
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
    await expect(page.getByText(/Ticket/).first()).toBeVisible();
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await saveEvidenceScreenshot(page, testInfo.project.name, "staff-queue", "queue-search");
  });

  test("opens Staff Ticket Detail with public comments, internal notes, and operations controls", async ({ page }, testInfo) => {
    await signInWithInitialPassword(page, "staff");
    await completeFirstLogin(page, "staff");
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    const ticketLink = page.locator('a[href^="/staff/tickets/"]:visible').first();
    await expect(ticketLink).toBeVisible();
    const ticketNumber = (await ticketLink.textContent())?.trim() ?? "";
    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    await ticketLink.click();
    await expect(page).toHaveURL(new RegExp(`/staff/tickets/${ticketNumber}$`));
    await expect(page.getByRole("heading", { name: "Staff Ticket Detail" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Public Comments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Internal Notes" })).toBeVisible();
    await expect(page.getByLabel("Assignee")).toBeVisible();
    await expect(page.getByLabel("IT Priority")).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
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
