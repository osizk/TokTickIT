import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";
import { storageRoot } from "../../src/ticket-service.js";

const password = "Issue37-Operations!2026";
const suffix = `${process.pid}-${Date.now()}`;
const staffAEmail = `lab3-ops-staff-a-${suffix}@example.test`;
const staffBEmail = `lab3-ops-staff-b-${suffix}@example.test`;
const inactiveStaffEmail = `lab3-ops-inactive-${suffix}@example.test`;
const requesterEmail = `lab3-ops-requester-${suffix}@example.test`;
const ticketNumber = `TKT-2094-${String((process.pid + 731) % 1_000_000).padStart(6, "0")}`;

let staffAId: number;
let staffBId: number;
let inactiveStaffId: number;
let requesterId: number;
let staffA: ReturnType<typeof request.agent>;
let requester: ReturnType<typeof request.agent>;
let staffACsrf: string;
let requesterCsrf: string;
let attachmentId: number;
const storedFilename = `issue37-${suffix}.pdf`;

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
  await prisma.session.deleteMany({ where: { user: { email: { in: [staffAEmail, staffBEmail, inactiveStaffEmail, requesterEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [staffAEmail, staffBEmail, inactiveStaffEmail, requesterEmail] } } });
  if (requesterRow) await prisma.requester.delete({ where: { id: requesterRow.id } });
  await rm(`${storageRoot()}\\${storedFilename}`, { force: true }).catch(() => undefined);
}

describe("Lab 3 Staff Ticket operations API", () => {
  beforeAll(async () => {
    await cleanup();
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    const requesterRow = await prisma.requester.create({ data: { name: "Operations Requester", email: requesterEmail, isActive: true } });
    requesterId = requesterRow.id;
    const [staffARow, staffBRow, inactiveRow, requesterUser] = await Promise.all([
      prisma.user.create({ data: { name: "Operations Staff A", email: staffAEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Operations Staff B", email: staffBEmail, passwordHash: await hashPassword(password), role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Inactive Operations Staff", email: inactiveStaffEmail, passwordHash: await hashPassword(password), role: "IT_STAFF", isActive: false, mustChangePassword: false } }),
      prisma.user.create({ data: { name: requesterRow.name, email: requesterEmail, passwordHash: await hashPassword(password), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: requesterRow.id } }),
    ]);
    staffAId = staffARow.id;
    staffBId = staffBRow.id;
    inactiveStaffId = inactiveRow.id;
    await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "HIGH",
        itPriority: "LOW",
        status: "NEW",
        summary: "Operations fixture ticket",
        description: "A ticket used to verify staff operations and ownership rules.",
      },
    });
    await mkdir(storageRoot(), { recursive: true });
    await writeFile(`${storageRoot()}\\${storedFilename}`, Buffer.from("%PDF-1.7 issue37 fixture"));
    const createdAttachment = await prisma.attachment.create({ data: { ticketId: (await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber }, select: { id: true } })).id, originalName: "issue37-evidence.pdf", mimeType: "application/pdf", sizeBytes: 23, storedFilename } });
    attachmentId = createdAttachment.id;
    ({ agent: staffA, csrfToken: staffACsrf } = await login(staffAEmail));
    ({ agent: requester, csrfToken: requesterCsrf } = await login(requesterEmail));
    void requesterUser;
  });

  afterAll(async () => {
    await cleanup();
    await getPrisma().$disconnect();
  });

  it("assigns, reassigns, and unassigns only active eligible staff", async () => {
    const assigned = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/assignment`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ ownerUserId: staffBId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ticket.ticketOwner.id).toBe(staffBId);

    const missingConfirmation = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/assignment`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ ownerUserId: staffAId });
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error.code).toBe("VALIDATION_ERROR");

    const inactive = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/assignment`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ ownerUserId: inactiveStaffId, confirm: true });
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.code).toBe("ASSIGNMENT_CONFLICT");

    const unassigned = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/assignment`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ ownerUserId: null, confirm: true });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.ticket.ticketOwner).toBeNull();
  });

  it("updates IT Priority without changing immutable Requested Priority", async () => {
    const response = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/priority`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ itPriority: "URGENT" });
    expect(response.status).toBe(200);
    expect(response.body.ticket).toMatchObject({ requestedPriority: "HIGH", itPriority: "URGENT" });

    const invalid = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/priority`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ itPriority: "CRITICAL" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("enforces the status transition matrix and confirmation rules", async () => {
    const open = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/status`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ status: "OPEN" });
    expect(open.status).toBe(200);

    const needsConfirmation = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/status`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ status: "RESOLVED" });
    expect(needsConfirmation.status).toBe(400);
    expect(needsConfirmation.body.error.code).toBe("VALIDATION_ERROR");

    const resolved = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/status`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ status: "RESOLVED", confirm: true });
    expect(resolved.status).toBe(200);

    const indication = await requester
      .post(`/api/tickets/${ticketNumber}/resolution-indication`)
      .set("X-CSRF-Token", requesterCsrf)
      .send({});
    expect(indication.status).toBe(200);
    expect(indication.body.resolutionIndication).toBeTruthy();

    const invalid = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/status`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ status: "IN_PROGRESS" });
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const reopened = await staffA
      .patch(`/api/staff/tickets/${ticketNumber}/status`)
      .set("X-CSRF-Token", staffACsrf)
      .send({ status: "REOPENED", confirm: true });
    expect(reopened.status).toBe(200);
    expect(reopened.body.ticket.resolutionIndication).toBeNull();
  });

  it("preserves attachment read continuity for staff and protects mutations by role", async () => {
    const attachments = await staffA.get(`/api/tickets/${ticketNumber}/attachments`);
    expect(attachments.status).toBe(200);
    expect(attachments.body.attachments).toMatchObject([{ id: attachmentId, originalName: "issue37-evidence.pdf", mimeType: "application/pdf", removedAt: null }]);
    const download = await staffA.get(`/api/tickets/${ticketNumber}/attachments/${attachmentId}/download`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
    expect(download.body.toString()).toContain("%PDF-1.7");

    const requesterRead = await requester.get(`/api/tickets/${ticketNumber}/attachments`);
    expect(requesterRead.status).toBe(200);
    const removed = await requester
      .delete(`/api/tickets/${ticketNumber}/attachments/${attachmentId}`)
      .set("X-CSRF-Token", requesterCsrf)
      .send({ removalReason: "No longer needed." });
    expect(removed.status).toBe(200);
    expect(removed.body.attachment.removedAt).toBeTruthy();
    expect((await staffA.get(`/api/tickets/${ticketNumber}/attachments/${attachmentId}/download`)).status).toBe(404);
    const requesterMutation = await requester
      .patch(`/api/staff/tickets/${ticketNumber}/assignment`)
      .set("X-CSRF-Token", "invalid")
      .send({ ownerUserId: staffAId });
    expect(requesterMutation.status).toBe(403);
  });
});
