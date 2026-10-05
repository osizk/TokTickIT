import type { ActionStatus, TicketStatus } from "@prisma/client";

const ACTION_TRANSITIONS: Readonly<Record<ActionStatus, readonly ActionStatus[]>> = {
  OPEN: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isAllowedActionTransition(from: ActionStatus, to: ActionStatus): boolean {
  return from === to || ACTION_TRANSITIONS[from].includes(to);
}

export function isTerminalActionStatus(status: ActionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function isTerminalTicketStatus(status: TicketStatus): boolean {
  return status === "RESOLVED" || status === "CLOSED" || status === "CANCELLED";
}

export function isActionTransitionBlockedByTicket(status: TicketStatus): boolean {
  return isTerminalTicketStatus(status);
}
