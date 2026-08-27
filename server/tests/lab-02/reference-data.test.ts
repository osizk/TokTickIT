import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as prismaModule from "../../src/prisma.js";

describe("Lab 2 reference-data APIs", () => {
  afterAll(async () => {
    await prismaModule.getPrisma().$disconnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only active categories in stable id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);
    expect(res.body.every((item: Record<string, unknown>) => Object.keys(item).sort().join(",") === "id,name")).toBe(true);
  });

  it("returns only active related systems in stable id/name order", async () => {
    const res = await request(app).get("/api/related-systems");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Campus Wi-Fi" },
      { id: expect.any(Number), name: "Employee Portal" },
      { id: expect.any(Number), name: "Email and Calendar" },
      { id: expect.any(Number), name: "File Storage" },
      { id: expect.any(Number), name: "Laptop Fleet" },
      { id: expect.any(Number), name: "Printing Services" },
      { id: expect.any(Number), name: "VPN Gateway" },
    ]);
  });

  it("returns only active requesters with safe public fields", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body).toEqual(
      expect.arrayContaining([
        { id: expect.any(Number), name: "Amina Rahman", email: "amina@example.test" },
        { id: expect.any(Number), name: "Ben Carter", email: "ben@example.test" },
        { id: expect.any(Number), name: "Chloe Nguyen", email: "chloe@example.test" },
        { id: expect.any(Number), name: "Davi Santos", email: "davi@example.test" },
      ]),
    );
    expect(res.body.every((item: Record<string, unknown>) => Object.keys(item).sort().join(",") === "email,id,name")).toBe(true);
  });

  it("keeps the one inactive seed requester out of the public response", async () => {
    const prisma = prismaModule.getPrisma();
    const total = await prisma.requester.count();
    const inactive = await prisma.requester.count({ where: { isActive: false } });
    const res = await request(app).get("/api/requesters");

    expect(total).toBe(5);
    expect(inactive).toBe(1);
    expect(res.body).toHaveLength(4);
  });

  it("returns a structured safe error when a reference query fails", async () => {
    const findMany = vi.fn().mockRejectedValue(new Error("database details must not escape"));
    vi.spyOn(prismaModule, "getPrisma").mockReturnValue({
      category: { findMany },
    } as never);

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: "REFERENCE_DATA_UNAVAILABLE",
        message: "Unable to load categories.",
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("database details");
  });
});
