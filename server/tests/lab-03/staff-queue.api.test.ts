import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const password = "Issue36-StaffQueue!2026";
const suffix = `${process.pid}-${Date.now()}`;
const staffAEmail = `lab3-queue-staff-a-${suffix}@example.test`;
const staffBEmail = `lab3-queue-staff-b-${suffix}@example.test`;
const inactiveStaffEmail = `lab3-queue-inactive-staff-${suffix}@example.test`;
const requesterEmail = `lab3-queue-requester-${suffix}@example.test`;
const createdTicketNumbers = Array.from({ length: 12 }, (_, index) =>
  `TKT-2096-${String((process.pid + index + 100) % 1_000_000).padStart(6, "0")}`,
);

let staffAId: number;
let staffBId: number;
let inactiveStaffId: number;
let requesterId: number;
let requesterUserId: number;
let categoryId: number;
let relatedSystemId: number;
let inactiveCategoryId: number;
let staffA: ReturnType<typeof request.agent>;
let requester: ReturnType<typeof request.agent>;

async function cleanupFixtures() {
  const prisma = getPrisma();
  const requesterRow = await prisma.requester.findUnique({ where: { email: requesterEmail } });
  const tickets = await prisma.ticket.findMany({
    where: { OR: [{ ticketNumber: { in: createdTicketNumbers } }, ...(requesterRow ? [{ requesterId: requesterRow.id }] : [])] },
    select: { id: true },
  });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: [staffAEmail, staffBEmail, inactiveStaffEmail, requesterEmail] } } });
  if (requesterRow) await prisma.requester.delete({ where: { id: requesterRow.id } });
  await prisma.category.deleteMany({ where: { name: `Lab 3 Queue Inactive Category ${suffix}` } });
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return agent;
}

