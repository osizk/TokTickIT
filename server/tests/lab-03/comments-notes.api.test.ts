import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const password = "Issue37-Comments!2026";
const suffix = `${process.pid}-${Date.now()}`;
const staffEmail = `lab3-comments-staff-${suffix}@example.test`;
const requesterEmail = `lab3-comments-requester-${suffix}@example.test`;
const ticketNumber = `TKT-2093-${String((process.pid + 877) % 1_000_000).padStart(6, "0")}`;
let requesterId: number;
let staff: ReturnType<typeof request.agent>;
let requester: ReturnType<typeof request.agent>;
let staffCsrf: string;
let requesterCsrf: string;

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

async function cleanup() {
  const prisma = getPrisma();
  const requesterRow = await prisma.requester.findUnique({ where: { email: requesterEmail } });
  const tickets = await prisma.ticket.findMany({ where: { ticketNumber }, select: { id: true } });
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } }).catch(() => undefined);
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.session.deleteMany({ where: { user: { email: { in: [staffEmail, requesterEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [staffEmail, requesterEmail] } } });
  if (requesterRow) await prisma.requester.delete({ where: { id: requesterRow.id } });
}

describe("Lab 3 Public Comments and Internal Notes API", () => {
  beforeAll(async () => {
    await cleanup();
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const requesterRow = await prisma.requester.create({ data: { name: "Comments Requester", email: requesterEmail, isActive: true } });
    requesterId = requesterRow.id;
    await prisma.user.create({ data: { name: "Comments Staff", email: staffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } });
    await prisma.user.create({ data: { name: requesterRow.name, email: requesterEmail, passwordHash: await hashPassword(password), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterRow.id } });
    await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status: "OPEN",
        summary: "Comments and notes fixture",
        description: "A ticket used to verify distinct public and private entries.",
      },
    });
    ({ agent: staff, csrfToken: staffCsrf } = await login(staffEmail));
    ({ agent: requester, csrfToken: requesterCsrf } = await login(requesterEmail));
  });

  afterAll(async () => {
    await cleanup();
    await getPrisma().$disconnect();
  });

  it("allows staff to append public comments and Requesters to read them", async () => {
    const created = await staff
      .post(`/api/tickets/${ticketNumber}/comments`)
      .set("X-CSRF-Token", staffCsrf)
      .send({ content: "Staff update is visible to the Requester." });
    expect(created.status).toBe(201);
    expect(created.body.comment.author.role).toBe("IT_STAFF");

    const listed = await requester.get(`/api/tickets/${ticketNumber}/comments`);
    expect(listed.status).toBe(200);
    expect(listed.body.comments).toHaveLength(1);
    expect(listed.body.comments[0].content).toContain("visible to the Requester");

    const invalid = await staff
      .post(`/api/tickets/${ticketNumber}/comments`)
      .set("X-CSRF-Token", staffCsrf)
      .send({ content: "   " });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps Internal Notes staff-only and never leaks their content", async () => {
    const created = await staff
      .post(`/api/tickets/${ticketNumber}/internal-notes`)
      .set("X-CSRF-Token", staffCsrf)
      .send({ content: "Private escalation detail for staff only." });
    expect(created.status).toBe(201);
    expect(created.body.note.content).toContain("staff only");

    const listed = await staff.get(`/api/tickets/${ticketNumber}/internal-notes`);
    expect(listed.status).toBe(200);
    expect(listed.body.notes).toHaveLength(1);

    const forbidden = await requester.get(`/api/tickets/${ticketNumber}/internal-notes`);
    expect(forbidden.status).toBe(403);
    expect(JSON.stringify(forbidden.body)).not.toContain("Private escalation detail");

    const requesterDetail = await requester.get(`/api/tickets/${ticketNumber}`);
    expect(requesterDetail.status).toBe(200);
    expect(JSON.stringify(requesterDetail.body)).not.toContain("Private escalation detail");
    void requesterCsrf;
  });
});
