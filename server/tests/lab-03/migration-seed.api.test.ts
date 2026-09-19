import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const execFileAsync = promisify(execFile);
const preservedEmail = `lab3-preserved-${process.pid}@example.test`;
const preservedPassword = "Already-Changed!Password-2026";
const legacyEmail = `lab3-legacy-owner-${process.pid}@example.test`;
const legacyTicketNumber = `TKT-2099-${String(process.pid % 1_000_000).padStart(6, "0")}`;
const legacyIdentityId = 900_000 + (process.pid % 50_000);
let preservedUserId: number;
let legacyRequesterId: number;
let legacyTicketId: number;
let legacyAttachmentId: number;

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
    const previousLegacyRequester = await prisma.requester.findUnique({ where: { email: legacyEmail } });
    if (previousLegacyRequester) {
      const previousTickets = await prisma.ticket.findMany({
        where: { requesterId: previousLegacyRequester.id },
        select: { id: true },
      });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: previousTickets.map((ticket) => ticket.id) } } });
      await prisma.ticket.deleteMany({ where: { id: { in: previousTickets.map((ticket) => ticket.id) } } });
      await prisma.user.deleteMany({ where: { legacyRequesterId: previousLegacyRequester.id } });
      await prisma.requester.delete({ where: { id: previousLegacyRequester.id } });
    }

    const category = await prisma.category.findFirstOrThrow({ orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ orderBy: { id: "asc" } });
    const legacyRequester = await prisma.requester.create({
      data: {
        id: legacyIdentityId,
        name: "Legacy Ticket Owner",
        email: legacyEmail,
        isActive: true,
      },
    });
    legacyRequesterId = legacyRequester.id;
    await prisma.user.create({
      data: {
        id: legacyIdentityId,
        name: legacyRequester.name,
        email: legacyRequester.email,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
        legacyRequesterId: legacyRequester.id,
      },
    });
    const legacyTicket = await prisma.ticket.create({
      data: {
        ticketNumber: legacyTicketNumber,
        requesterId: legacyRequester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "MEDIUM",
        status: "NEW",
        summary: "Legacy ownership survives authentication migration",
        description: "A non-fixture Lab 2 requester and their attachment must remain linked.",
      },
    });
    legacyTicketId = legacyTicket.id;
    const legacyAttachment = await prisma.attachment.create({
      data: {
        ticketId: legacyTicket.id,
        originalName: "legacy-evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: 128,
        storedFilename: `${legacyTicketNumber}-legacy-evidence.pdf`,
      },
    });
    legacyAttachmentId = legacyAttachment.id;

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

    // This test database has the migration applied already. Running the same
    // idempotent seed here exercises the credential backfill for a Requester
    // that was not part of the fixture list, as the release migration test
    // does on a disposable database.
    await runTestSeed();
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: preservedUserId } });
    await prisma.user.deleteMany({ where: { id: preservedUserId } });
    await prisma.attachment.deleteMany({ where: { id: legacyAttachmentId } });
    await prisma.ticket.deleteMany({ where: { id: legacyTicketId } });
    await prisma.user.deleteMany({ where: { legacyRequesterId: legacyRequesterId } });
    await prisma.requester.deleteMany({ where: { id: legacyRequesterId } });
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

  it("backfills a non-fixture Requester without changing Ticket or Attachment ownership", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { legacyRequesterId: legacyRequesterId } });
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: legacyTicketId } });
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: legacyAttachmentId } });

    expect(user.id).toBe(legacyRequesterId);
    expect(user.email).toBe(legacyEmail);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.mustChangePassword).toBe(true);
    expect(ticket.requesterId).toBe(legacyRequesterId);
    expect(attachment.ticketId).toBe(legacyTicketId);
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
