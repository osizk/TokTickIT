import formidable, { type File as FormidableFile, type Fields, type Files } from "formidable";
import type { Request } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import {
  AttachmentValidationError,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
  type ValidatedAttachment,
} from "./attachment-validation.js";
import { getPrisma } from "./prisma.js";
import { validateTicketFields, type ValidatedTicketFields } from "./ticket-validation.js";

const MAX_ATTACHMENTS_PER_TICKET = 5;
const DEFAULT_ATTACHMENT_STORAGE_DIR = path.resolve(process.cwd(), "attachments");

export interface ApiErrorShape {
  statusCode: 400 | 404 | 409 | 413 | 415 | 500;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export class TicketApiError extends Error {
  constructor(public readonly details: ApiErrorShape) {
    super(details.message);
    this.name = "TicketApiError";
  }
}

interface ParsedAttachment {
  validated: ValidatedAttachment;
  buffer: Buffer;
}

interface StagedAttachment extends ParsedAttachment {
  stagedPath: string;
  finalPath: string;
  storedFilename: string;
}

interface SerializedAttachment {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
  removedByRequesterId: number | null;
}

type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    requester: true;
    category: true;
    relatedSystem: true;
    attachments: true;
  };
}>;

function apiError(
  statusCode: ApiErrorShape["statusCode"],
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): TicketApiError {
  return new TicketApiError({ statusCode, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
}

function parseRequesterId(request: Request): number {
  const header = request.header("X-Requester-Id");
  if (!header || !/^\d+$/.test(header)) {
    throw apiError(400, "REQUESTER_CONTEXT_REQUIRED", "A valid X-Requester-Id header is required.");
  }

  const requesterId = Number(header);
  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    throw apiError(400, "REQUESTER_CONTEXT_REQUIRED", "A valid X-Requester-Id header is required.");
  }

  return requesterId;
}

function normalizeFields(fields: Fields): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, values]) => [
      name,
      values && values.length === 1 ? values[0] : values ?? undefined,
    ]),
  );
}

function flattenFiles(files: Files): FormidableFile[] {
  const unknownFileFields = Object.keys(files).filter((name) => name !== "attachments");
  if (unknownFileFields.length > 0) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      attachments: "Files must use the attachments field.",
    });
  }

  const attachments = files.attachments ?? [];
  return Array.isArray(attachments) ? attachments : [attachments];
}

async function parseMultipart(request: Request): Promise<{ fields: Record<string, unknown>; files: ParsedAttachment[] }> {
  const buffers = new Map<string, Buffer[]>();
  const bufferKeys = new WeakMap<object, string>();
  const form = formidable({
    multiples: true,
    // Read one extra file so the service can return a validation error for a
    // six-file submission instead of treating the count as a transport limit.
    maxFiles: MAX_ATTACHMENTS_PER_TICKET + 1,
    maxFileSize: MAX_ATTACHMENT_BYTES,
    maxTotalFileSize: (MAX_ATTACHMENTS_PER_TICKET + 1) * MAX_ATTACHMENT_BYTES,
    maxFields: 20,
    maxFieldsSize: 64 * 1024,
    allowEmptyFiles: true,
    fileWriteStreamHandler: (file) => {
      const key = randomUUID();
      if (file) {
        bufferKeys.set(file, key);
      }
      const chunks: Buffer[] = [];
      buffers.set(key, chunks);
      return new Writable({
        write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
    },
  });

  let fields: Fields;
  let files: Files;
  try {
    [fields, files] = await form.parse(request);
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "httpCode" in error && (error as { httpCode?: unknown }).httpCode === 413 ? 413 : 400;
    const code = statusCode === 413 ? "ATTACHMENT_TOO_LARGE" : "MULTIPART_INVALID";
    const message = statusCode === 413 ? "Each attachment must be no larger than 5 MiB." : "Ticket form data could not be read.";
    throw apiError(statusCode, code, message);
  }

  const parsedAttachments: ParsedAttachment[] = [];
  for (const file of flattenFiles(files)) {
    const buffer = Buffer.concat(buffers.get(bufferKeys.get(file) ?? "") ?? []);
    try {
      parsedAttachments.push({
        buffer,
        validated: validateAttachment({
          name: file.originalFilename,
          mimeType: file.mimetype,
          buffer,
        }),
      });
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        throw apiError(error.statusCode, error.code, error.message);
      }
      throw error;
    }
  }

  return { fields: normalizeFields(fields), files: parsedAttachments };
}

function storageRoot(): string {
  const configured = process.env.ATTACHMENT_STORAGE_DIR?.trim();
  return configured ? path.resolve(configured) : DEFAULT_ATTACHMENT_STORAGE_DIR;
}

async function stageAttachments(attachments: ParsedAttachment[]): Promise<{ stagingDir: string | null; staged: StagedAttachment[] }> {
  if (attachments.length === 0) {
    return { stagingDir: null, staged: [] };
  }

  const root = storageRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const stagingDir = await mkdtemp(path.join(root, ".ticket-"));
  const staged: StagedAttachment[] = [];

  try {
    for (const attachment of attachments) {
      const id = randomUUID();
      const stagedPath = path.join(stagingDir, `${id}.upload`);
      const storedFilename = `${id}${attachment.validated.extension}`;
      const finalPath = path.join(root, storedFilename);
      await writeFile(stagedPath, attachment.buffer, { flag: "wx", mode: 0o600 });
      staged.push({ ...attachment, stagedPath, finalPath, storedFilename });
    }
    return { stagingDir, staged };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function removeCreatedFiles(stagingDir: string | null, staged: StagedAttachment[]): Promise<void> {
  await Promise.all(
    staged.flatMap((attachment) => [
      rm(attachment.stagedPath, { force: true }).catch(() => undefined),
      rm(attachment.finalPath, { force: true }).catch(() => undefined),
    ]),
  );
  if (stagingDir) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function allocateTicketNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ lastIssued: number }>>`
    INSERT INTO "TicketCounter" ("year", "lastIssued", "createdAt", "updatedAt")
    VALUES (${year}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("year") DO UPDATE
      SET "lastIssued" = "TicketCounter"."lastIssued" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastIssued"
  `;
  const issued = rows[0]?.lastIssued;
  if (!issued || !Number.isSafeInteger(issued) || issued < 1) {
    throw apiError(500, "TICKET_CREATE_FAILED", "Ticket could not be created.");
  }
  return `TKT-${year}-${String(issued).padStart(6, "0")}`;
}

function serializeAttachment(attachment: TicketWithRelations["attachments"][number]): SerializedAttachment {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedAt: attachment.uploadedAt,
    removedAt: attachment.removedAt,
    removalReason: attachment.removalReason,
    removedByRequesterId: attachment.removedByRequesterId,
  };
}

function serializeTicket(ticket: TicketWithRelations) {
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
    attachments: ticket.attachments.map(serializeAttachment),
  };
}

