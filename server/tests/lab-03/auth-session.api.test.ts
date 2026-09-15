import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const sessionTestEmail = `lab3-session-${process.pid}@example.test`;
const sessionInitialPassword = "Initial-Lab3!Password";
const sessionNewPassword = "Changed-Lab3!Password-2026";
const expiryTestEmail = `lab3-expiry-${process.pid}@example.test`;
const expiryTestPassword = "Expiry-Lab3!Password-2026";
let sessionTestUserId: number;
let expiryTestUserId: number;

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
    await prisma.user.deleteMany({ where: { email: expiryTestEmail } });
    const expiryUser = await prisma.user.create({
      data: {
        name: "Lab 3 Expiry Test User",
        email: expiryTestEmail,
        passwordHash: await hashPassword(expiryTestPassword),
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });
    expiryTestUserId = expiryUser.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: sessionTestUserId } });
    await prisma.user.deleteMany({ where: { id: sessionTestUserId } });
    await prisma.session.deleteMany({ where: { userId: expiryTestUserId } });
    await prisma.user.deleteMany({ where: { id: expiryTestUserId } });
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

  it("rejects an unsafe first-login request with a wrong CSRF token", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: sessionTestEmail, password: sessionInitialPassword });
    expect(login.status).toBe(200);

    const response = await agent
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", "wrong-csrf-token")
      .send({
        currentPassword: sessionInitialPassword,
        newPassword: sessionNewPassword,
        confirmPassword: sessionNewPassword,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: { code: "CSRF_INVALID", message: "The request could not be verified." },
    });
  });

  it("rejects idle-expired and absolute-expired sessions", async () => {
    const prisma = getPrisma();
    const idleLogin = await request(app).post("/api/auth/login").send({ email: expiryTestEmail, password: expiryTestPassword });
    expect(idleLogin.status).toBe(200);
    const idleCookie = idleLogin.headers["set-cookie"][0];
    const idleSession = await prisma.session.findFirstOrThrow({
      where: { userId: expiryTestUserId, revokedAt: null },
      orderBy: { id: "desc" },
    });
    await prisma.session.update({ where: { id: idleSession.id }, data: { idleExpiresAt: new Date(Date.now() - 1) } });
    expect((await request(app).get("/api/auth/me").set("Cookie", idleCookie)).status).toBe(401);

    const absoluteLogin = await request(app).post("/api/auth/login").send({ email: expiryTestEmail, password: expiryTestPassword });
    expect(absoluteLogin.status).toBe(200);
    const absoluteCookie = absoluteLogin.headers["set-cookie"][0];
    const absoluteSession = await prisma.session.findFirstOrThrow({
      where: { userId: expiryTestUserId, revokedAt: null },
      orderBy: { id: "desc" },
    });
    await prisma.session.update({ where: { id: absoluteSession.id }, data: { absoluteExpiresAt: new Date(Date.now() - 1) } });
    expect((await request(app).get("/api/auth/me").set("Cookie", absoluteCookie)).status).toBe(401);
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
