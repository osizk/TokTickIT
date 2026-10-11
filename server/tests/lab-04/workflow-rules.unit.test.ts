import { describe, expect, it } from "vitest";
import { evaluateResolutionGate, isAllowedActionTransition, isAllowedTicketTransition } from "../../src/workflow-rules.js";

describe("Lab 4 Action lifecycle rules", () => {
  it.each([
    ["OPEN", "IN_PROGRESS", true],
    ["OPEN", "COMPLETED", true],
    ["IN_PROGRESS", "COMPLETED", true],
    ["IN_PROGRESS", "CANCELLED", true],
    ["OPEN", "CANCELLED", true],
    ["COMPLETED", "IN_PROGRESS", false],
    ["COMPLETED", "CANCELLED", false],
    ["CANCELLED", "OPEN", false],
    ["CANCELLED", "COMPLETED", false],
    ["IN_PROGRESS", "OPEN", false],
  ] as const)("transition %s → %s is allowed: %s", (from, to, allowed) => {
    expect(isAllowedActionTransition(from, to)).toBe(allowed);
  });
  it("checks every Action status pair, including no-op saves", () => {
    const statuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
    const allowed = new Set([
      "OPEN->OPEN", "OPEN->IN_PROGRESS", "OPEN->COMPLETED", "OPEN->CANCELLED",
      "IN_PROGRESS->IN_PROGRESS", "IN_PROGRESS->COMPLETED", "IN_PROGRESS->CANCELLED",
      "COMPLETED->COMPLETED", "CANCELLED->CANCELLED",
    ]);
    for (const from of statuses) for (const to of statuses) {
      expect(isAllowedActionTransition(from, to)).toBe(allowed.has(`${from}->${to}`));
    }
  });
});

describe("Lab 4 Ticket workflow rules", () => {
  it.each([
    ["NEW", "OPEN", true], ["NEW", "CANCELLED", true],
    ["OPEN", "IN_PROGRESS", true], ["OPEN", "WAITING_FOR_REQUESTER", true], ["OPEN", "RESOLVED", true], ["OPEN", "CANCELLED", true],
    ["IN_PROGRESS", "WAITING_FOR_REQUESTER", true], ["IN_PROGRESS", "RESOLVED", true], ["IN_PROGRESS", "CANCELLED", true],
    ["WAITING_FOR_REQUESTER", "IN_PROGRESS", true], ["WAITING_FOR_REQUESTER", "RESOLVED", true], ["WAITING_FOR_REQUESTER", "CANCELLED", true],
    ["RESOLVED", "CLOSED", true], ["RESOLVED", "REOPENED", true], ["CLOSED", "REOPENED", true],
    ["REOPENED", "IN_PROGRESS", true], ["REOPENED", "WAITING_FOR_REQUESTER", true], ["REOPENED", "RESOLVED", true], ["REOPENED", "CANCELLED", true],
    ["CANCELLED", "OPEN", false], ["CLOSED", "RESOLVED", false], ["RESOLVED", "IN_PROGRESS", false], ["NEW", "CLOSED", false],
  ] as const)("transition %s → %s is allowed: %s", (from, to, allowed) => {
    expect(isAllowedTicketTransition(from, to)).toBe(allowed);
  });

  it("checks every Ticket status pair against the approved matrix", () => {
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
    const allowed = new Set([
      "NEW->OPEN", "NEW->CANCELLED",
      "OPEN->IN_PROGRESS", "OPEN->WAITING_FOR_REQUESTER", "OPEN->RESOLVED", "OPEN->CANCELLED",
      "IN_PROGRESS->WAITING_FOR_REQUESTER", "IN_PROGRESS->RESOLVED", "IN_PROGRESS->CANCELLED",
      "WAITING_FOR_REQUESTER->IN_PROGRESS", "WAITING_FOR_REQUESTER->RESOLVED", "WAITING_FOR_REQUESTER->CANCELLED",
      "RESOLVED->CLOSED", "RESOLVED->REOPENED", "CLOSED->REOPENED",
      "REOPENED->IN_PROGRESS", "REOPENED->WAITING_FOR_REQUESTER", "REOPENED->RESOLVED", "REOPENED->CANCELLED",
    ]);
    for (const from of statuses) for (const to of statuses) {
      expect(isAllowedTicketTransition(from, to)).toBe(allowed.has(`${from}->${to}`));
    }
  });

  it("reports every resolution-gate reason and permits the gate after all predicates pass", () => {
    const failed = evaluateResolutionGate({
      status: "OPEN",
      ownerPresent: false,
      ownerEligible: false,
      completedActions: [{ result: "done", followUpRequired: true }],
      unfinishedActionCount: 1,
    });
    expect(failed).toEqual({
      canResolve: false,
      canClose: false,
      unmetConditions: ["OWNER_REQUIRED", "COMPLETED_ACTION_REQUIRED", "UNFINISHED_ACTIONS", "FOLLOW_UP_REQUIRED"],
    });

    const satisfied = evaluateResolutionGate({
      status: "OPEN",
      ownerPresent: true,
      ownerEligible: true,
      completedActions: [{ result: "Verified and restored.", followUpRequired: false }],
      unfinishedActionCount: 0,
    });
    expect(satisfied).toEqual({ canResolve: true, canClose: false, unmetConditions: [] });
  });

  it("requires a valid completed result and keeps a legacy resolved Ticket reopenable", () => {
    expect(evaluateResolutionGate({
      status: "OPEN",
      ownerPresent: true,
      ownerEligible: true,
      completedActions: [{ result: "bad", followUpRequired: false }],
      unfinishedActionCount: 0,
    }).unmetConditions).toContain("COMPLETED_ACTION_REQUIRED");
    expect(isAllowedTicketTransition("RESOLVED", "REOPENED")).toBe(true);
  });
});
