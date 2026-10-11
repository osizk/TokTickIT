import { randomBytes, randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import type { ActionStatus, TicketPriority, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

export const DASHBOARD_TEST_PASSWORD = "Lab4-Dashboard!2026";

export function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) throw new Error("Lab 4 dashboard tests require a disposable _test database.");
}

export async function createDashboardFixture() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  const suffix = `${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const passwordHash = await hashPassword(DASHBOARD_TEST_PASSWORD);
  const [category, relatedSystem, requesterA, requesterB, requesterC] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.requester.create({ data: { name: `Dashboard A ${suffix}`, email: `dashboard-a-${suffix}@example.test` } }),
    prisma.requester.create({ data: { name: `Dashboard B ${suffix}`, email: `dashboard-b-${suffix}@example.test` } }),
    prisma.requester.create({ data: { name: `Dashboard Zero ${suffix}`, email: `dashboard-zero-${suffix}@example.test` } }),
  ]);
  const [requesterUserA, requesterUserB, requesterUserC, staffA, staffB, admin] = await Promise.all([
    prisma.user.create({ data: { name: requesterA.name, email: requesterA.email, passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterA.id } }),
    prisma.user.create({ data: { name: requesterB.name, email: requesterB.email, passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterB.id } }),
    prisma.user.create({ data: { name: requesterC.name, email: requesterC.email, passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterC.id } }),
    prisma.user.create({ data: { name: `Dashboard Staff A ${suffix}`, email: `dashboard-staff-a-${suffix}@example.test`, passwordHash, role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
    prisma.user.create({ data: { name: `Dashboard Staff B ${suffix}`, email: `dashboard-staff-b-${suffix}@example.test`, passwordHash, role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
    prisma.user.create({ data: { name: `Dashboard Admin ${suffix}`, email: `dashboard-admin-${suffix}@example.test`, passwordHash, role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } }),
  ]);
  const users = [requesterUserA, requesterUserB, requesterUserC, staffA, staffB, admin];
  const ticketIds: number[] = [];
  let nextNumber = randomInt(0, 900_000);

  async function createTicket(options: {
    requesterId?: number;
    status?: TicketStatus;
    requestedPriority?: TicketPriority;
    itPriority?: TicketPriority;
    ticketOwnerId?: number | null;
    updatedAt?: Date;
    summary?: string;
  } = {}) {
    nextNumber = (nextNumber + 1) % 1_000_000;
    const now = options.updatedAt ?? new Date();
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2099-${String(nextNumber).padStart(6, "0")}`,
        requesterId: options.requesterId ?? requesterA.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: options.requestedPriority ?? "MEDIUM",
        itPriority: options.itPriority ?? "LOW",
        status: options.status ?? "NEW",
        summary: options.summary ?? "Dashboard contract fixture",
        description: "A deterministic isolated Ticket for Lab 4 dashboard API tests.",
        ...(options.ticketOwnerId === undefined ? {} : { ticketOwnerId: options.ticketOwnerId }),
        createdAt: now,
        updatedAt: now,
      },
    });
    ticketIds.push(ticket.id);
    return ticket;
  }

  async function createAction(ticketId: number, assigneeUserId: number, status: ActionStatus = "OPEN") {
    return prisma.actionTaken.create({
      data: {
        ticketId,
        assigneeUserId,
        createdByUserId: staffA.id,
        description: "Review the dashboard test fixture.",
        status,
        followUpRequired: false,
        clientRequestId: randomUUID(),
        requestFingerprint: randomBytes(32).toString("hex"),
      },
    });
  }

  async function login(email: string) {
    const agent = request.agent(app);
    const response = await agent.post("/api/auth/login").send({ email, password: DASHBOARD_TEST_PASSWORD });
    if (response.status !== 200) throw new Error(`Dashboard test login failed with ${response.status}.`);
    return agent;
  }

  async function cleanup() {
    assertDisposableTestDatabase();
    if (ticketIds.length) {
      const actionIds = await prisma.actionTaken.findMany({ where: { ticketId: { in: ticketIds } }, select: { id: true } });
      await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actionIds.map(({ id }) => id) } } });
      await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    }
    await prisma.session.deleteMany({ where: { userId: { in: users.map(({ id }) => id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
    await prisma.requester.deleteMany({ where: { id: { in: [requesterA.id, requesterB.id, requesterC.id] } } });
  }

  return { prisma, requesterA, requesterB, requesterC, requesterUserA, requesterUserB, requesterUserC, staffA, staffB, admin, category, relatedSystem, ticketIds, createTicket, createAction, login, cleanup };
}
