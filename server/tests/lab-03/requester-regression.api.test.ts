import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hashPassword } from "../../src/auth-service.js";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const password = "Requester-Regression!2026";
const requesterAEmail = `lab3-requester-regression-a-${process.pid}@example.test`;
const requesterBEmail = `lab3-requester-regression-b-${process.pid}@example.test`;
const ticketAPrefix = `TKT-2098-${String(process.pid % 1_000_000).padStart(6, "0")}`;
const ticketBPrefix = `TKT-2097-${String(process.pid % 1_000_000).padStart(6, "0")}`;

let requesterAId: number;
let requesterBId: number;
let userAId: number;
let userBId: number;
let ticketANumber: string;
let ticketBNumber: string;
let categoryId: number;
let relatedSystemId: number;
const createdTicketNumbers: string[] = [];

async function removeRequester(email: string): Promise<void> {
  const prisma = getPrisma();
  const requester = await prisma.requester.findUnique({ where: { email } });
  if (!requester) return;
  const tickets = await prisma.ticket.findMany({ where: { requesterId: requester.id }, select: { id: true } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.user.deleteMany({ where: { legacyRequesterId: requester.id } });
  await prisma.requester.delete({ where: { id: requester.id } });
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.csrfToken as string };
}

describe("Lab 3 authenticated Requester regression", () => {
  beforeAll(async () => {
    await removeRequester(requesterAEmail);
    await removeRequester(requesterBEmail);
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const requesterA = await prisma.requester.create({
      data: { name: "Regression Requester A", email: requesterAEmail, isActive: true },
    });
    const requesterB = await prisma.requester.create({
      data: { name: "Regression Requester B", email: requesterBEmail, isActive: true },
    });
    requesterAId = requesterA.id;
    requesterBId = requesterB.id;

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          name: requesterA.name,
          email: requesterA.email,
          passwordHash: await hashPassword(password),
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
          legacyRequesterId: requesterA.id,
        },
      }),
      prisma.user.create({
        data: {
          name: requesterB.name,
          email: requesterB.email,
          passwordHash: await hashPassword(password),
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
          legacyRequesterId: requesterB.id,
        },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;

    const [ticketA, ticketB] = await Promise.all([
      prisma.ticket.create({
        data: {
          ticketNumber: ticketAPrefix,
          requesterId: requesterA.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          requestedPriority: "HIGH",
          status: "NEW",
          summary: "Requester A regression ticket",
          description: "This ticket belongs only to the first authenticated Requester.",
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: ticketBPrefix,
          requesterId: requesterB.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          requestedPriority: "LOW",
          status: "NEW",
          summary: "Requester B regression ticket",
          description: "This ticket must not be visible to the first authenticated Requester.",
        },
      }),
    ]);
    ticketANumber = ticketA.ticketNumber;
    ticketBNumber = ticketB.ticketNumber;
    createdTicketNumbers.push(ticketANumber, ticketBNumber);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    const created = await prisma.ticket.findMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
      select: { id: true },
    });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: created.map((ticket) => ticket.id) } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: created.map((ticket) => ticket.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: created.map((ticket) => ticket.id) } } });
    await removeRequester(requesterAEmail);
    await removeRequester(requesterBEmail);
  });

  it("requires an authenticated session and derives the owned list without X-Requester-Id", async () => {
    const unauthenticated = await request(app).get("/api/categories");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({
      error: { code: "SESSION_REQUIRED", message: "Authentication is required." },
    });

    const { agent } = await login(requesterAEmail);
    const response = await agent.get("/api/tickets").set("X-Requester-Id", String(requesterBId));
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toContain(ticketANumber);
    expect(response.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).not.toContain(ticketBNumber);
  });

  it("creates a Ticket for the authenticated Requester even when a spoofed header is present", async () => {
    const { agent, csrfToken } = await login(requesterAEmail);
    const response = await agent
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterBId))
      .set("X-CSRF-Token", csrfToken)
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "MEDIUM")
      .field("summary", "Authenticated requester creates a ticket")
      .field("description", "The server must derive ownership from the authenticated session.");

    expect(response.status).toBe(201);
    expect(response.body.ticket.requester.id).toBe(requesterAId);
    createdTicketNumbers.push(response.body.ticket.ticketNumber);
  });

  it("uses one safe 404 for cross-owner detail and supports public comments and resolution indication", async () => {
    const { agent, csrfToken } = await login(requesterAEmail);
    const crossOwner = await agent.get(`/api/tickets/${ticketBNumber}`);
    expect(crossOwner.status).toBe(404);
    expect(crossOwner.body).toEqual({
      error: { code: "TICKET_NOT_FOUND", message: "Ticket was not found." },
    });

    const ownAttachments = await agent.get(`/api/tickets/${ticketANumber}/attachments`);
    expect(ownAttachments.status).toBe(200);

    const comment = await agent
      .post(`/api/tickets/${ticketANumber}/comments`)
      .set("X-CSRF-Token", csrfToken)
      .send({ content: "The problem still occurs after restarting." });
    expect(comment.status).toBe(201);

    const indication = await agent
      .post(`/api/tickets/${ticketANumber}/resolution-indication`)
      .set("X-CSRF-Token", csrfToken)
      .send({});
    expect(indication.status).toBe(200);
  });
});
