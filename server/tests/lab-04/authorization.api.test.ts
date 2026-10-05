import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const suffix = `${process.pid}-${Date.now()}`;
const staffEmail = `lab4-auth-staff-${suffix}@example.test`;
const gatedEmail = `lab4-auth-gated-${suffix}@example.test`;
const requesterEmail = `lab4-auth-requester-${suffix}@example.test`;
const otherRequesterEmail = `lab4-auth-other-requester-${suffix}@example.test`;
const password = "Lab4-Auth!2026";
const ticketNumber = `TKT-2091-${String(process.pid % 1_000_000).padStart(6, "0")}`;
let staffId: number;
let gatedId: number;
let requesterUserId: number;
let otherRequesterUserId: number;
let requesterId: number;
let otherRequesterId: number;
let ticketId: number;

function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) throw new Error("Issue #56 authorization tests require a disposable _test database.");
}

async function cleanup() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  if (ticketId) {
    await prisma.attachment.deleteMany({ where: { ticketId } });
    await prisma.publicComment.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
  }
  const userIds = [staffId, gatedId, requesterUserId, otherRequesterUserId].filter((id): id is number => typeof id === "number");
  if (userIds.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  const requesterIds = [requesterId, otherRequesterId].filter((id): id is number => typeof id === "number");
  if (requesterIds.length > 0) await prisma.requester.deleteMany({ where: { id: { in: requesterIds } } });
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 4 Actions API authorization", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    await cleanup();
    const prisma = getPrisma();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    const [requester, otherRequester] = await Promise.all([
      prisma.requester.create({ data: { name: "Authorized Action Requester", email: requesterEmail, isActive: true } }),
      prisma.requester.create({ data: { name: "Other Action Requester", email: otherRequesterEmail, isActive: true } }),
    ]);
    requesterId = requester.id;
    otherRequesterId = otherRequester.id;
    const [staff, gated, requesterUser, otherRequesterUser] = await Promise.all([
      prisma.user.create({ data: { name: "Action Reader Staff", email: staffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Password-gated Staff", email: gatedEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: true } }),
      prisma.user.create({ data: { name: requester.name, email: requester.email, passwordHash: await hashPassword(password), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requester.id } }),
      prisma.user.create({ data: { name: otherRequester.name, email: otherRequester.email, passwordHash: await hashPassword(password), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: otherRequester.id } }),
    ]);
    staffId = staff.id;
    gatedId = gated.id;
    requesterUserId = requesterUser.id;
    otherRequesterUserId = otherRequesterUser.id;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "MEDIUM",
        status: "OPEN",
        summary: "Action authorization fixture",
        description: "This Ticket is used to verify Action ownership and role checks.",
      },
    });
    ticketId = ticket.id;
  });

  afterAll(cleanup);

  it("requires a usable session and enforces password-change gating", async () => {
    const anonymous = request(app);
    const anonymousList = await anonymous.get(`/api/tickets/${ticketNumber}/actions-taken`);
    expect(anonymousList.status).toBe(401);
    expect(anonymousList.body.error.code).toBe("SESSION_REQUIRED");
    const anonymousCreate = await anonymous.post(`/api/tickets/${ticketNumber}/actions-taken`).send({});
    expect(anonymousCreate.status).toBe(401);

    const gated = await login(gatedEmail);
    const gatedRead = await gated.agent.get(`/api/tickets/${ticketNumber}/actions-taken`);
    expect(gatedRead.status).toBe(403);
    expect(gatedRead.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("allows Staff reads, limits Requesters to owned reads, and uses the same safe cross-owner 404", async () => {
    const staff = await login(staffEmail);
    expect((await staff.agent.get(`/api/tickets/${ticketNumber}/actions-taken`)).status).toBe(200);
    const badOrigin = await staff.agent.post(`/api/tickets/${ticketNumber}/actions-taken`)
      .set("X-CSRF-Token", staff.csrfToken)
      .set("Origin", "https://untrusted.example")
      .send({});
    expect(badOrigin.status).toBe(403);
    expect(badOrigin.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    const badCsrf = await staff.agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", "invalid").send({});
    expect(badCsrf.status).toBe(403);
    expect(badCsrf.body.error.code).toBe("CSRF_INVALID");

    const requester = await login(requesterEmail);
    expect((await requester.agent.get(`/api/tickets/${ticketNumber}/actions-taken`)).status).toBe(200);
    const deniedMutation = await requester.agent.post(`/api/tickets/${ticketNumber}/actions-taken`).set("X-CSRF-Token", requester.csrfToken).send({});
    expect(deniedMutation.status).toBe(403);
    expect(deniedMutation.body.error.code).toBe("FORBIDDEN");

    const other = await login(otherRequesterEmail);
    const crossOwner = await other.agent.get(`/api/tickets/${ticketNumber}/actions-taken`);
    expect(crossOwner.status).toBe(404);
    expect(crossOwner.body.error).toEqual({ code: "TICKET_NOT_FOUND", message: "Ticket was not found." });
  });

  it("rejects expired and revoked requester sessions", async () => {
    const expired = await login(requesterEmail);
    const session = await getPrisma().session.findFirstOrThrow({ where: { userId: requesterUserId, revokedAt: null }, orderBy: { createdAt: "desc" } });
    await getPrisma().session.update({ where: { id: session.id }, data: { idleExpiresAt: new Date(Date.now() - 1000) } });
    expect((await expired.agent.get(`/api/tickets/${ticketNumber}/actions-taken`)).status).toBe(401);

    const revoked = await login(requesterEmail);
    const revokedSession = await getPrisma().session.findFirstOrThrow({ where: { userId: requesterUserId, revokedAt: null }, orderBy: { createdAt: "desc" } });
    await getPrisma().session.update({ where: { id: revokedSession.id }, data: { revokedAt: new Date() } });
    expect((await revoked.agent.get(`/api/tickets/${ticketNumber}/actions-taken`)).status).toBe(401);
  });
});
