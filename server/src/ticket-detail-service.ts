import type { Request } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  parseMultipart,
  parseRequesterId,
  removeCreatedFiles,
  serializeAttachment,
  stageAttachments,
  storageRoot,
  TicketApiError,
  type StagedAttachment,
} from "./ticket-service.js";
import { getPrisma } from "./prisma.js";

const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/;
const MAX_ATTACHMENTS_PER_TICKET = 5;

type TicketDetailPayload = Prisma.TicketGetPayload<{
  include: {
    requester: true;
    category: true;
    relatedSystem: true;
  };
}>;

type DbClient = PrismaClient | Prisma.TransactionClient;

function apiError(
  statusCode: 400 | 404 | 409 | 413 | 415 | 500,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): TicketApiError {
  return new TicketApiError({ statusCode, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
}

function ensureTicketNumber(ticketNumber: string): string {
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
    throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  }
  return ticketNumber;
}

function parseAttachmentId(rawAttachmentId: string): number {
  if (!/^\d+$/.test(rawAttachmentId)) {
    throw apiError(404, "ATTACHMENT_NOT_FOUND", "Attachment was not found.");
  }
  const attachmentId = Number(rawAttachmentId);
  if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
    throw apiError(404, "ATTACHMENT_NOT_FOUND", "Attachment was not found.");
  }
  return attachmentId;
}

async function requireActiveRequester(db: DbClient, requesterId: number): Promise<void> {
  const requester = await db.requester.findFirst({
    where: { id: requesterId, isActive: true },
    select: { id: true },
  });
  if (!requester) {
    throw apiError(404, "REQUESTER_NOT_FOUND", "Development Requester was not found.");
  }
}

async function findOwnedTicket(
  db: DbClient,
  requesterId: number,
  ticketNumber: string,
): Promise<TicketDetailPayload> {
  const normalizedNumber = ensureTicketNumber(ticketNumber);
  const ticket = await db.ticket.findFirst({
    where: { ticketNumber: normalizedNumber, requesterId },
    include: { requester: true, category: true, relatedSystem: true },
  });
  if (!ticket) {
    throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  }
  return ticket;
}

function serializeTicketDetail(ticket: TicketDetailPayload) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    requester: {
      id: ticket.requester.id,
      name: ticket.requester.name,
      email: ticket.requester.email,
    },
    category: { id: ticket.category.id, name: ticket.category.name },
    relatedSystem: { id: ticket.relatedSystem.id, name: ticket.relatedSystem.name },
    requestedPriority: ticket.requestedPriority,
    status: ticket.status,
    summary: ticket.summary,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export async function getTicketDetail(request: Request, ticketNumber: string) {
  const requesterId = parseRequesterId(request);
  const db = getPrisma();
  await requireActiveRequester(db, requesterId);
  const ticket = await findOwnedTicket(db, requesterId, ticketNumber);
  return { ticket: serializeTicketDetail(ticket) };
}

export async function getTicketAttachments(request: Request, ticketNumber: string) {
  const requesterId = parseRequesterId(request);
  const db = getPrisma();
  await requireActiveRequester(db, requesterId);
  const ticket = await findOwnedTicket(db, requesterId, ticketNumber);
  const attachments = await db.attachment.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
  });
  return { attachments: attachments.map(serializeAttachment) };
}

function validateMultipartFields(fields: Record<string, unknown>): void {
  if (Object.keys(fields).length > 0) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      file: "Only one file may be uploaded at a time.",
    });
  }
}

