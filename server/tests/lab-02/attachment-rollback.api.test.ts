import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const fsMockState = vi.hoisted(() => ({ renameCalls: 0 }));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    rename: vi.fn(async (source: string, destination: string) => {
      fsMockState.renameCalls += 1;
      if (fsMockState.renameCalls === 1) {
        throw new Error("forced attachment post-row filesystem failure");
      }
      return actual.rename(source, destination);
    }),
  };
});

import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets/:ticketNumber/attachments filesystem compensation", () => {
  let storageDir: string;
  let requesterId: number;
  let ticketNumber: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "toktickit-lab2-attachment-rollback-"));
    process.env.ATTACHMENT_STORAGE_DIR = storageDir;
    const prisma = getPrisma();
    const requester = await prisma.requester.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    if (!requester || !category || !relatedSystem) {
      throw new Error("Lab 2 seed data is required before running attachment rollback tests.");
    }
    requesterId = requester.id;
    ticketNumber = `TKT-${new Date().getUTCFullYear()}-${String(Date.now() % 1_000_000).padStart(6, "0")}`;
    await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "LOW",
        summary: "Attachment rollback fixture",
        description: "A direct Ticket fixture for post-row attachment compensation.",
      },
    });
  });

  beforeEach(() => {
    fsMockState.renameCalls = 0;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({ where: { ticketNumber } });
    await rm(storageDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("rolls back Attachment metadata and removes staged/final files when the move fails", async () => {
    const prisma = getPrisma();
    const beforeFiles = await readdir(storageDir);
    const response = await request(app)
      .post(`/api/tickets/${ticketNumber}/attachments`)
      .set("X-Requester-Id", String(requesterId))
      .attach("file", Buffer.from("%PDF-1.7\nrollback"), { filename: "rollback.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_CREATE_FAILED",
      message: "Attachment could not be created.",
    });
    expect(fsMockState.renameCalls).toBe(1);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber } });
    expect(await prisma.attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect(await readdir(storageDir)).toEqual(beforeFiles);
  });
});
