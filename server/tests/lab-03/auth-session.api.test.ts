import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const sessionTestEmail = `lab3-session-${process.pid}@example.test`;
const sessionInitialPassword = "Initial-Lab3!Password";
const sessionNewPassword = "Changed-Lab3!Password-2026";
let sessionTestUserId: number;

describe("Lab 3 authentication session gates", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await prisma.user.deleteMany({ where: { email: sessionTestEmail } });
    const user = await prisma.user.create({
      data: {
        name: "Lab 3 Session Test User",
        email: sessionTestEmail,
        passwordHash: await hashPassword(sessionInitialPassword),
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
      },
    });
    sessionTestUserId = user.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: sessionTestUserId } });
    await prisma.user.deleteMany({ where: { id: sessionTestUserId } });
  });

  it("does not allow password changes without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", "missing-session-token")
      .send({
        currentPassword: "Initial-Lab3!Password",
        newPassword: "New-Lab3!Password-2026",
        confirmPassword: "New-Lab3!Password-2026",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("SESSION_REQUIRED");
  });

  it("keeps repeated logout safe and idempotent", async () => {
    const first = await request(app).post("/api/auth/logout");
    const second = await request(app).post("/api/auth/logout");

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });

  it("changes the first-login password, rotates the session, and revokes the old session", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: sessionTestEmail, password: sessionInitialPassword });
    const initialCookie = login.headers["set-cookie"][0];
    const initialCsrf = login.body.csrfToken;

    const changed = await agent
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", initialCsrf)
      .send({
        currentPassword: sessionInitialPassword,
        newPassword: sessionNewPassword,
        confirmPassword: sessionNewPassword,
      });

    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.body.csrfToken).toEqual(expect.any(String));
    expect(changed.headers["set-cookie"][0]).not.toBe(initialCookie);

    const oldSession = await request(app).get("/api/auth/me").set("Cookie", initialCookie);
    expect(oldSession.status).toBe(401);

    const currentSession = await agent.get("/api/auth/me");
    expect(currentSession.status).toBe(200);
    expect(currentSession.body.user.id).toBe(sessionTestUserId);

    const logout = await agent.post("/api/auth/logout").set("X-CSRF-Token", currentSession.body.csrfToken);
    expect(logout.status).toBe(204);
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
  });
});
