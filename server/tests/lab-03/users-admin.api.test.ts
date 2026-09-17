import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const suffix = `${process.pid}-${Date.now()}`;
const adminPassword = "Admin-Management!2026";
const managedPassword = "Managed-User!2026";
const resetPassword = "Reset-Password!2026";
const adminEmail = `lab3-admin-management-${suffix}@example.test`;
const managedEmail = `lab3-managed-user-${suffix}@example.test`;
const ownerEmail = `lab3-owner-user-${suffix}@example.test`;
const requesterEmail = `lab3-admin-requester-${suffix}@example.test`;
const createdEmail = `lab3-created-user-${suffix}@example.test`;
const ticketNumber = `TKT-2095-${String(process.pid % 1_000_000).padStart(6, "0")}`;

let adminId: number;
let managedId: number;
let ownerId: number;
let requesterUserId: number;
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1] ?? "";
  if (!databaseName.endsWith("_test")) {
    throw new Error("Issue #38 fixtures require a disposable DATABASE_URL whose database name ends with _test.");
  }
}

async function cleanup() {
  assertDisposableTestDatabase();
  const prisma = getPrisma();
  const requester = await prisma.requester.findUnique({ where: { email: requesterEmail } });
  const users = await prisma.user.findMany({ where: { email: { in: [adminEmail, managedEmail, ownerEmail, requesterEmail, createdEmail] } }, select: { id: true } });
  const tickets = await prisma.ticket.findMany({ where: { OR: [{ ticketNumber }, ...(requester ? [{ requesterId: requester.id }] : [])] }, select: { id: true } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.session.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  if (requester) await prisma.requester.delete({ where: { id: requester.id } });
}

async function login(email: string, password: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 3 Administrator User Management API", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    await cleanup();
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    const requester = await prisma.requester.create({ data: { name: "Admin API Requester", email: requesterEmail, isActive: true } });
    requesterId = requester.id;
    const [admin, managed, owner, requesterUser] = await Promise.all([
      prisma.user.create({ data: { name: "Management Administrator", email: adminEmail, passwordHash: await hashPassword(adminPassword), role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Managed Staff", email: managedEmail, passwordHash: await hashPassword(managedPassword), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Ticket Owner Staff", email: ownerEmail, passwordHash: await hashPassword(managedPassword), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: requester.name, email: requester.email, passwordHash: await hashPassword(managedPassword), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requester.id } }),
    ]);
    adminId = admin.id;
    managedId = managed.id;
    ownerId = owner.id;
    requesterUserId = requesterUser.id;
    await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId,
        relatedSystemId,
        requestedPriority: "MEDIUM",
        status: "NEW",
        summary: "Managed owner ticket",
        description: "This fixture keeps the owner eligible for the safety check.",
        ticketOwnerId: ownerId,
      },
    });
  });

  afterAll(cleanup);

  it("lists safe users with search and role filtering and protects the endpoint by role", async () => {
    const { agent } = await login(adminEmail, adminPassword);
    const response = await agent.get("/api/admin/users").query({ search: "managed", role: "IT_STAFF" });
    expect(response.status).toBe(200);
    expect(response.body.users).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: managedId, name: "Managed Staff", email: managedEmail, role: "IT_STAFF", isActive: true, mustChangePassword: false }),
    ]));
    expect(Object.keys(response.body.users[0]).sort()).toEqual(["createdAt", "email", "id", "isActive", "mustChangePassword", "name", "role", "updatedAt"].sort());
    expect(response.body.users[0]).not.toHaveProperty("passwordHash");

    const { agent: requesterAgent } = await login(requesterEmail, managedPassword);
    const forbidden = await requesterAgent.get("/api/admin/users");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
  });

  it("creates one-role users, requires an initial password, and rejects duplicate or invalid input", async () => {
    const { agent, csrfToken } = await login(adminEmail, adminPassword);
    const created = await agent.post("/api/admin/users").set("X-CSRF-Token", csrfToken).send({
      name: "Created Administrator",
      email: `  ${createdEmail.toUpperCase()} `,
      role: "ADMINISTRATOR",
      isActive: true,
      initialPassword: resetPassword,
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ email: createdEmail, role: "ADMINISTRATOR", isActive: true, mustChangePassword: true });
    expect(created.body.user).not.toHaveProperty("passwordHash");

    const duplicate = await agent.post("/api/admin/users").set("X-CSRF-Token", csrfToken).send({
      name: "Duplicate",
      email: createdEmail,
      role: "REQUESTER",
      isActive: true,
      initialPassword: resetPassword,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_EMAIL");

    const invalid = await agent.post("/api/admin/users").set("X-CSRF-Token", csrfToken).send({
      name: "Bad Role",
      email: `bad-role-${suffix}@example.test`,
      role: "SUPERUSER",
      isActive: true,
      initialPassword: "short",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps a session for name-only edits but revokes it after role or activation changes", async () => {
    const { agent, csrfToken } = await login(adminEmail, adminPassword);
    const managedSession = await login(managedEmail, managedPassword);
    const renamed = await agent.patch(`/api/admin/users/${managedId}`).set("X-CSRF-Token", csrfToken).send({ name: "Managed Staff Renamed" });
    expect(renamed.status).toBe(200);
    expect((await managedSession.agent.get("/api/auth/me")).status).toBe(200);

    const roleChanged = await agent.patch(`/api/admin/users/${managedId}`).set("X-CSRF-Token", csrfToken).send({ role: "ADMINISTRATOR" });
    expect(roleChanged.status).toBe(200);
    expect((await managedSession.agent.get("/api/auth/me")).status).toBe(401);
  });

  it("rejects deactivation or requester demotion for a ticket owner without changing data", async () => {
    const { agent, csrfToken } = await login(adminEmail, adminPassword);
    const response = await agent.patch(`/api/admin/users/${ownerId}`).set("X-CSRF-Token", csrfToken).send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({ code: "USER_OWNS_TICKETS", message: "This User owns Tickets and cannot be made ineligible." });
    const prisma = getPrisma();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).isActive).toBe(true);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber } })).ticketOwnerId).toBe(ownerId);
  });

  it("protects self and the last active Administrator and resets passwords with session revocation", async () => {
    const { agent, csrfToken } = await login(adminEmail, adminPassword);
    const self = await agent.patch(`/api/admin/users/${adminId}`).set("X-CSRF-Token", csrfToken).send({ isActive: false });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("ADMINISTRATOR_SAFETY_VIOLATION");

    const managedSession = await login(managedEmail, managedPassword);
    const reset = await agent.post(`/api/admin/users/${managedId}/initial-password`).set("X-CSRF-Token", csrfToken).send({ initialPassword: resetPassword });
    expect(reset.status).toBe(200);
    expect(reset.body.user.mustChangePassword).toBe(true);
    expect(reset.body.user).not.toHaveProperty("passwordHash");
    expect((await managedSession.agent.get("/api/auth/me")).status).toBe(401);

    const newLogin = await login(managedEmail, resetPassword);
    expect(newLogin.agent).toBeDefined();
    expect((await newLogin.agent.get("/api/auth/me")).body.user.mustChangePassword).toBe(true);
  });
});
