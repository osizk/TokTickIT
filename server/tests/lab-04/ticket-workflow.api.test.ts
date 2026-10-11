import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomInt } from "node:crypto";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const suffix = `${process.pid}-${Date.now()}`;
const password = "Lab4-Ticket-Workflow!2026";
const requesterEmail = `lab4-workflow-requester-${suffix}@example.test`;
const staffEmail = `lab4-workflow-staff-${suffix}@example.test`;
const ticketNumber = `TKT-2097-${String(randomInt(1, 1_000_000)).padStart(6, "0")}`;
const mutationTicketNumber = `TKT-2097-${String(randomInt(1, 1_000_000)).padStart(6, "0")}`;
const cancellationTicketNumber = `TKT-2097-${String(randomInt(1, 1_000_000)).padStart(6, "0")}`;
const resolvedTicketNumber = `TKT-2097-${String(randomInt(1, 1_000_000)).padStart(6, "0")}`;
let requesterId: number;
let requesterUserId: number;
let staffId: number;
const ticketIds: number[] = [];

function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) throw new Error("Issue #58 workflow tests require a disposable _test database.");
}

async function cleanup() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  if (ticketIds.length) {
    for (const id of ticketIds) await prisma.$executeRaw`DELETE FROM "TicketWorkflowEvent" WHERE "ticketId" = ${id}`.catch(() => undefined);
    const actions = await prisma.actionTaken.findMany({ where: { ticketId: { in: ticketIds } }, select: { id: true } });
    await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actions.map(({ id }) => id) } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  if (requesterUserId) await prisma.session.deleteMany({ where: { userId: requesterUserId } });
  if (staffId) await prisma.session.deleteMany({ where: { userId: staffId } });
  if (requesterUserId) await prisma.user.delete({ where: { id: requesterUserId } });
  if (staffId) await prisma.user.delete({ where: { id: staffId } });
  if (requesterId) await prisma.requester.delete({ where: { id: requesterId } });
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 4 Ticket workflow API", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    const prisma = getPrisma();
    const [category, relatedSystem, requester] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.requester.create({ data: { name: "Workflow Requester", email: requesterEmail, isActive: true } }),
    ]);
    requesterId = requester.id;
    const [requesterUser, staff] = await Promise.all([
      prisma.user.create({ data: { name: "Workflow Requester", email: requesterEmail, passwordHash: await hashPassword(password), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterId } }),
      prisma.user.create({ data: { name: "Workflow Staff", email: staffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
    ]);
    requesterUserId = requesterUser.id;
    staffId = staff.id;
    const [detailTicket, mutationTicket, cancellationTicket, resolvedTicket] = await Promise.all([
      prisma.ticket.create({ data: { ticketNumber, requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "MEDIUM", status: "OPEN", summary: "Workflow API fixture", description: "A Ticket for workflow contract tests." } }),
      prisma.ticket.create({ data: { ticketNumber: mutationTicketNumber, requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "MEDIUM", status: "OPEN", summary: "Mutation API fixture", description: "A Ticket for versioned mutation tests." } }),
      prisma.ticket.create({ data: { ticketNumber: cancellationTicketNumber, requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "MEDIUM", status: "OPEN", summary: "Cancellation API fixture", description: "A Ticket for atomic cancellation tests." } }),
      prisma.ticket.create({ data: { ticketNumber: resolvedTicketNumber, requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "MEDIUM", status: "RESOLVED", summary: "Legacy resolved fixture", description: "A legacy resolved Ticket for reopening tests." } }),
    ]);
    ticketIds.push(detailTicket.id, mutationTicket.id, cancellationTicket.id, resolvedTicket.id);
  });

  afterAll(cleanup);

  it("returns a gate-aware Staff detail and a stable empty workflow history", async () => {
    const { agent } = await login(staffEmail);
    const detail = await agent.get(`/api/staff/tickets/${ticketNumber}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ticket).toMatchObject({
      workflowVersion: 0,
      allowedTransitions: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
      resolutionGate: {
        canResolve: false,
        canClose: false,
        unmetConditions: ["OWNER_REQUIRED", "COMPLETED_ACTION_REQUIRED"],
      },
    });
    const history = await agent.get(`/api/tickets/${ticketNumber}/workflow-events`);
    expect(history.status).toBe(200);
    expect(history.body).toMatchObject({ events: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } });
  });

  it("versions Staff assignment, priority, and status writes and rejects stale updates", async () => {
    const { agent, csrfToken } = await login(staffEmail);
    const assignment = await agent.patch(`/api/staff/tickets/${mutationTicketNumber}/assignment`).set("X-CSRF-Token", csrfToken).send({ ownerUserId: staffId, expectedVersion: 0 });
    expect(assignment.status).toBe(200);
    expect(assignment.body.ticket.workflowVersion).toBe(1);
    const noOp = await agent.patch(`/api/staff/tickets/${mutationTicketNumber}/assignment`).set("X-CSRF-Token", csrfToken).send({ ownerUserId: staffId, expectedVersion: 1 });
    expect(noOp.body.ticket.workflowVersion).toBe(1);
    const stale = await agent.patch(`/api/staff/tickets/${mutationTicketNumber}/priority`).set("X-CSRF-Token", csrfToken).send({ itPriority: "HIGH", expectedVersion: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_VERSION");
    const priority = await agent.patch(`/api/staff/tickets/${mutationTicketNumber}/priority`).set("X-CSRF-Token", csrfToken).send({ itPriority: "HIGH", expectedVersion: 1 });
    expect(priority.status).toBe(200);
    expect(priority.body.ticket.workflowVersion).toBe(2);
    const status = await agent.patch(`/api/staff/tickets/${mutationTicketNumber}/status`).set("X-CSRF-Token", csrfToken).send({ status: "IN_PROGRESS", expectedVersion: 2 });
    expect(status.status).toBe(200);
    expect(status.body.ticket.workflowVersion).toBe(3);
    const history = await agent.get(`/api/tickets/${mutationTicketNumber}/workflow-events`);
    expect(history.body.events).toMatchObject([{ fromStatus: "OPEN", toStatus: "IN_PROGRESS", workflowVersion: 3 }]);
  });

  it("rejects resolution until its gate is met and cancels unfinished Actions atomically", async () => {
    const { agent, csrfToken } = await login(staffEmail);
    const blocked = await agent.patch(`/api/staff/tickets/${cancellationTicketNumber}/status`).set("X-CSRF-Token", csrfToken).send({ status: "RESOLVED", expectedVersion: 0, confirm: true });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("RESOLUTION_GATE_NOT_MET");

    const action = await agent.post(`/api/tickets/${cancellationTicketNumber}/actions-taken`).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: "33af7629-d256-48f8-9f88-c6f4bff52740",
      expectedTicketVersion: 0,
      description: "Inspect the workstation connection.",
      followUpRequired: false,
    });
    expect(action.status).toBe(201);
    const cancelled = await agent.patch(`/api/staff/tickets/${cancellationTicketNumber}/status`).set("X-CSRF-Token", csrfToken).send({
      status: "CANCELLED",
      expectedVersion: 1,
      confirm: true,
      cancellationReason: "Duplicate request; no repair is needed.",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.ticket).toMatchObject({ status: "CANCELLED", workflowVersion: 2 });
    const savedAction = await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: action.body.action.id } });
    expect(savedAction).toMatchObject({ status: "CANCELLED", cancellationReason: "Duplicate request; no repair is needed.", version: 1 });
    expect(await getPrisma().actionTakenRevision.count({ where: { actionId: savedAction.id } })).toBe(2);
    const history = await agent.get(`/api/tickets/${cancellationTicketNumber}/workflow-events`);
    expect(history.body.events).toMatchObject([{ fromStatus: "OPEN", toStatus: "CANCELLED", workflowVersion: 2, reason: "Duplicate request; no repair is needed." }]);
  });

  it("increments the Requester indication version once and clears it on reopening without deleting history", async () => {
    const requester = await login(requesterEmail);
    const staff = await login(staffEmail);
    const first = await requester.agent.post(`/api/tickets/${resolvedTicketNumber}/resolution-indication`).set("X-CSRF-Token", requester.csrfToken).send({});
    expect(first.status).toBe(200);
    const second = await requester.agent.post(`/api/tickets/${resolvedTicketNumber}/resolution-indication`).set("X-CSRF-Token", requester.csrfToken).send({});
    expect(second.status).toBe(200);
    expect(second.body.resolutionIndication.indicatedAt).toBe(first.body.resolutionIndication.indicatedAt);
    expect((await requester.agent.get(`/api/tickets/${resolvedTicketNumber}`)).body.ticket.workflowVersion).toBe(1);

    const reopened = await staff.agent.patch(`/api/staff/tickets/${resolvedTicketNumber}/status`).set("X-CSRF-Token", staff.csrfToken).send({ status: "REOPENED", expectedVersion: 1, confirm: true });
    expect(reopened.status).toBe(200);
    expect(reopened.body.ticket).toMatchObject({ status: "REOPENED", workflowVersion: 2, resolutionIndication: null });

    const assigned = await staff.agent.patch(`/api/staff/tickets/${resolvedTicketNumber}/assignment`).set("X-CSRF-Token", staff.csrfToken).send({ ownerUserId: staffId, expectedVersion: 2 });
    expect(assigned.status).toBe(200);
    const created = await staff.agent.post(`/api/tickets/${resolvedTicketNumber}/actions-taken`).set("X-CSRF-Token", staff.csrfToken).send({
      clientRequestId: "0ebfc8b9-e045-45bb-8ae5-c7054eb52ea8",
      expectedTicketVersion: 3,
      description: "Verify the reported service issue.",
      followUpRequired: false,
    });
    expect(created.status).toBe(201);
    const completed = await staff.agent.patch(`/api/tickets/${resolvedTicketNumber}/actions-taken/${created.body.action.id}`).set("X-CSRF-Token", staff.csrfToken).send({
      expectedTicketVersion: 4,
      expectedActionVersion: 0,
      status: "COMPLETED",
      result: "Service tested and operating normally after the repair.",
    });
    expect(completed.status).toBe(200);
    const resolved = await staff.agent.patch(`/api/staff/tickets/${resolvedTicketNumber}/status`).set("X-CSRF-Token", staff.csrfToken).send({ status: "RESOLVED", expectedVersion: 5, confirm: true });
    expect(resolved.status).toBe(200);
    expect(resolved.body.ticket).toMatchObject({ status: "RESOLVED", workflowVersion: 6 });

    const history = await requester.agent.get(`/api/tickets/${resolvedTicketNumber}/workflow-events`);
    expect(history.body.events).toMatchObject([
      { fromStatus: "RESOLVED", toStatus: "REOPENED", workflowVersion: 2 },
      { fromStatus: "REOPENED", toStatus: "RESOLVED", workflowVersion: 6 },
    ]);
  });
});
