import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const execFileAsync = promisify(execFile);
const suffix = `${process.pid}-${Date.now()}`;
const ticketNumber = `TKT-2094-${String(process.pid % 1_000_000).padStart(6, "0")}`;
const attachmentName = `lab4-migration-${suffix}.pdf`;
const changedPassword = "Existing-Changed!2026";
let ticketId: number | undefined;
let attachmentId: number | undefined;
let requesterId: number | undefined;
let categoryId: number | undefined;
let relatedSystemId: number | undefined;
let userId: number | undefined;
let originalRequester: { name: string; isActive: boolean } | undefined;
let originalCategory: { isActive: boolean } | undefined;
let originalSystem: { isActive: boolean } | undefined;
let originalUser: { name: string; passwordHash: string | null; mustChangePassword: boolean } | undefined;
let changedPasswordHash: string | undefined;
let seedActionId: number | undefined;
let originalSeedActionDescription: string | undefined;

function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) throw new Error("Issue #56 migration evidence requires a disposable _test database.");
}

async function runTestSeed() {
  for (const key of ["LAB3_REQUESTER_INITIAL_PASSWORD", "LAB3_IT_STAFF_INITIAL_PASSWORD", "LAB3_ADMIN_INITIAL_PASSWORD"]) {
    if (!process.env[key]) throw new Error(`${key} must be supplied by the local test environment.`);
  }
  return execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run prisma:test:seed"], {
    cwd: path.resolve(process.cwd()),
    env: { ...process.env },
    windowsHide: true,
  });
}

async function restoreAndCleanup() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  if (attachmentId) await prisma.attachment.deleteMany({ where: { id: attachmentId } });
  if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
  if (seedActionId && originalSeedActionDescription) await prisma.actionTaken.update({ where: { id: seedActionId }, data: { description: originalSeedActionDescription } });
  if (requesterId && originalRequester) await prisma.requester.update({ where: { id: requesterId }, data: originalRequester });
  if (categoryId && originalCategory) await prisma.category.update({ where: { id: categoryId }, data: originalCategory });
  if (relatedSystemId && originalSystem) await prisma.relatedSystem.update({ where: { id: relatedSystemId }, data: originalSystem });
  if (userId && originalUser) await prisma.user.update({ where: { id: userId }, data: originalUser });
}

