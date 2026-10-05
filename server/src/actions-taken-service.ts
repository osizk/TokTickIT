import { createHash } from "node:crypto";
import type { ActionStatus, Prisma, PrismaClient, TicketStatus } from "@prisma/client";
import type { AuthContext } from "./auth-service.js";
import { requireRole } from "./auth-service.js";
import { getPrisma } from "./prisma.js";
import { TicketApiError } from "./ticket-service.js";
import { validateCreateAction, validatePatchAction, type ValidatedCreateAction, type ValidatedPatchAction } from "./action-validation.js";
import { isAllowedActionTransition, isActionTransitionBlockedByTicket } from "./workflow-rules.js";

const TICKET_NUMBER = /^TKT-\d{4}-\d{6}$/;
const ACTION_ID = /^\d+$/;
const PAGE_SIZES = [10, 25, 50] as const;
const ACTION_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  performedBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ActionTakenInclude;

type ActionWithActors = Prisma.ActionTakenGetPayload<{ include: typeof ACTION_INCLUDE }>;
type ReaderTicket = { id: number; ticketNumber: string; requesterId: number; status: TicketStatus; workflowVersion: number };
type ActionTx = Prisma.TransactionClient;

export interface ActionListQuery {
  page?: unknown;
  pageSize?: unknown;
}

export interface ActionPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

function apiError(statusCode: 400 | 404 | 409 | 500, code: string, message: string, fieldErrors?: Record<string, string>): TicketApiError {
  return new TicketApiError({ statusCode, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
}

function toTicket404(): TicketApiError {
  return apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
}

function parseTicketNumber(value: string): string {
  if (!TICKET_NUMBER.test(value)) throw toTicket404();
  return value;
}

function parseActionId(value: string): number {
  if (!ACTION_ID.test(value)) throw apiError(404, "ACTION_NOT_FOUND", "Action was not found.");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw apiError(404, "ACTION_NOT_FOUND", "Action was not found.");
  return id;
}

function pageValue(value: unknown, defaultValue: number, field: string): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw apiError(400, "VALIDATION_ERROR", "Check the query parameters.", { [field]: "Enter a valid positive integer." });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw apiError(400, "VALIDATION_ERROR", "Check the query parameters.", { [field]: "Enter a valid positive integer." });
  }
  return parsed;
}

function parsePagination(query: ActionListQuery): { page: number; pageSize: (typeof PAGE_SIZES)[number] } {
  const page = pageValue(query.page, 1, "page");
  const rawPageSize = pageValue(query.pageSize, 25, "pageSize");
  if (!PAGE_SIZES.includes(rawPageSize as (typeof PAGE_SIZES)[number])) {
    throw apiError(400, "VALIDATION_ERROR", "Check the query parameters.", { pageSize: "Page size must be 10, 25, or 50." });
  }
  return { page, pageSize: rawPageSize as (typeof PAGE_SIZES)[number] };
}

function requesterScope(context: AuthContext): number | undefined {
  if (context.user.role !== "REQUESTER") return undefined;
  if (!context.user.legacyRequesterId) throw toTicket404();
  return context.user.legacyRequesterId;
}

async function findReaderTicket(
  client: PrismaClient | ActionTx,
  context: AuthContext,
  rawTicketNumber: string,
): Promise<ReaderTicket> {
  const ticketNumber = parseTicketNumber(rawTicketNumber);
  const requesterId = requesterScope(context);
  const ticket = await client.ticket.findFirst({
    where: { ticketNumber, ...(requesterId !== undefined ? { requesterId } : {}) },
    select: { id: true, ticketNumber: true, requesterId: true, status: true, workflowVersion: true },
  });
  if (!ticket) throw toTicket404();
  return ticket;
}

