import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow } from "../lab-03/lab3-fixtures.js";
import { apiBaseUrl, captureLab4Screenshot, cleanupE2eData, createEmptyRequester, deleteEmptyRequester, loginAs, loginTemporaryRequester, resetLab3Users } from "./lab4-fixtures.js";

test.describe("Lab 4 role dashboard browser regression", () => {
  test.beforeEach(async () => {
    await cleanupE2eData();
    await resetLab3Users();
  });

  test.afterEach(async () => cleanupE2eData());

  test("E2E-03 compares live dashboard metrics, drills into owned work, and preserves role boundaries", async ({ page, browser }, testInfo) => {
    await loginAs(page, "requesterA");
    await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
    const requesterResponse = await page.request.get(`${apiBaseUrl}/api/dashboard/requester`);
    expect(requesterResponse.status()).toBe(200);
    const requesterData = await requesterResponse.json() as { metrics: { activeTicketCount: number }; recentTickets: Array<{ summary: string }> };
    const activeMetric = page.getByRole("link", { name: /Active Tickets/ });
    await expect(activeMetric.locator("strong")).toHaveText(String(requesterData.metrics.activeTicketCount));
    await expect(page.getByText("Laptop battery drains during meetings", { exact: true })).toHaveCount(0);
    await new AxeBuilder({ page }).analyze().then((result) => expect(result.violations).toEqual([]));
    await assertNoHorizontalOverflow(page);
    await captureLab4Screenshot(page, testInfo, "requester-dashboard", "requester-populated");

    await activeMetric.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tickets\?statusGroup=active$/);
    await expect(page.getByText("Dashboard drill-down: active Tickets.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    const forbiddenDashboard = await page.request.get(`${apiBaseUrl}/api/dashboard/staff`);
    expect(forbiddenDashboard.status()).toBe(403);

    const staffContext = await browser.newContext();
    try {
      const staffPage = await staffContext.newPage();
      await loginAs(staffPage, "staff");
      await expect(staffPage.getByRole("heading", { name: "Staff Dashboard" })).toBeVisible();
      const staffResponse = await staffPage.request.get(`${apiBaseUrl}/api/dashboard/staff`);
      expect(staffResponse.status()).toBe(200);
      const staffData = await staffResponse.json() as { metrics: { unassignedActiveTicketCount: number; myOwnedActiveTicketCount: number; urgentActiveTicketCount: number; ticketsWithMyActiveActionsCount: number }; myActions: Array<{ id: number; description: string; ticketNumber: string }> };
      for (const [label, count] of [
        ["Unassigned active Tickets", staffData.metrics.unassignedActiveTicketCount],
        ["My owned active Tickets", staffData.metrics.myOwnedActiveTicketCount],
        ["Urgent active Tickets", staffData.metrics.urgentActiveTicketCount],
        ["Tickets with my active Actions", staffData.metrics.ticketsWithMyActiveActionsCount],
      ] as Array<[string, number]>) {
        await expect(staffPage.getByRole("link", { name: new RegExp(label) }).locator("strong")).toHaveText(String(count));
      }
      await expect(staffPage.getByRole("link", { name: /Tickets with my active Actions/ })).toHaveAttribute("href", /actionAssignee=me/);
      await new AxeBuilder({ page: staffPage }).analyze().then((result) => expect(result.violations).toEqual([]));
      await assertNoHorizontalOverflow(staffPage);
      await captureLab4Screenshot(staffPage, testInfo, "staff-dashboard", "staff-populated");

      const actionLink = staffPage.locator(".dashboard-action-link").first();
      await expect(actionLink).toBeVisible();
      const actionHref = await actionLink.getAttribute("href");
      expect(actionHref).toMatch(/^\/staff\/tickets\/TKT-\d{4}-\d{6}#action-heading-\d+$/);
      await actionLink.click();
      await expect(staffPage).toHaveURL(new RegExp(`${actionHref?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      const actionId = Number(actionHref?.split("#action-heading-")[1]);
      const focusedAction = staffPage.locator(`#action-heading-${actionId}`);
      await expect(focusedAction).toBeFocused();
      await captureLab4Screenshot(staffPage, testInfo, "actions-taken", "dashboard-action-detail");
    } finally {
      await staffContext.close();
    }

    const adminContext = await browser.newContext();
    try {
      const adminPage = await adminContext.newPage();
      await loginAs(adminPage, "admin");
      await expect(adminPage.getByRole("heading", { name: "Staff Dashboard" })).toBeVisible();
      await expect(adminPage.getByRole("link", { name: "User Management", exact: true })).toBeVisible();
      const adminDashboard = await adminPage.request.get(`${apiBaseUrl}/api/dashboard/staff`);
      expect(adminDashboard.status()).toBe(200);
    } finally {
      await adminContext.close();
    }

    for (const width of [767, 768, 991, 992]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertNoHorizontalOverflow(page);
    }
    const projectViewport = testInfo.project.use.viewport;
    if (projectViewport) await page.setViewportSize(projectViewport);
  });

  test("shows a genuine zero-data Requester dashboard for an isolated empty account", async ({ page }, testInfo) => {
    const identity = await createEmptyRequester();
    try {
      await loginTemporaryRequester(page, identity);
      await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
      await expect(page.getByText("You have no Tickets yet.", { exact: true })).toBeVisible();
      const response = await page.request.get(`${apiBaseUrl}/api/dashboard/requester`);
      expect(response.status()).toBe(200);
      const data = await response.json() as { metrics: Record<string, number>; recentTickets: unknown[]; attentionTickets: unknown[] };
      expect(Object.values(data.metrics).every((value) => value === 0)).toBe(true);
      expect(data.recentTickets).toEqual([]);
      expect(data.attentionTickets).toEqual([]);
      await assertNoHorizontalOverflow(page);
      await captureLab4Screenshot(page, testInfo, "requester-dashboard", "requester-empty");
    } finally {
      await deleteEmptyRequester(identity.email);
    }
  });

  test("shows a safe dashboard failure and retries to a real response", async ({ page }) => {
    let requests = 0;
    await loginAs(page, "requesterA");
    await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
    await page.route("**/api/dashboard/requester", async (route) => {
      requests += 1;
      if (requests === 1) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "REQUESTER_DASHBOARD_FAILED", message: "Requester dashboard could not be loaded." } }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Refresh dashboard", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Unable to load your dashboard.");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Active Tickets/ })).toBeVisible();
    expect(requests).toBeGreaterThanOrEqual(2);
  });
});
