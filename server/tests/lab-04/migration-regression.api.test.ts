import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { cp, copyFile, mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const execFileAsync = promisify(execFile);
const LAB4_MIGRATION = "20261004100000_lab4_actions_foundation";
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
  const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (!databaseName.endsWith("_test")) throw new Error("Issue #56 migration evidence requires a disposable _test database.");
}

async function applyRealLab4MigrationInScratchSchema(): Promise<void> {
  assertDisposableTestDatabase();
  const migratedPasswordHash = changedPasswordHash;
  if (!migratedPasswordHash) throw new Error("The changed-password fixture must be prepared before the migration regression.");
  const schemaName = `toktickit_lab4_migration_test_${process.pid}_${Date.now()}`;
  if (!/^toktickit_lab4_migration_test_\d+_\d+$/.test(schemaName)) throw new Error("Refusing an unexpected migration-test schema name.");
  const schemaUrl = new URL(process.env.DATABASE_URL as string);
  schemaUrl.searchParams.set("schema", schemaName);
  const tempDir = await mkdtemp(path.join(tmpdir(), "toktickit-lab4-migration-"));
  const migrationRoot = path.resolve(process.cwd(), "prisma/migrations");
  const tempSchema = path.join(tempDir, "schema.prisma");
  const tempMigrations = path.join(tempDir, "migrations");
  const prisma = getPrisma();
  let scratch: PrismaClient | undefined;

  try {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    await copyFile(path.resolve(process.cwd(), "prisma/schema.prisma"), tempSchema);
    await mkdir(tempMigrations);
    await copyFile(path.join(migrationRoot, "migration_lock.toml"), path.join(tempMigrations, "migration_lock.toml"));
    const migrationDirs = await readdir(migrationRoot, { withFileTypes: true });
    for (const migration of migrationDirs.filter((entry) => entry.isDirectory() && entry.name < LAB4_MIGRATION)) {
      await cp(path.join(migrationRoot, migration.name), path.join(tempMigrations, migration.name), { recursive: true });
    }

    const migrate = async () => execFileAsync(process.execPath, [
      path.resolve(process.cwd(), "node_modules/prisma/build/index.js"),
      "migrate", "deploy", "--schema", tempSchema,
    ], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: schemaUrl.toString() },
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    await migrate();
    scratch = new PrismaClient({ datasources: { db: { url: schemaUrl.toString() } } });

    const [requester] = await scratch.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "Requester" ("name", "email", "isActive")
      VALUES ('Pre-Lab 4 Requester', 'pre-lab4@example.test', true)
      RETURNING "id"
    `;
    const [category] = await scratch.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "Category" ("name") VALUES ('Pre-Lab 4 Category') RETURNING "id"
    `;
    const [relatedSystem] = await scratch.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "RelatedSystem" ("name") VALUES ('Pre-Lab 4 System') RETURNING "id"
    `;
    const [user] = await scratch.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "User" ("name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "legacyRequesterId")
      VALUES ('Changed Password User', 'changed-password@example.test', ${migratedPasswordHash}, 'REQUESTER', true, false, ${requester.id})
      RETURNING "id"
    `;
    const ticketNumber = `TKT-2093-${String(process.pid % 1_000_000).padStart(6, "0")}`;
    const [ticket] = await scratch.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "Ticket" ("ticketNumber", "requesterId", "categoryId", "relatedSystemId", "requestedPriority", "status", "summary", "description")
      VALUES (${ticketNumber}, ${requester.id}, ${category.id}, ${relatedSystem.id}, 'MEDIUM'::"TicketPriority", 'OPEN'::"TicketStatus", 'Existing Ticket', 'A Ticket created before the Lab 4 migration.')
      RETURNING "id"
    `;
    await scratch.$executeRaw`
      INSERT INTO "Attachment" ("ticketId", "originalName", "mimeType", "sizeBytes", "storedFilename")
      VALUES (${ticket.id}, 'pre-lab4.pdf', 'application/pdf', 128, 'pre-lab4-protected-file')
    `;
    const beforeMigration = await scratch.$queryRaw<Array<{ table_name: string }>>`
      SELECT "table_name" FROM information_schema.tables
      WHERE "table_schema" = ${schemaName} AND "table_name" = 'ActionTaken'
    `;
    expect(beforeMigration).toHaveLength(0);

    await cp(path.join(migrationRoot, LAB4_MIGRATION), path.join(tempMigrations, LAB4_MIGRATION), { recursive: true });
    const migrationOutput = await migrate();
    expect(migrationOutput.stdout).toContain(`Applying migration \`${LAB4_MIGRATION}\``);
    expect(migrationOutput.stdout).toContain("All migrations have been successfully applied.");

    const migrated = await scratch.$queryRaw<Array<{ ticketNumber: string; workflowVersion: number }>>`
      SELECT "ticketNumber", "workflowVersion" FROM "Ticket" WHERE "id" = ${ticket.id}
    `;
    const attachment = await scratch.$queryRaw<Array<{ originalName: string; storedFilename: string }>>`
      SELECT "originalName", "storedFilename" FROM "Attachment" WHERE "ticketId" = ${ticket.id}
    `;
    const preservedUser = await scratch.$queryRaw<Array<{ passwordHash: string; mustChangePassword: boolean }>>`
      SELECT "passwordHash", "mustChangePassword" FROM "User" WHERE "id" = ${user.id}
    `;
    const actionTables = await scratch.$queryRaw<Array<{ table_name: string }>>`
      SELECT "table_name" FROM information_schema.tables
      WHERE "table_schema" = ${schemaName} AND "table_name" IN ('ActionTaken', 'ActionTakenRevision')
      ORDER BY "table_name"
    `;
    const appliedMigration = await scratch.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT "migration_name", "finished_at" FROM "_prisma_migrations"
      WHERE "migration_name" = ${LAB4_MIGRATION} AND "finished_at" IS NOT NULL
    `;
    expect(migrated).toEqual([{ ticketNumber, workflowVersion: 0 }]);
    expect(attachment).toEqual([{ originalName: "pre-lab4.pdf", storedFilename: "pre-lab4-protected-file" }]);
    expect(preservedUser).toEqual([{ passwordHash: migratedPasswordHash, mustChangePassword: false }]);
    expect(actionTables.map((row) => row.table_name)).toEqual(["ActionTaken", "ActionTakenRevision"]);
    expect(appliedMigration).toHaveLength(1);
  } finally {
    try {
      await scratch?.$disconnect();
    } finally {
      try {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }
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

  it("applies the real Lab 4 migration to a pre-Lab-4 schema and preserves existing Tickets, Attachments, and changed credentials", async () => {
    await applyRealLab4MigrationInScratchSchema();
  }, 120_000);

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