function identity(user: { id: number; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function serializeAction(action: ActionWithActors, ticketNumber: string) {
  return {
    id: action.id,
    ticketNumber,
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    status: action.status,
    cancellationReason: action.cancellationReason,
    assignee: identity(action.assignee),
    createdBy: identity(action.createdBy),
    performedBy: action.performedBy ? identity(action.performedBy) : null,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    completedAt: action.completedAt,
    cancelledAt: action.cancelledAt,
    version: action.version,
  };
}

function serializeRevision(revision: {
  id: number;
  actionId: number;
  revisionNumber: number;
  actor: { id: number; name: string; email: string; role: string };
  changedAt: Date;
  snapshot: Prisma.JsonValue;
}) {
  return {
    id: revision.id,
    actionId: revision.actionId,
    revisionNumber: revision.revisionNumber,
    actor: identity(revision.actor),
    changedAt: revision.changedAt,
    snapshot: revision.snapshot,
  };
}

function pagination(page: number, pageSize: number, totalItems: number): ActionPagination {
  const totalPages = Math.ceil(totalItems / pageSize);
  return { page, pageSize, totalItems, totalPages, hasPreviousPage: page > 1, hasNextPage: page < totalPages };
}

function parseQueryKeys(query: Record<string, unknown>, allowed: Set<string>) {
  const unknown = Object.keys(query).find((key) => !allowed.has(key));
  if (unknown) throw apiError(400, "VALIDATION_ERROR", "Check the query parameters.", { [unknown]: "This query parameter is not supported." });
  const repeated = Object.keys(query).find((key) => Array.isArray(query[key]));
  if (repeated) throw apiError(400, "VALIDATION_ERROR", "Check the query parameters.", { [repeated]: "This query parameter may appear only once." });
}

export async function listActionsTaken(context: AuthContext, rawTicketNumber: string, query: ActionListQuery) {
  const { page, pageSize } = parsePagination(query);
  const prisma = getPrisma();
  try {
    const ticket = await findReaderTicket(prisma, context, rawTicketNumber);
    const where = { ticketId: ticket.id };
    const [rows, totalItems] = await Promise.all([
      prisma.actionTaken.findMany({
        where,
        include: ACTION_INCLUDE,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.actionTaken.count({ where }),
    ]);
    return {
      actions: rows.map((row) => serializeAction(row, ticket.ticketNumber)),
      pagination: pagination(page, pageSize, totalItems),
      ticketVersion: ticket.workflowVersion,
    };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw apiError(500, "ACTION_LIST_FAILED", "Actions could not be loaded.");
  }
}

function captureSnapshot(action: {
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  status: ActionStatus;
  cancellationReason: string | null;
  assigneeUserId: number;
  createdByUserId: number;
  performedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  version: number;
}) {
  return {
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    status: action.status,
    cancellationReason: action.cancellationReason,
    assigneeUserId: action.assigneeUserId,
    createdByUserId: action.createdByUserId,
    performedByUserId: action.performedByUserId,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
    completedAt: action.completedAt?.toISOString() ?? null,
    cancelledAt: action.cancelledAt?.toISOString() ?? null,
    version: action.version,
  };
}

async function lockTicket(tx: ActionTx, context: AuthContext, rawTicketNumber: string): Promise<ReaderTicket> {
  const ticketNumber = parseTicketNumber(rawTicketNumber);
  const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Ticket" WHERE "ticketNumber" = ${ticketNumber} FOR UPDATE`;
  if (locked.length === 0) throw toTicket404();
  const requesterId = requesterScope(context);
  const ticket = await tx.ticket.findFirst({
    where: { id: locked[0].id, ...(requesterId !== undefined ? { requesterId } : {}) },
    select: { id: true, ticketNumber: true, requesterId: true, status: true, workflowVersion: true },
  });
  if (!ticket) throw toTicket404();
  return ticket;
}

async function assertEligibleAssignee(tx: ActionTx, userId: number) {
  const eligibleUsers = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "User"
    WHERE "id" = ${userId} AND "isActive" = true AND "role" IN ('IT_STAFF', 'ADMINISTRATOR')
    FOR SHARE
  `;
  if (eligibleUsers.length === 0) throw apiError(409, "ASSIGNMENT_CONFLICT", "Choose an active IT Staff or Administrator.", { assigneeUserId: "This User is not eligible for Action assignment." });
}

function assertTicketActionWritable(ticket: ReaderTicket) {
  if (isActionTransitionBlockedByTicket(ticket.status)) {
    throw apiError(409, "ACTION_READ_ONLY", "Actions cannot be changed on a resolved, closed, or cancelled Ticket.");
  }
}

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as { code?: unknown; meta?: { code?: unknown } };
  if (typeof record.code === "string") return record.code;
  return typeof record.meta?.code === "string" ? record.meta.code : undefined;
}

function retryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as { code?: unknown; meta?: { code?: unknown } };
  const codes = [record.code, record.meta?.code];
  return codes.some((code) => code === "P2034" || code === "40001" || code === "40P01");
}

async function serializable<T>(operation: (tx: ActionTx) => Promise<T>): Promise<T> {
  const prisma = getPrisma();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (retryable(error) && attempt < 2) continue;
      if (retryable(error)) throw apiError(409, "CONCURRENT_UPDATE", "The Ticket changed concurrently. Reload and try again.");
      throw error;
    }
  }
  throw apiError(409, "CONCURRENT_UPDATE", "The Ticket changed concurrently. Reload and try again.");
}

function createFingerprint(ticketNumber: string, input: ValidatedCreateAction): string {
  const normalized = {
    ticketNumber,
    description: input.description,
    assigneeUserId: input.assigneeUserId ?? null,
    result: input.result,
    followUpRequired: input.followUpRequired,
    followUpNote: input.followUpNote,
    attachmentNotes: input.attachmentNotes,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function validationError(result: { ok: false; fieldErrors: Record<string, string> }): never {
  throw apiError(400, "VALIDATION_ERROR", "Check the highlighted fields.", result.fieldErrors);
}

export async function createActionTaken(context: AuthContext, rawTicketNumber: string, body: unknown) {
  requireRole(context, "IT_STAFF", "ADMINISTRATOR");
  const validation = validateCreateAction(body);
  if (!validation.ok) validationError(validation);
  const input = validation.value;
  const ticketNumber = parseTicketNumber(rawTicketNumber);
  const requestFingerprint = createFingerprint(ticketNumber, input);

  try {
    return await serializable(async (tx) => {
      const ticket = await lockTicket(tx, context, ticketNumber);
      const existing = await tx.actionTaken.findUnique({
        where: { createdByUserId_clientRequestId: { createdByUserId: context.user.id, clientRequestId: input.clientRequestId } },
        include: ACTION_INCLUDE,
      });
      if (existing) {
        if (existing.ticketId !== ticket.id || existing.requestFingerprint !== requestFingerprint) {
          throw apiError(409, "IDEMPOTENCY_KEY_REUSED", "This creation key was already used for different Action data.");
        }
        return { action: serializeAction(existing, ticket.ticketNumber), ticketVersion: ticket.workflowVersion, replayed: true as const };
      }

      assertTicketActionWritable(ticket);
      if (ticket.workflowVersion !== input.expectedTicketVersion) {
        throw apiError(409, "STALE_VERSION", "The Ticket has changed. Reload before creating an Action.", { expectedTicketVersion: "Reload the Ticket and retry." });
      }
      const assigneeUserId = input.assigneeUserId ?? context.user.id;
      await assertEligibleAssignee(tx, assigneeUserId);
      const now = new Date();
      const action = await tx.actionTaken.create({
        data: {
          ticketId: ticket.id,
          assigneeUserId,
          createdByUserId: context.user.id,
          description: input.description,
          result: input.result,
          followUpRequired: input.followUpRequired,
          followUpNote: input.followUpNote,
          attachmentNotes: input.attachmentNotes,
          status: "OPEN",
          createdAt: now,
          updatedAt: now,
          version: 0,
          clientRequestId: input.clientRequestId,
          requestFingerprint,
        },
      });
      await tx.actionTakenRevision.create({
        data: {
          actionId: action.id,
          revisionNumber: 1,
          actorUserId: context.user.id,
          changedAt: now,
          snapshot: captureSnapshot(action),
        },
      });
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: { workflowVersion: { increment: 1 } },
        select: { workflowVersion: true },
      });
      const withActors = await tx.actionTaken.findUniqueOrThrow({ where: { id: action.id }, include: ACTION_INCLUDE });
      return { action: serializeAction(withActors, ticket.ticketNumber), ticketVersion: updatedTicket.workflowVersion, replayed: false as const };
    });
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    if (prismaCode(error) === "P2002") {
      const existing = await getPrisma().actionTaken.findUnique({
        where: { createdByUserId_clientRequestId: { createdByUserId: context.user.id, clientRequestId: input.clientRequestId } },
        include: { ...ACTION_INCLUDE, ticket: { select: { ticketNumber: true, workflowVersion: true } } },
      });
      if (existing?.ticket.ticketNumber === ticketNumber && existing.requestFingerprint === requestFingerprint) {
        return { action: serializeAction(existing, ticketNumber), ticketVersion: existing.ticket.workflowVersion, replayed: true as const };
      }
      throw apiError(409, "IDEMPOTENCY_KEY_REUSED", "This creation key was already used for different Action data.");
    }
    throw apiError(500, "ACTION_CREATE_FAILED", "Action could not be created.");
  }
}

function checkCrossFieldRules(input: ValidatedPatchAction, current: ActionWithActors, final: {
  status: ActionStatus;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
}) {
  if (input.cancellationReason !== undefined && input.status !== "CANCELLED") {
    throw apiError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { cancellationReason: "A cancellation reason is allowed only when cancelling the Action." });
  }
  if (input.status === "CANCELLED" && current.status !== "CANCELLED" && !input.cancellationReason) {
    throw apiError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { cancellationReason: "Enter a cancellation reason." });
  }
  if (final.followUpRequired && !final.followUpNote) {
    throw apiError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { followUpNote: "Enter a note when follow-up is required." });
  }
  if (final.status === "COMPLETED" && (!final.result || final.result.trim().length < 5)) {
    throw apiError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { result: "Enter a result of 5–2000 characters before completing the Action." });
  }
}

export async function updateActionTaken(context: AuthContext, rawTicketNumber: string, rawActionId: string, body: unknown) {
  requireRole(context, "IT_STAFF", "ADMINISTRATOR");
  const validation = validatePatchAction(body);
  if (!validation.ok) validationError(validation);
  const input = validation.value;
  const actionId = parseActionId(rawActionId);
  const ticketNumber = parseTicketNumber(rawTicketNumber);

  try {
    return await serializable(async (tx) => {
      const ticket = await lockTicket(tx, context, ticketNumber);
      assertTicketActionWritable(ticket);
      const current = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId: ticket.id }, include: ACTION_INCLUDE });
      if (!current) throw apiError(404, "ACTION_NOT_FOUND", "Action was not found.");
      if (current.status === "CANCELLED") throw apiError(409, "ACTION_READ_ONLY", "A cancelled Action cannot be changed.");
      if (ticket.workflowVersion !== input.expectedTicketVersion || current.version !== input.expectedActionVersion) {
        throw apiError(409, "STALE_VERSION", "The Action or Ticket has changed. Reload before saving.", {
          ...(ticket.workflowVersion !== input.expectedTicketVersion ? { expectedTicketVersion: "Reload the Ticket and retry." } : {}),
          ...(current.version !== input.expectedActionVersion ? { expectedActionVersion: "Reload the Action and retry." } : {}),
        });
      }

      if (current.status === "COMPLETED" && (input.assigneeUserId !== undefined || (input.status !== undefined && input.status !== "COMPLETED"))) {
        throw apiError(409, "ACTION_READ_ONLY", "A completed Action may only have its narrative fields corrected.");
      }
      const finalStatus = input.status ?? current.status;
      if (!isAllowedActionTransition(current.status, finalStatus)) {
        throw apiError(409, "INVALID_ACTION_TRANSITION", "That Action status transition is not allowed.", { status: "Choose an allowed next status." });
      }
      const final = {
        status: finalStatus,
        result: input.result !== undefined ? input.result : current.result,
        followUpRequired: input.followUpRequired !== undefined ? input.followUpRequired : current.followUpRequired,
        followUpNote: input.followUpNote !== undefined ? input.followUpNote : current.followUpNote,
      };
      checkCrossFieldRules(input, current, final);
      if (input.assigneeUserId !== undefined) await assertEligibleAssignee(tx, input.assigneeUserId);
      if (finalStatus === "COMPLETED") await assertEligibleAssignee(tx, input.assigneeUserId ?? current.assigneeUserId);

      const now = new Date();
      const cancellationReason = finalStatus === "CANCELLED"
        ? input.cancellationReason as string
        : current.cancellationReason;
      const update: Prisma.ActionTakenUncheckedUpdateInput = {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
        ...(input.result !== undefined ? { result: input.result } : {}),
        ...(input.followUpRequired !== undefined ? { followUpRequired: input.followUpRequired } : {}),
        ...(input.followUpNote !== undefined ? { followUpNote: input.followUpNote } : {}),
        ...(input.attachmentNotes !== undefined ? { attachmentNotes: input.attachmentNotes } : {}),
        ...(input.status !== undefined ? { status: finalStatus } : {}),
        ...(finalStatus === "CANCELLED" ? { cancellationReason, cancelledAt: now } : {}),
        ...(finalStatus === "COMPLETED" && current.status !== "COMPLETED" ? { performedByUserId: context.user.id, completedAt: now } : {}),
      };
      const changed = Object.keys(update).length > 0 && Object.entries(update).some(([key, value]) => {
        const currentValue = current[key as keyof typeof current];
        return value !== currentValue;
      });
      if (!changed) return { action: serializeAction(current, ticket.ticketNumber), ticketVersion: ticket.workflowVersion };

      const version = current.version + 1;
      const updated = await tx.actionTaken.update({
        where: { id: current.id },
        data: { ...update, version, updatedAt: now },
      });
      await tx.actionTakenRevision.create({
        data: {
          actionId: current.id,
          revisionNumber: version + 1,
          actorUserId: context.user.id,
          changedAt: now,
          snapshot: captureSnapshot(updated),
        },
      });
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: { workflowVersion: { increment: 1 } },
        select: { workflowVersion: true },
      });
      const withActors = await tx.actionTaken.findUniqueOrThrow({ where: { id: updated.id }, include: ACTION_INCLUDE });
      return { action: serializeAction(withActors, ticket.ticketNumber), ticketVersion: updatedTicket.workflowVersion };
    });
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw apiError(500, "ACTION_UPDATE_FAILED", "Action could not be updated.");
  }
}

export async function listActionRevisions(context: AuthContext, rawTicketNumber: string, rawActionId: string, query: ActionListQuery) {
  const { page, pageSize } = parsePagination(query);
  const actionId = parseActionId(rawActionId);
  const prisma = getPrisma();
  try {
    const ticket = await findReaderTicket(prisma, context, rawTicketNumber);
    const action = await prisma.actionTaken.findFirst({ where: { id: actionId, ticketId: ticket.id }, select: { id: true } });
    if (!action) throw apiError(404, "ACTION_NOT_FOUND", "Action was not found.");
    const where = { actionId };
    const [rows, totalItems] = await Promise.all([
      prisma.actionTakenRevision.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: [{ revisionNumber: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.actionTakenRevision.count({ where }),
    ]);
    return { revisions: rows.map(serializeRevision), pagination: pagination(page, pageSize, totalItems) };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw apiError(500, "ACTION_HISTORY_FAILED", "Action history could not be loaded.");
  }
}

export function validateActionQueryKeys(query: Record<string, unknown>) {
  parseQueryKeys(query, new Set(["page", "pageSize"]));
}
