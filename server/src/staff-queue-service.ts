import type { Request } from "express";
import type { Prisma, PrismaClient, TicketPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { TicketApiError } from "./ticket-service.js";
import { ACTIVE_ACTION_STATUSES, applyDashboardListPredicates, parseDashboardListPredicates, TICKET_STATUSES, type DashboardListPredicates } from "./dashboard-query.js";
import {
  allowedTicketTransitions,
  evaluateResolutionGate,
  isAllowedTicketTransition,
  TICKET_STATUS_TRANSITIONS,
  type ResolutionGate,
} from "./workflow-rules.js";

const SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "ticketNumber",
  "summary",
  "requestedPriority",
  "itPriority",
  "status",
  "owner",
] as const;
const ORDERS = ["asc", "desc"] as const;
const PAGE_SIZES = [10, 25, 50] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/;
export const STAFF_STATUSES = TICKET_STATUSES;
const QUERY_KEYS = new Set([
  "search",
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "itPriority",
  "status",
  "owner",
  "sort",
  "order",
  "page",
  "pageSize",
  "statusGroup",
  "updatedSince",
  "updatedBefore",
  "actionAssignee",
]);

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = (typeof ORDERS)[number];
type PageSize = (typeof PAGE_SIZES)[number];
export type StaffOwnerFilter = "me" | "unassigned" | number;

export interface StaffQueueQuery extends DashboardListPredicates {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  itPriority?: TicketPriority;
  status?: TicketStatus;
  owner?: StaffOwnerFilter;
  actionAssignee?: "me";
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: PageSize;
}

export interface StaffTicket {
  id: number;
  ticketNumber: string;
  requester: { id: number; name: string; email: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  status: TicketStatus;
  summary: string;
  description: string;
  ticketOwner: { id: number; name: string; email: string; role: "IT_STAFF" | "ADMINISTRATOR" } | null;
  resolutionIndication: {
    indicatedAt: Date;
    indicatedBy: { id: number; name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" };
  } | null;
  workflowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffTicketDetail extends StaffTicket {
  allowedTransitions: TicketStatus[];
  resolutionGate: ResolutionGate;
}

export interface StaffQueuePagination {
  page: number;
  pageSize: PageSize;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface StaffQueueResponse {
  items: StaffTicket[];
  pagination: StaffQueuePagination;
}

function validationError(field: string, message: string): TicketApiError {
  return new TicketApiError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message: "Please correct the query parameters.",
    fieldErrors: { [field]: message },
  });
}

function ensureTicketNumber(ticketNumber: string): string {
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
    throw new TicketApiError({ statusCode: 404, code: "TICKET_NOT_FOUND", message: "Ticket was not found." });
  }
  return ticketNumber;
}

function getSingleQueryValue(query: Request["query"], key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw validationError(key, "This query parameter must be provided once as text.");
  }
  return value;
}

