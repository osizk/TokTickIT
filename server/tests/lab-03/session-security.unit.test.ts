import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_SESSION_MS,
  IDLE_SESSION_MS,
  assertCsrf,
  hashToken,
  loginAttemptKey,
  sessionCookie,
} from "../../src/auth-service.js";

describe("Lab 3 session security primitives", () => {
  it("uses the approved idle and absolute expiry windows", () => {
    expect(IDLE_SESSION_MS).toBe(30 * 60 * 1000);
    expect(ABSOLUTE_SESSION_MS).toBe(8 * 60 * 60 * 1000);
  });

  it("uses an HttpOnly SameSite cookie and never exposes the raw token in a rate key", () => {
    const cookie = sessionCookie("opaque-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(loginAttemptKey("amina@example.test", "127.0.0.1")).not.toContain("amina@example.test");
    expect(loginAttemptKey("amina@example.test", "127.0.0.1")).toBe(loginAttemptKey("amina@example.test", "127.0.0.1"));
  });

  it("accepts only the session-bound CSRF token", () => {
    const csrfToken = "csrf-value";
    const context = {
      session: { csrfTokenHash: hashToken(csrfToken) },
    } as never;
    const request = { header: (name: string) => name === "X-CSRF-Token" ? csrfToken : undefined } as never;
    expect(() => assertCsrf(context, request)).not.toThrow();
    const wrongRequest = { header: () => "wrong-token" } as never;
    expect(() => assertCsrf(context, wrongRequest)).toThrow();
  });
});
