import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const rateTestEmail = `lab3-rate-${process.pid}@example.test`;
const rateTestPassword = "Initial-Lab3!Password";
let rateTestUserId: number;

describe("Lab 3 login rate limiting", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await prisma.user.deleteMany({ where: { email: rateTestEmail } });
    const user = await prisma.user.create({
      data: {
        name: "Lab 3 Rate Test User",
        email: rateTestEmail,
        passwordHash: await hashPassword(rateTestPassword),
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });
    rateTestUserId = user.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: rateTestUserId } });
    await prisma.loginAttemptBucket.deleteMany();
    await prisma.user.deleteMany({ where: { id: rateTestUserId } });
  });

  it("blocks after five failed attempts and allows recovery after the bucket is cleared", async () => {
    const failures = [];
    for (let index = 0; index < 5; index += 1) {
      failures.push(await request(app).post("/api/auth/login").send({ email: rateTestEmail, password: "Wrong-Lab3!Password" }));
    }
    expect(failures.slice(0, 4).every((response) => response.status === 401)).toBe(true);
    expect(failures[4].status).toBe(429);

    const prisma = getPrisma();
    await prisma.loginAttemptBucket.deleteMany();
    const recovered = await request(app).post("/api/auth/login").send({ email: rateTestEmail, password: rateTestPassword });
    expect(recovered.status).toBe(200);
    expect(recovered.body.user.email).toBe(rateTestEmail);
  });
});
