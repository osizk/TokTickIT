import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { createDashboardFixture } from "./dashboard-fixtures.js";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
let fixture: Awaited<ReturnType<typeof createDashboardFixture>>;
let requesterA: Awaited<ReturnType<typeof fixture.login>>;
let requesterB: Awaited<ReturnType<typeof fixture.login>>;
let requesterZero: Awaited<ReturnType<typeof fixture.login>>;
let staff: Awaited<ReturnType<typeof fixture.login>>;
let ownNumbers: string[];
let oldNumber: string;
let futureNumber: string;
let firstTicketTime: Date;
let otherNumber: string;

describe("Lab 4 Requester dashboard API", () => {
  beforeAll(async () => {
    fixture = await createDashboardFixture();
    ownNumbers = [];
    for (const status of statuses) {
      const updatedAt = new Date(Date.now() - 60_000);
      const ticket = await fixture.createTicket({ status, updatedAt });
      if (status === "NEW") firstTicketTime = updatedAt;
      ownNumbers.push(ticket.ticketNumber);
    }
    const oldTicket = await fixture.createTicket({ status: "OPEN", updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) });
    const futureTicket = await fixture.createTicket({ status: "OPEN", updatedAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const otherTicket = await fixture.createTicket({ requesterId: fixture.requesterB.id, status: "OPEN" });
    oldNumber = oldTicket.ticketNumber;
    futureNumber = futureTicket.ticketNumber;
    ownNumbers.push(oldTicket.ticketNumber, futureTicket.ticketNumber);
    otherNumber = otherTicket.ticketNumber;
    [requesterA, requesterB, requesterZero, staff] = await Promise.all([
      fixture.login(fixture.requesterUserA.email),
      fixture.login(fixture.requesterUserB.email),
      fixture.login(fixture.requesterUserC.email),
      fixture.login(fixture.staffA.email),
    ]);
  });

  afterAll(async () => fixture?.cleanup());

  it("returns owned aggregate counts and bounded recent/attention links", async () => {
    const response = await requesterA.get("/api/dashboard/requester");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      timezone: "Asia/Bangkok",
      metrics: { activeTicketCount: 7, waitingForRequesterCount: 1, resolvedCount: 1, closedCount: 1 },
    });
    expect(new Date(response.body.generatedAt).toISOString()).toBe(response.body.generatedAt);
    expect(new Date(response.body.recentWindow.through).getTime() - new Date(response.body.recentWindow.from).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(response.body.recentTickets).toHaveLength(5);
    expect(response.body.recentTickets).not.toContainEqual(expect.objectContaining({ ticketNumber: otherNumber }));
    expect(response.body.recentTickets).not.toContainEqual(expect.objectContaining({ ticketNumber: oldNumber }));
    expect(response.body.recentTickets).not.toContainEqual(expect.objectContaining({ ticketNumber: futureNumber }));
    expect(response.body.attentionTickets).toHaveLength(1);
    expect(response.body.attentionTickets[0].status).toBe("WAITING_FOR_REQUESTER");
    expect(response.body.recentTickets.some((item: { ticketNumber: string }) => ownNumbers.includes(item.ticketNumber))).toBe(true);
  });

  it("drills down through every status, active and inclusive recent bounds", async () => {
    for (const [index, status] of statuses.entries()) {
      const response = await requesterA.get("/api/tickets").query({ status, search: ownNumbers[index] });
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].status).toBe(status);
    }

    const active = await requesterA.get("/api/tickets").query({ statusGroup: "active" });
    expect(active.status).toBe(200);
    expect(active.body.pagination.totalItems).toBe(7);
    const dashboard = await requesterA.get("/api/dashboard/requester");
    expect(active.body.pagination.totalItems).toBe(dashboard.body.metrics.activeTicketCount);

    const now = new Date();
    const recent = await requesterA.get("/api/tickets").query({
      updatedSince: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedBefore: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(recent.status).toBe(200);
    expect(recent.body.pagination.totalItems).toBe(8);

    const exactBoundary = await requesterA.get("/api/tickets").query({
      search: ownNumbers[0],
      updatedSince: firstTicketTime.toISOString(),
      updatedBefore: firstTicketTime.toISOString(),
    });
    expect(exactBoundary.status).toBe(200);
    expect(exactBoundary.body.pagination.totalItems).toBe(1);

    const tiedAt = new Date(Date.now() - 120_000);
    const tiedFirst = await fixture.createTicket({ summary: "Dashboard stable tie fixture", updatedAt: tiedAt });
    const tiedSecond = await fixture.createTicket({ summary: "Dashboard stable tie fixture", updatedAt: tiedAt });
    const tied = await requesterA.get("/api/tickets").query({ search: "Dashboard stable tie fixture", sort: "updatedAt", order: "desc" });
    expect(tied.status).toBe(200);
    expect(tied.body.items.map((item: { id: number }) => item.id)).toEqual([tiedSecond.id, tiedFirst.id]);
  });

  it("uses the authenticated Requester identity and rejects unsupported dashboard/list query input", async () => {
    const other = await requesterB.get("/api/dashboard/requester");
    expect(other.status).toBe(200);
    expect(other.body.metrics).toMatchObject({ activeTicketCount: 1, waitingForRequesterCount: 0, resolvedCount: 0, closedCount: 0 });
    expect(other.body.recentTickets.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([otherNumber]);
    const empty = await requesterZero.get("/api/dashboard/requester");
    expect(empty.status).toBe(200);
    expect(empty.body.metrics).toEqual({ activeTicketCount: 0, waitingForRequesterCount: 0, resolvedCount: 0, closedCount: 0 });
    expect(empty.body.recentTickets).toEqual([]);
    expect(empty.body.attentionTickets).toEqual([]);

    expect((await requesterA.get("/api/dashboard/requester").query({ requesterId: fixture.requesterB.id })).status).toBe(400);
    expect((await requesterA.get("/api/tickets").query({ requesterId: fixture.requesterB.id })).status).toBe(400);
    expect((await requesterA.get("/api/tickets").query({ status: "OPEN", statusGroup: "active" })).status).toBe(400);
    expect((await requesterA.get("/api/tickets").query({ updatedSince: "2026-10-01T00:00:00.000Z" })).status).toBe(400);
  });

  it("requires a usable Requester session and rejects other roles", async () => {
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
    expect((await staff.get("/api/dashboard/requester")).status).toBe(403);
  });
});
