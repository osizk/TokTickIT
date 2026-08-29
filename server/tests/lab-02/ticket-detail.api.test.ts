import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket detail and attachment ownership", () => {
  let storageDir: string;
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketNumber: string;
  let attachmentId: number;
  const createdTicketNumbers: string[] = [];

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "toktickit-lab2-detail-"));
    process.env.ATTACHMENT_STORAGE_DIR = storageDir;

    const prisma = getPrisma();
    const requesters = await prisma.requester.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    if (requesters.length < 2 || !category || !relatedSystem) {
      throw new Error("Lab 2 seed data is required before running Ticket detail tests.");
    }
    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterA))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "HIGH")
      .field("summary", "Detail ownership test")
      .field("description", "A Ticket used to verify owned detail and attachment boundaries.")
      .attach("attachments", Buffer.from("%PDF-1.7\ndetail fixture"), {
        filename: "detail-fixture.pdf",
        contentType: "application/pdf",
      });
    expect(response.status).toBe(201);
    ticketNumber = response.body.ticket.ticketNumber;
    attachmentId = response.body.attachments[0].id;
    createdTicketNumbers.push(ticketNumber);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
      select: { id: true },
    });
    if (tickets.length > 0) {
      await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
      await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
    }
    await rm(storageDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("returns owned read-only detail and attachment metadata without storage fields", async () => {
    const detail = await request(app)
      .get(`/api/tickets/${ticketNumber}`)
      .set("X-Requester-Id", String(requesterA));

    expect(detail.status).toBe(200);
    expect(detail.body.ticket).toMatchObject({
      ticketNumber,
      requestedPriority: "HIGH",
      status: "NEW",
      summary: "Detail ownership test",
      requester: { id: requesterA },
    });
    expect(detail.body.ticket.createdAt).toEqual(expect.any(String));
    expect(detail.body.ticket).not.toHaveProperty("attachments");
    expect(detail.body.ticket).not.toHaveProperty("requesterId");

    const metadata = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA));
    expect(metadata.status).toBe(200);
    expect(metadata.body.attachments).toHaveLength(1);
    expect(metadata.body.attachments[0]).toMatchObject({
      id: attachmentId,
      originalName: "detail-fixture.pdf",
      mimeType: "application/pdf",
      removedAt: null,
    });
    expect(metadata.body.attachments[0]).not.toHaveProperty("storedFilename");
  });

  it("uses the same safe 404 for missing and cross-requester detail", async () => {
    const crossOwner = await request(app)
      .get(`/api/tickets/${ticketNumber}`)
      .set("X-Requester-Id", String(requesterB));
    const missing = await request(app)
      .get("/api/tickets/TKT-2099-999999")
      .set("X-Requester-Id", String(requesterA));

    expect(crossOwner.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(crossOwner.body).toEqual(missing.body);
    expect(crossOwner.body.error).toEqual({
      code: "TICKET_NOT_FOUND",
      message: "Ticket was not found.",
    });
  });

  it("requires requester context for detail and attachment metadata", async () => {
    const detail = await request(app).get(`/api/tickets/${ticketNumber}`);
    const metadata = await request(app).get(`/api/tickets/${ticketNumber}/attachments`);
    expect(detail.status).toBe(400);
    expect(metadata.status).toBe(400);
    expect(detail.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
    expect(metadata.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });
});
