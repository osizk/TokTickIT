import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { createDashboardFixture } from "./dashboard-fixtures.js";

let fixture: Awaited<ReturnType<typeof createDashboardFixture>>;
let staff: Awaited<ReturnType<typeof fixture.login>>;
let trackingQueries = false;
let queryCount = 0;

describe("Lab 4 dashboard performance smoke", () => {
  beforeAll(async () => {
    fixture = await createDashboardFixture();
    const prisma = fixture.prisma;
    const base = randomInt(0, 998_000);
    staff = await fixture.login(fixture.staffA.email);
    prisma.$on("query", () => { if (trackingQueries) queryCount += 1; });
  });

  afterAll(async () => fixture?.cleanup());

  it("keeps query count and payload bounded when the fixture doubles from 500/1,000 to 1,000/2,000", async () => {
    const queryCounts: number[] = [];
    const elapsedMs: number[] = [];
    for (const batch of [0, 500]) {
      const base = randomInt(0, 998_000);
      const ticketNumbers = Array.from({ length: 500 }, (_, index) => `TKT-2098-${String(base + index).padStart(6, "0")}`);
      await fixture.prisma.ticket.createMany({
        data: ticketNumbers.map((ticketNumber) => ({
          ticketNumber,
          requesterId: fixture.requesterA.id,
          categoryId: fixture.category.id,
          relatedSystemId: fixture.relatedSystem.id,
          requestedPriority: "MEDIUM",
          itPriority: "LOW",
          status: "OPEN",
          summary: "Bounded dashboard performance fixture",
          description: "A synthetic isolated Ticket used to verify response bounds.",
        })),
      });
      const tickets = await fixture.prisma.ticket.findMany({ where: { ticketNumber: { in: ticketNumbers } }, select: { id: true } });
      fixture.ticketIds.push(...tickets.map(({ id }) => id));
      await fixture.prisma.actionTaken.createMany({
        data: tickets.flatMap(({ id }) => [0, 1].map(() => ({
          ticketId: id,
          assigneeUserId: fixture.staffA.id,
          createdByUserId: fixture.staffA.id,
          description: "Bounded dashboard Action fixture.",
          status: "OPEN" as const,
          followUpRequired: false,
          clientRequestId: randomUUID(),
          requestFingerprint: randomBytes(32).toString("hex"),
        }))),
      });

      queryCount = 0;
      trackingQueries = true;
      const startedAt = Date.now();
      let response;
      try {
        response = await staff.get("/api/dashboard/staff");
      } finally {
        trackingQueries = false;
      }
      expect(response!.status).toBe(200);
      expect(response!.body.metrics.ticketsWithMyActiveActionsCount).toBe((batch / 500 + 1) * 500);
      expect(response!.body.myActions).toHaveLength(5);
      expect(response!.body.recentTickets).toHaveLength(5);
      expect(response!.body.urgentTickets.length).toBeLessThanOrEqual(5);
      expect(JSON.stringify(response!.body).length).toBeLessThan(40_000);
      queryCounts.push(queryCount);
      elapsedMs.push(Date.now() - startedAt);
    }
    console.info(`Dashboard smoke diagnostics: 500 Tickets/1,000 Actions=${queryCounts[0]} queries, ${elapsedMs[0]} ms; 1,000 Tickets/2,000 Actions=${queryCounts[1]} queries, ${elapsedMs[1]} ms.`);
    expect(queryCounts[0]).toBeGreaterThan(0);
    expect(queryCounts[1]).toBe(queryCounts[0]);
  });
});
