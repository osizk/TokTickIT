import type { Request } from "express";
import type { ActionStatus, Prisma, TicketStatus } from "@prisma/client";

export const TICKET_STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
export const ACTIVE_ACTION_STATUSES: ActionStatus[] = ["OPEN", "IN_PROGRESS"];

export interface DashboardListPredicates {
  statusGroup?: "active";
  updatedSince?: Date;
  updatedBefore?: Date;
}

type ValidationError = (field: string, message: string) => Error;

function singleText(query: Request["query"], key: string, validationError: ValidationError): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw validationError(key, "This query parameter must be provided once as text.");
  return value;
}

function utcDate(value: string | undefined, field: string, validationError: ValidationError): Date | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw validationError(field, "Use an ISO UTC timestamp ending in Z.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 19) !== value.slice(0, 19)) {
    throw validationError(field, "Enter a valid ISO UTC timestamp.");
  }
  return date;
}

export function parseDashboardListPredicates(
  query: Request["query"],
  validationError: ValidationError,
): DashboardListPredicates {
  const rawGroup = singleText(query, "statusGroup", validationError);
  if (rawGroup !== undefined && rawGroup !== "active") {
    throw validationError("statusGroup", "Status group must be active.");
  }
  const updatedSince = utcDate(singleText(query, "updatedSince", validationError), "updatedSince", validationError);
  const updatedBefore = utcDate(singleText(query, "updatedBefore", validationError), "updatedBefore", validationError);
  if ((updatedSince === undefined) !== (updatedBefore === undefined)) {
    throw validationError(updatedSince ? "updatedBefore" : "updatedSince", "Provide both updatedSince and updatedBefore.");
  }
  if (updatedSince && updatedBefore && updatedSince > updatedBefore) {
    throw validationError("updatedSince", "updatedSince must not be later than updatedBefore.");
  }
  return {
    ...(rawGroup === "active" ? { statusGroup: "active" as const } : {}),
    ...(updatedSince ? { updatedSince } : {}),
    ...(updatedBefore ? { updatedBefore } : {}),
  };
}

export function applyDashboardListPredicates(
  where: Prisma.TicketWhereInput,
  predicates: DashboardListPredicates,
  forceActive = false,
): Prisma.TicketWhereInput {
  const AND: Prisma.TicketWhereInput[] = [];
  if (forceActive || predicates.statusGroup === "active") {
    AND.push({ status: { in: [...ACTIVE_TICKET_STATUSES] } });
  }
  if (predicates.updatedSince || predicates.updatedBefore) {
    AND.push({ updatedAt: { ...(predicates.updatedSince ? { gte: predicates.updatedSince } : {}), ...(predicates.updatedBefore ? { lte: predicates.updatedBefore } : {}) } });
  }
  return AND.length ? { ...where, AND } : where;
}
