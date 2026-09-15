import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const execFileAsync = promisify(execFile);
const preservedEmail = `lab3-preserved-${process.pid}@example.test`;
const preservedPassword = "Already-Changed!Password-2026";
let preservedUserId: number;

async function runTestSeed() {
  for (const key of [
    "LAB3_REQUESTER_INITIAL_PASSWORD",
    "LAB3_IT_STAFF_INITIAL_PASSWORD",
    "LAB3_ADMIN_INITIAL_PASSWORD",
  ]) {
    if (!process.env[key]) throw new Error(`${key} must be supplied by the local test environment.`);
  }
  await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run prisma:test:seed"], {
    cwd: path.resolve(process.cwd()),
    env: { ...process.env },
    windowsHide: true,
  });
}

describe("Lab 3 migration and seed preservation", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await prisma.user.deleteMany({ where: { email: preservedEmail } });
    const user = await prisma.user.create({
      data: {
        name: "Already Changed Lab 3 User",
        email: preservedEmail,
        passwordHash: await hashPassword(preservedPassword),
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });
    preservedUserId = user.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: preservedUserId } });
    await prisma.user.deleteMany({ where: { id: preservedUserId } });
  });

  it("preserves every existing Requester ID through the User backfill", async () => {
    const prisma = getPrisma();
    const requesters = await prisma.requester.findMany({ orderBy: { id: "asc" }, select: { id: true, email: true } });
    const users = await prisma.user.findMany({
      where: { legacyRequesterId: { not: null } },
      orderBy: { legacyRequesterId: "asc" },
      select: { id: true, email: true, legacyRequesterId: true, passwordHash: true, mustChangePassword: true },
    });

    expect(users).toHaveLength(requesters.length);
    expect(users.map((user) => user.legacyRequesterId)).toEqual(requesters.map((requester) => requester.id));
    expect(users.map((user) => user.id)).toEqual(requesters.map((requester) => requester.id));
    expect(users.every((user) => user.passwordHash?.startsWith("$argon2id$") && user.mustChangePassword)).toBe(true);
  });

  it("has stable required reference counts after repeated idempotent seed runs", async () => {
    const prisma = getPrisma();
    const [categories, relatedSystems, requesters, users] = await Promise.all([
      prisma.category.count({ where: { isActive: true } }),
      prisma.relatedSystem.count({ where: { isActive: true } }),
      prisma.requester.count(),
      prisma.user.count(),
    ]);

    expect(categories).toBeGreaterThanOrEqual(4);
    expect(relatedSystems).toBeGreaterThanOrEqual(7);
    expect(requesters).toBeGreaterThanOrEqual(5);
    expect(users).toBeGreaterThanOrEqual(10);
  });

  it("preserves a changed non-fixture credential across repeated seed runs", async () => {
    const prisma = getPrisma();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: preservedUserId } });
    const beforeUserCount = await prisma.user.count();

    await runTestSeed();
    await runTestSeed();

    const after = await prisma.user.findUniqueOrThrow({ where: { id: preservedUserId } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.mustChangePassword).toBe(false);
    expect(await prisma.user.count()).toBe(beforeUserCount);
  }, 30_000);
});
