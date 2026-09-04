import { describe, expect, it } from "vitest";
import {
  assertAllowedE2ESchema,
  assertSafeE2EEnvironment,
} from "../../../e2e/lab-02/e2e-environment.cjs";

const disposableDatabaseUrl = "postgresql://tester:secret@localhost:5432/toktickit_lab2_test?schema=public";

describe("Playwright E2E environment guard", () => {
  it("accepts a disposable database and an allowlisted schema", () => {
    expect(assertSafeE2EEnvironment({
      baseDatabaseUrl: disposableDatabaseUrl,
      schemaName: "toktickit_release_final",
    })).toMatchObject({
      databaseName: "toktickit_lab2_test",
      schemaName: "toktickit_release_final",
    });
  });

  it("rejects a database that is not explicitly a test database", () => {
    expect(() => assertSafeE2EEnvironment({
      baseDatabaseUrl: "postgresql://tester:secret@localhost:5432/toktickit",
      schemaName: "toktickit_e2e",
    })).toThrow(/ends with _test/);
  });

  it("rejects schemas outside the E2E allowlist", () => {
    expect(() => assertSafeE2EEnvironment({
      baseDatabaseUrl: disposableDatabaseUrl,
      schemaName: "public",
    })).toThrow(/allowlisted E2E schemas|one of/);
    expect(() => assertAllowedE2ESchema("production")).toThrow(/one of/);
  });

});
