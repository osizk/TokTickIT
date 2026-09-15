import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { AuthError, requireRole } from "../../src/auth-service.js";

describe("Lab 3 authorization safety contract", () => {
  it("rejects an unexpected credentialed request origin", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://untrusted.example")
      .send({ email: "amina@example.test", password: "wrong" });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: "ORIGIN_NOT_ALLOWED",
      message: "The request origin is not allowed.",
    });
  });

  it("provides one stable wrong-role error for protected handlers", () => {
    const context = { user: { role: "REQUESTER" } } as never;
    expect(() => requireRole(context, "IT_STAFF")).toThrowError(
      new AuthError(403, "FORBIDDEN", "You do not have permission to perform this action."),
    );
  });
});
