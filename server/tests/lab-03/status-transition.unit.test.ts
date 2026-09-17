import { describe, expect, it } from "vitest";
import { isAllowedStaffStatusTransition, STAFF_CONFIRMATION_STATUSES, STAFF_STATUS_TRANSITIONS } from "../../src/staff-queue-service.js";
import type { TicketStatus } from "@prisma/client";

describe("Lab 3 staff Ticket status contract", () => {
  it("allows exactly the approved transition matrix", () => {
    const expected: Record<TicketStatus, TicketStatus[]> = {
      NEW: ["OPEN", "CANCELLED"],
      OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      CANCELLED: [],
    };
    expect(STAFF_STATUS_TRANSITIONS).toEqual(expected);
    for (const from of Object.keys(expected) as TicketStatus[]) {
      for (const to of Object.keys(expected) as TicketStatus[]) {
        expect(isAllowedStaffStatusTransition(from, to)).toBe(expected[from].includes(to));
      }
    }
  });

  it("requires confirmation only for the contract's consequential targets", () => {
    expect([...STAFF_CONFIRMATION_STATUSES].sort()).toEqual(["CANCELLED", "CLOSED", "REOPENED", "RESOLVED"]);
  });
});
