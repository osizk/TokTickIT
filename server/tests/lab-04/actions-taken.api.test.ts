import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const suffix = `${process.pid}-${Date.now()}`;
const staffEmail = `lab4-actions-staff-${suffix}@example.test`;
const secondStaffEmail = `lab4-actions-second-staff-${suffix}@example.test`;
const requesterEmail = `lab4-actions-requester-${suffix}@example.test`;
const password = "Lab4-Actions!2026";
const ticketNumber = `TKT-2097-${String(process.pid % 1_000_000).padStart(6, "0")}`;
let staffId: number;
let secondStaffId: number;
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) {
    throw new Error("Issue #56 fixtures require a disposable DATABASE_URL whose database name ends with _test.");
  }
}

async function cleanup() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber }, select: { id: true } });
  const fixtureUsers = await prisma.user.findMany({ where: { email: { in: [staffEmail, secondStaffEmail, requesterEmail] } }, select: { id: true } });
  if (ticket) {
    const actions = await prisma.actionTaken.findMany({ where: { ticketId: ticket.id }, select: { id: true } });
    await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actions.map((action) => action.id) } } });
    await prisma.actionTaken.deleteMany({ where: { id: { in: actions.map((action) => action.id) } } });
    await prisma.attachment.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.publicComment.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.internalNote.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  }
  if (fixtureUsers.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: fixtureUsers.map((user) => user.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUsers.map((user) => user.id) } } });
  }
  await prisma.requester.deleteMany({ where: { email: requesterEmail } });
}

