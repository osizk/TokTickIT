import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { cleanupE2eData } from "../lab-02/e2e-data.js";

const repositoryDirectory = path.resolve(process.cwd(), "..");
const serverDirectory = path.join(repositoryDirectory, "server");
const requireFromServer = createRequire(path.join(serverDirectory, "package.json"));
const { PrismaClient } = requireFromServer("@prisma/client") as { PrismaClient: new () => any };
const argon2 = requireFromServer("argon2") as {
  argon2id: number;
  hash: (value: string, options: { type: number; memoryCost: number; timeCost: number; parallelism: number }) => Promise<string>;
};

export type Lab3Role = "requesterA" | "requesterB" | "staff" | "admin";

const roleSettings: Record<Lab3Role, { email: string; passwordKey: string }> = {
  requesterA: { email: "amina@example.test", passwordKey: "LAB3_REQUESTER_INITIAL_PASSWORD" },
  requesterB: { email: "ben@example.test", passwordKey: "LAB3_REQUESTER_INITIAL_PASSWORD" },
  staff: { email: "michael.staff@example.test", passwordKey: "LAB3_IT_STAFF_INITIAL_PASSWORD" },
  admin: { email: "admin@example.test", passwordKey: "LAB3_ADMIN_INITIAL_PASSWORD" },
};

function configuredPassword(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be configured in the local server/.env.test file before Lab 3 E2E tests run.`);
  }
  return value;
}

function changedPassword(initialPassword: string): string {
  // Derive a process-local password from the configured value so no credential
  // is committed to the repository or written into the evidence documents.
  return `${initialPassword.slice(0, 96)}Aa1!Lab39`;
}

export async function resetLab3Users(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const roles = Object.values(roleSettings);
    const emails = roles.map(({ email }) => email);
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
    if (users.length !== new Set(emails).size) {
      const found = new Set(users.map((user: { email: string }) => user.email));
      const missing = emails.filter((email) => !found.has(email));
      throw new Error(`Lab 3 E2E fixture users are missing from the isolated seed: ${missing.join(", ")}`);
    }

    const hashes = new Map<string, string>();
    for (const { email, passwordKey } of roles) {
      hashes.set(email, await argon2.hash(configuredPassword(passwordKey), {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      }));
    }

    await prisma.$transaction(async (tx: any) => {
      for (const user of users) {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: hashes.get(user.email), mustChangePassword: true, isActive: true },
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function signInWithInitialPassword(page: Page, role: Lab3Role): Promise<void> {
  const { email, passwordKey } = roleSettings[role];
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(configuredPassword(passwordKey));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/change-password$/);
}

export async function fillFirstLoginPassword(page: Page, role: Lab3Role): Promise<void> {
  const { passwordKey } = roleSettings[role];
  const nextPassword = changedPassword(configuredPassword(passwordKey));
  await page.getByRole("textbox", { name: "Current password", exact: true }).fill(configuredPassword(passwordKey));
  await page.getByRole("textbox", { name: "New password", exact: true }).fill(nextPassword);
  await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill(nextPassword);
}

export async function completeFirstLogin(page: Page, role: Lab3Role): Promise<void> {
  await fillFirstLoginPassword(page, role);
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page).not.toHaveURL(/\/change-password$/);
}

export async function loginAs(page: Page, role: Lab3Role): Promise<void> {
  await signInWithInitialPassword(page, role);
  await completeFirstLogin(page, role);
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const fits = await page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth + 1 &&
    document.body.scrollWidth <= window.innerWidth + 1
  ));
  expect(fits, "the page must not introduce horizontal scrolling").toBe(true);
}

export async function saveEvidenceScreenshot(
  page: Page,
  projectName: string,
  area: "authentication" | "staff-queue" | "staff-ticket-detail" | "user-management",
  name: string,
): Promise<void> {
  const directory = path.join(repositoryDirectory, "artifacts/lab-03/screenshots", area, projectName);
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

export { cleanupE2eData };
