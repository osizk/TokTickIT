import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import type { Request } from "express";
import { getPrisma } from "./prisma.js";
import { TicketApiError } from "./ticket-service.js";
import { ACTIVE_ACTION_STATUSES, ACTIVE_TICKET_STATUSES, TICKET_STATUSES } from "./dashboard-query.js";
import { buildRequesterTicketWhere } from "./ticket-list-service.js";
import { buildStaffTicketWhere, type StaffQueueQuery } from "./staff-queue-service.js";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies readonly TicketPriority[];
const DASHBOARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DASHBOARD_TIMEZONE = "Asia/Bangkok" as const;
const TICKET_LINK_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  requestedPriority: true,
  itPriority: true,
  updatedAt: true,
} as const;

export function createRecentWindow(generatedAt: Date): { from: Date; through: Date } {
  return { from: new Date(generatedAt.getTime() - DASHBOARD_WINDOW_MS), through: generatedAt };
}

export function completeStatusCounts(
  groups: Array<{ status: TicketStatus; _count?: { _all?: number } | true }>,
): Record<TicketStatus, number> {
  const counts = Object.fromEntries(TICKET_STATUSES.map((status) => [status, 0])) as Record<TicketStatus, number>;
  for (const group of groups) counts[group.status] = typeof group._count === "object" ? group._count._all ?? 0 : 0;
  return counts;
}

export function completePriorityCounts(
  groups: Array<{ itPriority: TicketPriority; _count?: { _all?: number } | true }>,
): Record<TicketPriority, number> {
  const counts = Object.fromEntries(PRIORITIES.map((priority) => [priority, 0])) as Record<TicketPriority, number>;
  for (const group of groups) counts[group.itPriority] = typeof group._count === "object" ? group._count._all ?? 0 : 0;
  return counts;
}

function assertDashboardHasNoQuery(query: Request["query"]): void {
  const key = Object.keys(query)[0];
  if (key) {
    throw new TicketApiError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Dashboard endpoints do not accept query parameters.",
      fieldErrors: { [key]: "Remove this unsupported query parameter." },
    });
  }
}

function dashboardError(code: string, message: string): TicketApiError {
  return new TicketApiError({ statusCode: 500, code, message });
}

export async function getRequesterDashboard(requesterId: number, query: Request["query"]) {
  assertDashboardHasNoQuery(query);
  try {
    return await getPrisma().$transaction(async (tx) => {
      const requester = await tx.requester.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } });
      if (!requester) {
        throw new TicketApiError({ statusCode: 404, code: "REQUESTER_NOT_FOUND", message: "Development Requester was not found." });
      }

      const generatedAt = new Date();
      const recentWindow = createRecentWindow(generatedAt);
      const baseWhere: Prisma.TicketWhereInput = { requesterId };
      const activeWhere = buildRequesterTicketWhere(requesterId, { statusGroup: "active", sort: "updatedAt", order: "desc", page: 1, pageSize: 10 });
      const recentWhere = buildRequesterTicketWhere(requesterId, { updatedSince: recentWindow.from, updatedBefore: recentWindow.through, sort: "updatedAt", order: "desc", page: 1, pageSize: 10 });
      const [activeTicketCount, waitingForRequesterCount, resolvedCount, closedCount, recentTickets, attentionTickets] = await Promise.all([
        tx.ticket.count({ where: activeWhere }),
        tx.ticket.count({ where: { ...baseWhere, status: "WAITING_FOR_REQUESTER" } }),
        tx.ticket.count({ where: { ...baseWhere, status: "RESOLVED" } }),
        tx.ticket.count({ where: { ...baseWhere, status: "CLOSED" } }),
        tx.ticket.findMany({ where: recentWhere, select: TICKET_LINK_SELECT, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 }),
        tx.ticket.findMany({ where: { ...baseWhere, status: "WAITING_FOR_REQUESTER" }, select: TICKET_LINK_SELECT, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 }),
      ]);
      return {
        generatedAt,
        timezone: DASHBOARD_TIMEZONE,
        recentWindow,
        metrics: { activeTicketCount, waitingForRequesterCount, resolvedCount, closedCount },
        recentTickets,
        attentionTickets,
      };
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw dashboardError("REQUESTER_DASHBOARD_FAILED", "Requester dashboard could not be loaded.");
  }
}

export async function getStaffDashboard(userId: number, query: Request["query"]) {
  assertDashboardHasNoQuery(query);
  try {
    return await getPrisma().$transaction(async (tx) => {
      const generatedAt = new Date();
      const recentWindow = createRecentWindow(generatedAt);
      const activeWhere = { status: { in: ACTIVE_TICKET_STATUSES } } satisfies Prisma.TicketWhereInput;
      const recentWhere = { updatedAt: { gte: recentWindow.from, lte: recentWindow.through } } satisfies Prisma.TicketWhereInput;
      const myActionQuery: StaffQueueQuery = { sort: "updatedAt", order: "desc", page: 1, pageSize: 10, actionAssignee: "me" };
      const [
        unassignedActiveTicketCount,
        myOwnedActiveTicketCount,
        urgentActiveTicketCount,
        ticketsWithMyActiveActionsCount,
        statusGroups,
        priorityGroups,
        myActions,
        recentTickets,
        urgentTickets,
      ] = await Promise.all([
        tx.ticket.count({ where: { ...activeWhere, ticketOwnerId: null } }),
        tx.ticket.count({ where: { ...activeWhere, ticketOwnerId: userId } }),
        tx.ticket.count({ where: { ...activeWhere, itPriority: "URGENT" } }),
        tx.ticket.count({ where: buildStaffTicketWhere(userId, myActionQuery) }),
        tx.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
        tx.ticket.groupBy({ by: ["itPriority"], where: activeWhere, _count: { _all: true } }),
        tx.actionTaken.findMany({
          where: { assigneeUserId: userId, status: { in: ACTIVE_ACTION_STATUSES }, ticket: activeWhere },
          select: { id: true, description: true, status: true, updatedAt: true, ticket: { select: { ticketNumber: true, summary: true } } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 5,
        }),
        tx.ticket.findMany({
          where: recentWhere,
          select: { ...TICKET_LINK_SELECT, requester: { select: { id: true, name: true, email: true } }, ticketOwner: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 5,
        }),
        tx.ticket.findMany({
          where: { ...activeWhere, itPriority: "URGENT" },
          select: { ...TICKET_LINK_SELECT, requester: { select: { id: true, name: true, email: true } }, ticketOwner: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 5,
        }),
      ]);
      return {
        generatedAt,
        timezone: DASHBOARD_TIMEZONE,
        recentWindow,
        metrics: { unassignedActiveTicketCount, myOwnedActiveTicketCount, urgentActiveTicketCount, ticketsWithMyActiveActionsCount },
        statusCounts: completeStatusCounts(statusGroups),
        itPriorityCounts: completePriorityCounts(priorityGroups),
        myActions: myActions.map((action) => ({ id: action.id, ticketNumber: action.ticket.ticketNumber, ticketSummary: action.ticket.summary, description: action.description, status: action.status, updatedAt: action.updatedAt })),
        recentTickets,
        urgentTickets,
      };
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw dashboardError("STAFF_DASHBOARD_FAILED", "Staff dashboard could not be loaded.");
  }
}
