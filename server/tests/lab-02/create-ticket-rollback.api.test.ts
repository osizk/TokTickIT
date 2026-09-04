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
      if (fsMockState.renameCalls === 2) {
        throw new Error("forced post-row filesystem failure");
      }
      return actual.rename(source, destination);
    }),
  };
});

import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets filesystem compensation", () => {
  let storageDir: string;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "toktickit-lab2-rollback-"));
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

  beforeEach(() => {
    fsMockState.renameCalls = 0;
  });

  afterAll(async () => {
    await rm(storageDir, { recursive: true, force: true });
    await getPrisma().$disconnect();
  });

  it("rolls back Ticket rows and removes staged/final files when a post-row move fails", async () => {
    const prisma = getPrisma();
    const beforeCount = await prisma.ticket.count();
    const beforeFiles = await readdir(storageDir);

    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .field("categoryId", String(categoryId))
      .field("relatedSystemId", String(relatedSystemId))
      .field("requestedPriority", "HIGH")
      .field("summary", "Forced rollback test")
      .field("description", "The second final file move is forced to fail after rows are created.")
      .attach("attachments", Buffer.from("%PDF-1.7\nfirst"), {
        filename: "first.pdf",
        contentType: "application/pdf",
      })
      .attach("attachments", Buffer.from("%PDF-1.7\nsecond"), {
        filename: "second.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "TICKET_CREATE_FAILED",
        message: "Ticket could not be created.",
      },
    });
    expect(fsMockState.renameCalls).toBe(2);
    expect(await prisma.ticket.count()).toBe(beforeCount);
    expect(await readdir(storageDir)).toEqual(beforeFiles);
  });
});
