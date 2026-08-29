import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv("test", process.cwd(), ""));

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
