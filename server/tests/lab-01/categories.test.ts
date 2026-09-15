import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginSeedRequester, restoreRequesterFirstLogin } from "../lab-03/requester-test-auth.js";

describe("GET /api/categories", () => {
  afterAll(async () => {
    const requester = await getPrisma().requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    await restoreRequesterFirstLogin(requester.id);
    await getPrisma().$disconnect();
  });

  it("returns the four seeded categories in id order", async () => {
    const { agent } = await loginSeedRequester();
    const res = await agent.get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);

    const ids = res.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
