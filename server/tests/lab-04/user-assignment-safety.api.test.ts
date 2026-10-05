import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const suffix = `${process.pid}-${Date.now()}`;
const adminEmail = `lab4-action-safety-admin-${suffix}@example.test`;
const staffEmail = `lab4-action-safety-staff-${suffix}@example.test`;
const raceStaffEmail = `lab4-action-race-staff-${suffix}@example.test`;
const requesterEmail = `lab4-action-safety-requester-${suffix}@example.test`;
const password = "Lab4-Assignment!2026";
const ticketNumber = `TKT-2096-${String(process.pid % 1_000_000).padStart(6, "0")}`;
const raceTicketNumber = `TKT-2093-${String(process.pid % 1_000_000).padStart(6, "0")}`;
let adminId: number;
let staffId: number;
let raceStaffId: number;
let requesterId: number;
let ticketId: number;
let raceTicketId: number;
let actionId: number;

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
  const ticketIds = [ticketId, raceTicketId].filter((id): id is number => typeof id === "number");
  if (ticketIds.length > 0) {
    const actions = await prisma.actionTaken.findMany({ where: { ticketId: { in: ticketIds } }, select: { id: true } });
    await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actions.map((action) => action.id) } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  const ids = [adminId, staffId, raceStaffId].filter((id): id is number => typeof id === "number");
  if (ids.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  if (requesterId) await prisma.requester.deleteMany({ where: { id: requesterId } });
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 4 assigned Action User safety", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    const prisma = getPrisma();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    const requester = await prisma.requester.create({ data: { name: "Action Safety Requester", email: requesterEmail, isActive: true } });
    requesterId = requester.id;
    const [admin, staff, raceStaff] = await Promise.all([
      prisma.user.create({ data: { name: "Action Safety Admin", email: adminEmail, passwordHash: await hashPassword(password), role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Action Safety Staff", email: staffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Action Race Staff", email: raceStaffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
    ]);
    adminId = admin.id;
    staffId = staff.id;
    raceStaffId = raceStaff.id;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "MEDIUM",
        status: "OPEN",
        summary: "Action assignment safety fixture",
        description: "This Ticket verifies User eligibility protections.",
      },
    });
    ticketId = ticket.id;
    const raceTicket = await prisma.ticket.create({
      data: {
        ticketNumber: raceTicketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "LOW",
        status: "NEW",
        summary: "Action assignment race fixture",
        description: "This Ticket verifies serialized assignment eligibility changes.",
      },
    });
    raceTicketId = raceTicket.id;
    const action = await prisma.actionTaken.create({
      data: {
        ticketId,
        assigneeUserId: staffId,
        createdByUserId: adminId,
        description: "Inspect the test fixture.",
        status: "OPEN",
        clientRequestId: "14a7c0fe-b7dd-4684-a0a1-94408a04f1dd",
        requestFingerprint: "a".repeat(64),
      },
    });
    actionId = action.id;
    await prisma.actionTakenRevision.create({
      data: {
        actionId,
        revisionNumber: 1,
        actorUserId: adminId,
        snapshot: {
          description: action.description,
          result: null,
          followUpRequired: false,
          followUpNote: null,
          attachmentNotes: null,
          status: action.status,
          cancellationReason: null,
          assigneeUserId: staffId,
          createdByUserId: adminId,
          performedByUserId: null,
          createdAt: action.createdAt.toISOString(),
          updatedAt: action.updatedAt.toISOString(),
          completedAt: null,
          cancelledAt: null,
          version: 0,
        },
      },
    });
  });

  afterAll(cleanup);

  it("rejects deactivation and requester demotion while unfinished Actions are assigned, preserving the User and sessions", async () => {
    const { agent: admin, csrfToken } = await login(adminEmail);
    const staffSession = await login(staffEmail);
    const prisma = getPrisma();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: staffId }, select: { id: true, role: true, isActive: true, updatedAt: true } });
    const activeSessionCount = await prisma.session.count({ where: { userId: staffId, revokedAt: null } });

    for (const change of [{ isActive: false }, { role: "REQUESTER" }]) {
      const response = await admin.patch(`/api/admin/users/${staffId}`).set("X-CSRF-Token", csrfToken).send(change);
      expect(response.status).toBe(409);
      expect(response.body.error).toEqual({ code: "USER_HAS_ACTIVE_ACTIONS", message: "This User has unfinished assigned Actions and cannot be made ineligible." });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: staffId }, select: { id: true, role: true, isActive: true, updatedAt: true } })).toEqual(before);
      expect(await prisma.session.count({ where: { userId: staffId, revokedAt: null } })).toBe(activeSessionCount);
      expect((await staffSession.agent.get("/api/auth/me")).status).toBe(200);
      expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } })).assigneeUserId).toBe(staffId);
    }
  });

  it("serializes a new Action assignment against User deactivation so no inactive assignee has unfinished work", async () => {
    const { agent: admin, csrfToken } = await login(adminEmail);
    const raceStaffSession = await login(raceStaffEmail);
    const create = admin.post(`/api/tickets/${raceTicketNumber}/actions-taken`)
      .set("X-CSRF-Token", csrfToken)
      .send({
        clientRequestId: "93f0d52c-0588-481e-8532-e403513b86d9",
        expectedTicketVersion: 0,
        description: "Assign the race fixture to the selected Staff member.",
        assigneeUserId: raceStaffId,
        followUpRequired: false,
      });
    const deactivate = admin.patch(`/api/admin/users/${raceStaffId}`).set("X-CSRF-Token", csrfToken).send({ isActive: false });
    const [actionResponse, userResponse] = await Promise.all([create, deactivate]);
    const prisma = getPrisma();
    const assignedUnfinishedActions = await prisma.actionTaken.count({ where: { assigneeUserId: raceStaffId, status: { in: ["OPEN", "IN_PROGRESS"] } } });
    const raceStaff = await prisma.user.findUniqueOrThrow({ where: { id: raceStaffId } });

    if (actionResponse.status === 201) {
      expect(userResponse.status).toBe(409);
      expect(userResponse.body.error.code).toBe("USER_HAS_ACTIVE_ACTIONS");
      expect(raceStaff.isActive).toBe(true);
      expect(assignedUnfinishedActions).toBeGreaterThan(0);
      expect((await raceStaffSession.agent.get("/api/auth/me")).status).toBe(200);
    } else {
      expect(actionResponse.status).toBe(409);
      expect(actionResponse.body.error.code).toBe("ASSIGNMENT_CONFLICT");
      expect(userResponse.status).toBe(200);
      expect(raceStaff.isActive).toBe(false);
      expect(assignedUnfinishedActions).toBe(0);
      expect((await raceStaffSession.agent.get("/api/auth/me")).status).toBe(401);
    }
  });
});
