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

export const TICKET_STATUS_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export type ResolutionGateReason =
  | "OWNER_REQUIRED"
  | "OWNER_INELIGIBLE"
  | "COMPLETED_ACTION_REQUIRED"
  | "UNFINISHED_ACTIONS"
  | "FOLLOW_UP_REQUIRED";

export interface ResolutionGateInput {
  status: TicketStatus;
  ownerPresent: boolean;
  ownerEligible: boolean;
  completedActions: Array<{ result: string | null; followUpRequired: boolean }>;
  unfinishedActionCount: number;
}

export interface ResolutionGate {
  canResolve: boolean;
  canClose: boolean;
  unmetConditions: ResolutionGateReason[];
}

export function isAllowedTicketTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_STATUS_TRANSITIONS[from].includes(to);
}

export function evaluateResolutionGate(input: ResolutionGateInput): ResolutionGate {
  const unmetConditions: ResolutionGateReason[] = [];
  if (!input.ownerPresent) unmetConditions.push("OWNER_REQUIRED");
  else if (!input.ownerEligible) unmetConditions.push("OWNER_INELIGIBLE");
  if (!input.completedActions.some((action) => (action.result?.trim().length ?? 0) >= 5)) {
    unmetConditions.push("COMPLETED_ACTION_REQUIRED");
  }
  if (input.unfinishedActionCount > 0) unmetConditions.push("UNFINISHED_ACTIONS");
  if (input.completedActions.some((action) => action.followUpRequired)) unmetConditions.push("FOLLOW_UP_REQUIRED");

  return {
    canResolve: unmetConditions.length === 0 && isAllowedTicketTransition(input.status, "RESOLVED"),
    canClose: unmetConditions.length === 0 && isAllowedTicketTransition(input.status, "CLOSED"),
    unmetConditions,
  };
}

export function allowedTicketTransitions(status: TicketStatus, gate: ResolutionGate): TicketStatus[] {
  return TICKET_STATUS_TRANSITIONS[status].filter((target) =>
    target === "RESOLVED" ? gate.canResolve : target === "CLOSED" ? gate.canClose : true,
  );
}
