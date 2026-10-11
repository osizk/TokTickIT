import { describe, expect, it } from "vitest";
import { parseTicketListQuery } from "../../src/ticket-list-service.js";
import { parseStaffQueueQuery } from "../../src/staff-queue-service.js";
import { completePriorityCounts, completeStatusCounts, createRecentWindow } from "../../src/dashboard-service.js";

describe("Lab 4 dashboard list predicates", () => {
  it("accepts all Ticket statuses and the active Requester group", () => {
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const) {
      expect(parseTicketListQuery({ status }).status).toBe(status);
    }
    expect(parseTicketListQuery({ statusGroup: "active" }).statusGroup).toBe("active");
  });

  it("validates paired inclusive UTC update bounds and rejects conflicting predicates", () => {
    const updatedSince = "2026-10-01T00:00:00.000Z";
    const updatedBefore = "2026-10-08T00:00:00.000Z";
    expect(parseTicketListQuery({ updatedSince, updatedBefore })).toMatchObject({ updatedSince: new Date(updatedSince), updatedBefore: new Date(updatedBefore) });
    expect(() => parseTicketListQuery({ updatedSince })).toThrow();
    expect(() => parseTicketListQuery({ updatedSince: updatedBefore, updatedBefore: updatedSince })).toThrow();
    expect(() => parseTicketListQuery({ status: "OPEN", statusGroup: "active" })).toThrow();
  });

  it("accepts Staff active/status/date/action-assignee filters and rejects non-me action scopes", () => {
    const query = parseStaffQueueQuery({ statusGroup: "active", actionAssignee: "me", updatedSince: "2026-10-01T00:00:00.000Z", updatedBefore: "2026-10-08T00:00:00.000Z" });
    expect(query).toMatchObject({ statusGroup: "active", actionAssignee: "me", updatedSince: new Date("2026-10-01T00:00:00.000Z"), updatedBefore: new Date("2026-10-08T00:00:00.000Z") });
    expect(() => parseStaffQueueQuery({ actionAssignee: "2" })).toThrow();
    expect(() => parseStaffQueueQuery({ status: "OPEN", statusGroup: "active" })).toThrow();
  });

  it("fills missing enum aggregates with zero and uses one exact seven-day UTC interval", () => {
    expect(completeStatusCounts([])).toEqual({ NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 });
    expect(completePriorityCounts([{ itPriority: "URGENT", _count: { _all: 2 } }])).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 2 });
    const generatedAt = new Date("2026-10-11T10:00:00.000Z");
    expect(createRecentWindow(generatedAt)).toEqual({ from: new Date("2026-10-04T10:00:00.000Z"), through: generatedAt });
  });
});
