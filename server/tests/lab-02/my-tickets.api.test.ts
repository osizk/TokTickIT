import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/tickets", () => {
  let requesterA: number;
  let requesterB: number;
  let categoryA: number;
  let categoryB: number;
  let systemA: number;
  let systemB: number;
  const token = `Issue16-${Date.now()}`;
  const createdTicketNumbers: string[] = [];

  beforeAll(async () => {
    const prisma = getPrisma();
    const requesters = await prisma.requester.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    const systems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (requesters.length < 2 || categories.length < 2 || systems.length < 2) {
      throw new Error("Lab 2 seed data is required before running My Tickets API tests.");
    }
    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
    categoryA = categories[0].id;
    categoryB = categories[1].id;
    systemA = systems[0].id;
    systemB = systems[1].id;

    const tickets = [
      ["Alpha VPN outage", "VPN cannot connect from the office.", "LOW", categoryA, systemA],
      ["Bravo laptop setup", "New laptop needs the standard software image.", "HIGH", categoryB, systemB],
      ["Charlie VPN follow-up", "VPN disconnects after a few minutes.", "MEDIUM", categoryA, systemA],
      ["Delta portal access", "Employee portal returns an access error.", "URGENT", categoryB, systemB],
    ] as const;

    for (const [summary, description, priority, categoryId, relatedSystemId] of tickets) {
      const response = await request(app)
        .post("/api/tickets")
        .set("X-Requester-Id", String(requesterA))
        .field("categoryId", String(categoryId))
        .field("relatedSystemId", String(relatedSystemId))
        .field("requestedPriority", priority)
        .field("summary", `${token} ${summary}`)
        .field("description", `${token} ${description}`);
      expect(response.status).toBe(201);
      createdTicketNumbers.push(response.body.ticket.ticketNumber);
    }

    const otherResponse = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterB))
      .field("categoryId", String(categoryA))
      .field("relatedSystemId", String(systemA))
      .field("requestedPriority", "LOW")
      .field("summary", `${token} Other requester ticket`)
      .field("description", `${token} This belongs to another requester.`);
    expect(otherResponse.status).toBe(201);
    createdTicketNumbers.push(otherResponse.body.ticket.ticketNumber);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
      select: { id: true },
    });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
    await prisma.$disconnect();
  });

  it("requires valid requester context and returns safe errors for invalid query parameters", async () => {
    const missingContext = await request(app).get("/api/tickets");
    expect(missingContext.status).toBe(400);
    expect(missingContext.body).toEqual({
      error: {
        code: "REQUESTER_CONTEXT_REQUIRED",
        message: "A valid X-Requester-Id header is required.",
      },
    });

    const inactive = await request(app).get("/api/tickets").set("X-Requester-Id", "5");
    expect(inactive.status).toBe(404);
    expect(inactive.body.error.code).toBe("REQUESTER_NOT_FOUND");

    for (const query of [
      "page=0",
      "page=abc",
      "pageSize=20",
      "categoryId=abc",
      "priority=CRITICAL",
      "status=OPEN",
      "sort=createdAt&order=sideways",
      "unknown=value",
      `search=${"x".repeat(101)}`,
    ]) {
      const response = await request(app)
        .get(`/api/tickets?${query}`)
        .set("X-Requester-Id", String(requesterA));
      expect(response.status, query).toBe(400);
      expect(response.body.error.code, query).toBe("VALIDATION_ERROR");
    }
  });

  it("returns only owned tickets with stable pagination metadata and no private fields", async () => {
    const response = await request(app)
      .get(`/api/tickets?search=${encodeURIComponent(token)}&page=1&pageSize=10`)
      .set("X-Requester-Id", String(requesterA));

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 4,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    expect(response.body.items).toHaveLength(4);
    expect(response.body.items.every((item: Record<string, unknown>) =>
      Object.keys(item).sort().join(",") ===
        "category,createdAt,id,relatedSystem,requestedPriority,status,summary,ticketNumber,updatedAt",
    )).toBe(true);
    expect(response.body.items.every((item: Record<string, unknown>) =>
      !Object.prototype.hasOwnProperty.call(item, "description") &&
      !Object.prototype.hasOwnProperty.call(item, "requester") &&
      !Object.prototype.hasOwnProperty.call(item, "attachments"),
    )).toBe(true);

    const nextPage = await request(app)
      .get(`/api/tickets?search=${encodeURIComponent(token)}&page=2&pageSize=10`)
      .set("X-Requester-Id", String(requesterA));
    expect(nextPage.status).toBe(200);
    expect(nextPage.body.items).toEqual([]);
    expect(nextPage.body.pagination.hasPreviousPage).toBe(true);
    expect(nextPage.body.pagination.hasNextPage).toBe(false);
  });

  it("supports search, reference filters, priority/status filters, and explicit sorting", async () => {
    const base = `/api/tickets?search=${encodeURIComponent(token)}`;
    const sorted = await request(app)
      .get(`${base}&sort=summary&order=asc&pageSize=10`)
      .set("X-Requester-Id", String(requesterA));
    expect(sorted.status).toBe(200);
    expect(sorted.body.items.map((item: { summary: string }) => item.summary)).toEqual([
      `${token} Alpha VPN outage`,
      `${token} Bravo laptop setup`,
      `${token} Charlie VPN follow-up`,
      `${token} Delta portal access`,
    ]);

    const filtered = await request(app)
      .get(
        `${base}&categoryId=${categoryA}&relatedSystemId=${systemA}&priority=MEDIUM&status=NEW`,
      )
      .set("X-Requester-Id", String(requesterA));
    expect(filtered.status).toBe(200);
    expect(filtered.body.pagination.totalItems).toBe(1);
    expect(filtered.body.items[0]).toMatchObject({
      summary: `${token} Charlie VPN follow-up`,
      requestedPriority: "MEDIUM",
      status: "NEW",
      category: { id: categoryA },
      relatedSystem: { id: systemA },
    });

    const ticketNumberSearch = await request(app)
      .get(`/api/tickets?search=${encodeURIComponent(createdTicketNumbers[0])}`)
      .set("X-Requester-Id", String(requesterA));
    expect(ticketNumberSearch.status).toBe(200);
    expect(ticketNumberSearch.body.items).toHaveLength(1);
    expect(ticketNumberSearch.body.items[0].ticketNumber).toBe(createdTicketNumbers[0]);
  });

  it("isolates ownership between requester contexts", async () => {
    const requesterAResponse = await request(app)
      .get(`/api/tickets?search=${encodeURIComponent(token)}`)
      .set("X-Requester-Id", String(requesterA));
    const requesterBResponse = await request(app)
      .get(`/api/tickets?search=${encodeURIComponent(token)}`)
      .set("X-Requester-Id", String(requesterB));

    expect(requesterAResponse.status).toBe(200);
    expect(requesterBResponse.status).toBe(200);
    expect(requesterAResponse.body.pagination.totalItems).toBe(4);
    expect(requesterBResponse.body.pagination.totalItems).toBe(1);
    expect(requesterBResponse.body.items[0].summary).toBe(`${token} Other requester ticket`);
  });
});