async function createTicketInTransaction(
  prisma: PrismaClient,
  requesterId: number,
  fields: ValidatedTicketFields,
  staged: StagedAttachment[],
): Promise<{ ticket: ReturnType<typeof serializeTicket>; attachments: SerializedAttachment[] }> {
  return prisma.$transaction(async (tx) => {
    const requester = await tx.requester.findFirst({ where: { id: requesterId, isActive: true } });
    if (!requester) {
      throw apiError(404, "REQUESTER_NOT_FOUND", "Development Requester was not found.");
    }

    const [category, relatedSystem] = await Promise.all([
      tx.category.findFirst({ where: { id: fields.categoryId, isActive: true } }),
      tx.relatedSystem.findFirst({ where: { id: fields.relatedSystemId, isActive: true } }),
    ]);
    const referenceErrors: Record<string, string> = {};
    if (!category) referenceErrors.categoryId = "Category is unavailable.";
    if (!relatedSystem) referenceErrors.relatedSystemId = "Related System is unavailable.";
    if (Object.keys(referenceErrors).length > 0) {
      throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", referenceErrors);
    }

    const year = new Date().getUTCFullYear();
    const ticketNumber = await allocateTicketNumber(tx, year);
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: fields.categoryId,
        relatedSystemId: fields.relatedSystemId,
        requestedPriority: fields.requestedPriority,
        summary: fields.summary,
        description: fields.description,
      },
    });

    for (const attachment of staged) {
      await tx.attachment.create({
        data: {
          ticketId: ticket.id,
          originalName: attachment.validated.originalName,
          mimeType: attachment.validated.mimeType,
          sizeBytes: attachment.validated.sizeBytes,
          storedFilename: attachment.storedFilename,
        },
      });
    }

    for (const attachment of staged) {
      await rename(attachment.stagedPath, attachment.finalPath);
    }

    const complete = await tx.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: { requester: true, category: true, relatedSystem: true, attachments: true },
    });
    const serialized = serializeTicket(complete);
    return { ticket: serialized, attachments: serialized.attachments };
  });
}

export async function createTicketFromMultipart(request: Request) {
  const requesterId = parseRequesterId(request);
  const { fields, files } = await parseMultipart(request);
  const fieldResult = validateTicketFields(fields);
  if (!fieldResult.ok) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", fieldResult.fieldErrors);
  }
  if (files.length > MAX_ATTACHMENTS_PER_TICKET) {
    throw apiError(400, "VALIDATION_ERROR", "A Ticket may include at most five attachments.", {
      attachments: "A Ticket may include at most five attachments.",
    });
  }

  let stagingDir: string | null = null;
  let staged: StagedAttachment[] = [];
  try {
    ({ stagingDir, staged } = await stageAttachments(files));
    const result = await createTicketInTransaction(getPrisma(), requesterId, fieldResult.value, staged);
    if (stagingDir) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    }
    return result;
  } catch (error) {
    await removeCreatedFiles(stagingDir, staged);
    if (error instanceof TicketApiError) {
      throw error;
    }
    if (error instanceof AttachmentValidationError) {
      throw apiError(error.statusCode, error.code, error.message);
    }
    throw apiError(500, "TICKET_CREATE_FAILED", "Ticket could not be created.");
  }
}

export function toApiError(error: unknown): ApiErrorShape {
  if (error instanceof TicketApiError) {
    return error.details;
  }
  return { statusCode: 500, code: "INTERNAL_ERROR", message: "The server could not complete the request." };
}

export const ticketServiceLimits = {
  maxAttachments: MAX_ATTACHMENTS_PER_TICKET,
  maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
};