describe("Lab 3 IT Staff Ticket Queue API", () => {
  beforeAll(async () => {
    await cleanupFixtures();
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    const inactiveCategory = await prisma.category.create({ data: { name: `Lab 3 Queue Inactive Category ${suffix}`, isActive: false } });
    inactiveCategoryId = inactiveCategory.id;

    const requesterRow = await prisma.requester.create({ data: { name: "Queue Requester", email: requesterEmail, isActive: true } });
    requesterId = requesterRow.id;
    const [staffARow, staffBRow, inactiveStaffRow, requesterUserRow] = await Promise.all([
      prisma.user.create({ data: { name: "Queue Staff A", email: staffAEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Queue Staff B", email: staffBEmail, passwordHash: await hashPassword(password), role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Queue Inactive Staff", email: inactiveStaffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: false, mustChangePassword: false } }),
      prisma.user.create({ data: { name: requesterRow.name, email: requesterEmail, passwordHash: await hashPassword(password), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterRow.id } }),
    ]);
    staffAId = staffARow.id;
    staffBId = staffBRow.id;
    inactiveStaffId = inactiveStaffRow.id;
    requesterUserId = requesterUserRow.id;

    await prisma.ticket.createMany({
      data: createdTicketNumbers.map((ticketNumber, index) => {
        const createdAt = new Date(Date.UTC(2026, 8, 1, 10, index));
        return {
          ticketNumber,
          requesterId,
          categoryId,
          relatedSystemId,
          requestedPriority: (["LOW", "MEDIUM", "HIGH", "URGENT"] as const)[index % 4],
          itPriority: (["URGENT", "HIGH", "MEDIUM", "LOW"] as const)[index % 4],
          status: (["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const)[index % 8],
          summary: `Queue fixture ${index + 1}`,
          description: `Queue fixture description ${index + 1}.`,
          ticketOwnerId: index % 3 === 0 ? null : index % 2 === 0 ? staffAId : staffBId,
          createdAt,
          updatedAt: createdAt,
        };
      }),
    });
    staffA = await login(staffAEmail);
    requester = await login(requesterEmail);
  });

  afterAll(async () => {
    await cleanupFixtures();
    const prisma = getPrisma();
    await prisma.$disconnect();
  });

  it("returns safe authentication and role errors", async () => {
    const unauthenticated = await request(app).get("/api/staff/tickets");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } });

    const forbidden = await requester.get("/api/staff/tickets");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
  });

  it("returns the shared queue with exact metadata, ownership, priorities, and stable defaults", async () => {
    // Scope assertions to this test's requester so a prior idempotent seed run
    // cannot make the disposable database's queue count nondeterministic.
    const fixtureScope = { search: requesterEmail };
    const response = await staffA.get("/api/staff/tickets").query(fixtureScope);
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 12,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true,
    });
    expect(response.body.items).toHaveLength(10);
    expect(response.body.items[0]).toMatchObject({
      ticketNumber: createdTicketNumbers[11],
      requester: { id: requesterId, name: "Queue Requester", email: requesterEmail },
      category: { id: categoryId },
      relatedSystem: { id: relatedSystemId },
      requestedPriority: "URGENT",
      itPriority: "LOW",
      status: "WAITING_FOR_REQUESTER",
      ticketOwner: { id: staffBId, name: "Queue Staff B", email: staffBEmail, role: "ADMINISTRATOR" },
    });
    expect(Object.keys(response.body.items[0]).sort()).toEqual([
      "category", "createdAt", "description", "id", "itPriority", "relatedSystem", "requester",
      "requestedPriority", "resolutionIndication", "status", "summary", "ticketNumber", "ticketOwner", "updatedAt",
    ].sort());
  });

  it("supports search, all queue filters, owner filters, sorting, and page sizes", async () => {
    const fixtureScope = { search: requesterEmail };
    const filtered = await staffA.get("/api/staff/tickets").query({
      search: "Queue fixture 5",
      categoryId,
      relatedSystemId,
      requestedPriority: "LOW",
      itPriority: "URGENT",
      status: "RESOLVED",
      owner: staffAId,
      sort: "itPriority",
      order: "asc",
      page: 1,
      pageSize: 25,
    });
    expect(filtered.status).toBe(200);
    expect(filtered.body.pagination.totalItems).toBe(1);
    expect(filtered.body.items[0]).toMatchObject({ summary: "Queue fixture 5", requestedPriority: "LOW", itPriority: "URGENT", status: "RESOLVED", ticketOwner: { id: staffAId } });

    const unassigned = await staffA.get("/api/staff/tickets").query({ ...fixtureScope, owner: "unassigned" });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.items.every((item: { ticketOwner: unknown }) => item.ticketOwner === null)).toBe(true);

    const mine = await staffA.get("/api/staff/tickets").query({ ...fixtureScope, owner: "me", pageSize: 50 });
    expect(mine.status).toBe(200);
    expect(mine.body.items.every((item: { ticketOwner: { id: number } | null }) => item.ticketOwner?.id === staffAId)).toBe(true);

    const secondPage = await staffA.get("/api/staff/tickets").query({ ...fixtureScope, page: 2, pageSize: 10 });
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(2);
    expect(secondPage.body.pagination.hasPreviousPage).toBe(true);

    for (const sort of ["updatedAt", "createdAt", "ticketNumber", "summary", "requestedPriority", "itPriority", "status", "owner"] as const) {
      const sorted = await staffA.get("/api/staff/tickets").query({ ...fixtureScope, sort, pageSize: 50 });
      expect(sorted.status, sort).toBe(200);
      expect(sorted.body.items).toHaveLength(12);
    }
  });

  it("rejects unknown, malformed, inactive, and ineligible query values safely", async () => {
    const queries = [
      { unknown: "value" },
      { page: 0 },
      { pageSize: 20 },
      { requestedPriority: "CRITICAL" },
      { itPriority: "CRITICAL" },
      { status: "QUEUED" },
      { owner: inactiveStaffId },
      { owner: requesterUserId },
      { categoryId: inactiveCategoryId },
      { search: "x".repeat(101) },
    ];
    for (const query of queries) {
      const response = await staffA.get("/api/staff/tickets").query(query);
      expect(response.status, JSON.stringify(query)).toBe(400);
      expect(response.body.error.code, JSON.stringify(query)).toBe("VALIDATION_ERROR");
      expect(response.body.error.message).toBe("Please correct the query parameters.");
    }
  });

  it("lists only active eligible assignees and protects the endpoint by role", async () => {
    const response = await staffA.get("/api/staff/assignees");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      { id: staffAId, name: "Queue Staff A", email: staffAEmail, role: "IT_STAFF" },
      { id: staffBId, name: "Queue Staff B", email: staffBEmail, role: "ADMINISTRATOR" },
    ]));
    expect(response.body).not.toEqual(expect.arrayContaining([{ id: inactiveStaffId, name: "Queue Inactive Staff", email: inactiveStaffEmail, role: "IT_STAFF" }]));
    expect((await requester.get("/api/staff/assignees")).status).toBe(403);
    expect((await request(app).get("/api/staff/assignees")).status).toBe(401);
  });
});
