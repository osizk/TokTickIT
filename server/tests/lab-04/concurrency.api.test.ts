import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const suffix = `${process.pid}-${Date.now()}`;
const staffEmail = `lab4-concurrency-staff-${suffix}@example.test`;
const requesterEmail = `lab4-concurrency-requester-${suffix}@example.test`;
const password = "Lab4-Concurrency!2026";
const ticketNumber = `TKT-2092-${String(process.pid % 1_000_000).padStart(6, "0")}`;
let staffId: number;
let requesterId: number;
let ticketId: number;

function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) throw new Error("Issue #56 concurrency tests require a disposable _test database.");
}

async function cleanup() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  if (ticketId) {
    const actions = await prisma.actionTaken.findMany({ where: { ticketId }, select: { id: true } });
    await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actions.map((action) => action.id) } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
    await prisma.attachment.deleteMany({ where: { ticketId } });
    await prisma.publicComment.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
  }
  if (staffId) {
    await prisma.session.deleteMany({ where: { userId: staffId } });
    await prisma.user.delete({ where: { id: staffId } });
  }
  if (requesterId) await prisma.requester.delete({ where: { id: requesterId } });
}

async function login() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: staffEmail, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 4 Action transaction concurrency", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    await cleanup();
    const prisma = getPrisma();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    const requester = await prisma.requester.create({ data: { name: "Concurrency Requester", email: requesterEmail, isActive: true } });
    requesterId = requester.id;
    const staff = await prisma.user.create({
      data: { name: "Concurrency Staff", email: staffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false },
    });
    staffId = staff.id;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "MEDIUM",
        status: "OPEN",
        summary: "Action concurrency test Ticket",
        description: "This Ticket verifies the atomic version and idempotency behavior.",
      },
    });
    ticketId = ticket.id;
  });

  afterAll(cleanup);

  it("replays concurrent and stale same-key requests once, and rejects a changed payload", async () => {
    const { agent, csrfToken } = await login();
    const body = {
      clientRequestId: "a44fdb32-4df6-40a8-9ae8-2e617ad42c6e",
      expectedTicketVersion: 0,
      description: "Confirm the network connection is stable after repair.",
      followUpRequired: false,
    };
    const post = (payload: typeof body) => agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send(payload);
    const [first, second] = await Promise.all([post(body), post(body)]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.action.id).toBe(second.body.action.id);
    expect(first.body.replayed || second.body.replayed).toBe(true);
    const actionId = first.body.action.id as number;
    expect(await getPrisma().actionTaken.count({ where: { id: actionId } })).toBe(1);
    expect(await getPrisma().actionTakenRevision.count({ where: { actionId } })).toBe(1);
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).workflowVersion).toBe(1);

    const staleReplay = await post(body);
    expect(staleReplay.status).toBe(200);
    expect(staleReplay.body).toMatchObject({ action: { id: actionId }, ticketVersion: 1, replayed: true });
    const changedPayload = await post({ ...body, description: "A different action with the same creation key." });
    expect(changedPayload.status).toBe(409);
    expect(changedPayload.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await getPrisma().actionTaken.count({ where: { ticketId } })).toBe(1);
  });

  it("rolls back the Action and Ticket version when revision persistence fails", async () => {
    const prisma = getPrisma();
    const { agent, csrfToken } = await login();
    const beforeActions = await prisma.actionTaken.count({ where: { ticketId } });
    const beforeRevisions = await prisma.actionTakenRevision.count({ where: { action: { ticketId } } });
    const triggerName = "lab4_test_fail_action_revision_insert";
    const functionName = "lab4_test_fail_action_revision";
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "ActionTakenRevision"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW."snapshot"->>'description' = 'Force rollback after Action insert.' THEN
            RAISE EXCEPTION 'intentional Issue #56 rollback-test failure';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER ${triggerName}
        BEFORE INSERT ON "ActionTakenRevision"
        FOR EACH ROW EXECUTE FUNCTION ${functionName}()
      `);

      const failed = await agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send({
        clientRequestId: "9d7a90a9-5af3-4972-a47a-31d34a290b50",
        expectedTicketVersion: 1,
        description: "Force rollback after Action insert.",
        followUpRequired: false,
      });
      expect(failed.status).toBe(500);
      expect(failed.body.error.code).toBe("ACTION_CREATE_FAILED");
      expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(beforeActions);
      expect(await prisma.actionTakenRevision.count({ where: { action: { ticketId } } })).toBe(beforeRevisions);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).workflowVersion).toBe(1);
      expect(await prisma.actionTaken.count({ where: { createdByUserId: staffId, clientRequestId: "9d7a90a9-5af3-4972-a47a-31d34a290b50" } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "ActionTakenRevision"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });
});
