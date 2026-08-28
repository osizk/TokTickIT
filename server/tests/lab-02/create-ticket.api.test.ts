import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets", () => {
  let storageDir: string;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;
  const createdTicketNumbers: string[] = [];

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "toktickit-lab2-attachments-"));
    process.env.ATTACHMENT_STORAGE_DIR = storageDir;

    const prisma = getPrisma();
    const requester = await prisma.requester.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    if (!requester || !category || !relatedSystem) {
      throw new Error("Lab 2 seed data is required before running Ticket API tests.");
    }

    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (createdTicketNumbers.length > 0) {
      const tickets = await prisma.ticket.findMany({
        where: { ticketNumber: { in: createdTicketNumbers } },
        select: { id: true },
      });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
      await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
    }
    await rm(storageDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("requires a requester context and never accepts requesterId in the multipart body", async () => {
    const missingContext = await request(app)
      .post("/api/tickets")
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "LOW")
      .field("summary", "A valid summary")
      .field("description", "A valid description for the ticket.");

    expect(missingContext.status).toBe(400);

    const bodyRequester = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .field("requesterId", String(requesterId))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "LOW")
      .field("summary", "A valid summary")
      .field("description", "A valid description for the ticket.");

    expect(bodyRequester.status).toBe(400);
    expect(bodyRequester.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a Ticket with the official number, createdAt Ticket Date, NEW status, and attachments atomically", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "HIGH")
      .field("summary", "Campus Wi-Fi disconnects")
      .field("description", "The connection drops several times during the workday.")
      .attach("attachments", Buffer.from("%PDF-1.7\nincident evidence"), {
        filename: "incident.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.ticket).toMatchObject({
      ticketNumber: expect.stringMatching(/^TKT-\d{4}-\d{6}$/),
      requestedPriority: "HIGH",
      status: "NEW",
      requester: { id: requesterId },
    });
    expect(response.body.ticket.createdAt).toEqual(expect.any(String));
    expect(response.body.attachments).toHaveLength(1);
    expect(response.body.attachments[0]).toMatchObject({
      originalName: "incident.pdf",
      mimeType: "application/pdf",
      sizeBytes: expect.any(Number),
    });
    expect(response.body.attachments[0]).not.toHaveProperty("storedFilename");

    createdTicketNumbers.push(response.body.ticket.ticketNumber);
  });

  it("rejects a signature-mismatched attachment without creating a Ticket", async () => {
    const beforeCount = await getPrisma().ticket.count();
    const beforeFiles = await readdir(storageDir);
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "LOW")
      .field("summary", "Signature mismatch test")
      .field("description", "This request should be rejected before persistence.")
      .attach("attachments", Buffer.from("not a PDF"), {
        filename: "fake.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_ATTACHMENT");
    expect(await getPrisma().ticket.count()).toBe(beforeCount);
    expect(await readdir(storageDir)).toEqual(beforeFiles);
  });

  it("rejects more than five attachments before persistence", async () => {
    const beforeCount = await getPrisma().ticket.count();
    const beforeFiles = await readdir(storageDir);
    const form = request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "LOW")
      .field("summary", "Attachment count test")
      .field("description", "This request should reject a sixth attachment.");
    for (let index = 0; index < 6; index += 1) {
      form.attach("attachments", Buffer.from(`%PDF-1.7\nfile-${index}`), {
        filename: `file-${index}.pdf`,
        contentType: "application/pdf",
      });
    }

    const response = await form;

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(await getPrisma().ticket.count()).toBe(beforeCount);
    expect(await readdir(storageDir)).toEqual(beforeFiles);
  });

  it("compensates staged files when a reference check aborts the transaction", async () => {
    const beforeCount = await getPrisma().ticket.count();
    const beforeFiles = await readdir(storageDir);
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .field("categoryId", "999999")
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "LOW")
      .field("summary", "Reference rollback test")
      .field("description", "This staged file must be removed when the reference is invalid.")
      .attach("attachments", Buffer.from("%PDF-1.7\nrollback"), {
        filename: "rollback.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fieldErrors.categoryId).toBeDefined();
    expect(await getPrisma().ticket.count()).toBe(beforeCount);
    expect(await readdir(storageDir)).toEqual(beforeFiles);
  });

  it("returns a safe failure without persistence when storage staging is unavailable", async () => {
    const prisma = getPrisma();
    const beforeCount = await prisma.ticket.count();
    const blockedStoragePath = path.join(os.tmpdir(), `toktickit-lab2-storage-file-${Date.now()}`);
    await writeFile(blockedStoragePath, "storage path is intentionally a file", { flag: "wx" });
    const previousStorageDir = process.env.ATTACHMENT_STORAGE_DIR;
    process.env.ATTACHMENT_STORAGE_DIR = blockedStoragePath;

    try {
      const response = await request(app)
        .post("/api/tickets")
        .set("X-Requester-Id", String(requesterId))
        .field("categoryId", String(categoryId))
        .field("relatedSystemId", String(relatedSystemId))
        .field("requestedPriority", "LOW")
        .field("summary", "Storage failure test")
        .field("description", "This request must not persist when storage is unavailable.")
        .attach("attachments", Buffer.from("%PDF-1.7\nstorage"), {
          filename: "storage.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "TICKET_CREATE_FAILED",
          message: "Ticket could not be created.",
        },
      });
      expect(await prisma.ticket.count()).toBe(beforeCount);
    } finally {
      if (previousStorageDir === undefined) {
        delete process.env.ATTACHMENT_STORAGE_DIR;
      } else {
        process.env.ATTACHMENT_STORAGE_DIR = previousStorageDir;
      }
      await rm(blockedStoragePath, { force: true });
    }
  });

  it("allocates unique annual Ticket Numbers for concurrent creates", async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        request(app)
          .post("/api/tickets")
          .set("X-Requester-Id", String(requesterId))
          .field("categoryId", String(categoryId))
          .field("relatedSystemId", String(relatedSystemId))
          .field("requestedPriority", "MEDIUM")
          .field("summary", `Concurrent Ticket ${index}`)
          .field("description", "A concurrent Ticket allocation test request."),
      ),
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    const numbers = responses.map((response) => response.body.ticket.ticketNumber);
    expect(new Set(numbers).size).toBe(4);
    expect(numbers.every((number) => /^TKT-\d{4}-\d{6}$/.test(number))).toBe(true);
    createdTicketNumbers.push(...numbers);
  });
});