async function login() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: staffEmail, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 4 Actions Taken API", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    await cleanup();
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    const requester = await prisma.requester.create({ data: { name: "Lab 4 Action Requester", email: requesterEmail, isActive: true } });
    requesterId = requester.id;
    const [staff, secondStaff] = await Promise.all([
      prisma.user.create({
        data: {
        name: "Lab 4 Action Staff",
        email: staffEmail,
        passwordHash: await hashPassword(password),
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: "Lab 4 Action Second Staff",
          email: secondStaffEmail,
          passwordHash: await hashPassword(password),
          role: "IT_STAFF",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ]);
    staffId = staff.id;
    secondStaffId = secondStaff.id;
    await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId,
        relatedSystemId,
        requestedPriority: "MEDIUM",
        status: "OPEN",
        summary: "Lab 4 Action API fixture",
        description: "A Ticket used to verify Actions Taken endpoints.",
      },
    });
  });

  afterAll(cleanup);

  it("creates, replays, edits, assigns and completes an Action with immutable revisions", async () => {
    const { agent, csrfToken } = await login();
    const createBody = {
      clientRequestId: "ba8a7e33-1b62-4935-94af-3f968a560bee",
      expectedTicketVersion: 0,
      description: "Replace the failed network cable.",
      followUpRequired: false,
    };
    const response = await agent
      .post(`/api/tickets/${ticketNumber}/actions-taken`)
      .set("X-CSRF-Token", csrfToken)
      .send(createBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      action: {
        ticketNumber,
        description: "Replace the failed network cable.",
        status: "OPEN",
        assignee: { id: staffId },
        createdBy: { id: staffId },
        version: 0,
      },
      ticketVersion: 1,
      replayed: false,
    });
    expect(response.body.action.createdAt).toEqual(expect.any(String));
    expect(response.body.action).not.toHaveProperty("clientRequestId");
    expect(response.body.action).not.toHaveProperty("requestFingerprint");
    expect(response.body.action.performedBy).toBeNull();
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { ticketNumber } })).ticketOwnerId).toBeNull();

    const actionId = response.body.action.id as number;
    const replay = await agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send(createBody);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ action: { id: actionId }, ticketVersion: 1, replayed: true });
    const duplicatePayload = await agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send({ ...createBody, description: "A different action description." });
    expect(duplicatePayload.status).toBe(409);
    expect(duplicatePayload.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await getPrisma().actionTaken.count({ where: { ticketId: (await getPrisma().ticket.findUniqueOrThrow({ where: { ticketNumber }, select: { id: true } })).id } })).toBe(1);

    const beforeEdit = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${actionId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 1, expectedActionVersion: 0, description: "Replace and test the failed cable.", assigneeUserId: secondStaffId });
    expect(beforeEdit.status).toBe(200);
    expect(beforeEdit.body).toMatchObject({
      action: { id: actionId, version: 1, description: "Replace and test the failed cable.", assignee: { id: secondStaffId } },
      ticketVersion: 2,
    });

    const stale = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${actionId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 1, expectedActionVersion: 0, description: "This update has a stale version." });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_VERSION");

    const completed = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${actionId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, status: "COMPLETED", result: "Cable replaced and network connectivity verified." });
    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({
      action: { status: "COMPLETED", version: 2, assignee: { id: secondStaffId }, performedBy: { id: staffId } },
      ticketVersion: 3,
    });
    expect(completed.body.action.completedAt).toEqual(expect.any(String));

    const completedEdit = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${actionId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 3, expectedActionVersion: 2, description: "Replace and verify the network cable." });
    expect(completedEdit.status).toBe(200);
    expect(completedEdit.body.action.version).toBe(3);
    expect(completedEdit.body.ticketVersion).toBe(4);

    const revisions = await agent.get(`/api/tickets/${ticketNumber}/actions-taken/${actionId}/revisions`).query({ pageSize: "10" });
    expect(revisions.status).toBe(200);
    expect(revisions.body.pagination.totalItems).toBe(4);
    expect(revisions.body.revisions.map((revision: { revisionNumber: number }) => revision.revisionNumber)).toEqual([1, 2, 3, 4]);
    expect(revisions.body.revisions[0].snapshot).toMatchObject({ status: "OPEN", assigneeUserId: staffId, performedByUserId: null, version: 0 });
    expect(revisions.body.revisions[2].snapshot).toMatchObject({ status: "COMPLETED", assigneeUserId: secondStaffId, performedByUserId: staffId, version: 2 });

    const list = await agent.get(`/api/tickets/${ticketNumber}/actions-taken`);
    expect(list.status).toBe(200);
    expect(list.body.actions).toHaveLength(1);
    expect(list.body.ticketVersion).toBe(4);

    const sameValue = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${actionId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 4, expectedActionVersion: 3, description: "Replace and verify the network cable." });
    expect(sameValue.status).toBe(200);
    expect(sameValue.body).toMatchObject({ action: { version: 3 }, ticketVersion: 4 });

    const reassignmentAfterCompletion = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${actionId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 4, expectedActionVersion: 3, assigneeUserId: staffId });
    expect(reassignmentAfterCompletion.status).toBe(409);
    expect(reassignmentAfterCompletion.body.error.code).toBe("ACTION_READ_ONLY");

    const newAction = await agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: "2660a180-0295-4f7f-aebc-e92dd2d15794",
      expectedTicketVersion: 4,
      description: "Cancel the unnecessary follow-up visit.",
      followUpRequired: false,
    });
    expect(newAction.status).toBe(201);
    const cancelled = await agent.patch(`/api/tickets/${ticketNumber}/actions-taken/${newAction.body.action.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ expectedTicketVersion: 5, expectedActionVersion: 0, status: "CANCELLED", cancellationReason: "Requester confirmed the follow-up is no longer needed." });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({
      action: { status: "CANCELLED", cancellationReason: "Requester confirmed the follow-up is no longer needed.", version: 1 },
      ticketVersion: 6,
    });
    expect(cancelled.body.action.cancelledAt).toEqual(expect.any(String));
    const firstPage = await agent.get(`/api/tickets/${ticketNumber}/actions-taken`).query({ page: "1", pageSize: "10" });
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.actions).toHaveLength(2);
    expect(firstPage.body.pagination).toMatchObject({ page: 1, pageSize: 10, totalItems: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
    const laterPage = await agent.get(`/api/tickets/${ticketNumber}/actions-taken`).query({ page: "2", pageSize: "10" });
    expect(laterPage.status).toBe(200);
    expect(laterPage.body.actions).toHaveLength(0);
    expect(laterPage.body.pagination.hasPreviousPage).toBe(true);
  });

  it("validates strict body fields and safe pagination", async () => {
    const { agent, csrfToken } = await login();
    const invalid = await agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: "bad",
      expectedTicketVersion: -1,
      requesterId,
      description: "x",
      followUpRequired: "no",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    const invalidPage = await agent.get(`/api/tickets/${ticketNumber}/actions-taken`).query({ pageSize: "11" });
    expect(invalidPage.status).toBe(400);
    const repeatedPageSize = await agent.get(`/api/tickets/${ticketNumber}/actions-taken`).query({ pageSize: ["10", "25"] });
    expect(repeatedPageSize.status).toBe(400);
  });
});
