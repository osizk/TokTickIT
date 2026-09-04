import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const pdf = (label: string) => Buffer.from(`%PDF-1.7\n${label}`);

describe("Ticket attachment lifecycle", () => {
  let storageDir: string;
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketNumber: string;
  let initialAttachmentId: number;
  const activeAttachmentIds: number[] = [];
  const createdTicketNumbers: string[] = [];

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "toktickit-lab2-attachments-detail-"));
    process.env.ATTACHMENT_STORAGE_DIR = storageDir;
    const prisma = getPrisma();
    const requesters = await prisma.requester.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 });
    const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    if (requesters.length < 2 || !category || !system) {
      throw new Error("Lab 2 seed data is required before running attachment tests.");
    }
    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
    categoryId = category.id;
    relatedSystemId = system.id;

    const created = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterA))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "MEDIUM")
      .field("summary", "Attachment lifecycle test")
      .field("description", "A Ticket used to exercise attachment upload, download, and removal.")
      .attach("attachments", pdf("initial"), { filename: "initial.pdf", contentType: "application/pdf" });
    expect(created.status).toBe(201);
    ticketNumber = created.body.ticket.ticketNumber;
    initialAttachmentId = created.body.attachments[0].id;
    activeAttachmentIds.push(initialAttachmentId);
    createdTicketNumbers.push(ticketNumber);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const tickets = await prisma.ticket.findMany({ where: { ticketNumber: { in: createdTicketNumbers } }, select: { id: true } });
    if (tickets.length > 0) {
      await prisma.attachment.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
      await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
    }
    await rm(storageDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("adds a valid attachment and downloads exact bytes with safe headers", async () => {
    const upload = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", pdf("added"), { filename: "added.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201);
    expect(upload.body.attachment).toMatchObject({ originalName: "added.pdf", mimeType: "application/pdf" });
    expect(upload.body.attachment).not.toHaveProperty("storedFilename");
    const addedId = upload.body.attachment.id as number;
    activeAttachmentIds.push(addedId);

    const download = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments/${addedId}/download`)
      .set("X-Requester-Id", String(requesterA));
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain("added.pdf");
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
    expect(download.body).toEqual(pdf("added"));
  });

  it("soft-removes an attachment, retains audit metadata, blocks download, and rejects repeat removal", async () => {
    const id = activeAttachmentIds[1];
    const removed = await request(app)
      .delete(`/api/tickets/${ticketNumber}/attachments/${id}`)
      .set("X-Requester-Id", String(requesterA))
      .send({ removalReason: "No longer needed for testing." });
    expect(removed.status).toBe(200);
    expect(removed.body.attachment).toMatchObject({
      id,
      removedAt: expect.any(String),
      removalReason: "No longer needed for testing.",
      removedByRequesterId: requesterA,
    });
    expect(removed.body.attachment).not.toHaveProperty("storedFilename");

    const blockedDownload = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments/${id}/download`)
      .set("X-Requester-Id", String(requesterA));
    expect(blockedDownload.status).toBe(404);
    const metadata = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA));
    expect(metadata.status).toBe(200);
    expect(metadata.body.attachments.find((attachment: { id: number }) => attachment.id === id)).toMatchObject({
      id,
      originalName: "added.pdf",
      removedAt: expect.any(String),
      removalReason: "No longer needed for testing.",
      removedByRequesterId: requesterA,
    });
    const repeat = await request(app)
      .delete(`/api/tickets/${ticketNumber}/attachments/${id}`)
      .set("X-Requester-Id", String(requesterA))
      .send({ removalReason: "Second removal attempt." });
    expect(repeat.status).toBe(409);
    expect(repeat.body.error.code).toBe("ATTACHMENT_ALREADY_REMOVED");
  });

  it("rejects short or unsupported removal reasons without changing metadata", async () => {
    const before = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA));
    const invalid = await request(app)
      .delete(`/api/tickets/${ticketNumber}/attachments/${initialAttachmentId}`)
      .set("X-Requester-Id", String(requesterA))
      .send({ removalReason: "no", unexpected: "field" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    const after = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA));
    expect(after.body.attachments).toEqual(before.body.attachments);
  });

  it("returns a structured safe error for malformed JSON removal requests", async () => {
    const response = await request(app)
      .delete(`/api/tickets/${ticketNumber}/attachments/${initialAttachmentId}`)
      .set("X-Requester-Id", String(requesterA))
      .set("Content-Type", "application/json")
      .send('{"removalReason":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "REQUEST_BODY_INVALID",
        message: "Request body could not be read.",
      },
    });
  });

  it("enforces five active attachments and allows a slot after removal", async () => {
    const addedIds: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const response = await request(app)
        .post(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Requester-Id", String(requesterA))
        .attach("file", pdf(`capacity-${index}`), { filename: `capacity-${index}.pdf`, contentType: "application/pdf" });
      expect(response.status).toBe(201);
      addedIds.push(response.body.attachment.id);
      activeAttachmentIds.push(response.body.attachment.id);
    }
    const full = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", pdf("full"), { filename: "full.pdf", contentType: "application/pdf" });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");

    const removed = await request(app)
      .delete(`/api/tickets/${ticketNumber}/attachments/${addedIds[0]}`)
      .set("X-Requester-Id", String(requesterA))
      .send({ removalReason: "Free this attachment slot." });
    expect(removed.status).toBe(200);
    const replacement = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", pdf("replacement"), { filename: "replacement.pdf", contentType: "application/pdf" });
    expect(replacement.status).toBe(201);
  });

  it("rejects mismatched and oversized files before persistence", async () => {
    const mismatch = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", Buffer.from("not a pdf"), { filename: "bad.pdf", contentType: "application/pdf" });
    expect(mismatch.status).toBe(415);
    expect(mismatch.body.error.code).toBe("UNSUPPORTED_ATTACHMENT");

    const oversized = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, 0x41), { filename: "large.pdf", contentType: "application/pdf" });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("ATTACHMENT_TOO_LARGE");
  });

  it("returns safe 404s for cross-requester attachment access", async () => {
    const metadata = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterB));
    const upload = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterB))
      .attach("file", pdf("cross"), { filename: "cross.pdf", contentType: "application/pdf" });
    const download = await request(app)
      .get(`/api/tickets/${ticketNumber}/attachments/${initialAttachmentId}/download`)
      .set("X-Requester-Id", String(requesterB));
    const remove = await request(app)
      .delete(`/api/tickets/${ticketNumber}/attachments/${initialAttachmentId}`)
      .set("X-Requester-Id", String(requesterB))
      .send({ removalReason: "Cross requester must not remove." });
    expect(metadata.status).toBe(404);
    expect(upload.status).toBe(404);
    expect(download.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(metadata.body.error).toEqual({ code: "TICKET_NOT_FOUND", message: "Ticket was not found." });
  });

  it("returns a safe failure without creating metadata when storage is unavailable", async () => {
    const blockedStoragePath = path.join(os.tmpdir(), `toktickit-lab2-attachment-storage-${Date.now()}`);
    await writeFile(blockedStoragePath, "storage path is intentionally a file", { flag: "wx" });
    const previousStorageDir = process.env.ATTACHMENT_STORAGE_DIR;
    process.env.ATTACHMENT_STORAGE_DIR = blockedStoragePath;
    try {
      const response = await request(app)
        .post(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Requester-Id", String(requesterA))
        .attach("file", pdf("storage failure"), { filename: "storage.pdf", contentType: "application/pdf" });
      expect(response.status).toBe(500);
      expect(response.body.error).toEqual({ code: "ATTACHMENT_CREATE_FAILED", message: "Attachment could not be created." });
    } finally {
      if (previousStorageDir === undefined) delete process.env.ATTACHMENT_STORAGE_DIR;
      else process.env.ATTACHMENT_STORAGE_DIR = previousStorageDir;
      await rm(blockedStoragePath, { force: true });
    }
  });
});
