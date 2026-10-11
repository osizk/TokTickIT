import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { createDashboardFixture } from "./dashboard-fixtures.js";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
let fixture: Awaited<ReturnType<typeof createDashboardFixture>>;
let staff: ReturnType<typeof request.agent>;
let requester: ReturnType<typeof request.agent>;
let admin: ReturnType<typeof request.agent>;
let fixtureNumbers: string[];
let baseline: Awaited<ReturnType<typeof readDashboard>>;

async function readDashboard() {
  const response = await staff.get("/api/dashboard/staff");
  return response.body;
}

describe("Lab 4 Staff dashboard API", () => {
  beforeAll(async () => {
    fixture = await createDashboardFixture();
    staff = await fixture.login(fixture.staffA.email);
    requester = await fixture.login(fixture.requesterUserA.email);
    admin = await fixture.login(fixture.admin.email);
    baseline = await readDashboard();

    const overrides = [
      { status: "NEW", itPriority: "MEDIUM", ticketOwnerId: null },
      { status: "OPEN", itPriority: "LOW", ticketOwnerId: fixture.staffA.id },
      { status: "IN_PROGRESS", itPriority: "URGENT", ticketOwnerId: fixture.staffB.id },
      { status: "WAITING_FOR_REQUESTER", itPriority: "URGENT", ticketOwnerId: fixture.staffA.id },
      { status: "REOPENED", itPriority: "HIGH", ticketOwnerId: null },
      { status: "RESOLVED", itPriority: "HIGH", ticketOwnerId: fixture.staffA.id },
      { status: "CLOSED", itPriority: "LOW", ticketOwnerId: fixture.staffB.id },
      { status: "CANCELLED", itPriority: "MEDIUM", ticketOwnerId: null },
    ] as const;
    fixtureNumbers = [];
    const tickets = [];
    for (const item of overrides) {
      const ticket = await fixture.createTicket({ ...item, updatedAt: new Date(Date.now() - 30_000), summary: `Dashboard fixture ${item.status}` });
      tickets.push(ticket);
      fixtureNumbers.push(ticket.ticketNumber);
    }

    await Promise.all([
      fixture.createAction(tickets[2].id, fixture.staffA.id, "OPEN"),
      fixture.createAction(tickets[2].id, fixture.staffA.id, "IN_PROGRESS"),
      fixture.createAction(tickets[3].id, fixture.staffA.id, "OPEN"),
      fixture.createAction(tickets[1].id, fixture.staffA.id, "COMPLETED"),
      fixture.createAction(tickets[5].id, fixture.staffA.id, "OPEN"),
    ]);
  });

  afterAll(async () => fixture?.cleanup());

  it("aggregates all statuses, active IT priorities and distinct current-user Action Tickets", async () => {
    const response = await staff.get("/api/dashboard/staff");
    expect(response.status).toBe(200);
    expect(response.body.timezone).toBe("Asia/Bangkok");
    expect(response.body.metrics.unassignedActiveTicketCount - baseline.metrics.unassignedActiveTicketCount).toBe(2);
    expect(response.body.metrics.myOwnedActiveTicketCount - baseline.metrics.myOwnedActiveTicketCount).toBe(2);
    expect(response.body.metrics.urgentActiveTicketCount - baseline.metrics.urgentActiveTicketCount).toBe(2);
    expect(response.body.metrics.ticketsWithMyActiveActionsCount - baseline.metrics.ticketsWithMyActiveActionsCount).toBe(2);
    for (const status of statuses) expect(response.body.statusCounts[status] - baseline.statusCounts[status]).toBe(1);
    for (const [priority, delta] of Object.entries({ LOW: 1, MEDIUM: 1, HIGH: 1, URGENT: 2 })) {
      expect(response.body.itPriorityCounts[priority] - baseline.itPriorityCounts[priority]).toBe(delta);
    }
    expect(response.body.myActions).toHaveLength(3);
    expect(response.body.myActions.map((item: { ticketNumber: string }) => item.ticketNumber)).toContain(fixtureNumbers[2]);
    expect(response.body.recentTickets.length).toBeLessThanOrEqual(5);
    expect(response.body.urgentTickets.length).toBeLessThanOrEqual(5);
    expect(response.body.recentTickets.some((item: { ticketNumber: string }) => fixtureNumbers.includes(item.ticketNumber))).toBe(true);
  });

  it("keeps dashboard metrics consistent with active, owner, priority and Action-assignee drill-down totals", async () => {
    const search = fixture.requesterA.email;
    const getTotal = async (query: Record<string, string>) => {
      const response = await staff.get("/api/staff/tickets").query({ search, ...query });
      expect(response.status).toBe(200);
      return response.body.pagination.totalItems as number;
    };
    expect(await getTotal({ statusGroup: "active" })).toBe(5);
    expect(await getTotal({ statusGroup: "active", owner: "unassigned" })).toBe(2);
    expect(await getTotal({ statusGroup: "active", owner: "me" })).toBe(2);
    expect(await getTotal({ statusGroup: "active", itPriority: "URGENT" })).toBe(2);
    expect(await getTotal({ statusGroup: "active", actionAssignee: "me" })).toBe(2);
    for (const [priority, expectedCount] of Object.entries({ LOW: 1, MEDIUM: 1, HIGH: 1, URGENT: 2 })) {
      expect(await getTotal({ statusGroup: "active", itPriority: priority })).toBe(expectedCount);
    }
    for (const status of statuses) {
      const response = await staff.get("/api/staff/tickets").query({ search, status });
      expect(response.status).toBe(200);
      expect(response.body.pagination.totalItems).toBe(1);
      expect(response.body.items[0].status).toBe(status);
    }

    const recent = await staff.get("/api/staff/tickets").query({
      search,
      updatedSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedBefore: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(recent.status).toBe(200);
    expect(recent.body.pagination.totalItems).toBe(8);
  });

  it("allows Administrators, denies Requesters, and requires authentication", async () => {
    expect((await admin.get("/api/dashboard/staff")).status).toBe(200);
    expect((await requester.get("/api/dashboard/staff")).status).toBe(403);
    expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
  });

  it("rejects unsupported and conflicting Staff filters", async () => {
    expect((await staff.get("/api/staff/tickets").query({ status: "OPEN", statusGroup: "active" })).status).toBe(400);
    expect((await staff.get("/api/staff/tickets").query({ actionAssignee: "2" })).status).toBe(400);
    expect((await staff.get("/api/staff/tickets").query({ updatedBefore: "2026-10-01T00:00:00.000Z" })).status).toBe(400);
  });
});
