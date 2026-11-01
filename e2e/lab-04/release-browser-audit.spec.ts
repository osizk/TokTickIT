import { expect, test } from "@playwright/test";
import { loginAs, resetLab3Users, type Lab3Role } from "../lab-03/lab3-fixtures.js";
import { cleanupE2eData, createTicket } from "./lab4-fixtures.js";

const routes: Array<{ role: Lab3Role; links: Array<{ name: string; path: string; heading: string }> }> = [
  { role: "requesterA", links: [
    { name: "Dashboard", path: "/dashboard", heading: "Requester Dashboard" },
    { name: "My Tickets", path: "/tickets", heading: "My Tickets" },
    { name: "Create Ticket", path: "/tickets/new", heading: "Create Ticket" },
  ] },
  { role: "staff", links: [
    { name: "Dashboard", path: "/staff/dashboard", heading: "Staff Dashboard" },
    { name: "Ticket Queue", path: "/staff/tickets", heading: "Ticket Queue" },
  ] },
  { role: "admin", links: [
    { name: "Dashboard", path: "/staff/dashboard", heading: "Staff Dashboard" },
    { name: "Ticket Queue", path: "/staff/tickets", heading: "Ticket Queue" },
    { name: "User Management", path: "/admin/users", heading: "User Management" },
  ] },
];

test("role navigation resolves without uncaught browser errors", async ({ browser }, testInfo) => {
  await resetLab3Users();
  for (const { role, links } of routes) {
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport ?? { width: 1440, height: 1000 },
      isMobile: testInfo.project.name === "mobile",
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    const consoleErrors: Array<{ text: string; url: string }> = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push({ text: message.text(), url: message.location().url });
    });
    try {
      await loginAs(page, role);
      for (const { name, path, heading } of links) {
        const link = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name, exact: true });
        await expect(link).toHaveAttribute("href", path);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
      expect(pageErrors).toEqual([]);
      expect(consoleErrors.filter(({ text, url }) => !url.endsWith("/api/auth/me") || !text.includes("401"))).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test("Requester interactive targets meet the 44px touch target", async ({ page }, testInfo) => {
  await cleanupE2eData();
  await resetLab3Users();
  await loginAs(page, "requesterA");
  try {
    await createTicket(page, testInfo, "touch-target");
    for (const path of ["/dashboard", "/tickets", "/tickets/new"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const small = await page.locator("a, button, input, select, textarea").evaluateAll((elements) => elements
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !element.hasAttribute("disabled");
        })
        .map((element) => ({ label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 50) || element.getAttribute("placeholder") || element.tagName, width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }))
        .filter((item) => item.width < 44 || item.height < 44));
      expect(small, path).toEqual([]);
    }
  } finally {
    await cleanupE2eData();
  }
});