function parsePositiveInteger(value: string | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw validationError(field, "This value must be a positive integer.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw validationError(field, "This value must be a positive integer.");
  }
  return parsed;
}

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  field: string,
  allowed: T,
): T[number] | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw validationError(field, `Value must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function parsePageSize(value: string | undefined): PageSize {
  if (value === undefined) return 10;
  if (!PAGE_SIZES.map(String).includes(value)) {
    throw validationError("pageSize", "Page size must be 10, 25, or 50.");
  }
  return Number(value) as PageSize;
}

function parseOwner(value: string | undefined): StaffOwnerFilter | undefined {
  if (value === undefined) return undefined;
  if (value === "me" || value === "unassigned") return value;
  const parsed = parsePositiveInteger(value, "owner");
  if (parsed === undefined) throw validationError("owner", "Owner must be me, unassigned, or an eligible User ID.");
  return parsed;
}

export function parseStaffQueueQuery(query: Request["query"]): StaffQueueQuery {
  for (const key of Object.keys(query)) {
    if (!QUERY_KEYS.has(key)) throw validationError(key, "This query parameter is not supported.");
  }

  const searchValue = getSingleQueryValue(query, "search");
  const search = searchValue?.trim() || undefined;
  if (search && search.length > 100) {
    throw validationError("search", "Search text must be at most 100 characters.");
  }

  const categoryId = parsePositiveInteger(getSingleQueryValue(query, "categoryId"), "categoryId");
  const relatedSystemId = parsePositiveInteger(getSingleQueryValue(query, "relatedSystemId"), "relatedSystemId");
  const requestedPriority = parseEnum(
    getSingleQueryValue(query, "requestedPriority"),
    "requestedPriority",
    PRIORITIES,
  ) as TicketPriority | undefined;
  const itPriority = parseEnum(getSingleQueryValue(query, "itPriority"), "itPriority", PRIORITIES) as
    | TicketPriority
    | undefined;
  const status = parseEnum(getSingleQueryValue(query, "status"), "status", STAFF_STATUSES) as TicketStatus | undefined;
  const dashboardPredicates = parseDashboardListPredicates(query, validationError);
  if (status && dashboardPredicates.statusGroup) {
    throw validationError("statusGroup", "Use either status or statusGroup, not both.");
  }
  const actionAssigneeValue = getSingleQueryValue(query, "actionAssignee");
  if (actionAssigneeValue !== undefined && actionAssigneeValue !== "me") {
    throw validationError("actionAssignee", "Action assignee must be me.");
  }
  const owner = parseOwner(getSingleQueryValue(query, "owner"));
  const sort = (parseEnum(getSingleQueryValue(query, "sort"), "sort", SORT_FIELDS) as SortField | undefined) ?? "updatedAt";
  const order = (parseEnum(getSingleQueryValue(query, "order"), "order", ORDERS) as SortOrder | undefined) ?? "desc";
  const page = parsePositiveInteger(getSingleQueryValue(query, "page"), "page") ?? 1;
  const pageSize = parsePageSize(getSingleQueryValue(query, "pageSize"));

  if (page > Math.floor(Number.MAX_SAFE_INTEGER / pageSize) + 1) {
    throw validationError("page", "This page number is too large.");
  }

  return {
    ...(search ? { search } : {}),
    ...(categoryId === undefined ? {} : { categoryId }),
    ...(relatedSystemId === undefined ? {} : { relatedSystemId }),
    ...(requestedPriority ? { requestedPriority } : {}),
    ...(itPriority ? { itPriority } : {}),
    ...(status ? { status } : {}),
    ...dashboardPredicates,
    ...(owner === undefined ? {} : { owner }),
    ...(actionAssigneeValue === "me" ? { actionAssignee: "me" as const } : {}),
    sort,
    order,
    page,
    pageSize,
  };
}

async function validateReferenceFilters(query: StaffQueueQuery): Promise<void> {
  const prisma = getPrisma();
  if (query.categoryId !== undefined) {
    const category = await prisma.category.findFirst({ where: { id: query.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw validationError("categoryId", "Category is unavailable.");
  }
  if (query.relatedSystemId !== undefined) {
    const relatedSystem = await prisma.relatedSystem.findFirst({ where: { id: query.relatedSystemId, isActive: true }, select: { id: true } });
    if (!relatedSystem) throw validationError("relatedSystemId", "Related System is unavailable.");
  }
  if (typeof query.owner === "number") {
    const owner = await prisma.user.findFirst({
      where: { id: query.owner, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true },
    });
    if (!owner) throw validationError("owner", "Owner must be an active IT Staff or Administrator.");
  }
}

export function buildStaffTicketWhere(authenticatedUserId: number, query: StaffQueueQuery): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};
  if (query.search) {
    where.OR = [
      { ticketNumber: { contains: query.search, mode: "insensitive" } },
      { summary: { contains: query.search, mode: "insensitive" } },
      { requester: { is: { name: { contains: query.search, mode: "insensitive" } } } },
      { requester: { is: { email: { contains: query.search, mode: "insensitive" } } } },
    ];
  }
  if (query.categoryId !== undefined) where.categoryId = query.categoryId;
  if (query.relatedSystemId !== undefined) where.relatedSystemId = query.relatedSystemId;
  if (query.requestedPriority !== undefined) where.requestedPriority = query.requestedPriority;
  if (query.itPriority !== undefined) where.itPriority = query.itPriority;
  if (query.status !== undefined) where.status = query.status;
  if (query.owner === "me") where.ticketOwnerId = authenticatedUserId;
  if (query.owner === "unassigned") where.ticketOwnerId = null;
  if (typeof query.owner === "number") where.ticketOwnerId = query.owner;
  const filtered = applyDashboardListPredicates(where, query, query.actionAssignee === "me");
  if (query.actionAssignee === "me") {
    filtered.actionsTaken = { some: { assigneeUserId: authenticatedUserId, status: { in: ACTIVE_ACTION_STATUSES } } };
  }
  return filtered;
}

function buildOrderBy(query: StaffQueueQuery): Prisma.TicketOrderByWithRelationInput[] {
  const direction = query.order;
  const primary = query.sort === "owner"
    ? { ticketOwner: { name: direction } }
    : { [query.sort]: direction } as Prisma.TicketOrderByWithRelationInput;
  return [primary as Prisma.TicketOrderByWithRelationInput, { id: direction }];
}

export const staffTicketSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requester: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requestedPriority: true,
  itPriority: true,
  status: true,
  ticketOwner: { select: { id: true, name: true, email: true, role: true, isActive: true } },
  resolutionIndicatedAt: true,
  resolutionIndicatedBy: { select: { id: true, name: true, email: true, role: true } },
  workflowVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

type StaffTicketRecord = Prisma.TicketGetPayload<{ select: typeof staffTicketSelect }>;

export function serializeStaffTicket(ticket: StaffTicketRecord): StaffTicket {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    summary: ticket.summary,
    description: ticket.description,
    ticketOwner: ticket.ticketOwner
      ? {
          id: ticket.ticketOwner.id,
          name: ticket.ticketOwner.name,
          email: ticket.ticketOwner.email,
          role: ticket.ticketOwner.role as "IT_STAFF" | "ADMINISTRATOR",
        }
      : null,
    resolutionIndication: ticket.resolutionIndicatedAt && ticket.resolutionIndicatedBy
      ? { indicatedAt: ticket.resolutionIndicatedAt, indicatedBy: ticket.resolutionIndicatedBy }
      : null,
    workflowVersion: ticket.workflowVersion,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export async function listStaffTickets(request: Request, authenticatedUserId: number): Promise<StaffQueueResponse> {
  const query = parseStaffQueueQuery(request.query);
  try {
    await validateReferenceFilters(query);
    const where = buildStaffTicketWhere(authenticatedUserId, query);
    const prisma = getPrisma();
    const [totalItems, tickets] = await prisma.$transaction([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        select: staffTicketSelect,
        orderBy: buildOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);
    return {
      items: tickets.map(serializeStaffTicket),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: query.page > 1 && totalItems > 0,
        hasNextPage: query.page < totalPages,
      },
    };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw new TicketApiError({ statusCode: 500, code: "STAFF_QUEUE_FAILED", message: "Staff Tickets could not be loaded." });
  }
}

export async function getStaffTicket(ticketNumber: string): Promise<{ ticket: StaffTicketDetail }> {
  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { ticketNumber: ensureTicketNumber(ticketNumber) },
      select: {
        ...staffTicketSelect,
        actionsTaken: { select: { status: true, result: true, followUpRequired: true } },
      },
    });
    if (!ticket) {
      throw new TicketApiError({ statusCode: 404, code: "TICKET_NOT_FOUND", message: "Ticket was not found." });
    }
    const resolutionGate = evaluateResolutionGate({
      status: ticket.status,
      ownerPresent: ticket.ticketOwner !== null,
      ownerEligible: ticket.ticketOwner?.isActive === true && ["IT_STAFF", "ADMINISTRATOR"].includes(ticket.ticketOwner.role),
      completedActions: ticket.actionsTaken.filter((action) => action.status === "COMPLETED"),
      unfinishedActionCount: ticket.actionsTaken.filter((action) => action.status === "OPEN" || action.status === "IN_PROGRESS").length,
    });
    return {
      ticket: {
        ...serializeStaffTicket(ticket),
        allowedTransitions: allowedTicketTransitions(ticket.status, resolutionGate),
        resolutionGate,
      },
    };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw new TicketApiError({
      statusCode: 500,
      code: "STAFF_TICKET_DETAIL_FAILED",
      message: "Staff Ticket could not be loaded.",
    });
  }
}

export async function listStaffAssignees() {
  try {
    return await getPrisma().user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  } catch {
    throw new TicketApiError({ statusCode: 500, code: "ASSIGNEE_LIST_FAILED", message: "Assignees could not be loaded." });
  }
}

export const staffQueueContract = {
  statuses: STAFF_STATUSES,
  priorities: PRIORITIES,
  sortFields: SORT_FIELDS,
  pageSizes: PAGE_SIZES,
};

const STAFF_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const STAFF_STATUS_TRANSITIONS = TICKET_STATUS_TRANSITIONS;
export const STAFF_CONFIRMATION_STATUSES = new Set<TicketStatus>(["RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]);

export function isAllowedStaffStatusTransition(from: TicketStatus, to: TicketStatus): boolean {
  return isAllowedTicketTransition(from, to);
}

function operationError(
  statusCode: 400 | 403 | 404 | 409 | 500,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): TicketApiError {
  return new TicketApiError({ statusCode, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
}

function readMutationObject(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { body: "Request body is required." });
  }
  const record = body as Record<string, unknown>;
  const unsupported = Object.keys(record).find((key) => !allowed.includes(key));
  if (unsupported) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { [unsupported]: "This field is not supported." });
  }
  return record;
}

function readConfirmation(record: Record<string, unknown>): boolean | undefined {
  if (record.confirm === undefined) return undefined;
  if (typeof record.confirm !== "boolean") {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { confirm: "Confirmation must be true or false." });
  }
  return record.confirm;
}

function readStaffTicketNumber(ticketNumber: string): string {
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
    throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  }
  return ticketNumber;
}

function expectedVersion(record: Record<string, unknown>): number {
  const value = record.expectedVersion;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { expectedVersion: "Reload the Ticket before saving." });
  }
  return value;
}

function checkVersion(current: { workflowVersion: number }, expected: number): void {
  if (current.workflowVersion !== expected) {
    throw operationError(409, "STALE_VERSION", "The Ticket has changed. Reload it before saving.", { expectedVersion: "Reload the Ticket and retry." });
  }
}

async function verifyWorkflowActor(tx: Prisma.TransactionClient, actorUserId: number): Promise<void> {
  const actor = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "User" WHERE "id" = ${actorUserId} AND "isActive" = true AND "role" IN ('IT_STAFF', 'ADMINISTRATOR') FOR SHARE
  `;
  if (!actor.length) throw operationError(403, "FORBIDDEN", "An active IT Staff or Administrator account is required.");
}

function retryableConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as { code?: unknown; meta?: { code?: unknown } };
  return [record.code, record.meta?.code].some((code) => code === "P2034" || code === "40001" || code === "40P01");
}

async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const prisma = getPrisma();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!retryableConflict(error)) throw error;
      if (attempt === 2) throw operationError(409, "CONCURRENT_UPDATE", "The Ticket changed concurrently. Reload and try again.");
    }
  }
  throw operationError(409, "CONCURRENT_UPDATE", "The Ticket changed concurrently. Reload and try again.");
}

async function lockTicket(tx: Prisma.TransactionClient, ticketNumber: string) {
  const ticket = readStaffTicketNumber(ticketNumber);
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "Ticket" WHERE "ticketNumber" = ${ticket} FOR UPDATE
  `;
  if (!rows.length) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  const current = await tx.ticket.findUnique({
    where: { id: rows[0].id },
    select: { id: true, ticketOwnerId: true, status: true, workflowVersion: true, itPriority: true, resolutionIndicatedAt: true, resolutionIndicatedByUserId: true },
  });
  if (!current) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return current;
}

async function loadStaffTicket(tx: PrismaClient | Prisma.TransactionClient, ticketNumber: string): Promise<StaffTicketRecord> {
  const ticket = await tx.ticket.findUnique({ where: { ticketNumber: readStaffTicketNumber(ticketNumber) }, select: staffTicketSelect });
  if (!ticket) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return ticket;
}

async function withStaffTicketMutation(
  actorUserId: number,
  operation: (tx: Prisma.TransactionClient) => Promise<StaffTicketRecord>,
  failureCode: string,
  failureMessage: string,
): Promise<{ ticket: StaffTicket }> {
  try {
    const ticket = await serializable(async (tx) => {
      await verifyWorkflowActor(tx, actorUserId);
      return operation(tx);
    });
    return { ticket: serializeStaffTicket(ticket) };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw operationError(500, failureCode, failureMessage);
  }
}

export async function updateStaffAssignment(ticketNumber: string, body: unknown, actorUserId: number): Promise<{ ticket: StaffTicket }> {
  const record = readMutationObject(body, ["ownerUserId", "expectedVersion", "confirm"]);
  const expected = expectedVersion(record);
  const confirm = readConfirmation(record);
  const rawOwner = record.ownerUserId;
  let ownerUserId: number | null;
  if (rawOwner === null) ownerUserId = null;
  else if (typeof rawOwner === "number" && Number.isSafeInteger(rawOwner) && rawOwner > 0) ownerUserId = rawOwner;
  else throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { ownerUserId: "Owner must be an eligible User ID or null." });

  return withStaffTicketMutation(actorUserId, async (tx) => {
    const current = await lockTicket(tx, ticketNumber);
    checkVersion(current, expected);
    const changesOwner = current.ticketOwnerId !== ownerUserId;
    if (!changesOwner) return loadStaffTicket(tx, ticketNumber);
    if (ownerUserId !== null) {
      const eligible = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "User" WHERE "id" = ${ownerUserId} AND "isActive" = true AND "role" IN ('IT_STAFF', 'ADMINISTRATOR') FOR SHARE
      `;
      if (!eligible.length) throw operationError(409, "ASSIGNMENT_CONFLICT", "The selected owner is not an active eligible staff User.");
    }
    if (current.ticketOwnerId !== null && confirm !== true) {
      throw operationError(400, "VALIDATION_ERROR", "Please confirm the reassignment or unassignment.", { confirm: "Confirmation is required for this ownership change." });
    }
    await tx.ticket.update({ where: { id: current.id }, data: { ticketOwnerId: ownerUserId, workflowVersion: { increment: 1 } } });
    return loadStaffTicket(tx, ticketNumber);
  }, "ASSIGNMENT_UPDATE_FAILED", "Ticket assignment could not be updated.");
}