async function createAttachmentInTransaction(
  db: PrismaClient,
  requesterId: number,
  ticketNumber: string,
  staged: StagedAttachment,
) {
  return db.$transaction(async (tx) => {
    await requireActiveRequester(tx, requesterId);
    const ticket = await tx.ticket.findFirst({
      where: { ticketNumber: ensureTicketNumber(ticketNumber), requesterId },
      select: { id: true },
    });
    if (!ticket) {
      throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
    }

    // Serialize concurrent additions for the same Ticket before counting
    // active rows, so two requests cannot both consume the fifth slot.
    await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "Ticket" WHERE "id" = ${ticket.id} FOR UPDATE
    `;
    const activeCount = await tx.attachment.count({ where: { ticketId: ticket.id, removedAt: null } });
    if (activeCount >= MAX_ATTACHMENTS_PER_TICKET) {
      throw apiError(409, "ATTACHMENT_LIMIT_REACHED", "A Ticket may have at most five active attachments.");
    }

    const attachment = await tx.attachment.create({
      data: {
        ticketId: ticket.id,
        originalName: staged.validated.originalName,
        mimeType: staged.validated.mimeType,
        sizeBytes: staged.validated.sizeBytes,
        storedFilename: staged.storedFilename,
      },
    });

    await rename(staged.stagedPath, staged.finalPath);
    return { attachment: serializeAttachment(attachment) };
  });
}

export async function addTicketAttachment(request: Request, ticketNumber: string) {
  const requesterId = parseRequesterId(request);
  const db = getPrisma();
  await requireActiveRequester(db, requesterId);
  // Resolve ownership before parsing/staging bytes so cross-requester Tickets
  // receive the same safe not-found response even for malformed uploads.
  await findOwnedTicket(db, requesterId, ticketNumber);

  const { fields, files } = await parseMultipart(request, "file");
  validateMultipartFields(fields);
  if (files.length !== 1) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      file: "Exactly one file is required.",
    });
  }

  let stagingDir: string | null = null;
  let staged: StagedAttachment[] = [];
  try {
    ({ stagingDir, staged } = await stageAttachments(files));
    const result = await createAttachmentInTransaction(db, requesterId, ticketNumber, staged[0]);
    if (stagingDir) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    }
    return result;
  } catch (error) {
    await removeCreatedFiles(stagingDir, staged);
    if (error instanceof TicketApiError) {
      throw error;
    }
    throw apiError(500, "ATTACHMENT_CREATE_FAILED", "Attachment could not be created.");
  }
}

export async function downloadTicketAttachment(
  request: Request,
  ticketNumber: string,
  rawAttachmentId: string,
) {
  const requesterId = parseRequesterId(request);
  const db = getPrisma();
  await requireActiveRequester(db, requesterId);
  const ticket = await findOwnedTicket(db, requesterId, ticketNumber);
  const attachmentId = parseAttachmentId(rawAttachmentId);
  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId, ticketId: ticket.id, removedAt: null },
  });
  if (!attachment) {
    throw apiError(404, "ATTACHMENT_NOT_FOUND", "Attachment was not found.");
  }

  const root = path.resolve(storageRoot());
  const filePath = path.resolve(root, attachment.storedFilename);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw apiError(500, "ATTACHMENT_DOWNLOAD_FAILED", "Attachment could not be downloaded.");
  }

  let body: Buffer;
  try {
    body = await readFile(filePath);
  } catch {
    throw apiError(500, "ATTACHMENT_DOWNLOAD_FAILED", "Attachment could not be downloaded.");
  }
  return {
    body,
    mimeType: attachment.mimeType,
    originalName: attachment.originalName,
  };
}

function readRemovalReason(request: Request): string {
  const body = request.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      removalReason: "Removal reason is required.",
    });
  }
  const record = body as Record<string, unknown>;
  const unsupportedField = Object.keys(record).find((key) => key !== "removalReason");
  if (unsupportedField) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      [unsupportedField]: "This field is not supported.",
    });
  }
  const reason = typeof record.removalReason === "string" ? record.removalReason.trim() : "";
  if (reason.length < 5 || reason.length > 250) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      removalReason: "Removal reason must be 5–250 characters after trimming.",
    });
  }
  return reason;
}

export async function removeTicketAttachment(
  request: Request,
  ticketNumber: string,
  rawAttachmentId: string,
) {
  const requesterId = parseRequesterId(request);
  const db = getPrisma();
  await requireActiveRequester(db, requesterId);
  // Check the owner before validating the requested row/body so inaccessible
  // Tickets cannot be distinguished through input-validation differences.
  await findOwnedTicket(db, requesterId, ticketNumber);
  const attachmentId = parseAttachmentId(rawAttachmentId);
  const removalReason = readRemovalReason(request);

  return db.$transaction(async (tx) => {
    await requireActiveRequester(tx, requesterId);
    const ticket = await tx.ticket.findFirst({
      where: { ticketNumber: ensureTicketNumber(ticketNumber), requesterId },
      select: { id: true },
    });
    if (!ticket) {
      throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
    }
    await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "Ticket" WHERE "id" = ${ticket.id} FOR UPDATE
    `;
    const attachment = await tx.attachment.findFirst({
      where: { id: attachmentId, ticketId: ticket.id },
    });
    if (!attachment) {
      throw apiError(404, "ATTACHMENT_NOT_FOUND", "Attachment was not found.");
    }
    if (attachment.removedAt) {
      throw apiError(409, "ATTACHMENT_ALREADY_REMOVED", "Attachment has already been removed.");
    }

    const updated = await tx.attachment.updateMany({
      where: { id: attachmentId, ticketId: ticket.id, removedAt: null },
      data: {
        removedAt: new Date(),
        removalReason,
        removedByRequesterId: requesterId,
      },
    });
    if (updated.count !== 1) {
      throw apiError(409, "ATTACHMENT_ALREADY_REMOVED", "Attachment has already been removed.");
    }
    const removed = await tx.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
    return { attachment: serializeAttachment(removed) };
  });
}
