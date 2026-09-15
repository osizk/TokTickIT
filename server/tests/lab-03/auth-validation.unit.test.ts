import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateUserName,
} from "../../src/auth-validation.js";
import { hashPassword, verifyPassword } from "../../src/auth-service.js";

describe("Lab 3 authentication validation", () => {
  it("normalizes email without changing the stored display value contract", () => {
    expect(normalizeEmail("  AMINA@EXAMPLE.TEST ")).toBe("amina@example.test");
    expect(validateEmail("amina@example.test")).toEqual({ ok: true, value: "amina@example.test" });
  });

  it("rejects invalid email and user-name boundaries", () => {
    expect(validateEmail("not-an-email")).toMatchObject({ ok: false });
    expect(validateUserName("A")).toMatchObject({ ok: false });
    expect(validateUserName("  Amina Rahman  ")).toEqual({ ok: true, value: "Amina Rahman" });
  });

  it("enforces the 12-128 character password policy", () => {
    expect(validatePassword("Initial-Lab3!Password")).toEqual({ ok: true });
    expect(validatePassword("short")).toMatchObject({ ok: false });
    expect(validatePassword("No-number-or-symbol")).toMatchObject({ ok: false });
    expect(validatePassword(" Leading-Lab3!Password")).toMatchObject({ ok: false });
    expect(validatePassword("Trailing-Lab3!Password ")).toMatchObject({ ok: false });
  });

  it("uses Argon2id for stored password hashes", async () => {
    const hash = await hashPassword("Initial-Lab3!Password");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "Initial-Lab3!Password")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });
});