export async function updateStaffPriority(ticketNumber: string, body: unknown, actorUserId: number): Promise<{ ticket: StaffTicket }> {
  const record = readMutationObject(body, ["itPriority", "expectedVersion"]);
  const expected = expectedVersion(record);
  const rawPriority = record.itPriority;
  if (typeof rawPriority !== "string" || !(STAFF_PRIORITIES as readonly string[]).includes(rawPriority)) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { itPriority: "IT Priority must be LOW, MEDIUM, HIGH, or URGENT." });
  }
  return withStaffTicketMutation(actorUserId, async (tx) => {
    const current = await lockTicket(tx, ticketNumber);
    checkVersion(current, expected);
    if (current.itPriority !== rawPriority) {
      await tx.ticket.update({ where: { id: current.id }, data: { itPriority: rawPriority as TicketPriority, workflowVersion: { increment: 1 } } });
    }
    return loadStaffTicket(tx, ticketNumber);
  }, "PRIORITY_UPDATE_FAILED", "Ticket IT Priority could not be updated.");
}

function cancellationReason(record: Record<string, unknown>, nextStatus: TicketStatus): string | null {
  if (nextStatus !== "CANCELLED") {
    if (record.cancellationReason !== undefined) throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { cancellationReason: "A cancellation reason is only accepted when cancelling a Ticket." });
    return null;
  }
  const reason = typeof record.cancellationReason === "string" ? record.cancellationReason.trim() : "";
  if (reason.length < 5 || reason.length > 250) throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { cancellationReason: "Cancellation reason must be 5–250 characters after trimming." });
  return reason;
}

