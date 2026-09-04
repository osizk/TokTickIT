import { defineConfig } from "vitest/config";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  assertDisposableDatabaseUrl,
  readEnvFile,
}: typeof import("../e2e/lab-02/e2e-environment.cjs") = require("../e2e/lab-02/e2e-environment.cjs");

const testEnvPath = path.resolve(process.cwd(), ".env.test");
if (!fs.existsSync(testEnvPath)) {
  throw new Error(`Vitest requires ${testEnvPath}. Copy server/.env.test.example and use a disposable *_test database.`);
}

const testEnv = readEnvFile(testEnvPath);
const validatedDatabase = assertDisposableDatabaseUrl(testEnv.DATABASE_URL);
const protectedStorageRoot = path.resolve(process.cwd(), ".test-attachments");
const configuredStorage = path.resolve(process.cwd(), testEnv.ATTACHMENT_STORAGE_DIR?.trim() || ".test-attachments");
if (configuredStorage !== protectedStorageRoot && !configuredStorage.startsWith(`${protectedStorageRoot}${path.sep}`)) {
  throw new Error(`Vitest ATTACHMENT_STORAGE_DIR must be inside ${protectedStorageRoot}.`);
}

Object.assign(process.env, testEnv, {
  DATABASE_URL: validatedDatabase.baseDatabaseUrl,
  ATTACHMENT_STORAGE_DIR: configuredStorage,
});

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Lab 2 integration suites share the isolated PostgreSQL database and
    // temporary attachment-storage environment; run files sequentially so
    // row-count and filesystem-compensation assertions cannot race fixtures
    // created by another suite.
    fileParallelism: false,
  },
});
