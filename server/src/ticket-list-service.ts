import type { Request } from "express";
import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { TicketApiError, parseRequesterId } from "./ticket-service.js";

const SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "ticketNumber",
  "summary",
  "requestedPriority",
] as const;
const ORDERS = ["asc", "desc"] as const;
const PAGE_SIZES = [10, 25, 50] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["NEW"] as const;
const QUERY_KEYS = new Set([
  "search",
  "categoryId",
  "relatedSystemId",
  "priority",
  "status",
  "sort",
  "order",
  "page",
  "pageSize",
]);

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = (typeof ORDERS)[number];
type PageSize = (typeof PAGE_SIZES)[number];

export interface TicketListQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  priority?: TicketPriority;
  status?: TicketStatus;
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: PageSize;
}

export interface TicketListPagination {
  page: number;
  pageSize: PageSize;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketListResponse {
  items: TicketListItem[];
  pagination: TicketListPagination;
}

function validationError(field: string, message: string): TicketApiError {
  return new TicketApiError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message: "Please correct the query parameters.",
    fieldErrors: { [field]: message },
  });
}

function getSingleQueryValue(query: Request["query"], key: string): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw validationError(key, "This query parameter must be provided once as text.");
  }
  return value;
}

function parsePositiveInteger(value: string | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw validationError(field, "This value must be a positive integer.");
  }
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
  if (value === undefined) {
    return undefined;
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw validationError(field, `Value must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function parsePageSize(value: string | undefined): PageSize {
  if (value === undefined) {
    return 10;
  }
  if (!PAGE_SIZES.map(String).includes(value)) {
    throw validationError("pageSize", "Page size must be 10, 25, or 50.");
  }
  return Number(value) as PageSize;
}

export function parseTicketListQuery(query: Request["query"]): TicketListQuery {
  for (const key of Object.keys(query)) {
    if (!QUERY_KEYS.has(key)) {
      throw validationError(key, "This query parameter is not supported.");
    }
  }

  const searchValue = getSingleQueryValue(query, "search");
  const search = searchValue?.trim() || undefined;
  if (search && search.length > 100) {
    throw validationError("search", "Search text must be at most 100 characters.");
  }

  const categoryId = parsePositiveInteger(getSingleQueryValue(query, "categoryId"), "categoryId");
  const relatedSystemId = parsePositiveInteger(
    getSingleQueryValue(query, "relatedSystemId"),
    "relatedSystemId",
  );
  const priority = parseEnum(getSingleQueryValue(query, "priority"), "priority", PRIORITIES) as
    | TicketPriority
    | undefined;
  const status = parseEnum(getSingleQueryValue(query, "status"), "status", STATUSES) as
    | TicketStatus
    | undefined;
  const sort =
    (parseEnum(getSingleQueryValue(query, "sort"), "sort", SORT_FIELDS) as SortField | undefined) ??
    "updatedAt";
  const order =
    (parseEnum(getSingleQueryValue(query, "order"), "order", ORDERS) as SortOrder | undefined) ??
    "desc";
  const page = parsePositiveInteger(getSingleQueryValue(query, "page"), "page") ?? 1;
  const pageSize = parsePageSize(getSingleQueryValue(query, "pageSize"));

  if (page > Math.floor(Number.MAX_SAFE_INTEGER / pageSize) + 1) {
    throw validationError("page", "This page number is too large.");
  }

  return {
    ...(search ? { search } : {}),
    ...(categoryId === undefined ? {} : { categoryId }),
    ...(relatedSystemId === undefined ? {} : { relatedSystemId }),
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
    sort,
    order,
    page,
    pageSize,
  };
}

function buildWhere(requesterId: number, query: TicketListQuery): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = { requesterId };

  if (query.search) {
    where.OR = [
      { ticketNumber: { contains: query.search, mode: "insensitive" } },
      { summary: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.categoryId !== undefined) {
    where.categoryId = query.categoryId;
  }
  if (query.relatedSystemId !== undefined) {
    where.relatedSystemId = query.relatedSystemId;
  }
  if (query.priority !== undefined) {
    where.requestedPriority = query.priority;
  }
  if (query.status !== undefined) {
    where.status = query.status;
  }

  return where;
}

function buildOrderBy(query: TicketListQuery): Prisma.TicketOrderByWithRelationInput[] {
  const direction = query.order;
  const primary = {
    [query.sort]: direction,
  } as Prisma.TicketOrderByWithRelationInput;
  return [primary, { id: direction }];
}

function serializeTicketListItem(
  ticket: Prisma.TicketGetPayload<{
    select: {
      id: true;
      ticketNumber: true;
      summary: true;
      category: { select: { id: true; name: true } };
      relatedSystem: { select: { id: true; name: true } };
      requestedPriority: true;
      status: true;
      createdAt: true;
      updatedAt: true;
    };
  }>,
): TicketListItem {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export async function listTickets(request: Request): Promise<TicketListResponse> {
  const requesterId = parseRequesterId(request);
  const query = parseTicketListQuery(request.query);
  const prisma = getPrisma();

  try {
    const requester = await prisma.requester.findFirst({
      where: { id: requesterId, isActive: true },
      select: { id: true },
    });
    if (!requester) {
      throw new TicketApiError({
        statusCode: 404,
        code: "REQUESTER_NOT_FOUND",
        message: "Development Requester was not found.",
      });
    }

    const where = buildWhere(requesterId, query);
    const [totalItems, tickets] = await prisma.$transaction([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requestedPriority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: buildOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);
    return {
      items: tickets.map(serializeTicketListItem),
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
    if (error instanceof TicketApiError) {
      throw error;
    }
    throw new TicketApiError({
      statusCode: 500,
      code: "TICKET_LIST_FAILED",
      message: "Tickets could not be loaded.",
    });
  }
}
