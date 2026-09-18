import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const authTestEmail = `lab3-auth-${process.pid}@example.test`;
const authTestPassword = "Initial-Lab3!Password";
let authTestUserId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  await prisma.user.deleteMany({ where: { email: authTestEmail } });
  const user = await prisma.user.create({
    data: {
      name: "Lab 3 Auth Test User",
      email: authTestEmail,
      passwordHash: await hashPassword(authTestPassword),
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: true,
    },
  });
  authTestUserId = user.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.session.deleteMany({ where: { userId: authTestUserId } });
  await prisma.user.deleteMany({ where: { id: authTestUserId } });
});

describe("Lab 3 authentication API safety contract", () => {
  it("rejects malformed login fields with structured validation errors", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fieldErrors: {
          email: "Enter a valid email address.",
          password: "Password is required.",
        },
      },
    });
  });

  it("returns the same safe unauthenticated response for current-user access", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: "SESSION_REQUIRED", message: "Authentication is required." },
    });
  });

  it("makes logout idempotent when no active session exists", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("toktickit_session=")]));
    expect(response.headers["set-cookie"][0]).toContain("Max-Age=0");
  });

  it("logs in an active User and returns safe role identity plus a CSRF token", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: `  ${authTestEmail.toUpperCase()} `,
      password: authTestPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: authTestUserId,
      name: "Lab 3 Auth Test User",
      email: authTestEmail,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("logs in the seeded Requester fixture with the local-only seed password", async () => {
    const seededPassword = process.env.LAB3_REQUESTER_INITIAL_PASSWORD;
    expect(seededPassword).toBeTruthy();
    const agent = request.agent(app);
    const response = await agent.post("/api/auth/login").send({ email: "amina@example.test", password: seededPassword });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email: "amina@example.test", role: "REQUESTER", isActive: true });
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect((await agent.post("/api/auth/logout").set("X-CSRF-Token", response.body.csrfToken)).status).toBe(204);
  });

  it("uses the same safe failure for an inactive User and an unknown email", async () => {
    const prisma = getPrisma();
    await prisma.user.update({ where: { id: authTestUserId }, data: { isActive: false } });
    const inactive = await request(app).post("/api/auth/login").send({ email: authTestEmail, password: authTestPassword });
    const unknown = await request(app).post("/api/auth/login").send({ email: "unknown-lab3@example.test", password: authTestPassword });
    await prisma.user.update({ where: { id: authTestUserId }, data: { isActive: true } });

    expect(inactive.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(inactive.body).toEqual(unknown.body);
  });
});
