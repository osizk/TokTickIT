import type { Request } from "express";
import type { Prisma, PrismaClient, TicketPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { TicketApiError } from "./ticket-service.js";

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
export const STAFF_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;
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
]);

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = (typeof ORDERS)[number];
type PageSize = (typeof PAGE_SIZES)[number];
export type StaffOwnerFilter = "me" | "unassigned" | number;

export interface StaffQueueQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  itPriority?: TicketPriority;
  status?: TicketStatus;
  owner?: StaffOwnerFilter;
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
  createdAt: Date;
  updatedAt: Date;
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
    ...(owner === undefined ? {} : { owner }),
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

function buildWhere(authenticatedUserId: number, query: StaffQueueQuery): Prisma.TicketWhereInput {
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
  return where;
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
  ticketOwner: { select: { id: true, name: true, email: true, role: true } },
  resolutionIndicatedAt: true,
  resolutionIndicatedBy: { select: { id: true, name: true, email: true, role: true } },
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
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export async function listStaffTickets(request: Request, authenticatedUserId: number): Promise<StaffQueueResponse> {
  const query = parseStaffQueueQuery(request.query);
  try {
    await validateReferenceFilters(query);
    const where = buildWhere(authenticatedUserId, query);
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

export async function getStaffTicket(ticketNumber: string): Promise<{ ticket: StaffTicket }> {
  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { ticketNumber: ensureTicketNumber(ticketNumber) },
      select: staffTicketSelect,
    });
    if (!ticket) {
      throw new TicketApiError({ statusCode: 404, code: "TICKET_NOT_FOUND", message: "Ticket was not found." });
    }
    return { ticket: serializeStaffTicket(ticket) };
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
export const STAFF_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};
export const STAFF_CONFIRMATION_STATUSES = new Set<TicketStatus>(["RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]);

export function isAllowedStaffStatusTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STAFF_STATUS_TRANSITIONS[from].includes(to);
}

function operationError(
  statusCode: 400 | 404 | 409 | 500,
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

async function lockTicket(tx: Prisma.TransactionClient, ticketNumber: string) {
  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "Ticket" WHERE "ticketNumber" = ${ticketNumber} FOR UPDATE
  `;
  const ticket = await tx.ticket.findUnique({ where: { ticketNumber }, select: { id: true, ticketOwnerId: true, status: true } });
  if (!ticket) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return ticket;
}

async function loadStaffTicket(tx: PrismaClient | Prisma.TransactionClient, ticketNumber: string): Promise<StaffTicketRecord> {
  const ticket = await tx.ticket.findUnique({ where: { ticketNumber: readStaffTicketNumber(ticketNumber) }, select: staffTicketSelect });
  if (!ticket) throw operationError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return ticket;
}

async function withStaffTicketMutation(
  ticketNumber: string,
  operation: (tx: Prisma.TransactionClient) => Promise<StaffTicketRecord>,
  failureCode: string,
  failureMessage: string,
): Promise<{ ticket: StaffTicket }> {
  try {
    const ticket = await getPrisma().$transaction((tx) => operation(tx));
    return { ticket: serializeStaffTicket(ticket) };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw operationError(500, failureCode, failureMessage);
  }
}

export async function updateStaffAssignment(ticketNumber: string, body: unknown): Promise<{ ticket: StaffTicket }> {
  const record = readMutationObject(body, ["ownerUserId", "confirm"]);
  const confirm = readConfirmation(record);
  const rawOwner = record.ownerUserId;
  let ownerUserId: number | null;
  if (rawOwner === null) {
    ownerUserId = null;
  } else if (typeof rawOwner === "number" && Number.isSafeInteger(rawOwner) && rawOwner > 0) {
    ownerUserId = rawOwner;
  } else {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { ownerUserId: "Owner must be an eligible User ID or null." });
  }

  return withStaffTicketMutation(ticketNumber, async (tx) => {
    const current = await lockTicket(tx, readStaffTicketNumber(ticketNumber));
    if (ownerUserId !== null) {
      const eligible = await tx.user.findFirst({
        where: { id: ownerUserId, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
        select: { id: true },
      });
      if (!eligible) throw operationError(409, "ASSIGNMENT_CONFLICT", "The selected owner is not an active eligible staff User.");
    }
    const changesOwner = current.ticketOwnerId !== ownerUserId;
    const requiresConfirmation = current.ticketOwnerId !== null && changesOwner;
    if (requiresConfirmation && confirm !== true) {
      throw operationError(400, "VALIDATION_ERROR", "Please confirm the reassignment or unassignment.", { confirm: "Confirmation is required for this ownership change." });
    }
    await tx.ticket.update({ where: { id: current.id }, data: { ticketOwnerId: ownerUserId } });
    return loadStaffTicket(tx, ticketNumber);
  }, "ASSIGNMENT_UPDATE_FAILED", "Ticket assignment could not be updated.");
}

export async function updateStaffPriority(ticketNumber: string, body: unknown): Promise<{ ticket: StaffTicket }> {
  const record = readMutationObject(body, ["itPriority"]);
  const rawPriority = record.itPriority;
  if (typeof rawPriority !== "string" || !(STAFF_PRIORITIES as readonly string[]).includes(rawPriority)) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { itPriority: "IT Priority must be LOW, MEDIUM, HIGH, or URGENT." });
  }
  return withStaffTicketMutation(ticketNumber, async (tx) => {
    const current = await lockTicket(tx, readStaffTicketNumber(ticketNumber));
    await tx.ticket.update({ where: { id: current.id }, data: { itPriority: rawPriority as TicketPriority } });
    return loadStaffTicket(tx, ticketNumber);
  }, "PRIORITY_UPDATE_FAILED", "Ticket IT Priority could not be updated.");
}

export async function updateStaffStatus(ticketNumber: string, body: unknown): Promise<{ ticket: StaffTicket }> {
  const record = readMutationObject(body, ["status", "confirm"]);
  const confirm = readConfirmation(record);
  const rawStatus = record.status;
  if (typeof rawStatus !== "string" || !(STAFF_STATUSES as readonly string[]).includes(rawStatus)) {
    throw operationError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { status: "Status is not supported." });
  }
  const nextStatus = rawStatus as TicketStatus;
  return withStaffTicketMutation(ticketNumber, async (tx) => {
    const current = await lockTicket(tx, readStaffTicketNumber(ticketNumber));
    if (!isAllowedStaffStatusTransition(current.status, nextStatus)) {
      throw operationError(409, "INVALID_STATUS_TRANSITION", "This Ticket status transition is not allowed.");
    }
    if (STAFF_CONFIRMATION_STATUSES.has(nextStatus) && confirm !== true) {
      throw operationError(400, "VALIDATION_ERROR", "Please confirm this status transition.", { confirm: "Confirmation is required for this status transition." });
    }
    await tx.ticket.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        ...(nextStatus === "REOPENED"
          ? { resolutionIndicatedAt: null, resolutionIndicatedByUserId: null }
          : {}),
      },
    });
    return loadStaffTicket(tx, ticketNumber);
  }, "STATUS_UPDATE_FAILED", "Ticket status could not be updated.");
}