function actionSnapshot(action: {
  description: string; result: string | null; followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  status: string; cancellationReason: string | null; assigneeUserId: number; createdByUserId: number; performedByUserId: number | null;
  createdAt: Date; updatedAt: Date; completedAt: Date | null; cancelledAt: Date | null; version: number;
}) {
  return {
    description: action.description, result: action.result, followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes, status: action.status,
    cancellationReason: action.cancellationReason, assigneeUserId: action.assigneeUserId,
    createdByUserId: action.createdByUserId, performedByUserId: action.performedByUserId,
    createdAt: action.createdAt.toISOString(), updatedAt: action.updatedAt.toISOString(),
    completedAt: action.completedAt?.toISOString() ?? null, cancelledAt: action.cancelledAt?.toISOString() ?? null,
    version: action.version,
  };
}

async function assertResolutionGate(tx: Prisma.TransactionClient, current: Awaited<ReturnType<typeof lockTicket>>, target: "RESOLVED" | "CLOSED") {
  const owner = current.ticketOwnerId === null ? null : await tx.user.findUnique({ where: { id: current.ticketOwnerId }, select: { id: true, role: true, isActive: true } });
  if (owner) {
    const locked = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "User" WHERE "id" = ${owner.id} AND "isActive" = true AND "role" IN ('IT_STAFF', 'ADMINISTRATOR') FOR SHARE
    `;
    if (!locked.length) owner.isActive = false;
  }
  const actions = await tx.actionTaken.findMany({
    where: { ticketId: current.id },
    select: { status: true, result: true, followUpRequired: true },
  });
  const gate = evaluateResolutionGate({
    status: current.status,
    ownerPresent: current.ticketOwnerId !== null,
    ownerEligible: owner?.isActive === true && (owner.role === "IT_STAFF" || owner.role === "ADMINISTRATOR"),
    completedActions: actions.filter((action) => action.status === "COMPLETED"),
    unfinishedActionCount: actions.filter((action) => action.status === "OPEN" || action.status === "IN_PROGRESS").length,
  });
  if (target === "RESOLVED" ? !gate.canResolve : !gate.canClose) {
    throw operationError(409, "RESOLUTION_GATE_NOT_MET", "Complete the Ticket prerequisites before resolving or closing it.", {
      resolutionGate: gate.unmetConditions.join(","),
    });
  }
}

export async function updateStaffStatus(ticketNumber: string, body: unknown, actorUserId: number): Promise<{ ticket: StaffTicket }> {
  const record = readMutationObject(body, ["status", "expectedVersion", "confirm", "cancellationReason"]);
  const expected = expectedVersion(record);
  const confirm = readConfirmation(record);
  const rawStatus = record.status;
  if (typeof rawStatus !== "string" || !(STAFF_STATUSES as readonly string[]).includes(rawStatus)) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { status: "Status is not supported." });
  }
  const nextStatus = rawStatus as TicketStatus;
  const reason = cancellationReason(record, nextStatus);
  return withStaffTicketMutation(actorUserId, async (tx) => {
    const current = await lockTicket(tx, ticketNumber);
    checkVersion(current, expected);
    if (current.status === nextStatus) return loadStaffTicket(tx, ticketNumber);
    if (!isAllowedTicketTransition(current.status, nextStatus)) {
      throw operationError(409, "INVALID_STATUS_TRANSITION", "This Ticket status transition is not allowed.");
    }
    if (STAFF_CONFIRMATION_STATUSES.has(nextStatus) && confirm !== true) {
      throw operationError(400, "VALIDATION_ERROR", "Please confirm this status transition.", { confirm: "Confirmation is required for this status transition." });
    }
    if (nextStatus === "RESOLVED" || nextStatus === "CLOSED") await assertResolutionGate(tx, current, nextStatus);
    if (nextStatus === "CANCELLED") {
      const unfinished = await tx.actionTaken.findMany({
        where: { ticketId: current.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      });
      const now = new Date();
      for (const action of unfinished) {
        const updated = await tx.actionTaken.update({
          where: { id: action.id },
          data: { status: "CANCELLED", cancellationReason: reason, cancelledAt: now, updatedAt: now, version: { increment: 1 } },
        });
        await tx.actionTakenRevision.create({
          data: { actionId: action.id, revisionNumber: updated.version + 1, actorUserId, changedAt: now, snapshot: actionSnapshot(updated) },
        });
      }
    }
    const changed = await tx.ticket.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        workflowVersion: { increment: 1 },
        ...(nextStatus === "REOPENED" ? { resolutionIndicatedAt: null, resolutionIndicatedByUserId: null } : {}),
      },
      select: { workflowVersion: true },
    });
    await tx.ticketWorkflowEvent.create({
      data: { ticketId: current.id, actorUserId, fromStatus: current.status, toStatus: nextStatus, reason, workflowVersion: changed.workflowVersion },
    });
    return loadStaffTicket(tx, ticketNumber);
  }, "STATUS_UPDATE_FAILED", "Ticket status could not be updated.");
}

export async function listTicketWorkflowEvents(ticketNumber: string, requesterId: number | undefined, query: Record<string, unknown>) {
  const unknown = Object.keys(query).find((key) => !["page", "pageSize"].includes(key));
  const repeated = Object.keys(query).find((key) => Array.isArray(query[key]));
  if (unknown || repeated) throw operationError(400, "VALIDATION_ERROR", "Check the query parameters.", { [unknown ?? repeated as string]: "Use one supported page or pageSize value." });
  const parsePositive = (value: unknown, field: string, fallback: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
      throw operationError(400, "VALIDATION_ERROR", "Check the query parameters.", { [field]: "Enter a valid positive integer." });
    }
    return Number(value);
  };
  const page = parsePositive(query.page, "page", 1);
  const pageSize = parsePositive(query.pageSize, "pageSize", 25);
  if (![10, 25, 50].includes(pageSize)) throw operationError(400, "VALIDATION_ERROR", "Check the query parameters.", { pageSize: "Page size must be 10, 25, or 50." });
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  const prisma = getPrisma();
  try {
    const ticket = await prisma.ticket.findFirst({ where: { ticketNumber, ...(requesterId === undefined ? {} : { requesterId }) }, select: { id: true, ticketNumber: true } });
    if (!ticket) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
    const where = { ticketId: ticket.id };
    const [rows, totalItems] = await Promise.all([
      prisma.ticketWorkflowEvent.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticketWorkflowEvent.count({ where }),
    ]);
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
      events: rows.map((event) => ({
        id: event.id, ticketNumber: ticket.ticketNumber,
        actor: event.actor, fromStatus: event.fromStatus, toStatus: event.toStatus,
        reason: event.reason, workflowVersion: event.workflowVersion, createdAt: event.createdAt,
      })),
      pagination: { page, pageSize, totalItems, totalPages, hasPreviousPage: page > 1 && totalItems > 0, hasNextPage: page < totalPages },
    };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw operationError(500, "WORKFLOW_HISTORY_FAILED", "Ticket workflow history could not be loaded.");
  }
}
