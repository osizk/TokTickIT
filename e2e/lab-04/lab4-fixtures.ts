import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { loginAs, resetLab3Users } from "../lab-03/lab3-fixtures.js";
import { cleanupE2eData } from "../lab-02/e2e-data.js";

const repositoryDirectory = path.resolve(process.cwd(), "..");
const requireFromServer = createRequire(path.join(repositoryDirectory, "server", "package.json"));
const { PrismaClient } = requireFromServer("@prisma/client") as { PrismaClient: new () => any };
const argon2 = requireFromServer("argon2") as {
  argon2id: number;
  hash: (value: string, options: { type: number; memoryCost: number; timeCost: number; parallelism: number }) => Promise<string>;
};

export { loginAs, resetLab3Users };
export { cleanupE2eData };
export const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
export const validPdf = Buffer.from("%PDF-1.7\nTokTickIT Lab 4 browser evidence\n", "utf8");

export async function createTicket(page: Page, testInfo: TestInfo, purpose: string, withAttachment = false): Promise<string> {
  const summary = `E2E-61-${purpose}-${testInfo.project.name}-${Date.now()}`;
  await page.goto("/tickets/new");
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "Laptop Fleet" });
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill(`Issue 61 ${purpose} browser regression verifies a persisted Requester Ticket.`);
  if (withAttachment) {
    await page.locator("#attachments").setInputFiles({ name: "lab4-evidence.pdf", mimeType: "application/pdf", buffer: validPdf });
  }
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/tickets") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page.getByRole("heading", { name: "Ticket created successfully" })).toBeVisible();
  const ticketNumber = (await page.locator(".zen-state-success strong").first().textContent())?.trim() ?? "";
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
  return ticketNumber;
}

export async function captureLab4Screenshot(page: Page, testInfo: TestInfo, area: "staff-dashboard" | "requester-dashboard" | "actions-taken", name: string): Promise<void> {
  if (process.env.LAB4_CAPTURE_EVIDENCE !== "1") return;
  const directory = path.join(repositoryDirectory, "artifacts/lab-04/screenshots", area);
  await fs.mkdir(directory, { recursive: true });
  const filename = `${name}-${testInfo.project.name}.png`;
  const target = path.join(directory, filename);
  try {
    await fs.access(target);
  } catch {
    await page.screenshot({ path: target, fullPage: true });
  }
}

export async function createEmptyRequester(): Promise<{ email: string; password: string }> {
  const password = process.env.LAB3_REQUESTER_INITIAL_PASSWORD;
  if (!password) throw new Error("LAB3_REQUESTER_INITIAL_PASSWORD is required in the local test environment.");
  const email = `e2e-empty-${Date.now()}@example.test`;
  const prisma = new PrismaClient();
  try {
    const requester = await prisma.requester.create({ data: { name: "Issue 61 Empty Requester", email, isActive: true } });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    await prisma.user.create({ data: { name: requester.name, email, role: "REQUESTER", isActive: true, mustChangePassword: false, passwordHash, legacyRequesterId: requester.id } });
    return { email, password };
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteEmptyRequester(email: string): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const requester = await prisma.requester.findUnique({ where: { email }, select: { id: true, legacyUser: { select: { id: true } } } });
    if (!requester) return;
    if (requester.legacyUser) {
      await prisma.session.deleteMany({ where: { userId: requester.legacyUser.id } });
      await prisma.user.delete({ where: { id: requester.legacyUser.id } });
    }
    await prisma.requester.delete({ where: { id: requester.id } });
  } finally {
    await prisma.$disconnect();
  }
}

export async function loginTemporaryRequester(page: Page, identity: { email: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identity.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(identity.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