describe("Lab 4 migration and repeat seed regression", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    const prisma = getPrisma();
    const requester = await prisma.requester.findUniqueOrThrow({ where: { email: "amina@example.test" } });
    const category = await prisma.category.findUniqueOrThrow({ where: { name: "Hardware" } });
    const relatedSystem = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Campus Wi-Fi" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "michael.staff@example.test" } });
    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    userId = user.id;
    originalRequester = { name: requester.name, isActive: requester.isActive };
    originalCategory = { isActive: category.isActive };
    originalSystem = { isActive: relatedSystem.isActive };
    originalUser = { name: user.name, passwordHash: user.passwordHash, mustChangePassword: user.mustChangePassword };

    const [ticketCategory, ticketSystem] = await Promise.all([
      prisma.category.findFirstOrThrow({ orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ orderBy: { id: "asc" } }),
    ]);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: ticketCategory.id,
        relatedSystemId: ticketSystem.id,
        requestedPriority: "MEDIUM",
        status: "NEW",
        summary: "Migration preservation fixture",
        description: "This pre-existing Ticket verifies that the additive migration and repeated seeds preserve records.",
      },
    });
    ticketId = ticket.id;
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalName: "legacy-lab4-preserved.pdf",
        mimeType: "application/pdf",
        sizeBytes: 128,
        storedFilename: attachmentName,
      },
    });
    attachmentId = attachment.id;

    await prisma.$transaction([
      prisma.requester.update({ where: { id: requesterId }, data: { name: "Student-edited Requester", isActive: false } }),
      prisma.category.update({ where: { id: categoryId }, data: { isActive: false } }),
      prisma.relatedSystem.update({ where: { id: relatedSystemId }, data: { isActive: false } }),
      prisma.user.update({ where: { id: userId }, data: { name: "Student-edited Staff", passwordHash: changedPasswordHash = await hashPassword(changedPassword), mustChangePassword: false } }),
    ]);
  });

  afterAll(restoreAndCleanup);

  it("records the additive migration and defaults existing Ticket versions without removing old data", async () => {
    const prisma = getPrisma();
    const migration = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT "migration_name", "finished_at"
      FROM "_prisma_migrations"
      WHERE "migration_name" = '20261004100000_lab4_actions_foundation'
        AND "finished_at" IS NOT NULL
    `;
    expect(migration).toHaveLength(1);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
    expect(ticket.workflowVersion).toBe(0);
    expect(attachment.ticketId).toBe(ticketId);
    expect(attachment.storedFilename).toBe(attachmentName);
  });

  it("runs the guarded seed twice without duplicating graphs or overwriting user-edited references and credentials", async () => {
    const prisma = getPrisma();
    await runTestSeed();
    const seedYear = new Date().getUTCFullYear();
    const [emptyTicket, oneActionTicket, multipleActionTicket] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: `TKT-${seedYear}-910001` } }),
      prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: `TKT-${seedYear}-910002` } }),
      prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: `TKT-${seedYear}-910003` } }),
    ]);
    const [emptyCount, oneCount, multipleActions] = await Promise.all([
      prisma.actionTaken.count({ where: { ticketId: emptyTicket.id } }),
      prisma.actionTaken.count({ where: { ticketId: oneActionTicket.id } }),
      prisma.actionTaken.findMany({ where: { ticketId: multipleActionTicket.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    ]);
    expect(emptyCount).toBe(0);
    expect(oneCount).toBe(1);
    expect(multipleActions).toHaveLength(2);
    expect(multipleActions.map((action) => action.status)).toEqual(["COMPLETED", "OPEN"]);
    const editableSeedAction = multipleActions[0];
    seedActionId = editableSeedAction.id;
    originalSeedActionDescription = editableSeedAction.description;
    await prisma.actionTaken.update({ where: { id: seedActionId }, data: { description: "Student-edited seeded Action" } });
    const countsBefore = await Promise.all([
      prisma.category.count(),
      prisma.relatedSystem.count(),
      prisma.requester.count(),
      prisma.ticket.count(),
      prisma.actionTaken.count(),
      prisma.actionTakenRevision.count(),
    ]);
    const firstSeed = await runTestSeed();
    const secondSeed = await runTestSeed();
    expect(firstSeed.stdout).toContain("Ensured");
    expect(secondSeed.stdout).toContain("existing Lab 4 fixture numbers left unchanged");
    const countsAfter = await Promise.all([
      prisma.category.count(),
      prisma.relatedSystem.count(),
      prisma.requester.count(),
      prisma.ticket.count(),
      prisma.actionTaken.count(),
      prisma.actionTakenRevision.count(),
    ]);
    expect(countsAfter).toEqual(countsBefore);

    const requester = await prisma.requester.findUniqueOrThrow({ where: { id: requesterId } });
    const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const relatedSystem = await prisma.relatedSystem.findUniqueOrThrow({ where: { id: relatedSystemId } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const preservedAction = await prisma.actionTaken.findUniqueOrThrow({ where: { id: seedActionId } });
    expect(requester).toMatchObject({ name: "Student-edited Requester", isActive: false });
    expect(category.isActive).toBe(false);
    expect(relatedSystem.isActive).toBe(false);
    expect(user).toMatchObject({ name: "Student-edited Staff", passwordHash: changedPasswordHash, mustChangePassword: false });
    expect(preservedAction.description).toBe("Student-edited seeded Action");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).workflowVersion).toBe(0);
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } })).ticketId).toBe(ticketId);
  }, 60_000);
});
